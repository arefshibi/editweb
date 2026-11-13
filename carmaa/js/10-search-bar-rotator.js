"use strict";

/* ---------------------------------------------------------------
   HOME + PAGE SEARCH BAR ROTATOR — the rotating word in the collapsed search bar, plus the search-results rail scrolling/auto-scroll and live search logic.
// Edit the search bar's rotating placeholder or search-results rail here.
--------------------------------------------------------------- */

  /* ---------------------------------------------------------------
     HOME + INTERNAL-PAGE SEARCH BAR ROTATOR
     The static header/home search boxes (the closed, tappable bars
     that open the search overlay) show the exact same rotating
     "جستجو خودرو بر اساس [برند/مدل/سال/شهر]" copy as the overlay itself —
     same word list, same 3s cadence, same slide/fade transition —
     just layered over the closed bar instead of the opened overlay,
     and without touching the bar's own background/border/sizing.
  --------------------------------------------------------------- */
  const BAR_SEARCH_ROTATOR_IDS = ["toolSearchRotator", "homeSearchRotator"];

  function buildBarSearchRotator(id) {
    const rotator = typeof id === "string" ? document.getElementById(id) : id; /* CM-ROT-FIX: id یا خود المنت */
    if (!rotator) return;
    rotator.innerHTML = "";
    const activeIndex = Number.isInteger(barSearchRotatorIndex) ? barSearchRotatorIndex : 0;
    SEARCH_OVERLAY_TERMS.forEach((term, index) => {
      const node = document.createElement("span");
      node.className = `word${index === activeIndex ? " active" : ""}`;
      node.textContent = term;
      rotator.appendChild(node);
    });
  }

  function advanceBarSearchRotators() {
    const prevIndex = barSearchRotatorIndex;
    barSearchRotatorIndex = (barSearchRotatorIndex + 1) % SEARCH_OVERLAY_TERMS.length;
    BAR_SEARCH_ROTATOR_IDS.forEach((id) => {
      const rotator = document.getElementById(id);
      if (!rotator) return;
      const words = [...rotator.children];
      if (!words.length) { buildBarSearchRotator(id); return; } /* CM-ROT-FIX: خودترمیمی اگه خالی بود */
      const current = words[prevIndex];
      const next = words[barSearchRotatorIndex];
      if (!current || !next) return;
      current.classList.remove("active");
      current.classList.add("exit");
      next.classList.remove("exit");
      next.classList.add("active");
      setTimeout(() => current.classList.remove("exit"), 480);
    });
  }

  function startBarSearchRotators() {
    barSearchRotatorIndex = 0;
    BAR_SEARCH_ROTATOR_IDS.forEach(buildBarSearchRotator);
    if (barSearchRotatorTimer) clearInterval(barSearchRotatorTimer);
    barSearchRotatorTimer = setInterval(advanceBarSearchRotators, 3000);
  }

  function primeRailScroll(rail) {
    // FIX: on some mobile engines (notably iOS Safari / WebKit), a
    // horizontally-scrollable container that was just populated /
    // revealed doesn't get a real "scroll node" until it receives an
    // actual user touch — so the very first programmatic scrollBy()
    // silently does nothing, and cards only start auto-scrolling after
    // the user has dragged the rail by hand once. Nudging scrollLeft by
    // 1px and back immediately forces the browser to register the
    // element as an active scroll surface before the timer-driven
    // auto-scroll ever calls scrollBy() on it.
    if (!rail) return;
    const original = rail.scrollLeft;
    rail.scrollLeft = original + 1;
    rail.scrollLeft = original;
  }

  function scrollCardIntoRail(rail, card, insetHalfGap, instant) {
    if (!rail || !card) return;
    // FIX: scrollIntoView() bubbles up to *all* scrollable ancestors, not
    // just this horizontal rail — with the on-screen keyboard open the
    // shrunken visual viewport made the browser think the card needed a
    // vertical scroll too, so the whole page jumped up mid-search. Using
    // getBoundingClientRect() to compute a pure pixel delta and passing it
    // to scrollBy() only moves the rail itself, and (unlike scrollLeft)
    // the delta is a real rendered-pixel offset, so it's correct under
    // RTL regardless of which scrollLeft convention the browser uses.
    //
    // FIX: the rail reads right-to-left (first card sits at the right
    // edge, later cards further left), so the "start" edge to align a
    // freshly-scrolled-to card against is its RIGHT edge, not its left.
    // Aligning by the left edge left a sliver of the previous card
    // peeking out on the right after every auto-scroll. When insetHalfGap
    // is set (every advance except the very first card, which has no
    // previous card to hide), the target lands the viewport's cut line in
    // the middle of the gap between the previous card and this one, so
    // nothing of the previous card is ever left showing.
    const railRect = rail.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const padRight = parseFloat(getComputedStyle(rail).paddingRight) || 0;
    const gap = insetHalfGap ? (parseFloat(getComputedStyle(rail).columnGap || getComputedStyle(rail).gap) || 0) : 0;
    const targetRight = railRect.right - padRight - gap / 2;
    const delta = cardRect.right - targetRight;
    if (Math.abs(delta) < 1) return;
    rail.scrollBy({ left: delta, behavior: instant ? "instant" : "smooth" });
  }

  function stopSearchOverlayAutoScroll() {
    searchOverlayRailIndex = 0;
  }

  function startSearchOverlayAutoScroll() {
    stopSearchOverlayAutoScroll();
    const rail = document.getElementById("searchOverlayRail");
    if (!rail) return;
    if (!rail.dataset.pauseBound) {
      rail.dataset.pauseBound = "1";
      ["pointerdown", "touchstart", "wheel"].forEach((eventName) => {
        rail.addEventListener(eventName, () => { searchOverlayPauseUntil = Date.now() + 1800; }, { passive: true });
      });
    }
    // Movement is now driven entirely by the shared word/card cycle
    // (see startSearchOverlayCycle) so the rail advances in lockstep with
    // the rotating word instead of running on its own schedule.
  }

  /* PERF (search overlay): the old version re-filtered + re-sorted every
     listing on each keystroke, rebuilt 24 full-size cards, and showed a fake
     650ms skeleton before every result. Now:
       - a normalized search index (built once, refreshed every 20s),
       - Persian/Arabic-aware matching (ی/ي, ک/ك, digits, ZWNJ),
       - results cached per query,
       - only the first cards render at once, the rest are appended in idle time,
       - thumbnails (not 1200px originals) and no per-card entrance animation. */
  const SO_FIRST_BATCH = 6;
  const SO_MAX_TOTAL = 24;
  const SO_INDEX_TTL = 20000;
  let soIndex = null, soIndexSrc = null, soIndexLen = -1, soIndexAt = 0, soVersion = 0;
  const soCache = new Map();
  let soRenderToken = 0;

  function soNormalize(str) {
    return String(str == null ? "" : str)
      .toLowerCase()
      .replace(/[\u064A\u0649]/g, "\u06CC")
      .replace(/\u0643/g, "\u06A9")
      .replace(/[\u064B-\u065F\u200C\u200D\u0640]/g, "")
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/\s+/g, " ")
      .trim();
  }

  function getSearchOverlayIndex() {
    const now = Date.now();
    if (soIndex && soIndexSrc === LISTINGS && soIndexLen === LISTINGS.length && now - soIndexAt < SO_INDEX_TTL) return soIndex;
    soIndex = LISTINGS.map((l) => ({
      l,
      hay: soNormalize(`${l.title} ${l.brand} ${vehicleModelName(l)} ${DEALERS[l.brand] ? DEALERS[l.brand].city : ""}`),
      views: getListingStats(l.id).views
    })).sort((a, b) => b.views - a.views);
    soIndexSrc = LISTINGS; soIndexLen = LISTINGS.length; soIndexAt = now;
    soVersion++; soCache.clear();
    return soIndex;
  }

  function getSearchOverlayMatches(query) {
    const index = getSearchOverlayIndex();
    const q = soNormalize(query);
    if (!q) return index.map((e) => e.l);
    const tokens = q.split(" ");
    const out = [];
    for (let i = 0; i < index.length; i++) {
      const hay = index[i].hay;
      let ok = true;
      for (let t = 0; t < tokens.length; t++) { if (hay.indexOf(tokens[t]) === -1) { ok = false; break; } }
      if (ok) out.push(index[i].l);
    }
    return out;
  }

  function soCardsHTML(list) {
    return list.map((l) => renderListingCard(l, 0, { thumb: true })).join("");
  }

  function renderSearchOverlayRail() {
    const rail = document.getElementById("searchOverlayRail");
    if (!rail) return;
    const token = ++soRenderToken;
    const q = soNormalize(state.searchOverlayQuery);
    const results = document.getElementById("searchOverlayResults");
    if (!q) {
      stopSearchOverlayAutoScroll();
      rail.replaceChildren();
      if (results) results.classList.add("is-hidden");
      return;
    }
    if (results) results.classList.remove("is-hidden");
    let entry = (getSearchOverlayIndex(), soCache.get(q));
    if (!entry) {
      const matches = getSearchOverlayMatches(q).slice(0, SO_MAX_TOTAL);
      entry = { matches, empty: !matches.length };
      if (soCache.size > 40) soCache.clear();
      soCache.set(q, entry);
    }
    if (entry.empty) {
      rail.innerHTML = '<div class="search-overlay-empty"><div class="search-overlay-empty-title">نتیجه‌ای یافت نشد</div><div class="search-overlay-empty-sub">عبارت دیگری را امتحان کنید</div></div>';
      return;
    }
    const first = entry.matches.slice(0, SO_FIRST_BATCH);
    const rest = entry.matches.slice(SO_FIRST_BATCH);
    rail.innerHTML = soCardsHTML(first);
    primeRailScroll(rail);
    scrollCardIntoRail(rail, rail.querySelector(".card-fade-in"), false, true);
    startSearchOverlayAutoScroll();
    if (!rest.length) return;
    // Append the remaining cards in small idle chunks (they land off-screen
    // at the end of the rail, so nothing visible shifts).
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 60));
    let at = 0;
    const pump = () => {
      if (token !== soRenderToken) return;
      const chunk = rest.slice(at, at + 6);
      if (!chunk.length) return;
      rail.insertAdjacentHTML("beforeend", soCardsHTML(chunk));
      at += 6;
      if (at < rest.length) idle(pump);
    };
    idle(pump);
  }

  function updateSearchOverlaySkeletonVisibility(visible) {
    const loading = document.getElementById("searchOverlayLoading");
    const results = document.getElementById("searchOverlayResults");
    if (loading) { loading.classList.toggle("is-visible", visible); loading.setAttribute("aria-hidden", String(!visible)); }
    if (results) results.classList.toggle("is-hidden", visible);
  }

  // Search is local + cached, so results are rendered right away (short
  // debounce only to coalesce fast typing). No artificial skeleton delay.
  function runSearchOverlaySearch() {
    clearTimeout(searchOverlayDebounce);
    clearTimeout(searchOverlayLoadingTimer);
    stopSearchOverlayAutoScroll();
    updateSearchOverlaySkeletonVisibility(false);
    if (state.searchOverlayQuery.trim().length === 0) {
      const rail = document.getElementById("searchOverlayRail");
      const results = document.getElementById("searchOverlayResults");
      if (rail) rail.replaceChildren();
      if (results) results.classList.add("is-hidden");
      return;
    }
    const results = document.getElementById("searchOverlayResults");
    if (results) results.classList.remove("is-hidden");
    searchOverlayDebounce = setTimeout(renderSearchOverlayRail, 80);
  }

  function updateSearchOverlay() {
    const overlay = document.getElementById("searchOverlay");
    const shell = document.querySelector(".search-overlay-shell");
    const input = document.getElementById("searchOverlayInput");
    const clearBtn = document.querySelector(".search-overlay-clear");
    if (!overlay) return;
    const open = state.searchOverlayOpen;
    if (open) {
      document.documentElement.classList.add("search-overlay-active");
      document.body.classList.add("search-overlay-active");
      overlay.hidden = false;
      requestAnimationFrame(() => overlay.classList.add("is-open"));
    } else {
      overlay.classList.remove("is-open");
      if (input && document.activeElement === input) input.blur();
    }
    if (input && input.value !== state.searchOverlayQuery) input.value = state.searchOverlayQuery;
    const hasValue = state.searchOverlayQuery.trim().length > 0;
    if (shell) shell.classList.toggle("has-value", hasValue);
    if (clearBtn) clearBtn.setAttribute("aria-label", hasValue ? "پاک کردن جستجو" : "بستن جستجو");
  }

  let searchOverlayHideTimer = null;
  function closeSearchOverlayFully() {
    stopSearchOverlayRotator();
    stopSearchOverlayAutoScroll();
    clearTimeout(searchOverlayDebounce);
    clearTimeout(searchOverlayLoadingTimer);
    clearTimeout(searchOverlayHideTimer);
    searchOverlayHideTimer = setTimeout(() => {
      if (state.searchOverlayOpen) return;
      const overlay = document.getElementById("searchOverlay");
      if (overlay) overlay.hidden = true;
      document.documentElement.classList.remove("search-overlay-active");
      document.body.classList.remove("search-overlay-active");
    }, 280);
  }

