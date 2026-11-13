"use strict";

/* ---------------------------------------------------------------
   LONG-PRESS "PEEK" PREVIEW + APP BOOTSTRAP — the (currently disabled) long-press card preview, vehicle-gallery swipe handling, and the DOMContentLoaded startup code that kicks off the app.
// Edit swipe gestures or app startup/bootstrap here.
--------------------------------------------------------------- */

  /* ---------------------------------------------------------------
     LONG-PRESS "PEEK" PREVIEW for two-column listing grids.
     Hold a card: the rest of the screen blurs, the held card stays
     sharp, and its row-mate's exact spot turns into a plain,
     unboxed list of that vehicle's specs — no card/box chrome.
  --------------------------------------------------------------- */
  function initPeekPreview() {
    const HOLD_MS = 420;
    const MOVE_TOLERANCE = 12;
    const ROW_TOLERANCE = 6; // px — how close two cards' tops must be to count as "same row"

    const scrim = document.createElement("div");
    scrim.id = "peekScrim";
    document.body.appendChild(scrim);

    const panel = document.createElement("div");
    panel.id = "peekInfoPanel";
    panel.innerHTML =
      '<div class="peek-name" data-slot="title"></div>' +
      '<div class="peek-row"><span class="peek-label">قیمت</span><span class="peek-value peek-price" data-slot="price"></span></div>' +
      '<div class="peek-row"><span class="peek-label">کارکرد</span><span class="peek-value" data-slot="miles"></span></div>' +
      '<div class="peek-row"><span class="peek-label">وضعیت رنگ</span><span class="peek-value" data-slot="paint"></span></div>' +
      '<div class="peek-row"><span class="peek-label">برند</span><span class="peek-value" data-slot="brand"></span></div>' +
      '<button type="button" class="peek-cta" data-slot="cta">مشاهده آگهی ←</button>';
    document.body.appendChild(panel);

    let pressTimer = null;
    let startX = 0, startY = 0;
    let activePointerId = null;
    let activeCard = null;
    let neighborCard = null;
    let blurredEls = [];
    let peeking = false;
    let suppressNextClick = null; // the card whose post-longpress click should be swallowed once

    function findCard(target) {
      return target.closest && target.closest(".card-fade-in[data-id]");
    }

    function isInPeekGrid(card) {
      // Only 2-column card grids opt in — horizontal rails and single-column
      // lists (e.g. "my listings") keep their normal tap-to-open behaviour.
      const parent = card.parentElement;
      return !!(parent && parent.classList.contains("grid") && parent.classList.contains("grid-cols-2"));
    }

    function clearBlur() {
      blurredEls.forEach((el) => el.classList.remove("peek-blur-sibling", "peek-taken-over"));
      blurredEls = [];
    }

    // Walk from the pressed card up to #appViewport, blurring every
    // sibling at each level (but never the ancestor chain itself, since a
    // filter on an ancestor would blur the card too). The immediate
    // row-mate gets hidden instead of blurred, making room for the panel.
    function applySpotlight(card, neighbor) {
      const root = document.getElementById("appViewport") || document.body;
      let node = card;
      while (node && node !== root) {
        const parent = node.parentElement;
        if (!parent) break;
        Array.from(parent.children).forEach((sib) => {
          if (sib === node) return;
          if (sib === neighbor) {
            sib.classList.add("peek-taken-over");
          } else {
            sib.classList.add("peek-blur-sibling");
          }
          blurredEls.push(sib);
        });
        node = parent;
      }
    }

    function cancelPress() {
      clearTimeout(pressTimer);
      pressTimer = null;
      if (activeCard) activeCard.classList.remove("peek-pressing");
    }

    function startPress(card) {
      if (peeking) return;
      activeCard = card;
      card.classList.add("peek-pressing");
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => openPeek(card), HOLD_MS);
    }

    function openPeek(card) {
      const heldLongEnough = pressTimer !== null;
      cancelPress();
      if (!heldLongEnough || !isInPeekGrid(card)) return;

      const id = card.getAttribute("data-id");
      const listing = LISTINGS.find((l) => l.id === id);
      if (!listing) return;

      const siblings = Array.from(card.parentElement.children);
      const idx = siblings.indexOf(card);
      const neighbor = siblings[idx + 1] || siblings[idx - 1];
      if (!neighbor) return;

      const rect = card.getBoundingClientRect();
      const nRect = neighbor.getBoundingClientRect();
      if (Math.abs(nRect.top - rect.top) > ROW_TOLERANCE) return; // not actually side-by-side

      panel.style.left = nRect.left + "px";
      panel.style.top = nRect.top + "px";
      panel.style.width = nRect.width + "px";
      panel.style.height = nRect.height + "px";
      panel.querySelector('[data-slot="title"]').textContent = listingDisplayTitle(listing);
      panel.querySelector('[data-slot="price"]').textContent = listing.price;
      panel.querySelector('[data-slot="miles"]').textContent = milesToKmLabel(listing.miles);
      panel.querySelector('[data-slot="paint"]').textContent = paintedPartsLabel(listing);
      panel.querySelector('[data-slot="brand"]').textContent = listing.brand || "—";

      neighborCard = neighbor;
      peeking = true;
      card.classList.add("peek-active-card");
      applySpotlight(card, neighbor);
      document.body.classList.add("is-peeking");
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
      requestAnimationFrame(() => panel.classList.add("show"));
      suppressNextClick = card;
    }

    function closePeek() {
      if (!peeking) return;
      peeking = false;
      document.body.classList.remove("is-peeking");
      panel.classList.remove("show", "peek-resisting");
      if (scrollGuardTimer) { clearTimeout(scrollGuardTimer); scrollGuardTimer = null; }
      scrollTouchStartY = null; scrollTouchStartX = null;
      clearBlur();
      if (activeCard) activeCard.classList.remove("peek-active-card", "peek-pressing", "peek-resisting");
      activeCard = null;
      neighborCard = null;
    }

    // Scrolling while the peek is open used to leave the (fixed-position)
    // panel behind while the real page moved underneath it. Now any scroll
    // attempt gets a brief moment of resistance (the card/panel visibly
    // tense up) and then the peek lets go and closes, instead of letting
    // the page and the panel drift out of sync.
    let scrollGuardTimer = null;
    let scrollTouchStartY = null;
    let scrollTouchStartX = null;
    const SCROLL_INTENT_PX = 10;
    const SCROLL_RESIST_MS = 170;

    function beginScrollResist() {
      if (scrollGuardTimer) return;
      if (activeCard) activeCard.classList.add("peek-resisting");
      panel.classList.add("peek-resisting");
      scrollGuardTimer = setTimeout(() => {
        scrollGuardTimer = null;
        closePeek();
      }, SCROLL_RESIST_MS);
    }

    document.addEventListener("touchstart", (e) => {
      if (!peeking) return;
      const t = e.touches[0];
      scrollTouchStartY = t.clientY;
      scrollTouchStartX = t.clientX;
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
      if (!peeking || scrollTouchStartY === null) return;
      const t = e.touches[0];
      const dy = Math.abs(t.clientY - scrollTouchStartY);
      const dx = Math.abs(t.clientX - scrollTouchStartX);
      if (dy > SCROLL_INTENT_PX || dx > SCROLL_INTENT_PX) {
        e.preventDefault(); // resist — hold the page still for a beat
        beginScrollResist();
      }
    }, { passive: false });

    document.addEventListener("touchend", () => { scrollTouchStartY = null; scrollTouchStartX = null; }, { passive: true });
    document.addEventListener("touchcancel", () => { scrollTouchStartY = null; scrollTouchStartX = null; }, { passive: true });

    document.addEventListener("wheel", (e) => {
      if (!peeking) return;
      e.preventDefault();
      beginScrollResist();
    }, { passive: false });

    document.addEventListener("contextmenu", (e) => { if (findCard(e.target)) e.preventDefault(); });
    document.addEventListener("selectstart", (e) => { if (findCard(e.target)) e.preventDefault(); });
    document.addEventListener("dragstart", (e) => { if (findCard(e.target)) e.preventDefault(); });

    document.addEventListener("pointerdown", (e) => {
      if (peeking) return;
      const card = findCard(e.target);
      if (!card || !isInPeekGrid(card)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      activePointerId = e.pointerId;
      startX = e.clientX; startY = e.clientY;
      try { card.setPointerCapture(e.pointerId); } catch (_) {}
      startPress(card);
    });

    document.addEventListener("pointermove", (e) => {
      if (e.pointerId !== activePointerId || !pressTimer) return;
      const dx = Math.abs(e.clientX - startX), dy = Math.abs(e.clientY - startY);
      if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) cancelPress();
    });

    function endPress(e) {
      if (e.pointerId !== undefined && e.pointerId !== activePointerId) return;
      cancelPress();
      activePointerId = null;
    }
    document.addEventListener("pointerup", endPress);
    document.addEventListener("pointercancel", endPress);

    // Capture phase, ahead of the app's own bubble-phase click delegator:
    // swallow the one click a browser fires right after a long-press
    // release (so lifting your finger doesn't also navigate into the ad),
    // and close the peek before any other click is allowed to act (e.g.
    // deliberately tapping the still-elevated active card to navigate).
    document.addEventListener("click", (e) => {
      if (suppressNextClick) {
        const card = findCard(e.target);
        const wasSuppressed = card === suppressNextClick;
        suppressNextClick = null;
        if (wasSuppressed) { e.preventDefault(); e.stopPropagation(); return; }
      }
      if (peeking) closePeek();
    }, true);

    scrim.addEventListener("pointerup", closePeek);
    panel.addEventListener("pointerup", (e) => e.stopPropagation());
    panel.querySelector('[data-slot="cta"]').addEventListener("pointerup", (e) => {
      e.stopPropagation();
      const card = activeCard;
      closePeek();
      const trigger = card && card.querySelector('[data-action="goVehicle"]');
      if (trigger) trigger.click();
    });

    window.addEventListener("resize", () => { if (peeking) closePeek(); });
  }

  function initVehicleGallerySwipe() {
    let startX = null;
    let startY = null;
    let tracking = false;
    let horizontal = false;

    document.addEventListener("touchstart", (e) => {
      if (state.route.page !== "vehicle" || !state.route.listing) return;
      const target = e.target;
      if (!target.closest("[data-page=\"vehicle\"] .detail-hero-main")) return;
      if (target.closest("button, a")) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
      horizontal = false;
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
      if (!tracking || startX === null || startY === null) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        horizontal = Math.abs(dx) > Math.abs(dy);
      }
      // The hero photo is now a normal (non-sticky) block in the page flow,
      // so only a horizontal drag (photo swipe) should be intercepted here —
      // a vertical drag must be left alone to scroll the page normally.
      if (horizontal) e.preventDefault();
    }, { passive: false });

    document.addEventListener("touchend", (e) => {
      if (!tracking || startX === null || startY === null) return;
      const t = e.changedTouches && e.changedTouches[0];
      const dx = t ? t.clientX - startX : 0;
      const dy = t ? t.clientY - startY : 0;
      const threshold = 46;
      const total = vehiclePhotoCount(state.route.listing);
      if (horizontal && Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.15 && total > 1) {
        const next = dx < 0
          ? (state.thumb + 1) % total
          : (state.thumb - 1 + total) % total;
        state = { ...state, thumb: next };
        updateVehiclePhoto();
        if (navigator.vibrate) { try { navigator.vibrate(8); } catch (_) {} }
      }
      startX = null;
      startY = null;
      tracking = false;
      horizontal = false;
    }, { passive: true });

    document.addEventListener("touchcancel", () => {
      startX = null;
      startY = null;
      tracking = false;
      horizontal = false;
    }, { passive: true });
  }

  // Same left/right swipe-to-change-photo gesture as initVehicleGallerySwipe
  // above, but scoped to the fullscreen photo viewer's stage instead of the
  // in-page hero photo. Kept as a separate listener since the viewer is a
  // permanent element in the DOM (shown/hidden via state.photoViewerOpen)
  // rather than something re-rendered per navigation.
  function initPhotoViewerSwipe() {
    let startX = null;
    let startY = null;
    let tracking = false;
    let horizontal = false;

    document.addEventListener("touchstart", (e) => {
      if (!state.photoViewerOpen) return;
      if (!e.target.closest("#photoViewerStage")) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
      horizontal = false;
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
      if (!tracking || startX === null || startY === null) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        horizontal = Math.abs(dx) > Math.abs(dy);
      }
      if (horizontal) e.preventDefault();
    }, { passive: false });

    document.addEventListener("touchend", (e) => {
      if (!tracking || startX === null || startY === null) return;
      const t = e.changedTouches && e.changedTouches[0];
      const dx = t ? t.clientX - startX : 0;
      const dy = t ? t.clientY - startY : 0;
      const threshold = 46;
      if (state.photoViewerOpen && state.route.page === "vehicle" && state.route.listing) {
        const total = vehiclePhotoCount(state.route.listing);
        if (horizontal && Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.15 && total > 1) {
          const next = dx < 0
            ? (state.thumb + 1) % total
            : (state.thumb - 1 + total) % total;
          state = { ...state, thumb: next };
          updateVehiclePhoto();
          if (navigator.vibrate) { try { navigator.vibrate(8); } catch (_) {} }
        }
      }
      startX = null;
      startY = null;
      tracking = false;
      horizontal = false;
    }, { passive: true });

    document.addEventListener("touchcancel", () => {
      startX = null;
      startY = null;
      tracking = false;
      horizontal = false;
    }, { passive: true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    // FIX: on a plain reload (e.g. VS Code Live Preview refreshing after an
    // edit), `state.route` always starts back at the default { page: "home" }
    // because `state` is rebuilt from scratch on every script load. This
    // handler used to immediately call history.replaceState() with that
    // default route, which overwrote whatever route the browser's own
    // history.state already had from before the reload — permanently losing
    // the page the user was on every single time the file watcher reloaded
    // the tab. Now we first check whether history.state already carries a
    // saved marqueRoute (it survives a same-URL reload) and, if so, restore
    // that route instead of clobbering it with "home". Only a genuinely
    // fresh load (no prior history.state) falls back to the default route.
    try {
      const existing = history.state && history.state.marqueRoute;
      const hashRoute = routeFromHash();   // a Q&A address typed/opened directly wins
      const homeMigrationKey = "mr_home_dashboard_migrated_v1";
      let homeMigrationDone = false;
      try { homeMigrationDone = localStorage.getItem(homeMigrationKey) === "1"; } catch (_) {}
      if (hashRoute) {
        state = { ...state, route: resolveRoute(hashRoute) };
        history.replaceState({ marqueRoute: serializeRoute(state.route) }, "", location.href);
        try { localStorage.setItem(homeMigrationKey, "1"); } catch (_) {}
      } else if (existing) {
        // One-time migration: the previous app version used to save the
        // listings page as its home route. The first updated launch should
        // open the new dashboard, then preserve normal route restoration.
        if (!homeMigrationDone && existing.page === "listings") {
          state = { ...state, route: { page: "home" } };
          history.replaceState({ marqueRoute: serializeRoute(state.route) }, "", location.href);
        } else {
          state = { ...state, route: resolveRoute(existing) };
        }
        try { localStorage.setItem(homeMigrationKey, "1"); } catch (_) {}
      } else {
        history.replaceState({ marqueRoute: serializeRoute(state.route) }, "", location.href);
        try { localStorage.setItem(homeMigrationKey, "1"); } catch (_) {}
      }
    } catch (_) {}

    // Apply the admin's decisions (hidden / featured / the owner's own ads).
    try { mrApplyStore(); } catch (_) {}

    // Show the skeleton-loading placeholder for the resolved route for half a
    // second on every fresh page load/refresh, then swap in the real content.
    // This mirrors the in-app "skeleton" navigation stage (see navigateTo()
    // in 04-state-core.js) but skips its "blur" spinner stage entirely, since
    // there is no previous page on screen to blur out on a hard refresh.
    // The home dashboard opens straight away: no placeholder page flashes first.
    const bootPending = !window.CARMA_BOOT_DONE && window.CARMA_API && window.CARMA_API.enabled;
    if (bootPending) {
      // Wait for the first server sync (session, ads, showrooms). Until then show the skeleton only:
      // the built-in sample ads/showrooms must never flash before the real data arrives.
      try { if (window.CARMA_API_STRICT_MODE && typeof LISTINGS !== "undefined" && Array.isArray(LISTINGS)) LISTINGS.splice(0, LISTINGS.length); } catch (_) {}
      state = { ...state, loading: true, loadingStage: "skeleton", pendingRoute: state.route };
      render();
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        state = { ...state, loading: false, loadingStage: null, pendingRoute: null };
        render();
      };
      window.addEventListener("carma:boot-done", release, { once: true });
      setTimeout(release, 5000); // never leave the skeleton up if the server is slow or unreachable
    } else if (state.route && state.route.page === "home") {
      render();
    } else {
      state = { ...state, loading: true, loadingStage: "skeleton", pendingRoute: state.route };
      render();
      setTimeout(() => {
        state = { ...state, loading: false, loadingStage: null, pendingRoute: null };
        render();
      }, 500);
    }

    startBarSearchRotators();
    // FIX: disabled per request — long-press on a car card no longer opens
    // the 3D-touch-style peek/preview panel.
    // initPeekPreview();
    initVehicleGallerySwipe();
    initPhotoViewerSwipe();
  });


// Large listing cards: the glass info bar hangs half over the photo / half below it.
// Its height varies (wrapped title, extra patch rows), so keep each card's bottom
// padding equal to half of the bar's height — that way the bar is always centered on
// the photo's bottom edge and is never clipped or overlapped by the next card.
(function () {
  if (typeof ResizeObserver === "undefined" || typeof MutationObserver === "undefined") return;
  const seen = new WeakSet();
  const ro = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      const glass = entry.target;
      const card = glass.closest(".xc");
      if (card) card.style.paddingBottom = Math.ceil(glass.offsetHeight / 2 + 4) + "px";
    });
  });
  // Preserve the large, bold title from the reference card. Long model names
  // may shrink slightly, then wrap to two lines instead of becoming tiny.
  const fitTitle = (el) => {
    el.classList.remove("is-two-line");
    el.style.whiteSpace = "nowrap";
    const compact = window.matchMedia && window.matchMedia("(max-width: 600px)").matches;
    let size = compact ? 21 : 30;
    const minSize = compact ? 17 : 22;
    el.style.fontSize = size + "px";
    while (el.scrollWidth > el.clientWidth + 1 && size > minSize) {
      size -= 1;
      el.style.fontSize = size + "px";
    }
    if (el.scrollWidth > el.clientWidth + 1) {
      el.style.fontSize = (compact ? 18 : 23) + "px";
      el.style.whiteSpace = "normal";
      el.classList.add("is-two-line");
    }
  };
  const titleRo = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      const el = entry.target, w = Math.round(entry.contentRect.width);
      if (el.dataset.fitW === String(w)) return;
      el.dataset.fitW = String(w);
      fitTitle(el);
    });
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => document.querySelectorAll(".xc-glass--tab .xc-title").forEach((el) => { delete el.dataset.fitW; fitTitle(el); }));
  const watch = (glass) => {
    if (seen.has(glass)) return;
    seen.add(glass); ro.observe(glass);
    const title = glass.querySelector(".xc-glass--tab .xc-title, .xc-title");
    if (glass.classList.contains("xc-glass--tab") && title) titleRo.observe(title);
  };
  const scan = (node) => {
    if (node.nodeType !== 1) return;
    if (node.matches && node.matches(".xc-glass")) watch(node);
    if (node.querySelectorAll) node.querySelectorAll(".xc-glass").forEach(watch);
  };
  new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach(scan))).observe(document.documentElement, { childList: true, subtree: true });
  scan(document.documentElement);
})();
