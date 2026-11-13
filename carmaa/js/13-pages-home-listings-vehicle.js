"use strict";

/* ---------------------------------------------------------------
   PAGE RENDERERS — home screen, brand-models screen, listings (grid) screen, vehicle detail screen, dealers screen.
// Edit any of these specific pages here.
--------------------------------------------------------------- */

// Renders a listing's price the same way it was entered in the sell form:
// digits only, English-numeral grouping, tomans instead of a dollar sign.
function normalizePriceDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function getListingPriceNumber(listing) {
  const raw = listing?.priceAmount ?? listing?.price ?? "";
  const digits = normalizePriceDigits(raw).replace(/[^0-9]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isNegotiablePrice(raw) { return String(raw ?? "").trim() === "توافقی"; }

function formatDetailPrice(raw) {
  if (isNegotiablePrice(raw)) return "توافقی";
  const digits = normalizePriceDigits(raw).replace(/[^0-9]/g, "");
  if (!digits) return "تماس بگیرید";
  return `${Number(digits).toLocaleString("en-US")} تومان`;
}

// Two-part price for the sticky contact bar, where a full price such as
// "1,250,000,000 تومان" does not fit: big number + small unit underneath
// ("1.25" / "میلیارد تومان", "850" / "میلیون تومان"). Prices under 10 million
// keep the full number. The full price stays in the main price block.
function formatCompactPrice(raw) {
  if (isNegotiablePrice(raw)) return { num: "توافقی", unit: "قیمت آگهی" };
  const digits = normalizePriceDigits(raw).replace(/[^0-9]/g, "");
  if (!digits) return { num: "تماس بگیرید", unit: "قیمت آگهی" };
  const n = Number(digits);
  if (n < 10000000) return { num: n.toLocaleString("en-US"), unit: "تومان" };
  const trim = (v) => String(Math.round(v * 100) / 100);
  return n >= 1e9 ? { num: trim(n / 1e9), unit: "میلیارد تومان" } : { num: trim(n / 1e6), unit: "میلیون تومان" };
}
// Shrinks the font a little at a time until the text fits its box.
function fitTextToWidth(el, maxPx, minPx) {
  if (!el) return;
  let size = maxPx;
  el.style.fontSize = size + "px";
  while (el.scrollWidth > el.clientWidth + 1 && size > minPx) { size -= 1; el.style.fontSize = size + "px"; }
}

let listingsInitialRefreshShown = false;
// Set by a "آگهی‌ها" dock tap while already on the listings page: instead of
// the usual full navigateTo() skeleton transition, the tap resets state in
// place and asks for a normal re-render. This flag tells the next
// renderListingsScreen() call to auto-play the pull-to-refresh animation
// (same visual as a manual pull-down) right after it mounts, so the tap
// reads as "refreshed" without ever showing skeleton cards.
let listingsForceRefreshOnNextRender = false;

  const HOME_DEMO_BRANDS = [
    { name: "Ferrari", routeBrand: "فراری", tint: "rgba(200,16,46,0.55)", color: "#c8102e", logo: "ferrari.svg", dark: true },
    { name: "Mercedes-Benz", routeBrand: "بنز", tint: "rgba(199,202,208,0.55)", color: "#c7cad0", logo: "mercedes-benz.svg" },
    { name: "BMW", routeBrand: "BMW", tint: "rgba(61,142,232,0.55)", color: "#3d8ee8", logo: "bmw.svg" },
    { name: "Porsche", routeBrand: "پورشه", tint: "rgba(199,154,75,0.55)", color: "#c79a4b", logo: "porsche.svg" },
    { name: "Audi", routeBrand: "آئودی", tint: "rgba(176,180,185,0.55)", color: "#b0b4b9", logo: "audi.svg", dark: true },
    { name: "Maserati", routeBrand: "مازراتی", tint: "rgba(60,110,165,0.55)", color: "#3c6ea5", logo: "maserati.webp", logoWidth: "84%", logoHeight: "37%" },
    { name: "Jaguar", routeBrand: "جگوار", tint: "rgba(47,138,82,0.55)", color: "#2f8a52", logo: "jaguar.webp" },
    { name: "Land Rover", routeBrand: "لند روور", tint: "rgba(47,107,79,0.55)", color: "#2f6b4f", logo: "land-rover.svg" },
    { name: "Volkswagen", routeBrand: "Volkswagen", tint: "rgba(59,79,199,0.55)", color: "#3b4fc7", logo: "volkswagen.webp" },
    { name: "Ford", routeBrand: "فورد", tint: "rgba(31,111,191,0.55)", color: "#1f6fbf", logo: "ford.webp" },
    { name: "Nissan", routeBrand: "Nissan", tint: "rgba(198,40,40,0.55)", color: "#c62828", logo: "nissan.webp" },
    { name: "MG", routeBrand: "MG", tint: "rgba(212,116,31,0.55)", color: "#d4741f", logo: "mg.webp" },
    { name: "Mazda", routeBrand: "Mazda", tint: "rgba(31,138,112,0.55)", color: "#1f8a70", logo: "mazda.webp" },
    { name: "Chevrolet", routeBrand: "شورلت", tint: "rgba(212,175,23,0.55)", color: "#d4af17", logo: "chevrolet.webp" },
    { name: "Acura", routeBrand: "Acura", tint: "rgba(123,63,199,0.55)", color: "#7b3fc7", logo: "acura.webp" },
    { name: "Toyota", routeBrand: "تویوتا", tint: "rgba(23,145,163,0.55)", color: "#1791a3", logo: "toyota.webp" },
    { name: "Mitsubishi", routeBrand: "Mitsubishi", tint: "rgba(122,154,46,0.55)", color: "#7a9a2e", logo: "mitsubishi.webp" },
    { name: "Kia", routeBrand: "کیا", tint: "rgba(178,63,174,0.55)", color: "#b23fae", logo: "kia.webp" },
    { name: "Peugeot", routeBrand: "Peugeot", tint: "rgba(46,125,79,0.55)", color: "#2e7d4f", logo: "peugeot.webp" },
    { name: "Lexus", routeBrand: "لکسوس", tint: "rgba(199,47,106,0.55)", color: "#c72f6a", logo: "lexus.webp" },
  ];

let brandLogoLazyObserver = null;

  // PERF: the 20 brand logos on the home page (several svg/png files, some
  // 100–170KB each) used to all load at once on first paint via inline
  // background-image — most of them below the fold. Now the URL is parked
  // in a data attribute and only actually assigned once the card is close
  // to entering view, so the browser only fetches what's about to be seen.
  function lazyLoadBrandLogo(logoEl) {
    if (!brandLogoLazyObserver) {
      brandLogoLazyObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const url = el.dataset.bg;
          if (url) el.style.backgroundImage = `url("${url}")`;
          brandLogoLazyObserver.unobserve(el);
        });
      }, { rootMargin: "300px 0px" });
    }
    brandLogoLazyObserver.observe(logoEl);
  }

  function renderBrandModelsScreen(brandName) {
    const byBrand = LISTINGS.filter((l)=>l.brand===brandName);
    const brandMeta = BRANDS.find((b)=>b.name===brandName) || {img:""};
    const modelMap = new Map();
    byBrand.forEach((l)=>{const key=vehicleModelName(l)||brandName;if(!modelMap.has(key))modelMap.set(key,{model:key,count:0,sample:l});modelMap.get(key).count++;});
    const q=(state.search||"").trim().toLowerCase();
    let models=Array.from(modelMap.values()).sort((a,b)=>b.count-a.count);
    if(q) models=models.filter(m=>`${brandName} ${m.model}`.toLowerCase().includes(q));
    return hydratePageShell("tpl-brand-models",(root)=>{
      mountBreadcrumbs(root,[{label:"جستجو",action:"goHome"},{label:brandName},{label:`(${byBrand.length} خودرو)`}]);
      root.querySelector('[data-slot="title"]').remove();
      mountPageToolbar(root);
      const grid=root.querySelector('[data-slot="models"]');
      const all=mountTemplate("tpl-model-all-card"); all.dataset.brand=brandName; setDynamicHTML(all.querySelector('[data-slot="mark"]'),renderBrandMark(brandMeta)); all.querySelector('[data-slot="count"]').textContent=`${byBrand.length} موجود`; grid.appendChild(all);
      models.forEach((m)=>{const card=mountTemplate("tpl-model-card");card.dataset.brand=brandName;card.dataset.model=m.model;setDynamicHTML(card.querySelector('[data-slot="visual"]'),carGlyphSVG(m.sample.color,"w-full h-full block"));card.querySelector('[data-slot="model"]').textContent=m.model;card.querySelector('[data-slot="count"]').textContent=`${m.count} موجود`;grid.appendChild(card);});
    });
  }
  function cleanupListingsTopRefresh() {
    const active = document.querySelector('[data-page="listings"]');
    if (active && active._listingsTopRefreshCleanup) {
      try { active._listingsTopRefreshCleanup(); } catch (_) {}
    }
  }
  function listStyleToggleMarkup() {
    const cur = state.listStyle;
    const btn = (style, label, svg) => `<button type="button" data-action="setListStyle" data-style="${style}" aria-label="${label}" aria-pressed="${cur === style}" class="vt-btn${cur === style ? " is-active" : ""}">${svg}</button>`;
    return `<div class="vt-seg" role="group" aria-label="نمای آگهی‌ها">`
      + btn("large", "نمای بزرگ", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M4 14h16"/></svg>')
      + btn("compact", "نمای فشرده", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4" width="17" height="6.5" rx="2"/><rect x="3.5" y="13.5" width="17" height="6.5" rx="2"/></svg>')
      + `</div>`;
  }
  // Floating (position:fixed) layout switch. It lives directly under <body>,
  // NOT inside #pageContent: the page shell runs an entrance animation with a
  // transform, and a fixed element inside a transformed ancestor stops being
  // fixed to the screen. Shown only on the listings page.
  function syncListStyleFab(show) {
    let fab = document.getElementById("listStyleFab");
    if (!show) { if (fab) fab.remove(); return; }
    if (!fab) {
      fab = document.createElement("div");
      fab.id = "listStyleFab";
      fab.className = "vt-fab";
      document.body.appendChild(fab);
    }
    fab.innerHTML = listStyleToggleMarkup();
  }
  function renderListingsScreen(brand) {
    cleanupListingsTopRefresh();
    const byBrand=brand==="all"?LISTINGS:LISTINGS.filter((l)=>l.brand===brand);
    const q=(state.search||"").trim().toLowerCase();
    const searchable=q?byBrand.filter(l=>`${l.title} ${l.adTitle||""} ${l.brand} ${vehicleModelName(l)} ${DEALERS[l.brand]?DEALERS[l.brand].city:""}`.toLowerCase().includes(q)):byBrand;
    const filtered=applyListingFilters(searchable), visible=filtered.slice(0,state.visibleCount);
    return hydratePageShell("tpl-listings",(root)=>{
      mountToolbar(root);
      const cards=root.querySelector('[data-slot="cards"]');
      cards.dataset.listStyle=state.listStyle;
      if(filtered.length){
        setDynamicHTML(cards,visible.map(renderExploreListingCard).join(""));
      }
      else {const empty=mountTemplate("tpl-list-empty");const msg=empty.querySelector('[data-slot="message"]');msg.append(document.createTextNode("هنوز آگهی‌ای برای این برند یافت نشد."));msg.appendChild(document.createElement("br"));msg.append(document.createTextNode("«همه برندها» را امتحان کنید یا بعداً دوباره سر بزنید."));cards.appendChild(empty);}
      mountListingsFooter(root, filtered);
      const shouldRunInitialRefresh = !listingsInitialRefreshShown || listingsForceRefreshOnNextRender;
      if (shouldRunInitialRefresh) listingsInitialRefreshShown = true;
      listingsForceRefreshOnNextRender = false;
      mountListingsTopRefresh(root, { initial: shouldRunInitialRefresh });
      // Skip the hint on the transient render that's about to be replaced
      // by the auto-triggered initial refresh (see mountListingsTopRefresh);
      // it fires instead once that cycle's checkmark lands and swaps the
      // cards in (see refreshListingsCardsNow), same as a manual pull-to-refresh.
      if (!shouldRunInitialRefresh && filtered.length) swipeShowFirstCardHint(cards);
    });
  }

  // Top pull-to-refresh. The gesture is compositor-friendly: cards are moved
  // with translate3d() instead of changing layout height on every touchmove.
  //
  // Timing model (why these numbers): a refresh that resolves in ~200ms reads
  // as if nothing happened, and one that snaps to hidden the instant it's done
  // reads as broken. So the cycle has three eased beats instead of one abrupt
  // timer — LOADING_MS (the spinner visibly does its job), then a short
  // SUCCESS_MS beat where it morphs into a checkmark (confirms *something*
  // happened), then EXIT_MS to fade/slide away — and the page swap only
  // happens once that fade has actually finished, so the new cards never pop
  // in underneath a still-visible indicator.
  const LISTINGS_REFRESH_LOADING_MS = 700;
  const LISTINGS_REFRESH_SUCCESS_MS = 320;
  const LISTINGS_REFRESH_EXIT_MS = 260;

  function mountListingsTopRefresh(root, options = {}) {
    const zone = root.querySelector('[data-slot="refreshTop"]');
    const cards = root.querySelector('[data-slot="cards"]');
    if (!zone || !cards) return;
    zone.innerHTML = `
      <div class="listings-top-refresh-zone" data-listings-top-refresh aria-hidden="true">
        <div class="listings-refresh-glyph">
          <div class="listings-refresh-spinner"></div>
          <div class="listings-refresh-check">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
          </div>
        </div>
        <div class="listings-refresh-label" data-slot="refresh-label">در حال بررسی آگهی‌های جدید…</div>
      </div>
    `;

    const refresh = zone.firstElementChild;
    const label = refresh.querySelector('[data-slot="refresh-label"]');
    refresh.classList.remove('is-released', 'is-loading', 'is-threshold', 'is-success', 'is-animating');
    zone.classList.remove('is-visible');
    refresh.style.display = 'flex';
    refresh.style.opacity = '0';

    // No layout-changing properties (height/padding/margin) are touched
    // during the gesture — only transform. PERF: the cards container is only
    // promoted to its own compositor layer WHILE it is being pulled or
    // animated (will-change is set in applyPullVisual/beginRefresh and
    // cleared again once it settles). It used to be promoted permanently,
    // which kept one huge layer (the entire card list) alive for the whole
    // time the page was open and made every scroll heavier.
    cards.style.transition = 'none';
    refresh.classList.add('is-idle');

    let touchStartY = null;
    let touchStartX = null;
    let pullDistance = 0;
    let pulling = false;
    let thresholdReached = false;
    let refreshAxisDecided = false;
    let refreshAxisAbandoned = false; // this touch read as horizontal — never pull
    let rafId = 0;
    let loadingTimer = null;
    let successTimer = null;
    let exitTimer = null;
    const initialRefresh = options.initial === true;

    const clearAllTimers = () => {
      if (loadingTimer) { clearTimeout(loadingTimer); loadingTimer = null; }
      if (successTimer) { clearTimeout(successTimer); successTimer = null; }
      if (exitTimer) { clearTimeout(exitTimer); exitTimer = null; }
    };

    const stillOnListings = () => root.isConnected && state.route?.page === "listings";

    const easePull = (distance) => {
      const capped = Math.min(distance, 150);
      // Increasing resistance makes the gesture feel a little heavier while
      // staying visually responsive.
      return Math.min(88, capped < 72 ? capped * 0.50 : 36 + (capped - 72) * 0.28);
    };

    const applyPullVisual = () => {
      rafId = 0;
      if (!pulling || touchStartY == null) return;
      const damped = easePull(pullDistance);
      zone.classList.add('is-visible');
      refresh.classList.remove('is-idle');
      refresh.style.display = 'flex';
      refresh.style.opacity = String(Math.min(1, 0.16 + damped / 72));
      refresh.style.transform = `translate3d(0, ${Math.min(6, damped * 0.04)}px, 0)`;
      if (cards.style.willChange !== 'transform') cards.style.willChange = 'transform';
      cards.style.transform = `translate3d(0, ${damped}px, 0)`;
      refresh.classList.toggle('is-threshold', thresholdReached);
    };

    const maybeHaptic = () => {
      if (thresholdReached || pullDistance < 72) return;
      thresholdReached = true;
      refresh.classList.add('is-threshold');
      try { if (navigator.vibrate) navigator.vibrate(14); } catch (_) {}
    };

    // Fades/slides the indicator back to hidden with the same eased motion
    // used everywhere else, instead of snapping styles away instantly.
    const settleHidden = (durationMs) => {
      refresh.classList.add('is-animating');
      refresh.classList.remove('is-loading', 'is-released', 'is-threshold', 'is-success');
      zone.classList.remove('is-visible');
      refresh.style.display = 'flex';
      refresh.style.opacity = '0';
      refresh.style.transform = '';
      refresh.setAttribute('aria-hidden', 'true');
      cards.style.transition = `transform ${durationMs}ms cubic-bezier(.22,1,.36,1)`;
      cards.style.transform = 'translate3d(0,0,0)';
      window.setTimeout(() => {
        cards.style.transition = 'none';
        // Fully at rest again -> drop the compositor layer and park the
        // (invisible) spinner animation. Skipped if a new gesture/refresh
        // already took over in the meantime.
        if (pulling || touchStartY != null || loadingTimer || successTimer) return;
        cards.style.transform = '';
        cards.style.willChange = '';
        refresh.classList.add('is-idle');
      }, durationMs + 20);
    };

    const resetVisuals = () => {
      clearAllTimers();
      settleHidden(240);
    };

    // Swaps in the refreshed card list. Called the instant the checkmark
    // appears (see runSuccess) rather than after the indicator has fully
    // faded away, so "به‌روز شد" and the actual card refresh happen at the
    // same moment instead of the cards visibly lagging behind the tick.
    const refreshListingsCardsNow = () => {
      const brand = (state.route && state.route.page === "listings") ? state.route.brand : "all";
      const byBrand = brand === "all" ? LISTINGS : LISTINGS.filter((l) => l.brand === brand);
      const q = (state.search || "").trim().toLowerCase();
      const searchable = q
        ? byBrand.filter((l) => `${l.title} ${l.adTitle||""} ${l.brand} ${vehicleModelName(l)} ${DEALERS[l.brand] ? DEALERS[l.brand].city : ""}`.toLowerCase().includes(q))
        : byBrand;
      const filtered = applyListingFilters(searchable);
      const visibleCount = Math.max(12, Math.min(12, LISTINGS.length));
      state = { ...state, visibleCount };
      const visible = filtered.slice(0, visibleCount);
      if (filtered.length) {
        setDynamicHTML(cards, visible.map(renderExploreListingCard).join(""));
      } else {
        cards.innerHTML = "";
        const empty = mountTemplate("tpl-list-empty");
        const msg = empty.querySelector('[data-slot="message"]');
        msg.append(document.createTextNode("هنوز آگهی‌ای برای این برند یافت نشد."));
        msg.appendChild(document.createElement("br"));
        msg.append(document.createTextNode("«همه برندها» را امتحان کنید یا بعداً دوباره سر بزنید."));
        cards.appendChild(empty);
      }
      mountListingsFooter(root, filtered);
      if (filtered.length) swipeShowFirstCardHint(cards);
    };

    // Beat 3: fade + slide the indicator away and let the cards ease back to
    // rest. The card content itself was already swapped in back in
    // runSuccess, so this beat is purely the indicator's exit visual.
    const runExit = () => {
      refresh.classList.add('is-animating');
      settleHidden(LISTINGS_REFRESH_EXIT_MS);
      exitTimer = window.setTimeout(() => {
        exitTimer = null;
        state = { ...state, listingsLoadingMore: false };
        cards.style.transition = 'none';
        cards.style.transform = '';
        cards.style.willChange = '';
        refresh.classList.add('is-idle');
        requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "smooth" }));
      }, LISTINGS_REFRESH_EXIT_MS);
    };

    // Beat 2: spinner morphs into a soft checkmark — and in the same beat,
    // the cards themselves refresh, so the "به‌روز شد" tick and the new
    // cards land together instead of the cards catching up later.
    const runSuccess = () => {
      if (!stillOnListings()) { runExit(); return; }
      refreshListingsCardsNow();
      refresh.classList.add('is-success');
      if (label) label.textContent = 'به‌روز شد';
      try { if (navigator.vibrate) navigator.vibrate(8); } catch (_) {}
      successTimer = window.setTimeout(() => {
        successTimer = null;
        runExit();
      }, LISTINGS_REFRESH_SUCCESS_MS);
    };

    // Beat 1: settle into the loading position with an eased transition
    // (rather than a hard jump from wherever the finger let go) and let the
    // spinner visibly spin for a beat before resolving.
    const beginRefresh = (isInitial = false) => {
      if (state.listingsLoadingMore || (!isInitial && pullDistance < 72) || (!isInitial && window.scrollY > 8)) return;
      clearAllTimers();
      refresh.classList.add('is-animating');
      refresh.classList.remove('is-success', 'is-idle');
      refresh.classList.add('is-released', 'is-loading');
      refresh.setAttribute('aria-hidden', 'false');
      if (label) label.textContent = 'در حال بررسی آگهی‌های جدید…';
      zone.classList.add('is-visible');
      refresh.style.display = 'flex';
      refresh.style.opacity = '1';
      refresh.style.transform = 'translate3d(0,0,0)';
      cards.style.willChange = 'transform';
      cards.style.transition = 'transform 280ms cubic-bezier(.22,1,.36,1)';
      cards.style.transform = 'translate3d(0,44px,0)';
      state = { ...state, listingsLoadingMore: true };
      loadingTimer = window.setTimeout(() => {
        loadingTimer = null;
        if (!stillOnListings()) { runExit(); return; }
        runSuccess();
      }, LISTINGS_REFRESH_LOADING_MS);
    };

    const onTouchStart = (e) => {
      if (!root.isConnected || state.route?.page !== "listings" || window.scrollY > 8 || state.listingsLoadingMore) return;
      const point = e.touches && e.touches[0];
      if (!point) return;
      touchStartY = point.clientY;
      touchStartX = point.clientX;
      pullDistance = 0;
      pulling = false;
      thresholdReached = false;
      refreshAxisDecided = false;
      refreshAxisAbandoned = false;
      // Dragging drives the indicator 1:1 with the finger every frame, so the
      // eased transition is switched off for the duration of the gesture —
      // otherwise each touchmove update would visibly lag behind the finger.
      refresh.classList.remove('is-threshold', 'is-released', 'is-loading', 'is-animating', 'is-idle');
      cards.style.transition = 'none';
    };

    const onTouchMove = (e) => {
      if (!root.isConnected || state.route?.page !== "listings" || touchStartY == null || window.scrollY > 8 || state.listingsLoadingMore) return;
      const point = e.touches && e.touches[0];
      if (!point) return;
      if (refreshAxisAbandoned) return;
      // Defer to an active horizontal card-swipe (js/19-swipe-save-card.js):
      // once that module has claimed this same touch, pull-to-refresh never
      // engages for it, no matter how the finger moves afterward.
      if (swipeGestureLockedByOther("refresh")) { refreshAxisAbandoned = true; return; }
      const delta = point.clientY - touchStartY;
      const deltaX = point.clientX - touchStartX;
      if (!refreshAxisDecided) {
        // Mirror swipe-save-card's own axis lock: wait for a few px of
        // movement before deciding, so a couple pixels of jitter doesn't
        // pick a winner prematurely.
        if (Math.max(Math.abs(delta), Math.abs(deltaX)) < 6) return;
        refreshAxisDecided = true;
        if (delta <= 0 || Math.abs(deltaX) > Math.abs(delta) * 1.2) { refreshAxisAbandoned = true; return; }
        // This touch is a genuine downward pull — claim it so a card-swipe
        // that resolves its own axis a moment later backs off instead.
        if (!swipeGestureTryLock("refresh")) { refreshAxisAbandoned = true; return; }
      }
      if (delta <= 0) return;
      pullDistance = delta;
      pulling = true;
      maybeHaptic();
      if (!rafId) rafId = requestAnimationFrame(applyPullVisual);
      if (e.cancelable) e.preventDefault();
    };

    const onTouchEnd = () => {
      swipeGestureRelease("refresh");
      if (touchStartY == null) return;
      const shouldRefresh = root.isConnected && state.route?.page === "listings" && pulling && pullDistance >= 72 && window.scrollY <= 8;
      touchStartY = null;
      pulling = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }

      if (shouldRefresh) {
        beginRefresh();
      } else {
        resetVisuals();
      }
      pullDistance = 0;
      thresholdReached = false;
    };

    if (initialRefresh) {
      // One frame is enough to let the page paint before the indicator
      // eases in — long enough to avoid a layout-thrash flash, short enough
      // that it doesn't read as a stall before anything happens.
      requestAnimationFrame(() => {
        if (stillOnListings()) beginRefresh(true);
      });
    }

    // IMPORTANT: bind the pull-to-refresh gesture to the active listings page
    // only. Binding to window caused the old listings handler to survive route
    // changes and react to pulls on unrelated pages.
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchend', onTouchEnd, { passive: true });

    // PERF: pull-to-refresh only ever engages at the very top of the page
    // (see the `window.scrollY > 8` guards above), but a NON-passive
    // touchmove listener makes the browser wait for JS on every touchmove
    // of every scroll — which is what makes a long list feel sticky. So the
    // non-passive listener is only attached while scrollY <= 8 and detached
    // as soon as the user scrolls down; scrolling then runs fully on the
    // compositor thread. Behavior at the top is identical.
    let moveBound = false;
    const bindMove = (on) => {
      if (on === moveBound) return;
      moveBound = on;
      if (on) root.addEventListener('touchmove', onTouchMove, { passive: false });
      else root.removeEventListener('touchmove', onTouchMove);
    };
    const onScrollGate = () => bindMove(window.scrollY <= 8);
    window.addEventListener('scroll', onScrollGate, { passive: true });
    onScrollGate();

    root._listingsTopRefreshCleanup = () => {
      clearAllTimers();
      if (rafId) cancelAnimationFrame(rafId);
      swipeGestureRelease("refresh");
      window.removeEventListener('scroll', onScrollGate);
      bindMove(false);
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchend', onTouchEnd);
      cards.style.willChange = '';
      zone.classList.remove('is-visible');

      cards.style.transform = '';
      cards.style.transition = '';
    };
  }

  // Bottom sentinel only loads additional older cards. It never refreshes the
  // feed anymore. Refreshing is deliberately handled at the top.
  function mountListingsFooter(root, filtered) {
    const footer = root.querySelector('[data-slot="footer"]');
    const cards = root.querySelector('[data-slot="cards"]');
    footer.innerHTML = "";
    if (listingsScrollObserver) { listingsScrollObserver.disconnect(); listingsScrollObserver = null; }
    if (listingsLoadMoreTimer) { clearTimeout(listingsLoadMoreTimer); listingsLoadMoreTimer = null; }

    if (!filtered.length || state.visibleCount >= filtered.length) return;

    const sentinel = document.createElement("div");
    sentinel.dataset.slot = "scroll-sentinel";
    sentinel.className = "h-px w-full";
    footer.appendChild(sentinel);

    listingsScrollObserver = new IntersectionObserver((entries) => {
      if (!entries[0] || !entries[0].isIntersecting) return;
      if (state.listingsLoadingMore || state.visibleCount >= filtered.length) return;
      listingsScrollObserver.disconnect();
      listingsScrollObserver = null;
      state = { ...state, listingsLoadingMore: true };

      sentinel.remove();
      const skeletons = [];
      for (let i = 0; i < 3; i++) {
        const sk = mountTemplate(state.listStyle === "compact" ? "tpl-skeleton-explore-card-compact" : "tpl-skeleton-explore-card");
        sk.classList.add("card-fade-in");
        sk.style.animationDelay = (i * 55) + "ms";
        cards.appendChild(sk);
        skeletons.push(sk);
      }

      listingsLoadMoreTimer = setTimeout(() => {
        skeletons.forEach((sk) => sk.remove());
        const nextBatch = filtered.slice(state.visibleCount, state.visibleCount + 12);
        // PERF: the whole batch (up to 30 cards, each with an image) used to
        // be parsed, inserted and laid out in one go — a long main-thread
        // task that froze scrolling for a moment. It's now inserted a few
        // cards per frame; the end result is exactly the same cards.
        const CHUNK = 2; // 6 -> 2: smaller per-frame insert keeps every frame under budget while the next page streams in
        let i = 0;
        const pump = () => {
          if (!cards.isConnected) return; // page was re-rendered/left meanwhile
          const html = nextBatch.slice(i, i + CHUNK).map((l, k) => renderExploreListingCard(l, i + k)).join("");
          const tpl = document.createElement("template");
          tpl.innerHTML = html;
          cards.appendChild(tpl.content);
          i += CHUNK;
          if (i < nextBatch.length) { requestAnimationFrame(pump); return; }
          state = { ...state, visibleCount: state.visibleCount + nextBatch.length, listingsLoadingMore: false };
          mountListingsFooter(root, filtered);
        };
        pump();
      }, 650);
    // PERF: start loading the next batch well before the user reaches the
    // end of the list (was 300px) so, in normal scrolling, they don't hit
    // the skeleton placeholders at all.
    }, { root: null, rootMargin: "900px 0px", threshold: 0 });
    listingsScrollObserver.observe(sentinel);
  }

  function syncVehicleScrollLayer() {
    const page = document.querySelector('[data-page="vehicle"].vehicle-detail-page');
    if (!page) return;
    page.classList.toggle('is-scrolled', window.scrollY > 24);
  }

  // Seller block on the vehicle page. Dealerships are a tappable row that
  // opens the dealership's page (all of its ads); personal sellers are static.
  function renderSellerCardMarkup(listing) {
    const s = listingSeller(listing);
    const avatarUrl = sellerAvatarFor(s.type === "dealer" ? "dealer" : "personal", s.id);
    const avatar = avatarUrl ? `<img src="${escHtml(avatarUrl)}" alt="" />` : escHtml((s.name || (s.type === "dealer" ? "ن" : "فروشنده")).trim().charAt(0));
    const isDealer = s.type === "dealer";
    const profile = isDealer ? sellerProfileById(s.id) : null;
    const count = profile ? profile.listings.length : 0;
    const inner = `<span class="seller-avatar">${avatar}</span><span class="seller-info"><span class="seller-name">${escHtml(isDealer ? s.name : "فروشنده شخصی")}${isDealer ? `<svg class="icon"><use href="#vd-i-badge-check"></use></svg>` : ""}</span><span class="seller-type"><span class="seller-tag ${isDealer ? "seller-tag-dealer" : "seller-tag-personal"}">${isDealer ? "نمایشگاه" : "شخصی"}</span><span>·</span><span>${escHtml(s.city || (isDealer ? `${count.toLocaleString("fa-IR")} آگهی` : "اطلاعات فروشنده"))}</span></span></span><span class="mini-label"><svg class="icon"><use href="#vd-i-chevron-left"></use></svg>${isDealer ? "مشاهده آگهی‌ها" : "صفحه فروشنده"}</span>`;
    if (!isDealer) {
      if (!s.id) return `<div class="seller-mini seller-mini--personal">${inner}</div>`;
      return `<button type="button" class="seller-mini seller-mini-link seller-mini--personal" data-action="goSeller" data-seller-kind="personal" data-seller-id="${escHtml(s.id)}" aria-label="مشاهده صفحه عمومی فروشنده">${inner.replace("فروشنده</span>", "صفحه فروشنده</span>")}</button>`;
    }
    return `<button type="button" class="seller-mini seller-mini-link seller-mini--dealer" data-action="goSeller" data-seller-id="${escHtml(s.id)}" aria-label="مشاهده آگهی‌های ${escHtml(s.name)}">${inner}</button>`;
  }

  // SA-FIX: listings API has no seller avatar; fetch the public user record in the background and fill the circle.
  function saEnsureAvatar(uid) {
    try {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uid)) return;
      const api = window.CARMA_API;
      if (!api || !api.enabled || !api.social || typeof api.social.user !== "function") return;
      const apply = (url) => {
        if (!url) return;
        document.querySelectorAll('.cm-seller-ava[data-seller-id="' + uid + '"] .cm-sa-circle').forEach((c) => {
          if (c.querySelector("img")) return;
          const old = c.innerHTML, img = document.createElement("img");
          img.alt = ""; img.decoding = "async";
          img.onerror = () => { try { c.innerHTML = old; } catch (_) {} };
          img.onload = () => { img.style.opacity = "1"; };
          img.style.cssText = "opacity:0;transition:opacity .25s ease";
          img.src = url;
          c.textContent = ""; c.appendChild(img);
        });
      };
      const cached = window.CARMA_SERVER_USERS && window.CARMA_SERVER_USERS[uid];
      if (cached) { apply(cached.avatar_url); return; }
      window.CARMA_USER_MISS = window.CARMA_USER_MISS || {};
      const miss = window.CARMA_USER_MISS[uid];
      if (miss === true || (miss && Date.now() - miss < 15000)) return;
      window.CARMA_SA_INFLIGHT = window.CARMA_SA_INFLIGHT || {};
      if (window.CARMA_SA_INFLIGHT[uid]) return;
      window.CARMA_SA_INFLIGHT[uid] = api.social.user(uid).then((r) => {
        if (r && r.user) {
          window.CARMA_SERVER_USERS = window.CARMA_SERVER_USERS || {};
          window.CARMA_SERVER_USERS[uid] = r.user;
          apply(r.user.avatar_url);
        }
      }).catch((err) => {
        window.CARMA_USER_MISS[uid] = (err && err.status === 404) ? true : Date.now();
      }).then(() => { delete window.CARMA_SA_INFLIGHT[uid]; });
    } catch (_) {}
  }

  // cm-seller-ava: small round seller avatar inside the title/price card (replaces the old seller card).
  function renderSellerAvatarMarkup(listing) {
    const s = listingSeller(listing);
    const isDealer = s.type === "dealer";
    const kind = isDealer ? "dealer" : "personal";
    // عکس پروفایل: نمایشگاه (اگر آگهی داخل نمایشگاه ثبت شده) یا حساب شخصی کاربر؛ در حالت سرور از پروفایل عمومی
    let avatarUrl = sellerAvatarFor(kind, s.id);
    if (!avatarUrl && s.id) { try { const pr = sellerProfileById(s.id, kind); avatarUrl = (pr && (pr.logo || pr.avatar)) || ""; } catch (_) {} }
    // SA-FIX: personal seller -> use cached public user record, or fetch it now.
    const saUid = isDealer ? "" : String(listing.sellerUserId || s.id || "");
    if (!avatarUrl && saUid) { const su = window.CARMA_SERVER_USERS && window.CARMA_SERVER_USERS[saUid]; if (su && su.avatar_url) avatarUrl = su.avatar_url; }
    if (!avatarUrl && saUid) setTimeout(() => saEnsureAvatar(saUid), 0);
    const name = String(s.name || (isDealer ? "نمایشگاه" : "فروشنده")).trim();
    const fallback = isDealer
      ? '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5 5.6 5h12.8L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 12.6V20h13v-7.4M10 20v-4.5h4V20"/></svg>'
      : '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.6-3.7 3.4-5.6 7.2-5.6s6.6 1.9 7.2 5.6"/></svg>';
    const circle = avatarUrl ? `<img src="${escHtml(avatarUrl)}" alt="" loading="lazy" decoding="async" />` : fallback;
    const inner = `<span class="cm-sa-circle">${circle}</span><span class="cm-sa-cap">فروشنده</span>`;
    const cls = `cm-seller-ava ${isDealer ? "is-dealer" : "is-personal"}`;
    if (!s.id) return `<span class="${cls}" aria-hidden="true">${inner}</span>`;
    const label = isDealer ? `مشاهده آگهی‌های ${name}` : "مشاهده صفحه فروشنده";
    return `<button type="button" class="${cls}" data-action="goSeller"${isDealer ? "" : ' data-seller-kind="personal"'} data-seller-id="${escHtml(s.id)}" aria-label="${escHtml(label)}">${inner}</button>`;
  }

  // Public profile page of one seller (user or dealership): tall cover photo that melts into a
  // blur, name + unique @username, follow / message buttons, counters, bio, then their ads.
  function renderSellerScreen(sellerId, kind) {
    const profile = sellerProfileById(sellerId, kind);
    return hydratePageShell("tpl-seller", (root) => {
      const hero = root.querySelector('[data-slot="hero"]');
      const cards = root.querySelector('[data-slot="cards"]');
      cards.dataset.listStyle = state.listStyle;
      {
        const uid = String(sellerId || "");
        const canFetch = window.CARMA_API?.enabled && kind !== "dealer" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uid);
        window.CARMA_USER_MISS = window.CARMA_USER_MISS || {};
        const miss = window.CARMA_USER_MISS[uid];
        // SU-FIX: a personal page built from listings alone shows placeholder name/handle; wait for the server record first.
        const wantServer = !profile || (profile.type === "personal" && !(window.CARMA_SERVER_USERS && window.CARMA_SERVER_USERS[uid]));
        if (wantServer && canFetch && !(miss === true || (miss && Date.now() - miss < 15000))) {
          // Public user pages do not depend on this visitor's listings or login: ask the server, then redraw.
          setDynamicHTML(hero, `<div class="seller-empty">در حال بارگذاری…</div>`);
          window.CARMA_API.social.user(uid).then((r) => {
            if (r && r.user) { window.CARMA_SERVER_USERS = window.CARMA_SERVER_USERS || {}; window.CARMA_SERVER_USERS[uid] = r.user; if (r.user.username && window.MR_PROFILE && window.MR_PROFILE.setServerHandle) window.MR_PROFILE.setServerHandle(uid, r.user.username); }
            else window.CARMA_USER_MISS[uid] = true;
          }).catch((err) => {
            // Only a real 404 means the account is gone; a network hiccup should not stick as "not found".
            if (err && err.status === 404) window.CARMA_USER_MISS[uid] = true;
            else window.CARMA_USER_MISS[uid] = Date.now();
          }).then(() => {
            const r = state.route || {};
            if (root.isConnected && r.page === "seller" && String(r.sellerId || "") === uid && typeof render === "function") render();
          });
          return;
        }
        if (!profile) { setDynamicHTML(hero, `<div class="seller-empty">صفحه این کاربر پیدا نشد.</div>`); return; }
      }
      const P = window.MR_PROFILE || {};
      const sorted = profile.listings.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const isDealerPage = profile.type === "dealer";
      const me = (!isDealerPage && window.CARMA_API?.enabled && window.CARMA_AUTH_USER?.id) ? String(window.CARMA_AUTH_USER.id) : (P.myId ? P.myId() : null);
      // In API mode the owner of a showroom is recognised by the server's showroom id (not the local hash id),
      // so they get "edit showroom" instead of a follow button that the server would reject.
      const isMe = (window.CARMA_API?.enabled && isDealerPage)
        ? !!(state.dealership && state.dealership.id && String(state.dealership.id) === String(profile.id))
        : (!!me && me === profile.id);
      // A showroom page never borrows the owner's personal name / photo / username.
      const ownProfile = (isMe && !isDealerPage) ? (state.accountProfile || {}) : null;
      const ownName = ownProfile ? [ownProfile.firstName, ownProfile.lastName].filter(Boolean).join(" ").trim() : "";
      const displayName = ownName || profile.name || "کاربر";
      const handle = P.getUsername ? P.getUsername(profile.id, isDealerPage ? "dealer" : "") : String(profile.id || "");
      if (!isDealerPage && !isMe && window.CARMA_API?.enabled && P.setServerHandle && profile.id && !(window.CARMA_USER_HANDLES || {})[String(profile.id)]) {
        window.CARMA_API.social.user(profile.id).then((r) => { const un = r && r.user && r.user.username; if (!un) return; P.setServerHandle(profile.id, un); const b = root.querySelector(".sp-sub bdi"); if (b) b.textContent = "@" + un; }).catch(() => {});
      }
      const avatar = profile.logo || sellerAvatarFor(profile.type, profile.id) || (ownProfile && ownProfile.avatar) || "";
      const firstPhoto = sorted.map((l) => (Array.isArray(l.photos) ? l.photos.filter(Boolean)[0] : "")).find(Boolean) || "";
      const initial = escHtml((displayName || "ن").trim().charAt(0).toUpperCase());
      const avatarSafe = avatar ? String(avatar).replace(/"/g, "&quot;") : "";
      const avatarMarkup = avatarSafe
        ? `<img src="${avatarSafe}" alt="" decoding="async" referrerpolicy="no-referrer" />`
        : (isDealerPage ? SR_ICON_STORE : `<span>${initial}</span>`);
      const isFollowing = !!(P.isFollowing && me && P.isFollowing(me, profile.id));
      const firstListing = sorted[0];
      const chatIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.3 9 9 0 0 1-3.6-.8L3 20.5l1.6-4.8A8.3 8.3 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/></svg>`;
      const chatBtn = firstListing
        ? `<button type="button" class="pf-chat" data-action="startListingChat" data-id="${escHtml(String(firstListing.id))}" aria-label="پیام دادن">${chatIcon}</button>`
        : `<button type="button" class="pf-chat" data-action="pfNoChat" aria-label="پیام دادن">${chatIcon}</button>`;
      const mainBtn = isMe
        ? `<button type="button" class="pf-follow" data-action="${isDealerPage ? "pfEditDealership" : "pfEditProfile"}">${isDealerPage ? "ویرایش نمایشگاه" : "ویرایش پروفایل"}</button>`
        : `<button type="button" class="pf-follow${isFollowing ? " is-following" : ""}" data-action="pfToggleFollow" data-kind="${isDealerPage ? "dealer" : "personal"}" data-seller-id="${escHtml(profile.id)}" aria-pressed="${isFollowing}">${isFollowing ? "دنبال می‌شود" : "دنبال کردن"}</button>`;
      const verified = profile.type === "dealer" && profile.verified ? `<span class="sr-verified sp-verified" role="img" aria-label="تأییدشده"><svg viewBox="0 0 24 24"><path d="M12 1.8l2.6 1.8 3.1-.2 1.2 2.9 2.7 1.6-.7 3.1 1.2 2.8-2.2 2.2-.3 3.1-3 .8-2 2.4-2.6-1.8-3.1.2-1.2-2.9-2.7-1.6.7-3.1L2.5 11.9l2.2-2.2.3-3.1 3-.8z"/><path d="m8.4 12.2 2.4 2.4 4.9-5"/></svg></span>` : "";
      const followers = P.followersCount ? P.followersCount(profile.id) : 0;
      const following = P.followingOf ? P.followingOf(profile.id).length : 0;
      const ratingRec = isDealerPage ? showroomRatingFor(profile.id) : null;
      const showroomDirectory = isDealerPage ? getShowroomDirectoryItems() : [];
      const matchingShowroom = isDealerPage ? (showroomDirectory.find((entry) => String(entry.id) === String(profile.id)) || {}) : {};
      const profileFollowers = P.followersCount ? Number(P.followersCount(profile.id)) || 0 : 0;
      const profileLatestAt = sorted.reduce((max, listing) => Math.max(max, Number(listing && listing.createdAt) || 0), 0);
      // The public showroom page uses the actual banner chosen in showroom settings
      // (db:<sellerId>), with directory/profile data as fallbacks for older records.
      // The showroom's chosen avatar IS the page banner now (no separate banner upload); the
      // old banner / auto banner only remain as fallbacks when the showroom has no avatar yet.
      // SB-FIX: the real banner saved by the showroom wins; without one the old behaviour (avatar) is kept.
      const sbSrv = isDealerPage ? (window.CARMA_SERVER_SHOWROOMS || []).find((x) => String(x.id) === String(profile.id)) : null;
      const sbReal = isDealerPage ? ((sbSrv && sbSrv.banner_url) || (state.dealership && String(state.dealership.id) === String(profile.id) && state.dealership.banner_image_id && state.dealership.banner) || (typeof mrGetAvatar === "function" ? mrGetAvatar("db", profile.id) : "") || "") : "";
      const showroomBanner = isDealerPage
        ? (sbReal || profile.logo || matchingShowroom.logo || sellerAvatarFor("dealer", profile.id) || profile.banner || (typeof sellerBannerFor === "function" ? sellerBannerFor(profile.id) : ""))
        : "";
      const profileAwardItem = isDealerPage ? {
        ...matchingShowroom, id: profile.id, name: profile.name || displayName,
        city: profile.city || matchingShowroom.city || "",
        description: profile.description || matchingShowroom.description || "",
        logo: profile.logo || matchingShowroom.logo || avatar || "",
        banner: showroomBanner, verified: !!profile.verified,
        listings: sorted, latestAt: Math.max(profileLatestAt, Number(matchingShowroom.latestAt) || 0),
        followers: profileFollowers, rating: ratingRec || showroomRatingFor(profile.id),
        activityScore: showroomActivityScore(sorted, profileFollowers)
      } : null;
      const awardsHTML = isDealerPage ? renderShowroomTrophies(getShowroomAwards(profileAwardItem, showroomDirectory)) : "";
      const thirdStat = isDealerPage
        ? `<div><strong>${escHtml(showroomJoinedLabel(profile.id))}</strong><span>تاریخ عضویت</span></div>`
        : `<div><strong data-pf-following>${faNum(following)}</strong><span>دنبال‌شونده</span></div>`;
      const place = [profile.city, profile.address].filter(Boolean).map(escHtml).join("، ");
      const rows = [];
      if (place) rows.push(`<div class="sp-row"><span>موقعیت</span><p>${place}</p></div>`);
      if (profile.description) rows.push(`<div class="sp-row"><span>درباره</span><p>${escHtml(profile.description)}</p></div>`);
      if (profile.hours) rows.push(`<div class="sp-row"><span>ساعت کاری</span><p>${escHtml(profile.hours)}</p></div>`);
      if (profile.since) rows.push(`<div class="sp-row"><span>سال تأسیس</span><p>${escHtml(profile.since)}</p></div>`);
      const tagList = isDealerPage && P.dealerTags ? P.dealerTags(profile.id) : [];
      const tagsRow = tagList.length ? `<div class="sp-tags" dir="rtl">${tagList.map((t) => `<span class="sp-tag">#${escHtml(t)}</span>`).join("")}</div>` : "";
      const about = (tagsRow || "") + (rows.length ? `<div class="sp-list">${rows.join("")}</div>` : "");
      const cityLine = profile.city ? `<span>${escHtml(profile.city)}</span>` : "";
      const publicUrl = window.MARQUE_TRUST && window.MARQUE_TRUST.sellerPublicUrl ? window.MARQUE_TRUST.sellerPublicUrl(profile.id) : `${location.origin}${location.pathname}${location.search}#/seller/${encodeURIComponent(profile.id)}`;
      const storyOn = !!(isDealerPage && window.MARQUE_STORIES && window.MARQUE_STORIES.hasDealer && window.MARQUE_STORIES.hasDealer(profile.id));
      const shareIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3.5M7.5 7.5 12 3l4.5 4.5"/><path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5H16"/></svg>`;
      const plusIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
      const idBlock = `<div class="sp-id">
            ${isDealerPage ? "" : `<div class="sp-avatar">${avatarMarkup}</div>`}
            <h1 class="sp-name"><span>${escHtml(displayName)}</span>${verified}</h1>
            <p class="sp-sub"><bdi dir="ltr">@${escHtml(handle)}</bdi>${cityLine ? `<i class="sr-dot" aria-hidden="true"></i>${cityLine}` : ""}</p>${profile.tagline ? `<p class="sp-tagline">${escHtml(profile.tagline)}</p>` : ""}${storyOn ? `<button type="button" class="sp-story-chip" data-action="storyOpen" data-owner="dealer:${escHtml(profile.id)}" aria-label="مشاهده استوری نمایشگاه"><i aria-hidden="true"></i>استوری نمایشگاه</button>` : ""}
          </div>`;
      const statsBlock = `<div class="sp-stats">
            <div><strong data-pf-followers>${faNum(followers)}</strong><span>دنبال‌کننده</span></div>
            <div><strong>${faNum(sorted.length)}</strong><span>آگهی</span></div>
            ${thirdStat}
          </div>`;
      const sectionBlock = `<div class="sp-section"><h2>آگهی‌ها</h2>${(isMe && isDealerPage) ? `<button type="button" class="sp-add-listing" data-action="goSellDealer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>افزودن آگهی</button>` : `<span>${faNum(sorted.length)}</span>`}</div>`;
      if (isDealerPage) {
        // Showroom page: full-bleed banner (the showroom avatar) that fades to dark, name + handle,
        // stats, a [share] [follow] [message] row, then the hexagon trophy carousel.
        const shareBtn = `<button type="button" class="sp-icon-btn" data-action="shareShowroomPage" data-seller-id="${escHtml(profile.id)}" aria-label="اشتراک‌گذاری نمایشگاه">${shareIcon}</button>`;
        const thirdBtn = isMe
          ? (profile.verified ? `<button type="button" class="sp-icon-btn" data-action="storyAdd" data-as="dealer" aria-label="افزودن استوری">${plusIcon}</button>` : "")
          : chatBtn;
        setDynamicHTML(hero, `
        <section class="pf-hero sp-hero sp-hero--has-banner">
          <div class="sp-banner-cover" data-slot="showroom-cover" aria-hidden="true"></div>
          ${idBlock}
          ${statsBlock}
          <div class="sp-actions sp-actions--dealer">${shareBtn}${mainBtn}${thirdBtn}</div>
          ${awardsHTML}
          ${about}
          ${sectionBlock}
        </section>`);
      } else {
      setDynamicHTML(hero, `
        <section class="pf-hero sp-hero">
          <div class="sp-banner-cover" data-slot="showroom-cover" aria-hidden="true"></div>
          ${idBlock}
          <div class="sp-actions">${mainBtn}${isMe ? "" : chatBtn}</div>
          ${statsBlock}
          ${about}
          ${sectionBlock}
        </section>`);
      }
      initShowroomTrophies(hero);
      const showroomCover = hero.querySelector('[data-slot="showroom-cover"]');
      if (showroomCover && showroomBanner) {
        const safeBanner = String(showroomBanner).replace(/["\\\n\r]/g, "\\$&");
        showroomCover.style.backgroundImage = `url("${safeBanner}")`;
        showroomCover.classList.add("has-banner");
      }
      const sellerPage = root.querySelector('[data-page="seller"]'); if (sellerPage) { sellerPage.dataset.publicUrl = publicUrl; sellerPage.classList.add("sp-page"); }
      // Showroom cover = same behaviour as the account cover: a page-level layer pinned to the
      // viewport, starting behind the transparent header and ending below the stats row.
      if (isDealerPage) (sellerPage || root).classList.add("sp-dealer");
      const staleSellerCover = document.querySelector('#pageBlurWrap > .sp-cover-banner-layer'); if (staleSellerCover) staleSellerCover.remove();
      if (showroomCover && showroomBanner && isDealerPage) {
        (sellerPage || root).classList.add("sp-has-cover");
        const heroSection = hero.querySelector(".pf-hero");
        const statsEl = hero.querySelector(".sp-actions--dealer") || hero.querySelector(".sp-stats");
        // Everything after the stats row scrolls over the pinned cover, so group it under one solid backdrop.
        if (heroSection && statsEl && !heroSection.querySelector(".sp-below")) {
          const below = document.createElement("div"); below.className = "sp-below";
          while (statsEl.nextSibling) below.appendChild(statsEl.nextSibling);
          heroSection.appendChild(below);
        }
        requestAnimationFrame(() => {
          const blurWrap = document.getElementById("pageBlurWrap");
          const pageContent = document.getElementById("pageContent");
          if (!blurWrap || !pageContent || !pageContent.contains(root) || !showroomCover.isConnected) return;
          showroomCover.classList.add("sp-cover-banner-layer");
          blurWrap.insertBefore(showroomCover, pageContent);
          const syncSellerCover = () => {
            if (!showroomCover.isConnected || !root.isConnected) return;
            // Cover lives inside #pageBlurWrap and scrolls with the page: it starts at the top of the screen
            // (behind the header) and ends at the vertical middle of the avatar. Scroll-independent maths.
            const endEl = root.querySelector(".sp-id") || root.querySelector(".pf-hero");
            const stickyEl = document.getElementById("stickyHeaderGroup");
            if (!endEl) return;
            const er = endEl.getBoundingClientRect();
            const wrapTop = blurWrap.getBoundingClientRect().top;
            const headerH = stickyEl ? stickyEl.offsetHeight : 0;
            // Banner runs from the very top of the screen down to the bottom of the name block, then fades into the page.
            const height = Math.max(120, Math.round(headerH + (er.bottom - wrapTop)));
            showroomCover.style.setProperty("top", `${-headerH}px`);
            showroomCover.style.setProperty("height", `${height}px`);
          };
          syncSellerCover();
          if (window.__carmaaSellerCoverRO) { try { window.__carmaaSellerCoverRO.disconnect(); } catch (_) {} }
          if (typeof ResizeObserver === "function") {
            window.__carmaaSellerCoverRO = new ResizeObserver(() => syncSellerCover());
            const heroEl = root.querySelector(".pf-hero"); if (heroEl) window.__carmaaSellerCoverRO.observe(heroEl);
          }
          window.__carmaaSellerCoverSync = syncSellerCover;
          // The header floats transparently over the banner; once the banner has scrolled away it turns solid.
          if (!window.__carmaaSellerHdrBound) {
            const hdrSync = () => {
              const c = document.querySelector("#pageBlurWrap > .sp-cover-banner-layer");
              document.body.classList.toggle("sp-hdr-solid", !!c && window.scrollY > Math.max(40, c.offsetHeight - 130));
            };
            window.addEventListener("scroll", hdrSync, { passive: true });
            window.__carmaaSellerHdrBound = true;
          }
          document.body.classList.remove("sp-hdr-solid");
          if (!window.__carmaaSellerCoverResizeBound) {
            window.addEventListener("resize", () => { if (typeof window.__carmaaSellerCoverSync === "function") window.__carmaaSellerCoverSync(); }, { passive: true });
            window.__carmaaSellerCoverResizeBound = true;
          }
        });
      }
      if (sorted.length) setDynamicHTML(cards, sorted.map(renderExploreListingCard).join(""));
      else setDynamicHTML(cards, `<div class="seller-empty">هنوز آگهی‌ای منتشر نشده است.</div>`);
      if (window.CARMA_API?.enabled && window.CARMA_AUTH_USER && isDealerPage && /^[0-9a-f-]{36}$/i.test(String(profile.id || ''))) {
        window.CARMA_API.showrooms.followStatus(profile.id).then((result) => {
          if (!root.isConnected) return;
          const followButton = root.querySelector('[data-action="pfToggleFollow"]');
          if (followButton) {
            const following = result?.following === true;
            followButton.classList.toggle('is-following', following);
            followButton.setAttribute('aria-pressed', String(following));
            followButton.textContent = following ? 'دنبال می‌شود' : 'دنبال کردن';
          }
          const followerCount = root.querySelector('[data-pf-followers]');
          if (followerCount && Number.isFinite(Number(result?.followerCount))) followerCount.textContent = Number(result.followerCount).toLocaleString('fa-IR');
        }).catch(() => {});
      }
      if (window.CARMA_API?.enabled && window.CARMA_AUTH_USER && !isDealerPage && /^[0-9a-f-]{36}$/i.test(String(profile.id || ''))) {
        window.CARMA_API.social.user(profile.id).then((result) => {
          if (!root.isConnected || !result?.user) return;
          const followerCount = root.querySelector('[data-pf-followers]'); if (followerCount) followerCount.textContent = Number(result.user.follower_count || 0).toLocaleString('fa-IR');
          const followingCount = root.querySelector('[data-pf-following]'); if (followingCount && result.user.following_count != null) followingCount.textContent = Number(result.user.following_count || 0).toLocaleString('fa-IR');
        }).catch(()=>{});
        if (String(window.CARMA_AUTH_USER.id) !== String(profile.id)) window.CARMA_API.social.followStatus(profile.id).then((result) => {
          if (!root.isConnected) return;
          const followButton = root.querySelector('[data-action="pfToggleFollow"]'); if (!followButton) return;
          const following = result?.following === true; followButton.classList.toggle('is-following', following); followButton.setAttribute('aria-pressed', String(following)); followButton.textContent = following ? 'دنبال می‌شود' : 'دنبال کردن';
        }).catch(()=>{});
      }
    });
  }

  function renderVehicleScreen(listing) {
    const specs = buildVehicleSpecs(listing);
    const photoCount = vehiclePhotoCount(listing);
    const tel = String(listing.phone || '').replace(/[^0-9+]/g, '');
    const tabNames = ["توضیحات", "مشخصات", "وضعیت بدنه"];
    const esc = (value) => (typeof escHtml === "function" ? escHtml(String(value ?? "")) : String(value ?? "").replace(/[&<>\"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[ch])));
    const rawTitle = String(listing.title || specs.model || "").replace(/\b(19|20)\d{2}\b/g, "").trim();
    const englishMakeAliases = {
      "کیا": /^Kia\s+/i, "فورد": /^Ford\s+/i, "بنز": /^Mercedes[- ]Benz\s+/i,
      "هیوندا": /^Hyundai\s+/i, "تویوتا": /^Toyota\s+/i, "مازراتی": /^Maserati\s+/i,
      "پورشه": /^Porsche\s+/i, "شورلت": /^Chevrolet\s+/i, "آئودی": /^Audi\s+/i,
      "لند روور": /^Land\s+Rover\s+/i, "جگوار": /^Jaguar\s+/i, "نیسان": /^Nissan\s+/i,
      "مزدا": /^Mazda\s+/i, "میتسوبیشی": /^Mitsubishi\s+/i, "لکسوس": /^Lexus\s+/i,
      "ولوو": /^Volvo\s+/i, "جیپ": /^Jeep\s+/i, "کادیلاک": /^Cadillac\s+/i,
      "BMW": /^BMW\s+/i, "بی‌ام‌و": /^BMW\s+/i,
    };
    let englishModel = rawTitle.replace(englishMakeAliases[listing.brand] || /^$/, "").trim();
    if (!englishModel) englishModel = String(specs.model || rawTitle).trim();
    const localizedModels = [
      [/^Sportage\b/i, "اسپورتیج"], [/^Tucson\b/i, "توسان"], [/^Mustang\b/i, "موستانگ"],
      [/^F-150\b/i, "F-150"], [/^C300\b/i, "C300"], [/^GLE\b/i, "GLE"],
      [/^K5\b/i, "K5"], [/^Elantra\b/i, "الانترا"], [/^Camry\b/i, "کمری"],
      [/^RAV4\b/i, "RAV4"], [/^911\b/i, "۹۱۱"], [/^Macan\b/i, "ماکان"],
      [/^Defender\b/i, "دیفندر"], [/^Range Rover\b/i, "رنج‌روور"], [/^Q5\b/i, "Q5"],
      [/^A4\b/i, "A4"], [/^M3\b/i, "M3"], [/^X5\b/i, "X5"], [/^Camaro\b/i, "کامارو"],
      [/^Silverado\b/i, "سیلورادو"], [/^Ghibli\b/i, "گیبلی"], [/^Levante\b/i, "لوانته"],
    ];
    let localizedModel = englishModel;
    for (const [re, fa] of localizedModels) {
      if (re.test(englishModel)) { localizedModel = englishModel.replace(re, (m) => fa) ; break; }
    }
    const headingMain = String(listing.adTitle || "").trim() || `${listing.brand || "خودرو"} ${localizedModel}`.trim();
    const cityText = listing.city || (specs.dealer && specs.dealer.city) || "موقعیت ثبت نشده";
    return hydratePageShell("tpl-vehicle", root => {
      // The demo breadcrumb structure is dynamic, unlike the hard-coded prototype page.
      const crumbs = root.querySelector('[data-slot="vehicle-breadcrumbs"]');
      if (crumbs) crumbs.innerHTML = `<a href="#top" data-action="goHome">خانه</a><svg class="icon"><use href="#vd-i-chevron-left"></use></svg><a href="#top" data-action="goListings" data-brand="all">خودروها</a><svg class="icon"><use href="#vd-i-chevron-left"></use></svg><a href="#top" data-action="goListings" data-brand="${esc(listing.brand)}">${esc(listing.brand)}</a><svg class="icon"><use href="#vd-i-chevron-left"></use></svg><span>${esc(localizedModel)}</span>`;
      const photoCountEl = root.querySelector('[data-slot="photo-count"]');
      if (photoCountEl) photoCountEl.textContent = `${faNum(Math.min(state.thumb + 1, photoCount))} / ${faNum(photoCount)}`;
      const photoCountMini = root.querySelector('[data-slot="photo-count-mini"]');
      if (photoCountMini) photoCountMini.textContent = `${faNum(photoCount)} تصویر`;
      const hero = root.querySelector('[data-slot="hero"]');
      setDynamicHTML(hero, vehiclePhotoMarkup(listing, state.thumb, 'hero-photo', 'cover'));
      const heart = root.querySelector('[data-slot-id="like"]');
      const heartSvg = heart ? heart.querySelector('svg') : null;
      const liked = state.likedIds.includes(listing.id);
      if (heart) {
        heart.dataset.id = listing.id;
        heart.classList.toggle('is-active', liked);
        heart.setAttribute('aria-pressed', String(liked));
        heart.setAttribute('aria-label', liked ? 'حذف از نشان‌شده‌ها' : 'نشان کردن');
      }
      if (heartSvg) {
        const use = heartSvg.querySelector('use');
        if (use) use.setAttribute('href', '#vd-i-ios-bookmark');
        heartSvg.setAttribute('fill', liked ? 'currentColor' : 'none');
      }
      const titleMain = root.querySelector('[data-slot="title"]');
      if (titleMain) titleMain.textContent = headingMain;
      const adTitleEl = root.querySelector('[data-slot="ad-title"]');
      if (adTitleEl) { adTitleEl.textContent = ''; adTitleEl.hidden = true; }
      const titleEn = root.querySelector('[data-slot="title-en"]');
      if (titleEn) titleEn.textContent = String(listing.adTitle || '').trim() ? '' : localizedModel !== englishModel && englishModel && !/^\s*$/.test(englishModel) ? ` ${englishModel}` : '';
      const city = root.querySelector('[data-slot="city"]');
      if (city) city.innerHTML = `<svg class="icon icon-sm"><use href="#vd-i-pin"></use></svg><span>${esc(cityText)}</span><span class="dot"></span><svg class="icon icon-sm"><use href="#vd-i-clock"></use></svg><span>به‌روزرسانی ${esc(specs.listedAgo || "تازه")}</span>`;
      const locationCity = root.querySelector('[data-slot="location-city"]');
      if (locationCity) locationCity.textContent = cityText;

      const price = formatTomanPrice(listing.priceAmount ?? listing.price);
      const mainPrice = root.querySelector('[data-slot="price-main"]');
      if (mainPrice) mainPrice.textContent = price.amount;
      const priceUnit = root.querySelector('[data-slot="price-unit"]');
      if (priceUnit) priceUnit.textContent = price.unit || (isNegotiablePrice(listing.priceAmount ?? listing.price) ? "" : "تومان");
      const priceHint = root.querySelector('[data-slot="price-hint"]');
      if (priceHint) {
        const hintText = isNegotiablePrice(listing.priceAmount ?? listing.price)
          ? "برای دریافت قیمت دقیق و شرایط معامله مستقیماً با فروشنده هماهنگ کنید."
          : "";
        priceHint.textContent = hintText;
        priceHint.hidden = !hintText;
      }
      const oldPriceAction = root.querySelector('[data-action="showPriceHistory"]'); if (oldPriceAction) oldPriceAction.remove();
      const oldPriceHistory = root.querySelector('[data-slot="price-history"]'); if (oldPriceHistory) oldPriceHistory.remove();
      const negotiation = root.querySelector('[data-slot="negotiation-label"]');
      if (negotiation) negotiation.textContent = listing.tradeIn ? "قابل مذاکره و معاوضه" : "قیمت فروشنده";
      const featured = root.querySelector('[data-slot="featured"]');
      if (featured) featured.hidden = !(listing.promoted || listing.featured || listing.isFeatured);
      const patchSlot = root.querySelector('[data-slot="status-patches"]');
      if (patchSlot) { patchSlot.innerHTML = ""; patchSlot.hidden = true; } /* notrade-badge-removed: نشان «قابل معاوضه» بالای عنوان صفحه جزئیات حذف شد */

      const quickFacts = root.querySelector('[data-slot="quick-facts"]');
      const mileage = (typeof milesToKmLabel === "function" ? milesToKmLabel(listing.miles || "") : (listing.miles || "ثبت نشده"));
      // Color the year and mileage tiles by condition proxies, and use the
      // listing's actual paint value for the color tile's ambient glow.
      const readNumericValue = (value) => {
        const normalized = normalizePriceDigits(value);
        const digits = normalized.replace(/[^0-9]/g, "");
        const parsed = Number(digits);
        return Number.isFinite(parsed) && digits ? parsed : null;
      };
      const metricHue = (progress) => {
        const t = Math.max(0, Math.min(1, progress));
        // A red → amber → green scale, with newer/lower values becoming greener.
        return Math.round(t <= 0.5 ? t * 120 : 60 + (t - 0.5) * 130);
      };
      const yearValue = readNumericValue(specs.year);
      const yearProgress = yearValue == null ? 0.5 : (yearValue - 2016) / (2026 - 2016);
      const yearHue = metricHue(yearProgress);
      const mileageValue = readNumericValue(mileage);
      const mileageProgress = mileageValue == null ? 0.5 : 1 - Math.min(1, mileageValue / 200000);
      const mileageHue = metricHue(mileageProgress);
      const paintHexRaw = String(listing.color || "#8a8a86").trim();
      const paintHex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(paintHexRaw) ? paintHexRaw : "#8a8a86";
      const paintLongHex = paintHex.length === 4 ? `#${paintHex[1]}${paintHex[1]}${paintHex[2]}${paintHex[2]}${paintHex[3]}${paintHex[3]}` : paintHex;
      let paintRgb = [138, 138, 134];
      const paintMatch = paintLongHex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      if (paintMatch) paintRgb = [parseInt(paintMatch[1], 16), parseInt(paintMatch[2], 16), parseInt(paintMatch[3], 16)];
      // Very dark paint needs a slightly lifted graphite glow so the effect
      // remains visible on the site's dark glass rather than disappearing.
      if (Math.max(...paintRgb) < 48) paintRgb = [88, 91, 101];
      const paintRgbCss = paintRgb.join(",");
      if (quickFacts) quickFacts.innerHTML = [
        `<div class="fact fact--mileage" style="--metric-hue:${mileageHue}"><svg class="icon"><use href="#vd-i-gauge"></use></svg><span class="fact-value">${esc(mileage || "ثبت نشده")}</span><span class="fact-name">کارکرد</span></div>`,
        `<div class="fact fact--year" style="--metric-hue:${yearHue}"><svg class="icon"><use href="#vd-i-calendar"></use></svg><span class="fact-value">${esc(specs.year || "—")}</span><span class="fact-name">سال ساخت</span></div>`,
        `<div class="fact fact--paint" style="--paint-rgb:${paintRgbCss}"><svg class="icon"><use href="#vd-i-palette"></use></svg><span class="fact-value">${esc(specs.exteriorColor || "ثبت نشده")}</span><span class="fact-name">رنگ بدنه</span></div>`
      ].join("");

      const description = root.querySelector('[data-slot="vehicle-description"]');
      if (description) description.textContent = String(listing.description || `این آگهی برای ${specs.year} ${listing.brand} ${specs.model} ثبت شده است. برای دریافت اطلاعات دقیق‌تر درباره وضعیت بدنه، سوابق سرویس و شرایط کارشناسی با فروشنده گفت‌وگو کنید.`);
      // Replace the old advert-highlight chips with structured technical and ownership data.
      // Missing ownership information is shown explicitly as "ثبت نشده" instead of guessed.
      const displayValue = (...values) => {
        for (const value of values) {
          if (value === undefined || value === null) continue;
          if (typeof value === "object") {
            const nested = value.label ?? value.status ?? value.value ?? value.name;
            if (nested !== undefined && nested !== null && String(nested).trim()) return String(nested).trim();
            continue;
          }
          const text = String(value).trim();
          if (text && text !== "null" && text !== "undefined") return text;
        }
        return "ثبت نشده";
      };
      const displayStatus = (...values) => {
        for (const value of values) {
          if (typeof value === "boolean") return value ? "دارد" : "ندارد";
          if (value !== undefined && value !== null && typeof value !== "object" && String(value).trim()) return String(value).trim();
          if (value && typeof value === "object") {
            const nested = value.label ?? value.status ?? value.value ?? value.name;
            if (nested !== undefined && nested !== null && String(nested).trim()) return String(nested).trim();
          }
        }
        return "ثبت نشده";
      };
      const ownership = listing.ownership && typeof listing.ownership === "object" ? listing.ownership : {};
      const technicalRows = [
        ["نوع گیربکس", displayValue(specs.transmission, listing.transmission), "gearbox"],
        ["نوع موتور", displayValue(listing.engineType, listing.engine, specs.engine), "engine"],
        ["نوع سوخت", displayValue(specs.fuelType, listing.fuelType), "fuel"],
        ...(listing.engineVolume ? [["حجم موتور", listing.engineVolume + " سی‌سی", "gauge"]] : []),
        ...(listing.cylinders ? [["تعداد سیلندر", listing.cylinders, "cyl"]] : []),
        ["انتقال قدرت", displayValue(specs.driveTrain, listing.driveTrain), "drivetrain"],
        ...(listing.mileageType === "presale" && listing.deliveryTime ? [["زمان تحویل", listing.deliveryTime, "clock"]] : [])
      ];
      const ownershipRows = [
        ["نوع سند", displayStatus(listing.documentType, listing.deedType, listing.ownershipDocumentType, listing.titleDocumentType, ownership.documentType, ownership.deedType, ownership.titleDocumentType), "file-text"],
        ["وضعیت وکالت", displayStatus(listing.powerOfAttorneyStatus, listing.agencyStatus, listing.wakalaStatus, listing.powerOfAttorney, listing.hasPowerOfAttorney, listing.authorizationStatus, ownership.powerOfAttorneyStatus, ownership.agencyStatus, ownership.powerOfAttorney, ownership.hasPowerOfAttorney), "pen-sign"],
        ["وضعیت بیمه", displayStatus(listing.insuranceStatus, listing.insurance, listing.insuranceType, listing.hasInsurance, ownership.insuranceStatus, ownership.insurance, ownership.hasInsurance), "shield"]
      ];
      const isMissingSpec = (value) => value === "ثبت نشده";
      const specIcon = (name) => `<svg class="icon" aria-hidden="true"><use href="#vd-i-${name}"></use></svg>`;
      // Technical specs: engraved tiles in one shared panel.
      const renderTechTiles = (rows) => rows.map(([label, value, icon]) => {
        // «انتقال قدرت»: فقط مخفف انگلیسی داخل پرانتز (FWD / RWD / AWD / 4WD)
        if (label === "انتقال قدرت") { const m = String(value).match(/\(([A-Za-z0-9]+)\)/); if (m) value = m[1].toUpperCase(); }
        const ltr = label === "انتقال قدرت" && /^[A-Za-z0-9]+$/.test(String(value));
        const bg3d = { "نوع سوخت": "is-fuel", "نوع موتور": "is-engine", "نوع گیربکس": "is-gearbox", "انتقال قدرت": "is-drivetrain" }[label];
        return `<div class="vx-t${bg3d ? " " + bg3d : ""}${isMissingSpec(value) ? " is-empty" : ""}"><span class="vx-ic">${specIcon(icon)}</span><div><small>${esc(label)}</small><strong${ltr ? ' dir="ltr" style="text-align:right"' : ' dir="auto"'}>${esc(value)}</strong></div></div>`;
      }).join("");
      // Ownership: a checklist where each document is either on record or still open.
      const renderOwnershipRows = (rows) => rows.map(([label, value, icon]) => {
        const missing = isMissingSpec(value);
        return `<div class="vx-d${missing ? " off" : ""}"><span class="vx-ic">${specIcon(icon)}</span><span class="vx-tx"><small>${esc(label)}</small><strong dir="auto">${esc(value)}</strong></span>${missing ? "" : `<svg class="icon vx-ck" aria-label="ثبت شده"><use href="#vd-i-badge-check"></use></svg>`}</div>`;
      }).join("");
      const technicalSlot = root.querySelector('[data-slot="technical-specs"]');
      if (technicalSlot) { technicalSlot.innerHTML = renderTechTiles(technicalRows); const tc = root.querySelector('[data-slot="technical-count"]'); if (tc) tc.textContent = `${faNum(technicalRows.length)} مورد`; }
      const ownershipSlot = root.querySelector('[data-slot="ownership-specs"]');
      if (ownershipSlot) { ownershipSlot.innerHTML = renderOwnershipRows(ownershipRows); }
      const ownershipDone = ownershipRows.filter((row) => !isMissingSpec(row[1])).length;
      const ownershipCaption = root.querySelector('[data-slot="ownership-caption"]');
      if (ownershipCaption) {
        ownershipCaption.innerHTML = `<span class="vx-meter" aria-hidden="true">${ownershipRows.map((_, i) => `<i${i < ownershipDone ? ' class="on"' : ""}></i>`).join("")}</span>${faNum(ownershipDone)} از ${faNum(ownershipRows.length)} مورد ثبت شده`;
      }
      const ownershipNote = root.querySelector('[data-slot="ownership-note"]');
      if (ownershipNote) ownershipNote.hidden = ownershipDone === ownershipRows.length;

      const thumbs = root.querySelector('[data-slot="thumbs"]');
      if (thumbs) {
        thumbs.innerHTML = "";
        // Horizontal rail: every photo gets a thumbnail (no "gallery" box any more).
        const thumbsToShow = photoCount;
        for (let i = 0; i < thumbsToShow; i++) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `thumb${i === state.thumb ? ' active' : ''}`;
          button.dataset.action = 'setThumb';
          button.dataset.index = String(i);
          button.setAttribute('aria-label', `تصویر ${faNum(i + 1)}`);
          button.innerHTML = vehiclePhotoMarkup(listing, i, 'thumb-image', 'cover');
          thumbs.appendChild(button);
        }
      }

      const sellerSlot = root.querySelector('[data-slot="seller"]'); if (sellerSlot) sellerSlot.innerHTML = "";
      const avaHost = root.querySelector(".price-card .price-heading");
      if (avaHost && !avaHost.querySelector(".cm-seller-ava")) { avaHost.classList.add("has-seller-ava"); avaHost.insertAdjacentHTML("afterbegin", renderSellerAvatarMarkup(listing)); }
      const stickyPrice = root.querySelector('[data-slot="price-sticky"]');
      if (stickyPrice) {
        const cp = formatCompactPrice(listing.priceAmount ?? listing.price);
        stickyPrice.textContent = cp.num;
        const su = root.querySelector(".detail-cta-price-unit"); if (su) su.textContent = cp.unit;
        stickyPrice.title = formatDetailPrice(listing.priceAmount ?? listing.price);
        requestAnimationFrame(() => requestAnimationFrame(() => fitTextToWidth(stickyPrice, 20, 12)));
      }
      const phone = root.querySelector('[data-slot="phone"]'); if (phone) { phone.href = `tel:${tel}`; phone.dataset.id = listing.id; }
      const contact = root.querySelector('[data-slot-id="contact"]'); if (contact) contact.dataset.id = listing.id;
      const stickyPhone = root.querySelector('[data-slot="phone-sticky"]'); if (stickyPhone) { stickyPhone.href = `tel:${tel}`; stickyPhone.dataset.id = listing.id; }
      const stickyContact = root.querySelector('[data-slot-id="contact-sticky"]'); if (stickyContact) stickyContact.dataset.id = listing.id;
      renderVehicleTabsInto(root, listing, specs, tabNames);
      (function setupVehicleV2Tabs() {
        const tabEls = [].slice.call(root.querySelectorAll('[data-vx-tab]'));
        if (!tabEls.length) return;
        const key = String(listing.id);
        if (window.__vxTabState?.id !== key) window.__vxTabState = { id: key, i: 0 };
        const pick = (i, focus) => {
          window.__vxTabState.i = i;
          tabEls.forEach((t, k) => {
            const on = k === i;
            t.setAttribute('aria-selected', String(on));
            t.tabIndex = on ? 0 : -1;
            const pane = root.querySelector('#' + t.getAttribute('aria-controls'));
            if (pane) pane.classList.toggle('on', on);
          });
          if (focus) tabEls[i].focus();
          if (i === 2 && typeof renderVehicleMapInto === 'function') {
            const mapSlot = root.querySelector('[data-slot="detail-map"]');
            if (mapSlot && !mapSlot.querySelector('.vmap')) renderVehicleMapInto(root, listing, specs);
            else if (mapSlot) window.dispatchEvent(new Event('resize'));
          }
        };
        tabEls.forEach((t, i) => {
          t.addEventListener('click', () => pick(i));
          t.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); pick((i + (e.key === 'ArrowLeft' ? 1 : -1) + tabEls.length) % tabEls.length, true); }
          });
        });
        pick(window.__vxTabState.i, false);
      })();
      if (typeof window.renderMarketplaceTrustFeatures === "function") window.renderMarketplaceTrustFeatures(root, listing);
    });
  }

  if (!window.__carmaaPriceHistoryHandler) {
    window.__carmaaPriceHistoryHandler = true;
    document.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action="showPriceHistory"]'); if (!button) return;
      event.preventDefault(); if (button.dataset.loading === '1') return;
      const root = button.closest('[data-page="vehicle"]') || button.closest('.vehicle-detail-page');
      const panel = root?.querySelector('[data-slot="price-history"]'); if (!panel) return;
      button.dataset.loading = '1'; button.disabled = true; button.textContent = 'در حال دریافت…'; panel.hidden = false; panel.textContent = 'در حال بارگذاری تاریخچه قیمت…';
      try {
        const result = await window.CARMA_API.listings.priceHistory(button.dataset.id);
        const rows = Array.isArray(result?.items) ? result.items : [];
        const money = (value) => value == null ? 'توافقی' : `${Number(value).toLocaleString('fa-IR')} تومان`;
        panel.innerHTML = rows.length ? `<strong>تغییرات ثبت‌شده قیمت</strong><ol class="mt-2 space-y-2">${rows.map((row) => `<li class="border-b border-white/10 pb-2"><span>${new Date(row.changed_at).toLocaleDateString('fa-IR')}</span><div>${money(row.old_price_toman)} ← ${money(row.new_price_toman)}</div></li>`).join('')}</ol>` : 'برای این آگهی هنوز تغییر قیمت ثبت نشده است.';
      } catch (error) { panel.textContent = error?.message || 'دریافت تاریخچه قیمت ممکن نشد.'; }
      finally { button.dataset.loading = '0'; button.disabled = false; button.textContent = 'مشاهده تاریخچه تغییر قیمت'; }
    });
  }

  const SHOWROOM_RATINGS_KEY = "carmaa_showroom_ratings_v1";

  function showroomReadRatings() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(SHOWROOM_RATINGS_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch (_) { return {}; }
  }

  // ---- تاریخ عضویت نمایشگاه (جایگزین امتیاز در کارت‌ها و صفحه نمایشگاه) ----
  const SHOWROOM_JOINED_KEY = "carmaa_showroom_joined_v1";
  function showroomReadJoined() {
    try { const raw = JSON.parse(window.localStorage.getItem(SHOWROOM_JOINED_KEY) || "{}"); return raw && typeof raw === "object" ? raw : {}; } catch (_) { return {}; }
  }
  function showroomWriteJoined(map) { try { window.localStorage.setItem(SHOWROOM_JOINED_KEY, JSON.stringify(map)); } catch (_) {} }
  // ثبت لحظه‌ی عضویت (فقط یک بار؛ هنگام ساخت نمایشگاه صدا زده می‌شود)
  window.showroomMarkJoined = function (id) {
    id = String(id || ""); if (!id) return;
    if (window.CARMA_API?.enabled) return; // server mode: created_at on the server is the join date
    const map = showroomReadJoined();
    if (!map[id]) { map[id] = Date.now(); showroomWriteJoined(map); }
  };
  function showroomJoinedAt(id) {
    id = String(id || ""); if (!id) return 0;
    // Server mode: the join date is the showroom's created_at on the server (nothing is stored in the browser).
    if (window.CARMA_API?.enabled) {
      const sr = (Array.isArray(window.CARMA_SERVER_SHOWROOMS) ? window.CARMA_SERVER_SHOWROOMS : []).find((x) => String(x.id) === id);
      const t = sr && sr.created_at ? Date.parse(sr.created_at) : NaN;
      if (Number.isFinite(t)) return t;
      const mine = typeof state !== "undefined" && state.dealership && String(state.dealership.id) === id && state.dealership.createdAt ? Date.parse(state.dealership.createdAt) : NaN;
      return Number.isFinite(mine) ? mine : 0;
    }
    const map = showroomReadJoined();
    if (map[id]) return Number(map[id]) || 0;
    // نمایشگاه‌های نمایشی: تاریخ فرضی و ثابت برای هر نمایشگاه
    if (typeof demoShowroomById === "function" && demoShowroomById(id)) {
      return Date.UTC(2026, 9, 1) - (45 + (demoHash("m" + id) % 640)) * 86400000;
    }
    // نمایشگاه‌های قدیمی بدون رکورد: اولین باری که دیده می‌شوند ثبت می‌شود
    map[id] = Date.now(); showroomWriteJoined(map);
    return map[id];
  }
  function showroomJoinedLabel(id) {
    const t = showroomJoinedAt(id); if (!t) return "—";
    try { return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long" }).format(new Date(t)); } catch (_) { return "—"; }
  }

  function showroomRatingFor(id) {
    if (window.CARMA_API?.enabled) {
      const server = (Array.isArray(window.CARMA_SERVER_SHOWROOMS) ? window.CARMA_SERVER_SHOWROOMS : []).find((x) => String(x.id) === String(id));
      return server ? { count: Number(server.review_count || 0), average: Number(server.rating || 0) } : { count: 0, average: 0 };
    }
    const all = showroomReadRatings();
    const record = all[String(id)] || {};
    const votes = record.votes && typeof record.votes === "object" ? Object.values(record.votes) : [];
    const valid = votes.map(Number).filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
    const seed = typeof demoRatingSeed === "function" ? demoRatingSeed(id) : null;
    if (seed) { const sum = valid.reduce((a, b) => a + b, 0); const n = seed.count + valid.length; return { count: n, average: (seed.average * seed.count + sum) / n }; }
    return { count: valid.length, average: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0 };
  }

  function showroomActivityScore(listings, followers) {
    const list = Array.isArray(listings) ? listings : [];
    const count = list.length;
    const latestAt = list.reduce((max, item) => Math.max(max, Number(item && item.createdAt) || 0), 0);
    const age = latestAt ? Math.max(0, Date.now() - latestAt) : Infinity;
    const freshScore = age < 86400000 ? 25 : age < 7 * 86400000 ? 19 : age < 30 * 86400000 ? 12 : count ? 5 : 0;
    return Math.min(100, 12 + Math.min(52, count * 14) + freshScore + Math.min(14, Math.max(0, followers || 0) * 2));
  }

  // Rank movements are tracked from one observed full-directory ranking to the next.
  // This standalone demo stores history in this browser; a production multi-user site
  // should calculate and persist ranking snapshots on the server.
  const SHOWROOM_RANK_HISTORY_KEY = "carmaa_showroom_rank_history_v1";
  const SHOWROOM_RANK_SORT_KEYS = ["activity", "listings", "recent", "popular", "rating"];

  function compareShowroomRanking(a, b, sortKey) {
    let result = 0;
    if (sortKey === "listings") result = (b.listings.length - a.listings.length) || (b.activityScore - a.activityScore);
    else if (sortKey === "recent") result = (b.latestAt - a.latestAt) || (b.activityScore - a.activityScore);
    else if (sortKey === "popular") result = (b.followers - a.followers) || (b.activityScore - a.activityScore);
    else if (sortKey === "rating") result = (b.rating.average - a.rating.average) || (b.rating.count - a.rating.count) || (b.activityScore - a.activityScore);
    else result = (b.activityScore - a.activityScore) || (b.listings.length - a.listings.length) || (b.latestAt - a.latestAt);
    return result || String(a.id).localeCompare(String(b.id), "fa");
  }

  function sortShowroomsForRanking(items, sortKey) {
    return (Array.isArray(items) ? items : []).slice().sort((a, b) => compareShowroomRanking(a, b, sortKey));
  }

  // Server mode: movements come from GET /showrooms/rank-movements (computed + stored on the server).
  function loadServerRankMovements() {
    if (!window.CARMA_API?.enabled || !window.CARMA_API.showrooms?.rankMovements) return;
    const now = Date.now();
    if (window.CARMA_RANK_MOVEMENTS_AT && now - window.CARMA_RANK_MOVEMENTS_AT < 60000) return;
    window.CARMA_RANK_MOVEMENTS_AT = now;
    window.CARMA_API.showrooms.rankMovements().then((res) => {
      const m = res && res.movementsBySort;
      if (!m || typeof m !== "object") return;
      const before = JSON.stringify(window.CARMA_RANK_MOVEMENTS || {});
      window.CARMA_RANK_MOVEMENTS = m;
      if (JSON.stringify(m) !== before && typeof render === "function" && state.route && (state.route.page === "dealers" || state.route.page === "home")) render();
    }).catch(() => { window.CARMA_RANK_MOVEMENTS_AT = 0; });
  }

  function readShowroomRankHistory() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SHOWROOM_RANK_HISTORY_KEY) || "null");
      if (!saved || typeof saved !== "object") return { ranksBySort: {}, movementsBySort: {} };
      return {
        ranksBySort: saved.ranksBySort && typeof saved.ranksBySort === "object" ? saved.ranksBySort : {},
        movementsBySort: saved.movementsBySort && typeof saved.movementsBySort === "object" ? saved.movementsBySort : {}
      };
    } catch (_) {
      return { ranksBySort: {}, movementsBySort: {} };
    }
  }

  function buildShowroomRankContext(items) {
    if (window.CARMA_API?.enabled) {
      loadServerRankMovements();
      const serverMoves = window.CARMA_RANK_MOVEMENTS && typeof window.CARMA_RANK_MOVEMENTS === "object" ? window.CARMA_RANK_MOVEMENTS : {};
      const ranksBySort = {}, movementsBySort = {};
      SHOWROOM_RANK_SORT_KEYS.forEach((sortKey) => {
        const ranks = {};
        sortShowroomsForRanking(items, sortKey).forEach((item, index) => { ranks[String(item.id)] = index + 1; });
        ranksBySort[sortKey] = ranks;
        movementsBySort[sortKey] = serverMoves[sortKey] && typeof serverMoves[sortKey] === "object" ? serverMoves[sortKey] : {};
      });
      return { ranksBySort, movementsBySort };
    }
    const saved = readShowroomRankHistory();
    const ranksBySort = {};
    const movementsBySort = {};
    const presentIds = new Set((Array.isArray(items) ? items : []).map((item) => String(item.id)));
    const now = Date.now();

    SHOWROOM_RANK_SORT_KEYS.forEach((sortKey) => {
      const sorted = sortShowroomsForRanking(items, sortKey);
      const ranks = {};
      sorted.forEach((item, index) => { ranks[String(item.id)] = index + 1; });
      const oldRanks = saved.ranksBySort[sortKey] && typeof saved.ranksBySort[sortKey] === "object" ? saved.ranksBySort[sortKey] : {};
      const movements = { ...(saved.movementsBySort[sortKey] || {}) };

      Object.keys(ranks).forEach((id) => {
        const before = Number(oldRanks[id]);
        const after = ranks[id];
        if (Number.isFinite(before) && before > 0 && before !== after) {
          movements[id] = {
            from: before,
            to: after,
            delta: before - after,
            changedAt: now
          };
        }
      });

      // Do not show stale movement history for showrooms that are no longer listed.
      Object.keys(movements).forEach((id) => { if (!presentIds.has(id)) delete movements[id]; });
      ranksBySort[sortKey] = ranks;
      movementsBySort[sortKey] = movements;
    });

    try {
      window.localStorage.setItem(SHOWROOM_RANK_HISTORY_KEY, JSON.stringify({
        version: 1,
        updatedAt: now,
        ranksBySort,
        movementsBySort
      }));
    } catch (_) { /* Ranking stays usable when browser storage is unavailable. */ }

    return { ranksBySort, movementsBySort };
  }

  // Illustrative movement for the standalone demo only. Real saved movement always wins.
  // Remove this helper when server-side historical ranking snapshots are available.
  function demoShowroomRankMovement(rank) {
    const samples = {
      1: { from: 3, to: 1, delta: 2 },
      2: { from: 1, to: 2, delta: -1 },
      3: { from: 4, to: 3, delta: 1 },
      4: { from: 2, to: 4, delta: -2 },
      6: { from: 8, to: 6, delta: 2 }
    };
    const sample = samples[Number(rank)];
    return sample ? { ...sample, isDemo: true } : null;
  }

  function showroomRankMovementHTML(movement) {
    if (!movement || !Number.isFinite(Number(movement.delta)) || Number(movement.delta) === 0) return "";
    const delta = Number(movement.delta);
    const up = delta > 0;
    const amount = Math.abs(delta);
    const phrase = `${up ? "صعود" : "افت"} ${amount.toLocaleString("fa-IR")} رتبه؛ از رتبه ${Number(movement.from).toLocaleString("fa-IR")} به رتبه ${Number(movement.to).toLocaleString("fa-IR")}${movement.isDemo ? "؛ نمونه نمایشی" : ""}`;
    const trendIcon = up
      ? `<svg class="sr-rank-trend-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5 9.2 11l3.7 3.7L20 6.5"/><path d="M14.5 6.5H20v5.5"/></svg>`
      : `<svg class="sr-rank-trend-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 7.5 5.2 5.5 3.7-3.7L20 17.5"/><path d="M14.5 17.5H20V12"/></svg>`;
    return `<span class="sr-rank-movement ${up ? "is-up" : "is-down"}${movement.isDemo ? " is-demo" : ""}" title="${phrase}" aria-label="${phrase}">${trendIcon}<strong class="sr-rank-movement-value">${amount.toLocaleString("fa-IR")}</strong></span>`;
  }

  function getShowroomDirectoryItems() {
    const byId = new Map();
    const add = (id, values) => {
      id = String(id || "");
      if (!id || !values || values.type === "personal") return;
      const profile = typeof sellerProfileById === "function" ? sellerProfileById(id) : null;
      const existing = byId.get(id) || {};
      const profileListings = profile && Array.isArray(profile.listings) ? profile.listings : [];
      const sourceListings = Array.isArray(values.listings) ? values.listings : [];
      const listings = profileListings.length ? profileListings : (existing.listings || sourceListings);
      const allListings = listings.slice();
      const latestAt = allListings.reduce((max, l) => Math.max(max, Number(l && l.createdAt) || 0), 0);
      const followersAPI = window.MR_PROFILE || {};
      const followers = Number.isFinite(Number(values.followers)) ? Number(values.followers) : (typeof followersAPI.followersCount === "function" ? (Number(followersAPI.followersCount(id)) || 0) : 0);
      const brandName = values.brand || existing.brand || (id.startsWith("brand:") ? id.slice(6) : "");
      const brandRec = (Array.isArray(BRANDS) ? BRANDS : []).find((b) => b && b.name === brandName);
      const brandLogo = ""; // لوگوی واقعی برند نمایش داده نمی‌شود؛ آواتار فرضی جایگزین است
      const logo = (profile && profile.logo) || values.logo || existing.logo || (typeof sellerAvatarFor === "function" ? sellerAvatarFor("dealer", id) : "") || brandLogo;
      const banner = (profile && profile.banner) || (typeof sellerBannerFor === "function" ? sellerBannerFor(id) : "");
      const item = {
        id,
        name: String((profile && profile.name) || values.name || existing.name || "نمایشگاه خودرو"),
        city: String((profile && profile.city) || values.city || existing.city || "موقعیت ثبت نشده"),
        verified: !!((profile && profile.verified) || values.verified || existing.verified),
        description: String((profile && profile.description) || values.description || existing.description || ""),
        logo,
        banner,
        brand: brandName,
        listings: allListings,
        latestAt,
        followers,
        rating: showroomRatingFor(id),
        founding: Number(values.founding || existing.founding || 0) || 0,
      };
      item.activityScore = showroomActivityScore(allListings, followers);
      byId.set(id, item);
    };

    (Array.isArray(LISTINGS) ? LISTINGS : []).forEach((listing) => {
      const seller = typeof listingSeller === "function" ? listingSeller(listing) : null;
      if (seller && seller.type === "dealer") add(seller.id, { ...seller, brand: String(listing.brand || "") });
    });

    // Curated demo showrooms are permitted only in the offline preview. API mode must never mix demo inventory with server records.
    // Brand showrooms are sample data: off by default so only showrooms users really created are listed.
    const SHOW_SAMPLE_SHOWROOMS = false;
    if (SHOW_SAMPLE_SHOWROOMS && !window.CARMA_API?.enabled) {
    Object.entries(typeof DEALERS === "object" && DEALERS ? DEALERS : {}).forEach(([brand, dealer]) => {
      const id = "brand:" + brand;
      const brandListings = (Array.isArray(LISTINGS) ? LISTINGS : []).filter((listing) => {
        if (listing.brand !== brand || listing.privateSeller) return false;
        const seller = typeof listingSeller === "function" ? listingSeller(listing) : null;
        return !!seller && seller.type === "dealer" && seller.id === id;
      });
      // Keep only brand showroom cards that can open a real seller profile.
      if (brandListings.length || (typeof sellerProfileById === "function" && sellerProfileById(id))) {
        add(id, { ...dealer, brand, type: "dealer", listings: brandListings });
      }
    });

    }
    // Approved user-created showrooms can appear even before their first listing (offline preview only).
    if (!window.CARMA_API?.enabled) try {
      const metaRaw = JSON.parse(window.localStorage.getItem("marqueAccountMeta") || "{}");
      const dealerRecords = MR_STORE && typeof MR_STORE.read === "function" ? ((MR_STORE.read() || {}).dealers || {}) : {};
      Object.entries(dealerRecords).forEach(([phone, record]) => {
        if (!record || record.status !== "approved") return;
        const meta = metaRaw && metaRaw[phone] ? metaRaw[phone] : {};
        const id = typeof sellerIdForPhone === "function" ? sellerIdForPhone(phone) : "";
        if (!id || (!meta.dealerName && !record.name)) return;
        if (typeof sellerProfileById === "function" && sellerProfileById(id)) {
          add(id, { type: "dealer", name: meta.dealerName || record.name, city: meta.dealerCity || "", logo: typeof sellerAvatarFor === "function" ? sellerAvatarFor("dealer", id) : "", banner: typeof sellerBannerFor === "function" ? sellerBannerFor(id) : "", verified: true });
        }
      });
    } catch (_) {}
    if (state && state.account && state.dealership && state.dealership.status === "approved" && typeof sellerIdForPhone === "function") {
      // With the server, the showroom's public id is its own id (the same entry the server list produces); the
      // phone-derived id would list the same showroom twice.
      add(state.dealership.id || sellerIdForPhone(state.account), { ...state.dealership, type: "dealer", logo: state.dealership.logo || "", banner: state.dealership.banner || "", verified: true });
    }

    (Array.isArray(window.CARMA_SERVER_SHOWROOMS) ? window.CARMA_SERVER_SHOWROOMS : []).forEach((showroom) => {
      if (!showroom || !showroom.id) return;
      const id = String(showroom.id);
      const listings = (Array.isArray(LISTINGS) ? LISTINGS : []).filter((l) => String(l.showroomId || l.showroom_id || "") === id);
      add(id, { type: "dealer", name: showroom.name, city: showroom.city, description: showroom.description, logo: showroom.logo_url || "", banner: showroom.banner_url || "", verified: showroom.status === "approved", followers: Number(showroom.follower_count || 0), founding: Number(showroom.founding_number || 0), listings });
    });
    return Array.from(byId.values()).map((item) => ({ ...item, rating: showroomRatingFor(item.id) }));
  }

  const SHOWROOM_AWARD_DEFS = {
    activity: { label: "فعال‌ترین", title: "فعال‌ترین نمایشگاه", description: "بالاترین شاخص فعالیت در میان نمایشگاه‌ها", symbol: "↗" },
    inventory: { label: "بیشترین موجودی", title: "بیشترین موجودی", description: "دارای بیشترین تعداد آگهی فعال در فهرست نمایشگاه‌ها", symbol: "▤" },
    fresh: { label: "موجودی به‌روز", title: "موجودی به‌روز", description: "حداقل یک آگهی در ۷ روز گذشته ثبت شده است", symbol: "↻" },
    quality: { label: "آگهی‌های کامل", title: "آگهی‌های کامل", description: "بخش بزرگی از آگهی‌ها عکس و مشخصات پایه دارند", symbol: "✓" },
    rating: { label: "خوش‌امتیاز", title: "خوش‌امتیاز", description: "میانگین امتیاز حداقل ۴٫۵ از ۵ با دست‌کم ۳ رأی", symbol: "★" },
    popular: { label: "محبوب‌ترین", title: "محبوب‌ترین", description: "بیشترین دنبال‌کننده در میان نمایشگاه‌ها", symbol: "♡" },
    profile: { label: "پروفایل کامل", title: "پروفایل کامل", description: "اطلاعات معرفی، شهر و تصویر نمایشگاه تکمیل شده است", symbol: "◇" },
    founding: { label: "عضو بنیان‌گذار", title: "عضو بنیان‌گذار CarMaa", description: "از نخستین نمایشگاه‌هایی که پیش از لانچ به CarMaa پیوستند", symbol: "◆" }
  };

  // Awards are derived from current listing/profile/rating data. Response-time awards
  // are intentionally omitted because this client currently has no reliable response-time metric.
  function getShowroomAwards(item, directoryItems) {
    if (!item || !item.id) return [];
    const directory = Array.isArray(directoryItems) ? directoryItems : getShowroomDirectoryItems();
    const current = directory.find((entry) => String(entry.id) === String(item.id)) || {};
    const data = { ...current, ...item };
    const listings = Array.isArray(data.listings) ? data.listings : [];
    const count = listings.length;
    const followers = Math.max(0, Number(data.followers) || 0);
    const latestAt = Math.max(Number(data.latestAt) || 0, ...listings.map((listing) => Number(listing && listing.createdAt) || 0));
    const score = Number.isFinite(Number(data.activityScore)) ? Number(data.activityScore) : showroomActivityScore(listings, followers);
    const rating = data.rating || showroomRatingFor(data.id);
    const maxActivity = Math.max(0, ...directory.map((entry) => Number(entry.activityScore) || showroomActivityScore(entry.listings || [], entry.followers || 0)));
    const maxInventory = Math.max(0, ...directory.map((entry) => (entry.listings || []).length));
    const maxFollowers = Math.max(0, ...directory.map((entry) => Number(entry.followers) || 0));
    const awards = [];
    if (Number(data.founding) > 0) { const fn = Number(data.founding).toLocaleString("fa-IR"); awards.push({ key: "founding", ...SHOWROOM_AWARD_DEFS.founding, label: "بنیان‌گذار " + fn, description: "عضو شماره " + fn + " از نخستین نمایشگاه‌های CarMaa" }); }

    if (count > 0 && score >= maxActivity) awards.push({ key: "activity", ...SHOWROOM_AWARD_DEFS.activity });
    if (count >= 3 && count === maxInventory) awards.push({ key: "inventory", ...SHOWROOM_AWARD_DEFS.inventory });

    const completeListingCount = listings.filter((listing) => {
      const photos = Array.isArray(listing && listing.photos) ? listing.photos.some((photo) => typeof photo === "string" && photo.trim()) : !!(listing && (listing.photo || listing.image));
      const hasTitle = !!String((listing && (listing.title || listing.model || listing.brand)) || "").trim();
      const hasSpec = !!((listing && listing.year) || (listing && listing.mileage) || (listing && listing.price));
      return photos && hasTitle && hasSpec;
    }).length;
    if (count >= 3 && completeListingCount / count >= 0.7) awards.push({ key: "quality", ...SHOWROOM_AWARD_DEFS.quality });

    const age = latestAt ? Date.now() - latestAt : Infinity;
    if (count > 0 && age >= 0 && age <= 7 * 86400000) awards.push({ key: "fresh", ...SHOWROOM_AWARD_DEFS.fresh });
    if (Number(rating.count) >= 3 && Number(rating.average) >= 4.5) awards.push({ key: "rating", ...SHOWROOM_AWARD_DEFS.rating });
    if (followers >= 3 && followers === maxFollowers) awards.push({ key: "popular", ...SHOWROOM_AWARD_DEFS.popular });
    if (data.city && data.city !== "موقعیت ثبت نشده" && String(data.description || "").trim().length >= 24 && (data.logo || data.banner)) {
      awards.push({ key: "profile", ...SHOWROOM_AWARD_DEFS.profile });
    }
    return awards;
  }

  // Custom, consistent line icons sit inside glossy medallions so they feel dimensional
  // on Android, iOS and desktop (without depending on the platform emoji font).
  function showroomAwardIconSVG(key) {
    const paths = {
      activity: '<path d="M4 16.5 9 11l3.3 3.3L20 6.5"/><path d="M14.8 6.5H20v5.2"/>',
      inventory: '<path d="m12 3 8 4.2-8 4.2-8-4.2L12 3Z"/><path d="m4 12 8 4.2 8-4.2M4 16.8 12 21l8-4.2"/>',
      fresh: '<path d="m13.2 2.8-8 10.1h5.5l-.5 8.3 8.6-11h-5.7l.1-7.4Z"/>',
      quality: '<path d="m12 3 7 2.8v5.5c0 4.3-3 7.7-7 9.7-4-2-7-5.4-7-9.7V5.8L12 3Z"/><path d="m8.5 11.8 2.3 2.3 4.8-5"/>',
      rating: '<path d="m12 3.2 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3.2Z"/>',
      popular: '<path d="m3 8 5.5 4L12 5l3.5 7L21 8l-2 11H5L3 8Z"/><path d="M6 21h12"/>',
      profile: '<path d="M12 3 19 6v5.2c0 4.1-2.8 7.3-7 9.8-4.2-2.5-7-5.7-7-9.8V6l7-3Z"/><path d="m8.5 12 2.2 2.2 4.8-4.8"/>',
      founding: '<path d="M6.5 4h11L21 9l-9 11L3 9l3.5-5Z"/><path d="M3 9h18M9.2 4 12 9l2.8-5M12 9v11"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[key] || paths.quality}</svg>`;
  }

  function renderShowroomAwardChips(awards) {
    const list = Array.isArray(awards) ? awards : [];
    if (!list.length) return "";
    return `<div class="sr-awards-row" role="region" tabindex="0" aria-label="نشان‌های افتخار؛ برای دیدن همه نشان‌ها افقی پیمایش کنید">${list.map((award) => `<span class="sr-award-chip" title="${escHtml(award.description)}"><span class="sr-award-mini-medal sr-award-mini-medal--${escHtml(award.key)}" aria-hidden="true">${showroomAwardIconSVG(award.key)}</span><span class="sr-award-label">${escHtml(award.label)}</span></span>`).join("")}</div>`;
  }

  function renderShowroomAwardsSection(awards) {
    const list = Array.isArray(awards) ? awards : [];
    const rows = list.length ? `<div class="sp-honors-rail" role="region" tabindex="0" aria-label="نشان‌های افتخار؛ برای دیدن همه نشان‌ها افقی پیمایش کنید">${list.map((award) => `<article class="sp-honor-card sp-honor-card--${escHtml(award.key)}"><div class="sp-honor-card-top"><span class="sp-honor-medal sp-honor-medal--${escHtml(award.key)}" aria-hidden="true">${showroomAwardIconSVG(award.key)}</span><span class="sp-honor-kicker">نشان افتخار</span></div><div class="sp-honor-copy"><strong>${escHtml(award.title || award.label)}</strong><small>${escHtml(award.description)}</small></div></article>`).join("")}</div>` : `<div class="sp-honors-empty"><strong>اولین نشان در راه است</strong><p>با ثبت آگهی‌های کامل و به‌روز و تکمیل اطلاعات نمایشگاه، نشان‌های افتخار کسب کن.</p></div>`;
    return `<section class="sp-honors" aria-labelledby="sp-honors-title"><div class="sp-honors-heading"><h2 id="sp-honors-title">نشان‌های افتخار</h2><span>${list.length.toLocaleString("fa-IR")} نشان</span></div>${rows}</section>`;
  }

  // Showroom page trophies: a horizontal hexagon carousel (earned = coloured, not yet earned = dark).
  // The hexagon closest to the centre is the active one; its title + description show underneath.
  function renderShowroomTrophies(earned) {
    const have = new Set((Array.isArray(earned) ? earned : []).map((a) => a.key));
    const keys = Object.keys(SHOWROOM_AWARD_DEFS).filter((k) => k !== "founding" || have.has("founding"));
    const ordered = keys.filter((k) => have.has(k)).concat(keys.filter((k) => !have.has(k)));
    const items = ordered.map((key, i) => {
      const def = SHOWROOM_AWARD_DEFS[key];
      const ok = have.has(key);
      const title = def.title || def.label;
      return `<button type="button" class="sp-hex sp-hex--${key} ${ok ? "is-earned" : "is-locked"}" role="option" data-i="${i}" data-title="${escHtml(title)}" data-desc="${escHtml(ok ? def.description : "برای کسب این نشان: " + def.description)}" aria-label="${escHtml(title)}${ok ? "" : " (کسب نشده)"}"><span class="sp-hex-in">${showroomAwardIconSVG(key)}</span></button>`;
    }).join("");
    const first = SHOWROOM_AWARD_DEFS[ordered[0]];
    return `<section class="sp-troph" aria-label="نشان‌های افتخار"><div class="sp-troph-rail" role="listbox" aria-label="نشان‌های افتخار" tabindex="0">${items}</div><div class="sp-troph-cap" aria-live="polite"><strong>${escHtml(first.title || first.label)}</strong><p>${escHtml(have.has(ordered[0]) ? first.description : "برای کسب این نشان: " + first.description)}</p></div></section>`;
  }

  function initShowroomTrophies(scope) {
    const rail = scope && scope.querySelector(".sp-troph-rail");
    if (!rail) return;
    const cap = rail.parentElement.querySelector(".sp-troph-cap");
    const hexes = Array.from(rail.querySelectorAll(".sp-hex"));
    if (!hexes.length) return;
    let active = -1;
    const setActive = (i) => {
      if (i === active || !hexes[i]) return;
      active = i;
      hexes.forEach((h, k) => { h.classList.toggle("is-active", k === i); h.setAttribute("aria-selected", String(k === i)); });
      const h = hexes[i];
      if (cap) { cap.classList.add("is-swap"); cap.querySelector("strong").textContent = h.dataset.title || ""; cap.querySelector("p").textContent = h.dataset.desc || ""; requestAnimationFrame(() => cap.classList.remove("is-swap")); }
    };
    const nearest = () => {
      const r = rail.getBoundingClientRect(), mid = r.left + r.width / 2;
      let best = 0, bd = Infinity;
      hexes.forEach((h, k) => { const b = h.getBoundingClientRect(); const d = Math.abs(b.left + b.width / 2 - mid); if (d < bd) { bd = d; best = k; } });
      return best;
    };
    let raf = 0;
    rail.addEventListener("scroll", () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; setActive(nearest()); }); }, { passive: true });
    rail.addEventListener("click", (e) => {
      const h = e.target.closest(".sp-hex"); if (!h) return;
      const r = rail.getBoundingClientRect(), b = h.getBoundingClientRect();
      rail.scrollBy({ left: (b.left + b.width / 2) - (r.left + r.width / 2), behavior: "smooth" });
      setActive(hexes.indexOf(h));
    });
    rail.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const step = (e.key === "ArrowLeft") ? 1 : -1; // RTL: left = next
      const n = Math.min(hexes.length - 1, Math.max(0, (active < 0 ? 0 : active) + step));
      hexes[n].click();
    });
    setActive(0);
  }

  function showroomCoverHTML(item) {
    // The showroom's own banner always wins; ad photos / logo are only fallbacks.
    if (item.banner && /^(data:image\/|https?:\/\/|blob:|assets\/)/i.test(item.banner)) return `<img class="sr-photo is-banner" src="${escHtml(item.banner)}" alt="" loading="lazy" decoding="async" />`;
    const first = (item.listings || []).slice().sort((x, y) => (Number(y.createdAt) || 0) - (Number(x.createdAt) || 0))[0];
    const photo = first && Array.isArray(first.photos) ? first.photos.find((src) => typeof src === "string" && src.trim()) : "";
    if (photo) return `<img class="sr-photo" src="${escHtml(photo)}" alt="" loading="lazy" decoding="async" />`;
    if (item.logo && /^(data:image\/|https?:\/\/|blob:|assets\/)/i.test(item.logo)) return `<img class="sr-photo is-logo" src="${escHtml(item.logo)}" alt="" loading="lazy" decoding="async" />`;
    return `<div class="sr-media-empty" aria-hidden="true">${SR_ICON_STORE}</div>`;
  }

  function renderShowroomStarsHTML(item, compact) {
    const rating = item.rating || showroomRatingFor(item.id);
    if (compact) {
      return `<div class="cm-showroom-compact-rating"><span class="cm-showroom-star-static">★</span><strong>${rating.count ? rating.average.toFixed(1) : "جدید"}</strong><span>${rating.count ? `${rating.count.toLocaleString("fa-IR")} امتیاز` : "بدون امتیاز"}</span></div>`;
    }
    const averageText = rating.count ? rating.average.toFixed(1) : "—";
    const votesText = rating.count ? `${rating.count.toLocaleString("fa-IR")} رأی` : "اولین امتیاز را ثبت کن";
    const stars = [1, 2, 3, 4, 5].map((value) => `<button type="button" class="cm-showroom-rate-star${rating.count && value <= Math.round(rating.average) ? " is-filled" : ""}" data-showroom-rate="${escHtml(item.id)}" data-value="${value}" aria-label="ثبت امتیاز ${value} از ۵ برای ${escHtml(item.name)}">★</button>`).join("");
    return `<div class="cm-showroom-rating"><div class="cm-showroom-rating-summary"><span>امتیاز کاربران</span><strong>${averageText}</strong><small>${votesText}</small></div><div class="cm-showroom-rating-stars" role="group" aria-label="ثبت امتیاز نمایشگاه">${stars}</div></div>`;
  }

  const SR_ICON_STORE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5 5.6 4.5h12.8L20 9.5M4 9.5c0 1.4 1.1 2.5 2.5 2.5S9 10.9 9 9.5c0 1.4 1.1 2.5 3 2.5s3-1.1 3-2.5c0 1.4 1.1 2.5 2.5 2.5S20 10.9 20 9.5M5.5 12v7.5h13V12M10 19.5v-4h4v4"/></svg>`;
  const SR_ICON_CHEV = `<svg class="sr-chev" viewBox="0 0 9 15" aria-hidden="true"><path d="M7.5 1.5 1.8 7.5l5.7 6"/></svg>`;

  function renderShowroomCardHTML(item, rank, compact = false, sortKey = "activity", directoryItems = null, rankMovement = null) {
    const count = (item.listings || []).length;
    const escId = escHtml(item.id);
    const name = escHtml(item.name);
    const city = escHtml(item.city || "موقعیت ثبت نشده");
    const rating = item.rating || showroomRatingFor(item.id);
    const fa = (value) => Number(value || 0).toLocaleString("fa-IR");
    const avg = rating.count ? rating.average.toLocaleString("fa-IR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "";
    const awards = getShowroomAwards(item, directoryItems);
    const awardChips = renderShowroomAwardChips(awards);
    const verified = item.verified ? `<span class="sr-verified" role="img" aria-label="نمایشگاه تأییدشده"><svg viewBox="0 0 24 24"><path d="M12 1.8l2.6 1.8 3.1-.2 1.2 2.9 2.7 1.6-.7 3.1 1.2 2.8-2.2 2.2-.3 3.1-3 .8-2 2.4-2.6-1.8-3.1.2-1.2-2.9-2.7-1.6.7-3.1L2.5 11.9l2.2-2.2.3-3.1 3-.8z"/><path d="m8.4 12.2 2.4 2.4 4.9-5"/></svg></span>` : "";
    const avatar = item.logo
      ? `<img src="${escHtml(item.logo)}" alt="" loading="lazy" decoding="async" />`
      : SR_ICON_STORE;
    const topLabel = sortKey === "listings" && count > 0 ? "بیشترین آگهی"
      : sortKey === "recent" && item.latestAt ? "جدیدترین"
      : sortKey === "popular" && item.followers > 0 ? "محبوب‌ترین"
      : sortKey === "rating" && rating.count > 0 ? "بالاترین امتیاز"
      : sortKey === "activity" ? "فعال‌ترین" : "";
    const displayedMovement = rankMovement || demoShowroomRankMovement(rank);
    const movementHTML = showroomRankMovementHTML(displayedMovement);
    const rankChip = rank === 1 && topLabel
      ? `<span class="sr-rank"><b>${fa(rank)}</b><span>${topLabel}</span>${movementHTML}</span>`
      : `<span class="sr-rank"><b>${fa(rank)}</b>${movementHTML}</span>`;
    const media = `<button type="button" class="sr-media" data-action="goSeller" data-seller-id="${escId}" aria-label="مشاهده ${name}">${showroomCoverHTML(item)}${rankChip}</button>`;

    if (compact) {
      const tail = ""; // home "top showrooms" card: membership date removed
      return `<article class="sr-card">${media}<div class="sr-body"><button type="button" class="sr-id" data-action="goSeller" data-seller-id="${escId}"><span class="sr-avatar">${avatar}</span><span class="sr-meta"><h3><span class="sr-name">${name}</span>${verified}</h3><p><span>${city}</span><i class="sr-dot" aria-hidden="true"></i><span>${fa(count)} آگهی</span></p></span>${tail}</button>${awardChips}</div></article>`;
    }

    const joined = escHtml(showroomJoinedLabel(item.id));
    return `<article class="sr-card">${media}<div class="sr-body"><button type="button" class="sr-id" data-action="goSeller" data-seller-id="${escId}"><span class="sr-avatar">${avatar}</span><span class="sr-meta"><h3><span class="sr-name">${name}</span>${verified}</h3><p>${city}</p></span>${SR_ICON_CHEV}</button>${awardChips}<dl class="sr-stats"><div><dd>${fa(count)}</dd><dt>آگهی فعال</dt></div><div><dd>${fa(item.activityScore)}<small>/۱۰۰</small></dd><dt>شاخص فعالیت</dt></div><div><dd class="sr-stat-date">${joined}</dd><dt>تاریخ عضویت</dt></div></dl></div></article>`;
  }

  function renderDealersScreen() {
    const page = document.createElement("section");
    page.dataset.page = "dealers";
    page.className = "cm-showroom-directory sr-page";
    // Entering the directory re-reads the public list (at most every 15s), so showrooms approved or created
    // after page start show up without a reload.
    try { Promise.resolve(window.CARMA_SESSION?.refreshShowrooms?.({ maxAgeMs: 15000 })).then((changed) => { if (changed && state.route && state.route.page === "dealers" && typeof render === "function") render(); }).catch(() => {}); } catch (_) {}
    const items = getShowroomDirectoryItems();
    const rankContext = buildShowroomRankContext(items);
    const cities = KHUZESTAN_CITIES.filter((c) => items.some((item) => item.city === c));
    page.innerHTML = `<div class="page-header-sticky bg-neutral-950 cm-lh"><div class="cm-lh-text"><h1>نمایشگاه‌ها</h1><p>نمایشگاه‌های معتبر را پیدا و مقایسه کن</p></div><div class="cm-lh-btns"><button type="button" class="cm-lh-btn" data-showroom-focus aria-label="جستجوی نمایشگاه"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg></button><button type="button" data-action="goSell" class="cm-lh-btn" aria-label="ثبت آگهی"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div><div class="sr-chips" role="group" aria-label="شهر و مرتب‌سازی"><label class="sr-select"><span data-showroom-city-label>همه شهرها</span><svg viewBox="0 0 12 12"><path d="m2.5 4.5 3.5 3.5 3.5-3.5"/></svg><select data-showroom-city aria-label="فیلتر براساس شهر"><option value="all">همه شهرها</option>${cities.map((city) => `<option value="${escHtml(city)}">${escHtml(city)}</option>`).join("")}</select></label><i class="sr-chips-sep"></i><button type="button" class="sr-chip is-active" data-showroom-sort="activity">فعال‌ترین</button><button type="button" class="sr-chip" data-showroom-sort="listings">بیشترین آگهی</button><button type="button" class="sr-chip" data-showroom-sort="recent">جدیدترین فعالیت</button><button type="button" class="sr-chip" data-showroom-sort="popular">محبوب‌ترین</button><button type="button" class="sr-chip" data-showroom-sort="rating">بالاترین امتیاز</button></div></div><div class="sr-group"><div><strong>${items.length.toLocaleString("fa-IR")}</strong><span>نمایشگاه</span></div><div><strong>${items.reduce((sum, item) => sum + item.listings.length, 0).toLocaleString("fa-IR")}</strong><span>آگهی فعال</span></div><div><strong>${cities.length.toLocaleString("fa-IR")}</strong><span>شهر</span></div></div><label class="sr-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input type="search" data-showroom-search placeholder="جستجوی نام نمایشگاه یا شهر" autocomplete="off" aria-label="جستجوی نمایشگاه‌ها"/></label><div class="sr-count" data-showroom-results-count></div><div class="sr-grid" data-showroom-grid></div><p class="sr-footnote">شاخص فعالیت از امتیاز کاربران جداست. در حالت آنلاین، امتیازها در حساب کاربری و سرور ثبت می‌شوند.</p>`;

    const grid = page.querySelector("[data-showroom-grid]");
    const count = page.querySelector("[data-showroom-results-count]");
    const search = page.querySelector("[data-showroom-search]");
    const focusBtn = page.querySelector("[data-showroom-focus]");
    if (focusBtn && search) focusBtn.addEventListener("click", () => {
      try { search.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}
      search.focus({ preventScroll: true });
    });
    const cityFilter = page.querySelector("[data-showroom-city]");
    const chipsBar = page.querySelector(".sr-chips");
    let currentSort = "activity";
    let searchQuery = "";
    let selectedCity = "all";
    const paintCards = () => {
      let filtered = items.filter((item) => {
        const query = searchQuery.trim().toLocaleLowerCase();
        const searchable = `${item.name} ${item.city} ${item.brand}`.toLocaleLowerCase();
        return (!query || searchable.includes(query)) && (selectedCity === "all" || item.city === selectedCity);
      });
      filtered.sort((a, b) => compareShowroomRanking(a, b, currentSort));
      if (count) count.textContent = `${filtered.length.toLocaleString("fa-IR")} نمایشگاه`;
      if (!grid) return;
      grid.innerHTML = filtered.length ? filtered.map((item, index) => {
        const id = String(item.id);
        const rank = rankContext.ranksBySort[currentSort]?.[id] || index + 1;
        const movement = rankContext.movementsBySort[currentSort]?.[id] || null;
        return renderShowroomCardHTML(item, rank, false, currentSort, items, movement);
      }).join("") : `<div class="sr-empty"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><strong>نمایشگاهی پیدا نشد</strong><p>نام یا شهر دیگری را جستجو کن.</p><button type="button" data-showroom-reset>پاک‌کردن فیلترها</button></div>`;
    };
    paintCards();
    search.addEventListener("input", () => { searchQuery = search.value || ""; paintCards(); });
    cityFilter.addEventListener("change", () => { selectedCity = cityFilter.value || "all"; const lbl = document.querySelector("[data-showroom-city-label]"); if (lbl) lbl.textContent = selectedCity === "all" ? "همه شهرها" : selectedCity; const _sel = cityFilter.closest(".sr-select"); if (_sel) _sel.classList.toggle("is-set", selectedCity !== "all"); paintCards(); });
    const onShowroomClick = (event) => {
      const sortButton = event.target.closest("[data-showroom-sort]");
      if (sortButton) {
        currentSort = sortButton.dataset.showroomSort || "activity";
        document.querySelectorAll("[data-showroom-sort]").forEach((button) => button.classList.toggle("is-active", button === sortButton));
        paintCards();
        return;
      }
      const resetButton = event.target.closest("[data-showroom-reset]");
      if (resetButton) {
        searchQuery = ""; selectedCity = "all";
        if (search) search.value = "";
        if (cityFilter) cityFilter.value = "all"; const lbl0 = document.querySelector("[data-showroom-city-label]"); if (lbl0) lbl0.textContent = "همه شهرها"; const _sel0 = cityFilter && cityFilter.closest(".sr-select"); if (_sel0) _sel0.classList.remove("is-set");
        paintCards();
        return;
      }
      const rateButton = event.target.closest("[data-showroom-rate]");
      if (rateButton) {
        event.preventDefault(); event.stopPropagation();
        const id = String(rateButton.dataset.showroomRate || "");
        const ratingValue = Math.max(1, Math.min(5, Number(rateButton.dataset.value) || 0));
        if (!id || !ratingValue) return;
        if (window.CARMA_API?.enabled) {
          if (!window.CARMA_AUTH_USER) {
            state = { ...state, modal: { type: "login", reason: "برای ثبت امتیاز نمایشگاه ابتدا وارد حساب کاربری شوید." }, loginStep: "phone", loginPhone: "", loginReturnTo: state.route };
            if (typeof render === "function") render();
            return;
          }
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
            if (typeof showToast === "function") showToast("این نمایشگاه هنوز به سرور متصل نیست؛ امتیاز محلی ثبت نشد.");
            return;
          }
          rateButton.disabled = true;
          window.CARMA_API.showrooms.review(id, { stars: ratingValue, body: "" })
            .then(async () => {
              const refreshed = await window.CARMA_API.showrooms.list({});
              window.CARMA_SERVER_SHOWROOMS = Array.isArray(refreshed?.items) ? refreshed.items : [];
              const latest = window.CARMA_SERVER_SHOWROOMS.find((x) => String(x.id) === id);
              const item = items.find((x) => String(x.id) === id);
              if (item && latest) item.rating = { count: Number(latest.review_count || 0), average: Number(latest.rating || 0) };
              paintCards();
              if (typeof showToast === "function") showToast(`امتیاز ${ratingValue.toLocaleString("fa-IR")} از ۵ در سرور ثبت شد`);
            })
            .catch((error) => { if (typeof showToast === "function") showToast(error?.message || "ثبت امتیاز انجام نشد."); })
            .finally(() => { if (rateButton.isConnected) rateButton.disabled = false; });
          return;
        }
        const all = showroomReadRatings();
        const record = all[id] && typeof all[id] === "object" ? all[id] : { votes: {} };
        record.votes = record.votes && typeof record.votes === "object" ? record.votes : {};
        const profileAPI = window.MR_PROFILE || {};
        const voter = state && state.account && typeof profileAPI.myId === "function" ? String(profileAPI.myId() || "member") : "guest";
        record.votes[voter] = ratingValue;
        all[id] = record;
        try { window.localStorage.setItem(SHOWROOM_RATINGS_KEY, JSON.stringify(all)); } catch (_) {}
        const updated = items.find((item) => item.id === id);
        if (updated) updated.rating = showroomRatingFor(id);
        paintCards();
        if (typeof showToast === "function") showToast(`امتیاز ${ratingValue.toLocaleString("fa-IR")} از ۵ ثبت شد`);
      }
    };
    page.addEventListener("click", onShowroomClick);
    // The chips are moved into the sticky header, outside the page node.
    if (chipsBar) chipsBar.addEventListener("click", onShowroomClick);
    return page;
  }
