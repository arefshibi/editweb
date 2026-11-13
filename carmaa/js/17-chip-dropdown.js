"use strict";

/* ---------------------------------------------------------------
   APP ROOT / RENDER / ROUTER (bottom part) — the filter-chip dropdown positioning/behavior and the countdown-timer updater for time-limited listings. (This is one very large function in the original file, kept intact here.)
// Edit the filter-chip dropdown or countdown timers here.
--------------------------------------------------------------- */

  let sellPublishingInProgress = false;
  // True from the moment "publish" is accepted until the server answers. Without it a second tap
  // (or a re-render that re-enabled the button) started a second upload and a second ad.
  let sellSubmitInFlight = false;
  let sellSubmitKey = null; // { fp, key } — reused when a failed attempt is retried with the same content

  // "Waiting for the server" overlay: shown immediately on publish so the screen never looks frozen,
  // and it blocks further taps until the server has answered (or the request timed out).
  function sellWait(on) {
    const sheet = document.getElementById("sellPublishingSheet");
    if (!sheet || sellPublishingInProgress) return;
    const iconEl = sheet.querySelector('[data-slot="statusIcon"]');
    const titleEl = sheet.querySelector('[data-slot="title"]');
    const messageEl = sheet.querySelector('[data-slot="message"]');
    const progressEl = sheet.querySelector('[data-slot="progress"]');
    if (on) {
      sheet.hidden = false; sheet.setAttribute("aria-hidden", "false");
      if (iconEl) iconEl.classList.remove("is-success");
      if (titleEl) titleEl.textContent = "درحال ثبت آگهی...";
      if (messageEl) messageEl.textContent = "درحال ارسال اطلاعات و عکس‌ها؛ لطفاً صبر کنید";
      if (progressEl) { progressEl.style.transition = "none"; progressEl.style.width = "4%"; void progressEl.offsetWidth; progressEl.style.transition = "width 25s cubic-bezier(.1,.6,.2,1)"; progressEl.style.width = "92%"; }
      document.documentElement.classList.add("sell-publishing-open");
    } else {
      if (progressEl) { progressEl.style.transition = ""; }
      sheet.hidden = true; sheet.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("sell-publishing-open");
    }
  }
  let sellPublishingTimer = null;
  let sellPublishingProgressFrame = null;
  let sellPublishingOnComplete = null;
  let sellPublishingDraft = null;
  let sellPublishingId = null;

  function openSellPublishingSheet(onComplete) {
    const sheet = document.getElementById("sellPublishingSheet");
    if (!sheet || sellPublishingInProgress) return false;
    sellPublishingInProgress = true;
    sellPublishingOnComplete = typeof onComplete === "function" ? onComplete : null;
    { const p0 = sheet.querySelector('[data-slot="progress"]'); if (p0) { p0.style.transition = ""; } }
    sheet.hidden = false;
    sheet.setAttribute("aria-hidden", "false");
    const iconEl = sheet.querySelector('[data-slot="statusIcon"]');
    const titleEl = sheet.querySelector('[data-slot="title"]');
    const messageEl = sheet.querySelector('[data-slot="message"]');
    const progressEl = sheet.querySelector('[data-slot="progress"]');
    if (iconEl) iconEl.classList.remove("is-success");
    if (titleEl) titleEl.textContent = "درحال ثبت آگهی...";
    if (messageEl) messageEl.textContent = "آگهی شما در حال آماده‌سازی است";
    if (progressEl) progressEl.style.width = "0%";
    document.documentElement.classList.add("sell-publishing-open");

    const startedAt = performance.now();
    // The server has already answered by now, so the confirmation animation is short in API mode.
    const duration = window.CARMA_API?.enabled ? 1500 : 5000;
    const tick = (now) => {
      if (!sellPublishingInProgress) return;
      const progress = Math.min(1, (now - startedAt) / duration);
      if (progressEl) progressEl.style.width = `${Math.round(progress * 100)}%`;
      if (progress < 1) sellPublishingProgressFrame = requestAnimationFrame(tick);
    };
    sellPublishingProgressFrame = requestAnimationFrame(tick);
    sellPublishingTimer = setTimeout(() => {
      if (!sellPublishingInProgress) return;
      if (iconEl) iconEl.classList.add("is-success");
      if (titleEl) titleEl.textContent = "آگهی ثبت شد";
      if (messageEl) messageEl.textContent = "آگهی شما با موفقیت ثبت و آماده نمایش شد";
      if (progressEl) progressEl.style.width = "100%";
      // Give the success state a short, deliberate moment to land before
      // navigating away. The check appears at exactly 5 seconds.
      sellPublishingTimer = setTimeout(() => finishSellPublishing(), 700);
    }, duration);
    return true;
  }

  function finishSellPublishing(runComplete = true) {
    if (!sellPublishingInProgress) return;
    sellPublishingInProgress = false;
    if (sellPublishingTimer) clearTimeout(sellPublishingTimer);
    if (sellPublishingProgressFrame) cancelAnimationFrame(sellPublishingProgressFrame);
    sellPublishingTimer = null;
    sellPublishingProgressFrame = null;
    const sheet = document.getElementById("sellPublishingSheet");
    if (sheet) { sheet.hidden = true; sheet.setAttribute("aria-hidden", "true"); }
    document.documentElement.classList.remove("sell-publishing-open");
    const complete = sellPublishingOnComplete;
    sellPublishingOnComplete = null;
    if (runComplete && complete) complete();
    if (runComplete) { sellPublishingDraft = null; sellPublishingId = null; }
  }

  function cancelSellPublishing() {
    if (!sellPublishingInProgress) return;
    const cancelledId = sellPublishingId;
    const draft = sellPublishingDraft;
    finishSellPublishing(false);
    if (cancelledId) {
      listingStatsCache[cancelledId] && delete listingStatsCache[cancelledId]; mrStatsDrop(cancelledId);
      state = { ...state, myListings: state.myListings.filter(m => m.id !== cancelledId), sellForm: draft || state.sellForm, sellError: null };
    }
    sellPublishingDraft = null;
    sellPublishingId = null;
    render();
  }

  function positionChipDropdown() {
    const dropdown = document.querySelector(".toolbox-chip-dropdown");
    if (!dropdown) return;
    const key = dropdown.dataset.chipDropdown;
    const shell = document.querySelector(".toolbox-shell");
    const wrap = shell ? shell.querySelector(`[data-chip-wrap="${key}"]`) : null;
    if (!shell || !wrap) return;
    const shellRect = shell.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();

    // FIX (bug): the dropdown used to be forced to exactly the trigger
    // chip's width, which was often much narrower than its own option
    // text (e.g. a long city name under the small "شهر" chip) — squeezing
    // it down and forcing it to scroll sideways. The CSS now sizes the
    // dropdown to its own content (each option only as wide as its own
    // text, up to a max-width), so here we only set a floor (never
    // narrower than the chip itself) and let it grow from there.
    dropdown.style.minWidth = `${wrapRect.width}px`;
    dropdown.style.top = `${wrapRect.bottom - shellRect.top + 8}px`;

    // FIX (bug): left used to be the chip's raw left edge with no bounds
    // check, so once the dropdown could be wider than its trigger chip it
    // was free to spill past the toolbar's edge — "falling off the
    // corner". Now that it has its natural content width, clamp its left
    // offset so it always stays fully inside the toolbar shell.
    const dropdownWidth = dropdown.offsetWidth;
    const maxLeft = Math.max(4, shellRect.width - dropdownWidth - 4);
    const left = Math.min(Math.max(4, wrapRect.left - shellRect.left), maxLeft);
    dropdown.style.left = `${left}px`;
    // Chip scrolled completely out of the toolbar's view -> hide its list
    // instead of leaving it stranded at the edge.
    const outOfView = wrapRect.right < shellRect.left + 4 || wrapRect.left > shellRect.right - 4;
    dropdown.style.visibility = outOfView ? "hidden" : "";
  }

  // Keep the open sub-list attached to its chip while the chip rail is
  // scrolled sideways (or the page scrolls / resizes). `scroll` doesn't
  // bubble, so listen in the capture phase to catch the rail's own scroll.
  let chipDropdownRaf = 0;
  const chipDropdownLive = document.getElementsByClassName("toolbox-chip-dropdown");
  function scheduleChipDropdownReposition() {
    // PERF: this runs for every scroll event on the page (capture phase).
    // Bail out immediately — no rAF, no querySelector — unless a chip
    // dropdown is actually open.
    if (!chipDropdownLive.length) return;
    if (chipDropdownRaf) return;
    chipDropdownRaf = requestAnimationFrame(() => {
      chipDropdownRaf = 0;
      if (document.querySelector(".toolbox-chip-dropdown")) positionChipDropdown();
    });
  }
  document.addEventListener("scroll", scheduleChipDropdownReposition, { capture: true, passive: true });
  window.addEventListener("resize", scheduleChipDropdownReposition);

  // FIX: .card-fade-in's entrance animation ends on `transform: translateY(0)
  // scale(1)` with fill-mode "both", so that transform value is held in the
  // CSS-animation cascade layer forever after — which outranks any normal
  // author rule (like the new press-down `:active` effect below) trying to
  // set `transform` on the same element, no matter its specificity.
  // Canceling the animation itself (not removing the class — it also carries
  // the no-select/no-callout/touch-action rules cards still need) once it
  // actually finishes releases `transform` back to normal rules, so the
  // press animation can take over cleanly.
  document.addEventListener("animationend", (e) => {
    if (e.animationName === "cardFadeIn") {
      e.target.style.animation = "none";
    }
  });

  document.addEventListener("click", function (e) {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.getAttribute("data-action");
    // Bottom-dock buttons (home/saved/sell/account) carry their own
    // `data-dock` attribute alongside `data-action` — used below to skip
    // the circular-spinner "blur" loading stage only for dock taps, not
    // for the same actions triggered from the menu drawer or elsewhere.
    const fromDock = el.hasAttribute("data-dock");

    switch (action) {
      case "cancelSellPublishing": {
        cancelSellPublishing();
        break;
      }
      case "openBodyConditionOverlay": {
        openBodyConditionOverlay();
        break;
      }
      case "closeBodyConditionOverlay": {
        closeBodyConditionOverlay();
        break;
      }
      case "saveBodyConditionRating": {
        saveBodyConditionRating();
        break;
      }
      case "clearBodyConditionRating": {
        clearBodyConditionRating();
        break;
      }
      case "openBodyConditionHowTo": {
        showToast("۱ یعنی بدنه کاملاً سالم و ۱۰ یعنی آسیب‌دیدگی شدید یا سابقه تصادف سنگین.");
        break;
      }
      case "goHome": {
        const homeState = {
          menuOpen: false,
          selectedBrand: null,
          filters: { model: null, city: null, color: null, condition: null, year: null, priceMin: null, priceMax: null, transmission: null, bodyStyle: null },
          sort: "newest", filterOpenKey: null, sortOpen: false, toolFiltersOpen: false, chipDropdownKey: null,
          visibleCount: 12, listingsLoadingMore: false,
        };
        if (state.route && state.route.page === "home") {
          window.scrollTo(0, 0);
          state = { ...state, ...homeState, loading: false, loadingStage: null, pendingRoute: null, route: { page: "home" } };
          render();
        } else {
          navigateTo({ page: "home" }, homeState, { skipBlur: fromDock });
        }
        break;
      }
      case "openSocialFeed": {
        navigateTo({ page: "feed" }, { menuOpen: false }, { skipBlur: fromDock });
        break;
      }
      case "openBrandSheet": {
        openBrandSheet();
        break;
      }
      case "closeBrandSheet": {
        closeBrandSheet();
        break;
      }
      case "pickBrandSheet": {
        const value = el.getAttribute("data-brand");
        closeBrandSheet();
        if (value === "all") {
          state = { ...state, selectedBrand: null, route: { page: "listings", brand: "all" }, filters: { ...state.filters, model: null }, chipDropdownKey: null, visibleCount: 12, listingsLoadingMore: false };
        } else {
          state = { ...state, selectedBrand: value, route: { page: "listings", brand: value }, filters: { ...state.filters, model: null }, chipDropdownKey: null, visibleCount: 12, listingsLoadingMore: false };
        }
        window.scrollTo(0, 0);
        render();
        break;
      }
      case "openDealershipEdit": {
        if (!state.account) {
          resetOtpVerifiedAnimation();
          state = { ...state, modal: { type: "login" }, modalClosing: false, loginStep: "phone", loginPhone: "", loginReturnTo: { page: "dealershipEdit" } };
          updateOverlays();
          break;
        }
        navigateTo({ page: "dealershipEdit" }, { menuOpen: false, dealershipError: null, dealershipDraft: null, dealershipLogoDraft: null, dealershipBannerDraft: null });
        break;
      }
      case "goSeller": {
        const sellerId = el.getAttribute("data-seller-id");
        const sellerKind = el.getAttribute("data-seller-kind");
        if (sellerId) navigateTo(sellerKind ? { page: "seller", sellerId, kind: sellerKind } : { page: "seller", sellerId }, { menuOpen: false });
        break;
      }
      case "goBrand": {
        const brand = el.getAttribute("data-brand");
        navigateTo({ page: "brand", brand }, { menuOpen: false, selectedBrand: brand });
        break;
      }
      case "goListings": {
        // Bottom-dock tap ("آگهی‌ها") is meant to act like a genuine
        // "reset to all listings" — not just switch the route while
        // silently carrying over whatever brand filter/sort/scroll state
        // was left over from wherever the user tapped it from (a specific
        // brand page, a filtered listings view, my-listings, etc). So for
        // dock taps specifically: force brand to "all" and clear the
        // filters/sort/pagination back to their defaults.
        const brand = fromDock ? "all" : el.getAttribute("data-brand");
        const extraState = { menuOpen: false };
        if (fromDock) {
          Object.assign(extraState, {
            selectedBrand: null,
            filters: { model: null, city: null, color: null, condition: null, year: null, priceMin: null, priceMax: null, transmission: null, bodyStyle: null },
            sort: "newest",
            filterOpenKey: null,
            sortOpen: false,
            toolFiltersOpen: false,
            visibleCount: 12,
            listingsLoadingMore: false,
          });
        }
        // A repeat dock tap while already sitting on the listings page
        // shouldn't replay the full navigateTo() skeleton transition — it
        // should feel like a pull-to-refresh instead: scroll to top and
        // replay that same spinner → checkmark animation in place, with
        // the cards never disappearing behind skeleton placeholders.
        //
        // Guard against rapid repeat taps: a refresh cycle (spinner →
        // checkmark → cards fade back) takes about 1.3s from start to
        // finish. Re-triggering it mid-flight tears down and rebuilds the
        // whole page node, which snaps the still-animating indicator/cards
        // back to their start state instead of letting them ease out —
        // that abrupt reset is what reads as "jumpy". So while one cycle
        // is still running, extra taps are simply ignored and the current
        // animation is left to finish smoothly on its own.
        if (fromDock && state.route && state.route.page === "listings") {
          if (state.listingsLoadingMore) break;
          window.scrollTo(0, 0);
          state = { ...state, ...extraState, route: { page: "listings", brand } };
          listingsForceRefreshOnNextRender = true;
          render();
        } else {
          navigateTo({ page: "listings", brand }, extraState);
        }
        break;
      }
      case "goListingsModel": {
        const brand = el.getAttribute("data-brand");
        const model = el.getAttribute("data-model");
        navigateTo(
          { page: "listings", brand },
          { filters: { ...state.filters, model }, filterOpenKey: null, visibleCount: 12, listingsLoadingMore: false }
        );
        break;
      }
      case "vehicleBack": {
        if (window.history.length > 1) window.history.back(); else navigateTo({ page: "home" });
        break;
      }
      case "goVehicle": {
        const id = el.getAttribute("data-id");
        const listing = LISTINGS.find((l) => l.id === id);
        if (listing) {
          bumpStat(id, "views");
          if (window.CARMA_API?.enabled && listing._source === 'api') window.CARMA_API.listings.event(id, 'view').catch(() => {});
          if (state.searchOverlayOpen) {
            state = { ...state, searchOverlayOpen: false };
            updateSearchOverlay();
            closeSearchOverlayFully();
          }
          const morph = window.CARMA_MORPH ? window.CARMA_MORPH.begin(el) : null;
          navigateTo({ page: "vehicle", listing }, { thumb: 0, showMorePhotos: false, photoViewerOpen: false, activeTab: 0 });
          if (morph) window.CARMA_MORPH.run(morph);
        }
        break;
      }
      // Lets the owner view their OWN listing while it's still pending
      // review — before promoteListing() has added it to LISTINGS, so
      // goVehicle's LISTINGS.find(...) wouldn't find anything. This reads
      // straight from state.myListings instead, and skips bumpStat since
      // it's the owner previewing their own ad, not a real buyer view.
      case "previewListing": {
        const id = el.getAttribute("data-id");
        const entry = state.myListings.find((m) => m.id === id);
        if (entry) {
          navigateTo({ page: "vehicle", listing: entry.listing }, { thumb: 0, showMorePhotos: false, photoViewerOpen: false, activeTab: 0 });
        }
        break;
      }
      // Opens the "مدیریت آگهی" bottom-sheet-style modal for one of the
      // owner's own listings (tapped from the account page's "آگهی‌ها"
      // tab). Reuses the generic #genericModal shell — see updateModalUI's
      // "manageAd" branch for the actual content.
      case "openManageAd": {
        const id = el.getAttribute("data-id");
        const entry = state.myListings.find((m) => m.id === id);
        if (!entry) break;
        state = { ...state, modal: { type: "manageAd", id }, modalClosing: false };
        updateOverlays();
        break;
      }
      case "openAdStats": {
        const id = el.getAttribute("data-id");
        if (!state.myListings.some((m) => m.id === id)) break;
        state = { ...state, modal: { type: "adStats", id, metric: "views", range: 7, sel: null }, modalClosing: false };
        updateOverlays();
        if (window.CARMA_API?.enabled && /^[0-9a-f-]{36}$/i.test(String(id))) window.CARMA_API.listings.stats(id, 7).then((data) => { window.CARMA_AD_STATS_CACHE = window.CARMA_AD_STATS_CACHE || {}; window.CARMA_AD_STATS_CACHE[id] = data; if (state.modal?.type === 'adStats' && state.modal.id === id) updateOverlays(); }).catch(() => {});
        break;
      }
      case "adStatsMetric": case "adStatsRange": case "adStatsSel": {
        if (!state.modal || state.modal.type !== "adStats") break;
        const nm = { ...state.modal };
        if (action === "adStatsMetric") { nm.metric = el.getAttribute("data-metric"); nm.sel = null; }
        else if (action === "adStatsRange") { nm.range = parseInt(el.getAttribute("data-range"), 10) === 30 ? 30 : 7; nm.sel = null; if (window.CARMA_API?.enabled && /^[0-9a-f-]{36}$/i.test(String(state.modal.id))) window.CARMA_API.listings.stats(state.modal.id, nm.range).then((data) => { window.CARMA_AD_STATS_CACHE = window.CARMA_AD_STATS_CACHE || {}; window.CARMA_AD_STATS_CACHE[state.modal.id] = data; if (state.modal?.type === 'adStats' && state.modal.id === data.listingId) render(); }).catch(() => {}); }
        else { const i = parseInt(el.getAttribute("data-i"), 10); nm.sel = nm.sel === i ? null : i; }
        state = { ...state, modal: nm };
        updateOverlays();
        break;
      }
      case "adStatsBack": {
        if (!state.modal || state.modal.type !== "adStats") break;
        state = { ...state, modal: { type: "manageAd", id: state.modal.id } };
        updateOverlays();
        break;
      }
      case "openAdService": {
        const id = el.getAttribute("data-id");
        const service = el.getAttribute("data-service");
        const entry = state.myListings.find((m) => m.id === id);
        if (!entry || !PAID_SERVICES[service]) break;
        if (service === "renew" && entry.status !== "expired") break;
        if (service !== "renew" && entry.status !== "listed") break;
        state = { ...state, modal: { type: "adService", id, service, paying: false }, modalClosing: false };
        updateOverlays();
        break;
      }
      case "adServiceBack": {
        if (!state.modal || state.modal.type !== "adService" || state.modal.paying) break;
        state = { ...state, modal: { type: "manageAd", id: state.modal.id } };
        updateOverlays();
        break;
      }
      case "payService": {
        const m = state.modal;
        if (!m || m.type !== "adService" || m.paying) break;
        const { id, service } = m;
        { const en = state.myListings.find((x) => x.id === id); if (!en || !PAID_SERVICES[service] || (service === "renew" ? en.status !== "expired" : en.status !== "listed")) break; }
        state = { ...state, modal: { ...m, paying: true } };
        updateOverlays();
        mrPay(service, id).then((res) => {
          if (res && res.redirectUrl) {
            // The order is pending at the gateway. Do not activate service effects in browser storage.
            window.location.assign(res.redirectUrl);
            return;
          }
          state = { ...state, modal: null, modalClosing: false };
          updateOverlays();
          if (res && res.status === "paid") showToast("این سفارش از سمت سرور پرداخت‌شده است. برای دریافت آخرین وضعیت آگهی، صفحه را تازه‌سازی کنید.");
          else showToast("پرداخت از سمت سرور تأیید نشد؛ هیچ خدمتی فعال نشد.");
        }).catch(() => {
          state = { ...state, modal: { ...m, paying: false } };
          updateOverlays();
          showToast("وضعیت پرداخت نامشخص است؛ دوباره بررسی کنید.");
        });
        break;
      }
      case "resubmitListing": {
        const id = el.getAttribute("data-id");
        const entry = state.myListings.find((m) => m.id === id);
        if (!entry || (entry.status !== "rejected" && entry.status !== "removed")) break;
        MR_STORE.resubmit(id);
        state = {
          ...state,
          modal: null,
          modalClosing: false,
          myListings: state.myListings.map((m) => (m.id === id ? { ...m, status: "pending", why: "" } : m)),
        };
        updateOverlays();
        render();
        showToast("آگهی دوباره برای بررسی ثبت شد.");
        break;
      }
      case "manageAdPreview": {
        const id = el.getAttribute("data-id");
        const entry = state.myListings.find((m) => m.id === id);
        state = { ...state, modal: null, modalClosing: false };
        if (entry) {
          navigateTo({ page: "vehicle", listing: entry.listing }, { thumb: 0, showMorePhotos: false, photoViewerOpen: false, activeTab: 0 });
        } else {
          updateOverlays();
        }
        break;
      }
      case "manageAdEdit": {
        const id = el.getAttribute("data-id");
        const entry = state.myListings.find((m) => m.id === id);
        if (!entry) { state = { ...state, modal: null, modalClosing: false }; updateOverlays(); break; }
        if (entry.status === "pending") {
          state = { ...state, modal: null, modalClosing: false };
          updateOverlays();
          showToast("تا زمانی که آگهی منتشر نشده، امکان ویرایش آن وجود ندارد.");
          break;
        }
        if (!state.account) {
          resetOtpVerifiedAnimation();
          state = { ...state, modal: { type: "login" }, modalClosing: false, loginStep: "phone", loginPhone: "", loginReturnTo: { page: "manageListings" } };
          updateOverlays();
          break;
        }
        state = { ...state, modal: null, modalClosing: false };
        navigateTo(
          { page: "sell" },
          {
            menuOpen: false,
            sellError: null,
            editingListingId: id,
            sellForm: sellFormFromListing(entry.listing),
            sellStep: 1,
            sellDirection: "forward",
          }
        );
        break;
      }
      case "manageAdDeleteAsk": {
        const id = el.getAttribute("data-id");
        state = { ...state, modal: { type: "manageAdConfirm", id, reason: null }, modalClosing: false };
        updateOverlays();
        break;
      }
      case "selectDeleteReason": {
        const reason = el.getAttribute("data-reason");
        if (!state.modal || state.modal.type !== "manageAdConfirm") break;
        state = { ...state, modal: { ...state.modal, reason } };
        updateOverlays();
        break;
      }
      case "manageAdDeleteCancel": {
        if (!state.modal || state.modal.type !== "manageAdConfirm") break;
        state = { ...state, modal: { type: "manageAd", id: state.modal.id } };
        updateOverlays();
        break;
      }
      case "manageAdDeleteConfirm": {
        if (!state.modal || state.modal.type !== "manageAdConfirm") break;
        if (!state.modal.reason) {
          showToast("لطفاً یکی از دلایل حذف رو انتخاب کن.");
          break;
        }
        const id = state.modal.id;
        if (state.modalClosing) break;
        state = { ...state, modalClosing: true };
        updateOverlays();
        setTimeout(() => {
          state = { ...state, modal: null, modalClosing: false };
          deleteMyListing(id);
          render();
        }, 500);
        break;
      }
      case "dealerBannerRandom": {
        // بنر ساخته‌شده‌ی تصادفی دیگر برای نمایشگاه (پیش‌نویس تا زدن «ذخیره»)
        const sid = state.account ? sellerIdForPhone(state.account) : "";
        if (!sid) break;
        let draft = state.dealershipDraft;
        const form = document.querySelector('form[data-action="saveDealership"]');
        if (form) {
          const fd = new FormData(form);
          draft = { name: (fd.get("dealerName") || "").toString(), username: (fd.get("dealerUsername") || "").toString(), ownerName: (fd.get("ownerName") || "").toString(), address: (fd.get("dealerAddress") || "").toString(), nid: (fd.get("nationalId") || "").toString(), tags: (fd.get("dealerTags") || "").toString() };
        }
        const url = demoRandomBanner(state.dealershipBannerDraft);
        state = { ...state, dealershipBannerDraft: url, dealershipDraft: draft };
        render();
        break;
      }
      case "contactSupport": {
        if (!window.CARMA_API?.enabled) { showToast("ارسال درخواست پشتیبانی در این نسخه در دسترس نیست."); break; }
        if (!window.CARMA_AUTH_USER) {
          state = { ...state, modal: { type: "login", reason: "برای ارسال درخواست پشتیبانی ابتدا وارد حساب کاربری شوید." }, loginStep: "phone", loginPhone: "", loginReturnTo: state.route };
        } else state = { ...state, modal: { type: "supportTicket" }, modalClosing: false };
        render();
        break;
      }
      case "submitSupportTicket": {
        const form = document.querySelector('#modalBody form[data-support-ticket]');
        if (!form || form.dataset.sending === "1") break;
        const subject = form.elements.subject.value.trim(), category = form.elements.category.value, body = form.elements.body.value.trim();
        if (subject.length < 4 || body.length < 10) { showToast("موضوع و شرح درخواست را کامل‌تر وارد کنید."); break; }
        form.dataset.sending = "1"; el.disabled = true; el.textContent = "در حال ارسال…";
        window.CARMA_API.support.create({ subject, category, body }).then((result) => {
          if (!result?.ticket?.id) throw new Error("پاسخ سرور برای ثبت درخواست معتبر نیست.");
          state = { ...state, modal: null, modalClosing: false }; updateOverlays(); showToast("درخواست پشتیبانی ثبت شد.");
        }).catch((error) => { showToast(error?.message || "ثبت درخواست پشتیبانی انجام نشد."); })
          .finally(() => { if (el.isConnected) { el.disabled = false; el.textContent = "ارسال درخواست"; } if (form.isConnected) form.dataset.sending = "0"; });
        break;
      }
      case "setListStyle": {
        const style = "compact"; // large view removed
        if (style === state.listStyle) break;
        try { localStorage.setItem("mr_list_style", style); } catch (_) {}
        state = { ...state, listStyle: style };
        render();
        break;
      }
      case "toggleLike": {
        if (!state.account) {
          resetOtpVerifiedAnimation();
          state = { ...state, modal: { type: "login", reason: "برای استفاده از این خدمات، ابتدا وارد حساب کاربری خود شوید." }, loginStep: "phone", loginPhone: "", loginReturnTo: state.route };
          render();
          break;
        }
        const id = el.getAttribute("data-id");
        if (window.CARMA_API?.enabled && window.CARMA_AUTH_USER) {
          if (el.dataset.busy === "1") break;
          el.dataset.busy = "1";
          window.CARMA_MARKETPLACE?.toggleFavorite?.(id)
            .then((now) => { if (now && /^[0-9a-f-]{36}$/i.test(String(id))) window.CARMA_API.listings.event(id, 'favorite').catch(() => {}); render(); })
            .catch((error) => { if (typeof showToast === "function") showToast(error?.message || "ذخیرهٔ آگهی انجام نشد."); })
            .finally(() => { el.dataset.busy = "0"; });
          break;
        }
        const likedIds = state.likedIds.includes(id)
          ? state.likedIds.filter((x) => x !== id)
          : [...state.likedIds, id];
        state = { ...state, likedIds };
        bumpStat(id, "likes", likedIds.includes(id) ? 1 : -1);
        render();
        break;
      }
      case "clickContact": {
        const id = el.getAttribute("data-id");
        if (id) { bumpStat(id, "clicks"); if (window.CARMA_API?.enabled && /^[0-9a-f-]{36}$/i.test(String(id))) window.CARMA_API.listings.event(id, 'contact_click').catch(() => {}); }
        break;
      }
      case "shareVehicle": {
        const listing = state.route.page === "vehicle" ? state.route.listing : null;
        if (!listing) break;
        if (typeof openSharePoster === "function") { openSharePoster(listing); break; }
        const title = listingDisplayTitle(listing) || `${listing.brand} ${vehicleModelName(listing)}`;
        const shareData = { title, text: `مشاهده ${title}`, url: window.location.href };
        if (navigator.share) {
          navigator.share(shareData).catch(() => {});
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(window.location.href).then(() => showToast("لینک آگهی کپی شد")).catch(() => showToast("امکان کپی لینک وجود ندارد"));
        } else {
          showToast("امکان اشتراک‌گذاری در این مرورگر وجود ندارد");
        }
        break;
      }
      case "openContactSeller": {
        const id = el.getAttribute("data-id");
        const listing =
          LISTINGS.find((l) => l.id === id) ||
          (state.route.listing && state.route.listing.id === id ? state.route.listing : null);
        if (listing) {
          state = { ...state, modal: { type: "contact", listing, revealed: false } };
          updateOverlays();
        }
        break;
      }
      case "revealPhone": {
        if (state.modal && state.modal.type === "contact") {
          const id = state.modal.listing.id;
          bumpStat(id, "clicks");
          state = { ...state, modal: { ...state.modal, revealed: true } };
          updateOverlays();
        }
        break;
      }
      // FIX (perf/bug): opening/closing the burger menu used to call the
      // full render(), which tears down and rebuilds the entire current
      // page — including the listing-card grid — just to toggle a
      // slide-in drawer. That's why the menu felt heavy to open/close and
      // why the car cards visibly re-rendered every time it was toggled.
      // menuOpen only affects the drawer/backdrop/header, all of which
      // updateHeader()+updateMenuDrawer() already handle by toggling
      // classes on the existing drawer elements, so that's all we need
      // here — pageContent (and the cards inside it) is left untouched.
      case "openSearchOverlay": {
        clearTimeout(searchOverlayHideTimer);
        state = { ...state, searchOverlayOpen: true, searchOverlayQuery: "", searchOverlayLoading: false };
        updateSearchOverlay();
        startSearchOverlayRotator();
        renderSearchOverlayRail();
        /* No auto-focus: the keyboard opens only when the user taps the input. */
        break;
      }
      case "closeSearchOverlay": {
        state = { ...state, searchOverlayOpen: false };
        updateSearchOverlay();
        closeSearchOverlayFully();
        break;
      }
      case "clearSearchOverlay": {
        state = { ...state, searchOverlayQuery: "" };
        updateSearchOverlay();
        runSearchOverlaySearch();
        document.getElementById("searchOverlayInput")?.focus({ preventScroll: true });
        break;
      }
      case "clearOrCloseSearchOverlay": {
        if (state.searchOverlayQuery.trim().length > 0) {
          state = { ...state, searchOverlayQuery: "" };
          updateSearchOverlay();
          runSearchOverlaySearch();
          document.getElementById("searchOverlayInput")?.focus({ preventScroll: true });
        } else {
          state = { ...state, searchOverlayOpen: false };
          updateSearchOverlay();
          closeSearchOverlayFully();
        }
        break;
      }
      case "toggleBuy": {
        state = { ...state, buyOpen: !state.buyOpen };
        render();
        break;
      }
      case "goListingsFromMenu": {
        const brand = el.getAttribute("data-brand");
        navigateTo({ page: "brand", brand }, { menuOpen: false });
        break;
      }
      case "setThumb": {
        const idx = parseInt(el.getAttribute("data-index"), 10);
        state = { ...state, thumb: idx };
        updateVehiclePhoto();
        break;
      }
      case "toggleMorePhotos": {
        state = { ...state, showMorePhotos: !state.showMorePhotos };
        updateVehicleMorePhotos();
        break;
      }
      case "openPhotoViewer": {
        if (state.route.page !== "vehicle" || !state.route.listing) break;
        state = { ...state, photoViewerOpen: true };
        updatePhotoViewer();
        break;
      }
      case "closePhotoViewer": {
        state = { ...state, photoViewerOpen: false };
        updatePhotoViewer();
        break;
      }
      case "prevPhoto": {
        state = { ...state, thumb: (state.thumb - 1 + vehiclePhotoCount(state.route.listing)) % vehiclePhotoCount(state.route.listing) };
        updateVehiclePhoto();
        break;
      }
      case "nextPhoto": {
        state = { ...state, thumb: (state.thumb + 1) % vehiclePhotoCount(state.route.listing) };
        updateVehiclePhoto();
        break;
      }
      case "setTab": {
        const idx = parseInt(el.getAttribute("data-index"), 10);
        state = { ...state, activeTab: idx };
        updateVehicleTabs();
        break;
      }
      case "openAccount": {
        navigateTo({ page: "account" }, { menuOpen: false }, { skipBlur: fromDock });
        break;
      }
      case "chooseAccountEditBanner": {
        // Cover images can only be changed from the dedicated account editor.
        if (state.route && state.route.page === "accountEdit") {
          const input = document.getElementById("accountEditBannerInput");
          if (input) input.click();
        }
        break;
      }
      case "openAccountEdit": {
        if (!state.account) {
          resetOtpVerifiedAnimation();
          state = { ...state, modal: { type: "login" }, modalClosing: false, loginStep: "phone", loginPhone: "", loginReturnTo: { page: "account" } };
          updateOverlays();
          break;
        }
        navigateTo({ page: "accountEdit" }, { menuOpen: false });
        break;
      }
      case "goSaved": {
        if (!state.account) {
          resetOtpVerifiedAnimation();
          state = { ...state, menuOpen: false, modal: { type: "login", reason: "برای دیدن خودروهای نشان‌شده، ابتدا وارد حساب کاربری شوید." }, modalClosing: false, loginStep: "phone", loginPhone: "", loginReturnTo: { page: "saved" } };
          updateOverlays();
          break;
        }
        navigateTo({ page: "saved" }, { menuOpen: false }, { skipBlur: fromDock });
        break;
      }
      case "setAccountTab": {
        const tab = el.getAttribute("data-tab");
        if (!tab || tab === state.accountTab) break;
        state = { ...state, accountTab: tab };
        render();
        break;
      }
      case "goManageListings": {
        navigateTo({ page: "manageListings" }, { menuOpen: false });
        break;
      }
      case "promptLogin": {
        resetOtpVerifiedAnimation();
        state = { ...state, modal: { type: "login" }, modalClosing: false, loginStep: "phone", loginPhone: "", loginReturnTo: state.route };
        updateOverlays();
        break;
      }
      case "authBack": {
        if (state.loginStep === "code") {
          resetOtpVerifiedAnimation();
          state = { ...state, loginStep: "phone", loginPhone: state.loginPhone || "" };
          updateOverlays();
        } else {
          state = { ...state, modal: null, modalClosing: false };
          updateOverlays();
        }
        break;
      }
      case "closeAuthSheet": {
        resetOtpVerifiedAnimation();
        state = { ...state, modal: null, modalClosing: false, loginStep: "phone" };
        updateOverlays();
        break;
      }
      case "authKeypadDigit": {
        pressAuthKeypadDigit(el.getAttribute("data-key") || "");
        break;
      }
      case "authKeypadBackspace": {
        pressAuthKeypadBackspace();
        break;
      }
      case "toggleCountryPicker": {
        const picker = document.getElementById("authCountryPicker");
        const toggle = document.getElementById("authCountryButton");
        if (picker) picker.hidden = !picker.hidden;
        if (toggle) toggle.setAttribute("aria-expanded", String(picker ? !picker.hidden : false));
        break;
      }
      case "selectAuthCountry": {
        setAuthCountry(el.getAttribute("data-country"));
        break;
      }
      case "resendOtp": {
        if (resendCooldownUntil && Date.now() < resendCooldownUntil) break;
        if (state.loginStep === "code") {
          const phone = authPhoneForApi(state.loginPhone || "");
          (async () => {
            try {
              await window.CARMA_API.auth.requestOtp(phone);
              document.querySelectorAll("#authOtpInputs [data-otp-index]").forEach(i => { i.value = ""; i.classList.remove("has-value", "is-error"); });
              updateOtpContinue();
              focusAuthField('#authOtpInputs [data-otp-index="0"]', 60);
              startResendCooldown();
              showToast("کد تأیید جدید ارسال شد.");
            } catch (error) { showToast(error.message || "ارسال کد انجام نشد."); }
          })();
        } else {
          state = { ...state, loginStep: "phone" };
          updateOverlays();
        }
        break;
      }
      case "authDone": {
        hideAuthSuccessThenEnterAccount();
        break;
      }
      case "closeModal": {
        if (!state.modal || state.modalClosing) break;
        const wasLogin = state.modal.type === "login";
        state = { ...state, modalClosing: true };
        updateOverlays();
        setTimeout(() => {
          if (wasLogin) resetOtpVerifiedAnimation();
          if (state.modalClosing) {
            state = { ...state, modal: null, modalClosing: false, loginStep: wasLogin ? "phone" : state.loginStep };
            updateOverlays();
          }
        }, state.modal && state.modal.type === "login" ? 520 : 500);
        break;
      }
      case "logout": {
        // Invalidate the HttpOnly server session. UI clears immediately; the server also enforces expiry/revocation.
        try { window.CARMA_API?.auth?.logout()?.catch(() => {}); } catch (_) {}
        // The showroom stays in the public directory after its owner logs out: remember it in the shared
        // list first (state.dealership is cleared below), then re-read the real list from the server.
        try { if (state.dealership && state.dealership.id) window.CARMA_SESSION?.upsertShowroom?.(state.dealership); } catch (_) {}
        try {
          Promise.resolve().then(async () => {
            const a = await window.CARMA_SESSION?.refreshShowrooms?.();
            const b = await window.CARMA_MARKETPLACE?.syncPublicListings?.();
            if ((a || b) && typeof render === "function") render();
          }).catch(() => {});
        } catch (_) {}
        window.CARMA_AUTH_USER = null;
        window.CARMA_AD_STATS_CACHE = {};
        try { window.dispatchEvent(new CustomEvent("carmaa:session-reset")); } catch (_) {}
        try { window.localStorage.removeItem("marqueAccount"); } catch (_) {}
        state = {
          ...state,
          account: null,
          dealership: null,
          accountProfile: { firstName: "", lastName: "", email: "", avatar: null },
          accountEditError: null,
          dealershipDraft: null,
          dealershipLogoDraft: null,
          dealershipBannerDraft: null,
          myListings: [],
          likedIds: [],
          accountTab: "listings",
          editingListingId: null,
          modal: null,
          modalClosing: false,
          authSuccess: false,
          loginPhone: "",
          loginStep: "phone",
          route: { page: "home" },
          loading: false,
          loadingStage: null,
          pendingRoute: null,
        };
        try { window.history.replaceState({ ...(window.history.state || {}), marqueRoute: { page: "home" } }, "", /^https?:$/.test(window.location.protocol) ? "/" : window.location.pathname + window.location.search); } catch (_) {}
        render();
        updateOverlays();
        showToast("با موفقیت از حساب خارج شدید");
        break;
      }
      case "openNews": {
        const nid = el.getAttribute("data-id");
        if (nid) navigateTo({ page: "newsItem", newsId: nid }, { menuOpen: false });
        break;
      }
      case "goNews": {
        navigateTo({ page: "news" }, { menuOpen: false });
        break;
      }
      case "browseDealers": {
        navigateTo({ page: "dealers" }, { menuOpen: false });
        break;
      }
      case "goSell": {
        if (!state.account) {
          resetOtpVerifiedAnimation();
          state = { ...state, menuOpen: false, modal: { type: "login", reason: "برای ثبت آگهی، ابتدا وارد حساب کاربری شوید." }, modalClosing: false, loginStep: "phone", loginPhone: "", loginReturnTo: { page: "sell" } };
          updateOverlays();
          break;
        }
        // Starting a fresh listing must never carry over a stale edit
        // target or leftover draft fields from a previously abandoned
        // edit — otherwise submitting this "new" listing would silently
        // overwrite whichever listing was last opened for editing.
        navigateTo({ page: "sell" }, { menuOpen: false, sellError: null, editingListingId: null, sellForm: { ...BLANK_SELL_FORM, phone: state.account || "" }, sellStep: 1, sellDirection: "forward", sellPanelLock: null }, { skipBlur: fromDock });
        break;
      }
      case "goSellDealer": {
        // «افزودن آگهی» در صفحه‌ی خود نمایشگاه: آگهی مستقیم در همان نمایشگاه ثبت می‌شود و پنل پرسیده نمی‌شود.
        if (!state.account) {
          resetOtpVerifiedAnimation();
          state = { ...state, menuOpen: false, modal: { type: "login", reason: "برای ثبت آگهی، ابتدا وارد حساب کاربری شوید." }, modalClosing: false, loginStep: "phone", loginPhone: "", loginReturnTo: { page: "sell" } };
          updateOverlays();
          break;
        }
        const lockDealer = !!(state.dealership && state.dealership.status === "approved");
        navigateTo({ page: "sell" }, { menuOpen: false, sellError: null, editingListingId: null, sellForm: { ...BLANK_SELL_FORM, phone: state.account || "" }, sellStep: 1, sellDirection: "forward", sellPanelLock: lockDealer ? "dealer" : null, lastPublishAs: lockDealer ? "dealer" : state.lastPublishAs }, { skipBlur: fromDock });
        break;
      }
      case "suggestSellTitle": { suggestSellTitle(); break; }
      case "useSellTitle": { useSellTitle(el.getAttribute("data-value") || ""); break; }
      case "setSellMileage": {
        setSellMileage(el.getAttribute("data-value") || "");
        break;
      }
      case "removeSellVideo": {
        state = { ...state, sellForm: { ...state.sellForm, video: null }, sellError: null };
        render();
        break;
      }
      case "showVideoRules": {
        showToast("ویدیو باید مربوط به همین خودرو باشد؛ ویدیوی نامرتبط، تبلیغاتی یا دارای شماره تماس حذف می‌شود.");
        break;
      }
      case "setSellOption": {
        setSellOption(el.getAttribute("data-field"), el.getAttribute("data-value"));
        break;
      }
      case "editListing": {
        const id = el.getAttribute("data-id");
        const entry = state.myListings.find((m) => m.id === id);
        if (!entry) break;
        // A listing can't be edited while it's still pending review —
        // editing only becomes available once it has actually been
        // published (see promoteListing).
        if (entry.status === "pending") {
          showToast("تا زمانی که آگهی منتشر نشده، امکان ویرایش آن وجود ندارد.");
          break;
        }
        if (!state.account) {
          resetOtpVerifiedAnimation();
          state = { ...state, modal: { type: "login" }, modalClosing: false, loginStep: "phone", loginPhone: "", loginReturnTo: { page: "manageListings" } };
          updateOverlays();
          break;
        }
        navigateTo(
          { page: "sell" },
          {
            menuOpen: false,
            sellError: null,
            editingListingId: id,
            sellForm: sellFormFromListing(entry.listing),
            sellStep: 1,
            sellDirection: "forward",
          }
        );
        break;
      }
      case "cancelEditListing": {
        navigateTo({ page: "manageListings" }, { editingListingId: null, sellForm: BLANK_SELL_FORM, sellStep: 1, sellError: null, sellPanelLock: null });
        break;
      }
      case "promptLoginSell": {
        resetOtpVerifiedAnimation();
        state = { ...state, modal: { type: "login" }, modalClosing: false, loginStep: "phone", loginPhone: "", loginReturnTo: { page: "sell" } };
        updateOverlays();
        break;
      }
      case "goListingsFromMenuAll": {
        navigateTo({ page: "listings", brand: "all" }, { menuOpen: false });
        break;
      }
      case "menuNavItem": {
        const label = el.getAttribute("data-label");
        state = { ...state, menuOpen: false };
        showToast(`${label} — به‌زودی`);
        break;
      }
      case "promoGetStarted": {
        state = { ...state, modalClosing: false, modal: { type: "getstarted", title: "فروش سوپراسپرت شما" }, menuOpen: false };
        updateOverlays();
        break;
      }
      case "promoPreQualify": {
        state = { ...state, modalClosing: false, modal: { type: "getstarted", title: "بررسی اولیه تأمین مالی" }, menuOpen: false };
        updateOverlays();
        break;
      }
      case "submitGetStarted": {
        break; // handled by submit listener below
      }
      case "noop": {
        break;
      }
      case "toggleToolFilters": {
        state = { ...state, filterOverlayOpen: true, chipDropdownKey: null };
        updateFilterOverlay();
        break;
      }
      case "closeFilterOverlay": {
        state = { ...state, filterOverlayOpen: false };
        updateFilterOverlay();
        break;
      }
      case "resetFilterOverlay": {
        state = {
          ...state,
          sort: "newest",
          filters: { model: null, city: null, color: null, condition: null, year: null, priceMin: null, priceMax: null, transmission: null, bodyStyle: null },
          visibleCount: 12,
          listingsLoadingMore: false,
        };
        renderFilterOverlayBody();
        refreshLiveToolbar();
        showToast("فیلترها بازنشانی شدند");
        break;
      }
      case "setOverlayFilterValue": {
        const key = el.getAttribute("data-filter");
        const value = el.getAttribute("data-value");
        const next = { ...state.filters, [key]: state.filters[key] === value ? null : value };
        state = { ...state, filters: next, visibleCount: 12, listingsLoadingMore: false };
        renderFilterOverlayBody();
        refreshLiveToolbar();
        break;
      }
      case "setOverlayBrand": {
        const value = el.getAttribute("data-value");
        const current = state.route.page === "brand" ? state.route.brand : (state.route.page === "listings" && state.route.brand !== "all" ? state.route.brand : state.selectedBrand);
        const clear = current === value;
        const page = state.route.page === "brand" && !clear ? "brand" : "listings";
        state = { ...state, selectedBrand: clear ? null : value, route: { page, brand: clear ? "all" : value }, filters: { ...state.filters, model: null }, visibleCount: 12, listingsLoadingMore: false };
        renderFilterOverlayBody();
        refreshLiveToolbar();
        break;
      }
      case "toggleOverlayMore": {
        const key = el.getAttribute("data-key");
        if (key && Object.prototype.hasOwnProperty.call(filterUi, key)) filterUi[key] = !filterUi[key];
        renderFilterOverlayBody();
        break;
      }
      case "toggleOverlaySpecial": {
        const value = el.getAttribute("data-value");
        const cur = Array.isArray(state.filters.specials) ? state.filters.specials : [];
        const next = cur.includes(value) ? cur.filter((v) => v !== value) : cur.concat(value);
        state = { ...state, filters: { ...state.filters, specials: next.length ? next : null }, visibleCount: 12, listingsLoadingMore: false };
        renderFilterOverlayBody();
        refreshLiveToolbar();
        break;
      }
      case "clearOverlayFilterKey": {
        const key = el.getAttribute("data-filter");
        if (key === "brand") {
          state = { ...state, selectedBrand: null, route: { page: state.route.page === "brand" ? "listings" : state.route.page, brand: "all" }, filters: { ...state.filters, model: null }, visibleCount: 12, listingsLoadingMore: false };
          renderFilterOverlayBody();
          refreshLiveToolbar();
          break;
        }
        const next = key === "price"
          ? { ...state.filters, priceMin: null, priceMax: null }
          : { ...state.filters, [key]: null };
        state = { ...state, filters: next, visibleCount: 12, listingsLoadingMore: false };
        renderFilterOverlayBody();
        refreshLiveToolbar();
        break;
      }
      case "setOverlaySort": {
        const sort = el.getAttribute("data-sort");
        state = { ...state, sort, visibleCount: 12, listingsLoadingMore: false };
        renderFilterOverlayBody();
        break;
      }
      case "openToolFilter": {
        const key = el.getAttribute("data-filter");
        if (key === "brand") { openBrandSheet(); break; }
        state = { ...state, chipDropdownKey: state.chipDropdownKey === key ? null : key };
        refreshLiveToolbar();
        break;
      }
      case "clearToolSearch": {
        if (searchLiveTimer) { clearTimeout(searchLiveTimer); searchLiveTimer = null; }
        state = { ...state, search: "", visibleCount: 12, listingsLoadingMore: false };
        render();
        break;
      }
      case "submitToolSearch": {
        const input = document.getElementById("toolSearchInput");
        const value = input ? input.value.trim() : "";
        state = { ...state, search: value, visibleCount: 12, listingsLoadingMore: false };
        if(state.route.page === "brand") state = { ...state, route: { page: "listings", brand: state.route.brand } };
        render();
        setTimeout(()=>document.getElementById("toolSearchInput")?.focus({preventScroll:true}),0);
        break;
      }
      case "toggleSort": {
        state = { ...state, sortOpen: !state.sortOpen };
        render();
        break;
      }
      case "setSort": {
        const sort = el.getAttribute("data-sort");
        state = { ...state, sort, sortOpen: false, visibleCount: 12, listingsLoadingMore: false };
        render();
        break;
      }
      case "clearAll": {
        state = { ...state, sort: "newest", filters: { model: null, city: null, color: null, condition: null, year: null, priceMin: null, priceMax: null, transmission: null, bodyStyle: null }, filterOpenKey: null, visibleCount: 12, listingsLoadingMore: false };
        showToast("فیلترها پاک شدند");
        break;
      }
      case "toggleFilter": {
        const key = el.getAttribute("data-filter");
        state = { ...state, filterOpenKey: state.filterOpenKey === key ? null : key, toolFiltersOpen: true };
        refreshLiveToolbar();
        break;
      }
      case "setFilterValue": {
        const key = el.getAttribute("data-filter");
        const value = el.getAttribute("data-value");
        if (key === "brand") {
          state = { ...state, selectedBrand: value, route: { page: "listings", brand: value }, filters: { ...state.filters, model: null }, toolFiltersOpen: false, filterOpenKey: null, visibleCount: 12, listingsLoadingMore: false };
          render();
          break;
        }
        const next = { ...state.filters, [key]: state.filters[key] === value ? null : value };
        state = { ...state, filters: next, visibleCount: 12, listingsLoadingMore: false, toolFiltersOpen: true, filterOpenKey: null };
        if (state.route.page === "brand") {
          state = { ...state, route: { page: "listings", brand: state.route.brand } };
        }
        render();
        break;
      }
      case "setChipFilterValue": {
        const key = el.getAttribute("data-filter");
        const value = el.getAttribute("data-value");
        if (key === "brand") {
          state = { ...state, selectedBrand: value, route: { page: "listings", brand: value }, filters: { ...state.filters, model: null }, chipDropdownKey: null, visibleCount: 12, listingsLoadingMore: false };
          render();
          break;
        }
        const next = { ...state.filters, [key]: state.filters[key] === value ? null : value };
        state = { ...state, filters: next, visibleCount: 12, listingsLoadingMore: false, chipDropdownKey: null };
        if (state.route.page === "brand") {
          state = { ...state, route: { page: "listings", brand: state.route.brand } };
        }
        render();
        break;
      }
      case "openPricing": {
        state = { ...state, modalClosing: false, modal: { type: "pricing", listing: state.route.listing } };
        updateOverlays();
        break;
      }
      case "openLiveAuctions": {
        showToast("حراجی‌های زنده به‌زودی آغاز می‌شود — بعداً دوباره سر بزنید");
        break;
      }
      case "openSellBrandPicker": {
        openSellBrandPicker();
        break;
      }
      case "closeSellBrandPicker": {
        closeSellBrandPicker();
        break;
      }
      case "openSellModelPicker": {
        openSellModelPicker();
        break;
      }
      case "clearSellModelSearch": {
        const si = document.getElementById("sellModelPickerSearch");
        if (si) { si.value = ""; si.focus(); }
        renderSellModelPicker("");
        break;
      }
      case "closeSellModelPicker": {
        closeSellModelPicker();
        break;
      }
      case "chooseSellModel": {
        chooseSellModel(el.getAttribute("data-model") || "");
        break;
      }
      case "openSellSubmodelPicker": {
        openSellSubmodelPicker(el.getAttribute("data-model") || "");
        break;
      }
      case "backSellModelPicker": {
        backSellModelPicker();
        break;
      }
      case "closeSellTrimPicker": {
        closeSellTrimPicker();
        break;
      }
      case "openSellTrimPicker": {
        openSellTrimPicker();
        break;
      }
      case "chooseSellTrim": {
        chooseSellTrim(el.getAttribute("data-trim") || "full");
        break;
      }
      case "openSellCityPicker": {
        openSellCityPicker();
        break;
      }
      case "closeSellCityPicker": {
        closeSellCityPicker();
        break;
      }
      case "chooseSellCity": {
        chooseSellCity(el.getAttribute("data-city") || "");
        break;
      }
      case "openSellColorPicker": {
        openSellColorPicker();
        break;
      }
      case "closeSellColorPicker": {
        closeSellColorPicker();
        break;
      }
      case "chooseSellColor": {
        chooseSellColor(el.getAttribute("data-color") || "");
        break;
      }
      case "setSellPrice": {
        setSellPrice(el.getAttribute("data-price") || "");
        break;
      }
      case "addSellPrice": {
        addSellPrice(el.getAttribute("data-price-add") || "0");
        break;
      }
      case "openSellYearPicker": {
        openSellYearPicker();
        break;
      }
      case "closeSellYearPicker": {
        closeSellYearPicker();
        break;
      }
      case "chooseSellBrand": {
        chooseSellBrand(el.getAttribute("data-brand") || "");
        break;
      }
      case "confirmSellYear": {
        confirmSellYear();
        break;
      }
      case "sellNext":
      case "sellPrev":
      case "removeSellPhoto": {
        const form = el.closest("form");
        const fd = form ? new FormData(form) : null;
        const negotiable = readSellToggle(form, fd, "negotiable");
        const nextForm = {
          ...state.sellForm,
          brand: fd?.get("brand") ?? state.sellForm.brand,
          year: fd?.get("year") ?? state.sellForm.year,
          model: fd?.get("model") ?? state.sellForm.model,
          price: negotiable ? "" : String(fd?.get("price") ?? state.sellForm.price ?? "").replace(/[^0-9]/g, ""),
          miles: String(fd?.get("miles") ?? state.sellForm.miles ?? "").replace(/[^0-9]/g, ""),
          color: fd?.get("color") ?? state.sellForm.color,
          trim: fd?.get("trim") ?? state.sellForm.trim,
          city: fd?.get("city") ?? state.sellForm.city,
          // Ignore any submitted "phone" field value entirely — the ad's
          // contact number is always the logged-in account's number, never
          // user-editable (the input is readonly, but this guards against
          // tampering too).
          phone: state.account || state.sellForm.phone,
          description: fd?.get("description") ?? state.sellForm.description,
          negotiable,
          tradeIn: readSellToggle(form, fd, "tradeIn"),
          acceptsOffers: readSellToggle(form, fd, "acceptsOffers"),
          minPrice: String(fd?.get("minPrice") ?? state.sellForm.minPrice ?? "").replace(/[^0-9]/g, ""),
        };
        if (action === "removeSellPhoto") {
          // The ✕ button itself carries no data-index; the index lives on the
          // photo card (tpl-sell-photo root), so read it from the nearest ancestor.
          const idxHolder = el.closest("[data-index]");
          const idx = parseInt((idxHolder && idxHolder.getAttribute("data-index")) ?? el.getAttribute("data-index"), 10);
          if (!Number.isInteger(idx)) break;
          nextForm.photos = [...(state.sellForm.photos || [])].filter((_, i) => i !== idx);
          state = { ...state, sellForm: nextForm, sellError: null };
          render();
          break;
        }
        const current = state.sellStep || 1;
        if (action === "sellNext") {
          // Step order: 1) photos & description, 2) vehicle specs, 3) price & condition,
          // 4) body/paint condition (optional), 5) location & contact (validated on submit).
          if (current === 1 && !String(nextForm.description || "").trim()) {
            state = { ...state, sellForm: nextForm, sellError: "لطفاً توضیحات آگهی را وارد کنید؛ این بخش الزامی است." }; render(); break;
          }
          if (current === 2 && (!nextForm.brand || !nextForm.year || !nextForm.model)) {
            state = { ...state, sellForm: nextForm, sellError: "لطفاً برند، سال و مدل خودرو را وارد کنید." }; render(); break;
          }
          if (current === 2 && (!nextForm.fuelType || !nextForm.transmission || !nextForm.interiorColor || !nextForm.driveTrain)) {
            state = { ...state, sellForm: nextForm, sellError: "لطفاً نوع سوخت، گیربکس، رنگ تریم داخلی و سیستم انتقال قدرت را انتخاب کنید." }; render(); break;
          }
          if (current === 2 && sellNeedsEngineSpecs(nextForm) && (!nextForm.engineVolume || !nextForm.cylinders)) {
            state = { ...state, sellForm: nextForm, sellError: "لطفاً حجم موتور و تعداد سیلندر را انتخاب کنید." }; render(); break;
          }
          if (current === 5 && !String(nextForm.city || "").trim()) {
            state = { ...state, sellForm: nextForm, sellError: "لطفاً شهر خودرو را انتخاب کنید." }; render(); break;
          }
          if (current === 5 && action === "sellNext" && !nextForm.locConfirmed) {
            state = { ...state, sellForm: nextForm, sellError: "لطفاً موقعیت خودرو را روی نقشه با دکمه‌ی «تایید موقعیت» تایید کنید." }; render(); break;
          }
          if (current === 3 && ((!nextForm.negotiable && !Number.isFinite(parseInt(nextForm.price, 10))) || !Number.isFinite(sellMilesNumber(nextForm)))) {
            state = { ...state, sellForm: nextForm, sellError: nextForm.negotiable ? "لطفاً کارکرد را با مقدار معتبر وارد کنید." : "لطفاً قیمت و کارکرد را با مقدار معتبر وارد کنید." }; render(); break;
          }
          if (current === 3 && nextForm.mileageType === "presale" && !nextForm.deliveryTime) {
            state = { ...state, sellForm: nextForm, sellError: "لطفاً زمان تحویل را انتخاب کنید." }; render(); break;
          }
        }
        try { if (navigator.vibrate) navigator.vibrate(action === "sellNext" ? 12 : 8); } catch (_) {}
        state = { ...state, sellForm: nextForm, sellStep: Math.max(1, Math.min(sellTotalSteps(), current + (action === "sellNext" ? 1 : -1))), sellDirection: action === "sellNext" ? "forward" : "backward", sellError: null };
        render();
        window.scrollTo(0, 0);
        break;
      }
      case "makeSellPhotoPrimary": {
        const idx = parseInt(el.getAttribute("data-index"), 10);
        const photos = Array.isArray(state.sellForm.photos) ? [...state.sellForm.photos] : [];
        if (Number.isInteger(idx) && idx > 0 && idx < photos.length) {
          const [chosen] = photos.splice(idx, 1);
          photos.unshift(chosen);
          state = { ...state, sellForm: { ...state.sellForm, photos }, sellError: null };
          render();
        }
        break;
      }
      case "openPartStatusPicker": {
        const panel = el.getAttribute("data-panel");
        if (panel) openPartStatusPicker(panel);
        break;
      }
      case "closePartStatusPicker": {
        closePartStatusPicker();
        break;
      }
      case "choosePartStatus": {
        choosePartStatus(el.getAttribute("data-status") || "");
        break;
      }
      case "clearPartStatus": {
        clearPartStatus();
        break;
      }
      case "noop":
      default:
        break;
    }
  });

  // A portrait (vertical) car photo is cut to a 4:3 landscape band (full
  // width; top and bottom trimmed, a bit more from the top because the car
  // usually sits in the lower half) so it fits the listing cards. Landscape
  // photos pass through untouched. Resolves with a data URL (or the original
  // if anything goes wrong).
  // Showroom banner: centre-crop to a vertical 3:4 frame, max 720px wide.
  function cropBannerPhoto(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) return resolve(dataUrl);
          let sw = w, sh = Math.round(w * 4 / 3);
          if (sh > h) { sh = h; sw = Math.round(h * 3 / 4); }
          const sx = Math.round((w - sw) / 2), sy = Math.round((h - sh) / 2);
          const ow = Math.min(720, sw), oh = Math.round(ow * 4 / 3);
          const c = document.createElement("canvas"); c.width = ow; c.height = oh;
          const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, ow, oh);
          g.drawImage(img, sx, sy, sw, sh, 0, 0, ow, oh);
          resolve(mrCanvasToDataURL(c, 0.82));
        } catch (_) { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function cropPortraitPhoto(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) return resolve(dataUrl);
          const portrait = h > w * 1.05;
          const srcH = portrait ? Math.round(w * 3 / 4) : h;
          const sy = portrait ? Math.round((h - srcH) * 0.55) : 0;
          const scale = Math.min(1, 1280 / w);
          // Every photo is re-encoded as WebP (small landscape photos included).
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(srcH * scale);
          const g = canvas.getContext("2d");
          g.fillStyle = "#fff"; g.fillRect(0, 0, canvas.width, canvas.height);
          g.drawImage(img, 0, sy, w, srcH, 0, 0, canvas.width, canvas.height);
          if (portrait) cropPortraitPhoto.cropped = (cropPortraitPhoto.cropped || 0) + 1;
          const out = mrCanvasToDataURL(canvas, 0.78);
          resolve(out);
        } catch (_) { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  // Showroom banner: centre-crop to a wide 16:9 frame, max 960px wide.
  function cropLandscapeBanner(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) return resolve(dataUrl);
          /* SB-FIX: 4:3 banner crop */ let sw = w, sh = Math.round(w * 3 / 4);
          if (sh > h) { sh = h; sw = Math.round(h * 4 / 3); }
          const sx = Math.round((w - sw) / 2), sy = Math.round((h - sh) / 2);
          const ow = Math.min(1280, sw), oh = Math.round(ow * 3 / 4);
          const c = document.createElement("canvas"); c.width = ow; c.height = oh;
          const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, ow, oh);
          g.drawImage(img, sx, sy, sw, sh, 0, 0, ow, oh);
          resolve(mrCanvasToDataURL(c, 0.8));
        } catch (_) { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  // Showroom profile photo: centre-crop to a square, max 360px.
  function cropSquareAvatar(dataUrl, maxSide) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) return resolve(dataUrl);
          const s = Math.min(w, h);
          const sx = Math.round((w - s) / 2), sy = Math.round((h - s) / 2);
          const o = Math.min(maxSide || 360, s);
          const c = document.createElement("canvas"); c.width = o; c.height = o;
          const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, o, o);
          g.drawImage(img, sx, sy, s, s, 0, 0, o, o);
          resolve(mrCanvasToDataURL(c, 0.82));
        } catch (_) { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  document.addEventListener("change", function (e) {
    const avatarInput = e.target.closest("#accountAvatarInput");
    if (avatarInput) {
      const file = avatarInput.files && avatarInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        mrRecompressPhoto(reader.result, 320, 0.8).then((url) => {
          if (state.account && !window.CARMA_API?.enabled) mrSetAvatar("p", sellerIdForPhone(state.account), url); // server mode: the photo is uploaded on save, not kept in the browser
          state = { ...state, accountProfile: { ...state.accountProfile, avatar: url } };
          const preview = document.querySelector('[data-slot="avatar-preview"]');
          if (preview && state.route && state.route.page === "accountEdit") {
            preview.innerHTML = `<img src="${url}" alt="عکس پروفایل" class="w-full h-full object-cover"/>`;
          }
        });
      };
      reader.readAsDataURL(file);
      return;
    }
    const accountBannerInput = e.target.closest("#accountEditBannerInput");
    if (accountBannerInput) {
      if (!state.route || state.route.page !== "accountEdit") return;
      const file = accountBannerInput.files && accountBannerInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        mrRecompressPhoto(reader.result, 1600, 0.82).then((url) => {
          if (state.account && !window.CARMA_API?.enabled) mrSetAvatar("ab", sellerIdForPhone(state.account), url); // server mode: the photo is uploaded on save, not kept in the browser
          state = { ...state, accountProfile: { ...state.accountProfile, banner: url } };
          const preview = document.querySelector('[data-slot="banner-preview"]');
          if (preview && state.route && state.route.page === "accountEdit") {
            preview.style.backgroundImage = `url("${url}")`;
            preview.classList.add("has-banner");
            preview.innerHTML = "";
            const label = document.querySelector(".account-edit-banner-button");
            if (label) label.innerHTML = '<span aria-hidden="true">＋</span> تغییر بنر';
          }
        });
      };
      reader.readAsDataURL(file);
      return;
    }
    const bannerInput = e.target.closest("#dealerBannerInput");
    if (bannerInput) {
      const file = bannerInput.files && bannerInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        cropLandscapeBanner(reader.result).then((url) => {
          let draft = state.dealershipDraft;
          const form = bannerInput.closest("form");
          if (form) {
            const fd = new FormData(form);
            draft = { name: (fd.get("dealerName") || "").toString(), username: (fd.get("dealerUsername") || "").toString(), ownerName: (fd.get("ownerName") || "").toString(), address: (fd.get("dealerAddress") || "").toString(), nid: (fd.get("nationalId") || "").toString(), tags: (fd.get("dealerTags") || "").toString() };
          }
          state = { ...state, dealershipBannerDraft: url, dealershipDraft: draft };
          render();
        });
      };
      reader.readAsDataURL(file);
      return;
    }
    const logoInput = e.target.closest("#dealerLogoInput");
    if (logoInput) {
      const file = logoInput.files && logoInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        cropSquareAvatar(reader.result, 900).then((url) => {
          // keep what the owner already typed: the edit page is rebuilt from the draft
          let draft = state.dealershipDraft;
          const form = logoInput.closest("form");
          if (form) {
            const fd = new FormData(form);
            draft = { name: (fd.get("dealerName") || "").toString(), username: (fd.get("dealerUsername") || "").toString(), ownerName: (fd.get("ownerName") || "").toString(), address: (fd.get("dealerAddress") || "").toString(), nid: (fd.get("nationalId") || "").toString(), tags: (fd.get("dealerTags") || "").toString() };
          }
          state = { ...state, dealershipLogoDraft: url, dealershipDraft: draft };
          render();
        });
      };
      reader.readAsDataURL(file);
      return;
    }
    const videoInput = e.target.closest("#sellVideoInput");
    if (videoInput) {
      const file = (videoInput.files || [])[0];
      videoInput.value = "";
      if (!file) return;
      if (!/^video\//.test(file.type)) { showToast("فقط فایل ویدیو قابل بارگذاری است."); return; }
      if (file.size > SELL_VIDEO_MAX_BYTES) { showToast("حجم ویدیو نباید بیشتر از ۳۰۰ مگابایت باشد."); return; }
      const url = URL.createObjectURL(file);
      const vid = document.createElement("video");
      vid.preload = "metadata"; vid.muted = true; vid.playsInline = true;
      const fail = (msg) => { URL.revokeObjectURL(url); showToast(msg); };
      vid.onerror = () => fail("این ویدیو قابل خواندن نیست؛ فرمت دیگری را امتحان کنید.");
      vid.onloadedmetadata = () => {
        const d = vid.duration;
        if (!Number.isFinite(d)) return fail("مدت‌زمان ویدیو مشخص نشد.");
        if (d < SELL_VIDEO_MIN_SEC) return fail("زمان ویدیو باید حداقل ۳۰ ثانیه باشد.");
        if (d > SELL_VIDEO_MAX_SEC) return fail("زمان ویدیو باید حداکثر ۳ دقیقه باشد.");
        vid.currentTime = Math.min(1, d / 2);
      };
      vid.onseeked = () => {
        let poster = "";
        try {
          const w = 480, h = Math.max(1, Math.round(w * (vid.videoHeight || 270) / (vid.videoWidth || 480)));
          const c = document.createElement("canvas"); c.width = w; c.height = h;
          c.getContext("2d").drawImage(vid, 0, 0, w, h);
          poster = mrCanvasToDataURL(c, 0.7);
        } catch (_) {}
        if (!poster) return fail("پیش‌نمایش ویدیو ساخته نشد.");
        state = { ...state, sellForm: { ...state.sellForm, video: { url, poster, duration: vid.duration, name: file.name } }, sellError: null };
        render();
      };
      vid.src = url;
      return;
    }
    const input = e.target.closest("#sellPhotoInput");
    if (!input) return;
    const picked = Array.from(input.files || []);
    input.value = "";
    if (!picked.length) return;
    const existing = Array.isArray(state.sellForm.photos) ? state.sellForm.photos : [];
    const room = SELL_MAX_PHOTOS - existing.length;
    if (room <= 0) { showToast("حداکثر ۴ عکس می‌توانید اضافه کنید."); return; }
    const valid = picked.filter((f) => /^image\//.test(f.type));
    const small = valid.filter((f) => f.size <= SELL_MAX_PHOTO_BYTES);
    if (valid.length !== picked.length) showToast("فقط فایل تصویر قابل بارگذاری است.");
    else if (small.length !== valid.length) showToast("حجم هر عکس باید حداکثر ۲۰ مگابایت باشد.");
    else if (small.length > room) showToast("حداکثر ۴ عکس می‌توانید اضافه کنید؛ فقط " + toFaDigits(String(room)) + " عکس اول اضافه شد.");
    const files = small;
    if (!files.length) return;
    const readers = files.slice(0, room).map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => cropPortraitPhoto(reader.result).then(resolve);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then((results) => {
      const added = results.filter(Boolean);
      if (cropPortraitPhoto.cropped) { cropPortraitPhoto.cropped = 0; showToast("عکس عمودی به‌صورت خودکار به اندازه کارت برش خورد."); }
      state = { ...state, sellForm: { ...state.sellForm, photos: [...existing, ...added] }, sellError: null };
      render();
      // Free on-device suggestion of brand / model / colour from the new photos (js/55-photo-autofill.js).
      if (added.length && window.carmaaPhotoAutofill) window.carmaaPhotoAutofill.run(added);
    });
  });

  document.addEventListener("input", function (e) {
    const target = e.target;
    if (target && target.closest?.('[data-page="sell-step"]') && target.name === "price") {
      const digits = String(target.value || "").replace(/[^0-9]/g, "");
      target.value = formatSellPrice(digits);
      state = { ...state, sellForm: { ...state.sellForm, price: digits }, sellError: null };
      updateSellPriceAdders();
      updateSellPriceUnit();
      return;
    }
    if (target && target.closest?.('[data-page="sell-step"]') && target.name === "negotiable") {
      const page = target.closest('[data-page="sell-step"]');
      applySellNegotiableUI(page, target.checked);
      const pInput = page.querySelector('input[name="price"]');
      const digits = target.checked ? "" : String(pInput?.value || "").replace(/[^0-9]/g, "");
      state = { ...state, sellForm: { ...state.sellForm, negotiable: target.checked, price: digits }, sellError: null };
      updateSellPriceAdders();
      updateSellPriceUnit();
      return;
    }
    if (target && target.closest?.('[data-page="sell-step"]') && target.name === "miles") {
      const digits = faToEnDigits(target.value || "").replace(/[^0-9]/g, "");
      target.value = formatSellPrice(digits); // 12,000 — grouped by 3 for readability; state keeps plain digits
      state = { ...state, sellForm: { ...state.sellForm, miles: digits }, sellError: null };
      updateSellMilesHint(target.closest('[data-page="sell-step"]'));
      return;
    }
    if (target && target.closest?.('[data-page="sell-step"]') && target.name && !["price", "miles"].includes(target.name)) {
      const value = target.type === "checkbox" ? target.checked : target.value;
      state = { ...state, sellForm: { ...state.sellForm, [target.name]: value }, sellError: null };
      return;
    }
    if (target && target.id === "sellModelPickerSearch") {
      renderSellModelPicker(target.value);
      return;
    }
    if (target && target.id === "searchOverlayInput") {
      state = { ...state, searchOverlayQuery: target.value };
      const shell = document.querySelector(".search-overlay-shell");
      const clearBtn = document.querySelector(".search-overlay-clear");
      const hasValue = target.value.trim().length > 0;
      if (shell) shell.classList.toggle("has-value", hasValue);
      if (clearBtn) clearBtn.setAttribute("aria-label", hasValue ? "پاک کردن جستجو" : "بستن جستجو");
      runSearchOverlaySearch();
      return;
    }
    if (target && target.id === "toolSearchInput") {
      state = { ...state, search: target.value };
      const clear = document.querySelector('.header-search-clear');
      if (clear) clear.hidden = !target.value.trim();
      if (searchLiveTimer) clearTimeout(searchLiveTimer);
      searchLiveTimer = setTimeout(() => {
        searchLiveTimer = null;
        state = { ...state, visibleCount: 12, listingsLoadingMore: false };
        if (state.route.page === "brand") state = { ...state, route: { page: "listings", brand: state.route.brand } };
        render();
        setTimeout(() => document.getElementById("toolSearchInput")?.focus({ preventScroll: true }), 0);
      }, 250);
      return;
    }
    if (target && target.id === "authPhoneInput") {
      updateAuthPhoneControls();
      state = { ...state, loginPhone: target.value };
      return;
    }
    const otp = target?.closest?.("#authOtpInputs [data-otp-index]");
    if (otp) {
      const clean = authDigits(otp.value).slice(-1);
      otp.value = clean;
      otp.classList.toggle("has-value", !!clean);
      otp.classList.remove("is-error");
      if (clean) {
        const idx = Number(otp.dataset.otpIndex || 0);
        document.querySelector(`#authOtpInputs [data-otp-index="${Math.min(5, idx + 1)}"]`)?.focus({ preventScroll: true });
      }
      updateOtpContinue();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (state.photoViewerOpen && (e.key === "Escape" || e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      if (e.key === "Escape") {
        state = { ...state, photoViewerOpen: false };
        updatePhotoViewer();
      } else if (state.route.page === "vehicle" && state.route.listing) {
        const total = vehiclePhotoCount(state.route.listing);
        const dir = e.key === "ArrowRight" ? 1 : -1;
        state = { ...state, thumb: (state.thumb + dir + total) % total };
        updateVehiclePhoto();
      }
      return;
    }
    if (e.key === "Escape" && state.searchOverlayOpen) {
      state = { ...state, searchOverlayOpen: false };
      updateSearchOverlay();
      closeSearchOverlayFully();
      return;
    }
    if (e.target?.id === "searchOverlayInput" && e.key === "Enter") {
      e.preventDefault();
      clearTimeout(searchOverlayDebounce);
      clearTimeout(searchOverlayLoadingTimer);
      updateSearchOverlaySkeletonVisibility(false);
      renderSearchOverlayRail();
      return;
    }
    if (e.target?.id === "toolSearchInput" && e.key === "Enter") {
      e.preventDefault();
      if (searchLiveTimer) { clearTimeout(searchLiveTimer); searchLiveTimer = null; }
      const input = e.target;
      state = { ...state, search: input.value.trim(), visibleCount: 12, listingsLoadingMore: false };
      if (state.route.page === "brand") state = { ...state, route: { page: "listings", brand: state.route.brand } };
      render();
      setTimeout(()=>document.getElementById("toolSearchInput")?.focus({preventScroll:true}),0);
      return;
    }
    const otp = e.target?.closest?.("#authOtpInputs [data-otp-index]");
    if (!otp) return;
    const idx = Number(otp.dataset.otpIndex || 0);
    if (e.key === "Backspace" && !otp.value && idx > 0) {
      e.preventDefault();
      const prev = document.querySelector(`#authOtpInputs [data-otp-index="${idx - 1}"]`);
      if (prev) { prev.value = ""; prev.classList.remove("has-value"); prev.focus({ preventScroll: true }); }
      updateOtpContinue();
    }
    if (e.key === "ArrowLeft" && idx > 0) document.querySelector(`#authOtpInputs [data-otp-index="${idx - 1}"]`)?.focus({ preventScroll: true });
    if (e.key === "ArrowRight" && idx < 5) document.querySelector(`#authOtpInputs [data-otp-index="${idx + 1}"]`)?.focus({ preventScroll: true });
  });

  document.addEventListener("paste", function (e) {
    const otp = e.target?.closest?.("#authOtpInputs [data-otp-index]");
    if (!otp) return;
    const pasted = authDigits(e.clipboardData?.getData("text") || "").slice(0, 6);
    if (pasted.length < 1) return;
    e.preventDefault();
    const inputs = Array.from(document.querySelectorAll("#authOtpInputs [data-otp-index]"));
    inputs.forEach((input, i) => { input.value = pasted[i] || ""; input.classList.toggle("has-value", !!pasted[i]); input.classList.remove("is-error"); });
    const focusIndex = Math.min(5, pasted.length);
    inputs[focusIndex]?.focus({ preventScroll: true });
    updateOtpContinue();
  });

  document.addEventListener("pointerdown", function (e) {
    const picker = document.getElementById("authCountryPicker");
    const button = document.getElementById("authCountryButton");
    if (!picker || picker.hidden) return;
    if (!picker.contains(e.target) && !button?.contains(e.target)) {
      picker.hidden = true;
      button?.setAttribute("aria-expanded", "false");
    }
  });

  // Keep focus (and the blinking caret) on the phone input / OTP box that's
  // being edited when a keypad button is tapped, instead of the button
  // stealing focus away from it.
  document.addEventListener("pointerdown", function (e) {
    if (e.target.closest(".auth-keypad-btn")) e.preventDefault();
  });

  document.addEventListener("submit", async function (e) {
    const form = e.target.closest("[data-action]");
    if (!form) return;
    const action = form.getAttribute("data-action");
    if (action === "sendOtp") {
      e.preventDefault();
      if (state.modalClosing || state.loginStep === "code") return;
      const phoneInput = form.querySelector('[data-role="authPhone"]');
      const localPhone = phoneInput ? phoneInput.value.trim() : "";
      if (!authPhoneIsValid(localPhone)) { updateAuthPhoneControls(); return; }
      const phone = authPhoneForApi(localPhone);
      const submitButton = form.querySelector('[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      (async () => {
        try {
          await window.CARMA_API.auth.requestOtp(phone);
          state = { ...state, loginPhone: authDigits(localPhone), loginStep: "code", loginError: null };
          updateOverlays();
          startResendCooldown();
        } catch (error) {
          showToast(error.message || "ارسال پیامک انجام نشد.");
        } finally { if (submitButton && submitButton.isConnected) submitButton.disabled = false; }
      })();
    } else if (action === "verifyOtp") {
      e.preventDefault();
      if (state.modalClosing || state.loginStep !== "code") return;
      const otp = getOtpValue();
      const error = document.getElementById("authOtpError");
      if (otp.length !== 6) return;
      const phone = authPhoneForApi(state.loginPhone || "");
      const submitButton = form.querySelector('[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      (async () => {
        try {
          const result = await window.CARMA_API.auth.verifyOtp(phone, otp);
          if (!result?.user?.phone) throw new Error("پاسخ احراز هویت معتبر نیست.");
          window.CARMA_AUTH_USER = result.user;
          try { window.dispatchEvent(new CustomEvent("carmaa:session-reset")); } catch (_) {}
          if (error) error.hidden = true;
          document.querySelectorAll("#authOtpInputs [data-otp-index]").forEach(i => i.classList.remove("is-error"));
          playOtpVerifiedAnimation();
        } catch (err) {
          if (error) { error.hidden = false; error.textContent = err.message || "کد تأیید نادرست یا منقضی شده است."; }
          document.querySelectorAll("#authOtpInputs [data-otp-index]").forEach(i => i.classList.add("is-error"));
        } finally { if (submitButton && submitButton.isConnected) submitButton.disabled = false; }
      })();
    } else if (action === "saveDealership") {
      e.preventDefault();
      if (!state.account) return;
      const fd = new FormData(form);
      const name = (fd.get("dealerName") || "").toString().trim();
      const username = (fd.get("dealerUsername") || "").toString();
      // city/description are no longer part of the form: keep what is already saved
      const cityIn = (fd.get("dealerCity") || "").toString().trim();
      const city = KHUZESTAN_CITIES.includes(cityIn) ? cityIn : (state.dealership ? state.dealership.city : "");
      const description = state.dealership ? state.dealership.description : "";
      if (name.length < 2) {
        state = { ...state, dealershipDraft: { name, username, ownerName: (fd.get("ownerName") || "").toString(), address: (fd.get("dealerAddress") || "").toString(), nid: (fd.get("nationalId") || "").toString(), tags: (fd.get("dealerTags") || "").toString() }, dealershipError: "نام نمایشگاه را وارد کنید (حداقل ۲ حرف)." };
        render();
        return;
      }
      const ownerName = (fd.get("ownerName") || "").toString().trim();
      const address = (fd.get("dealerAddress") || "").toString().trim();
      const nidIn = faToEnDigits((fd.get("nationalId") || "").toString().trim());
      const prev = state.dealership ? MR_STORE.dealer(state.account) : null;
      let err = "";
      if (ownerName.length < 3) err = "نام مالک نمایشگاه را وارد کنید.";
      else if (address.length < 8) err = "آدرس نمایشگاه را کامل وارد کنید.";
      else if (window.CARMA_API?.enabled && city.length < 2) err = "شهر نمایشگاه را وارد کنید.";
      else if (window.CARMA_API?.enabled && !username.trim()) err = "برای ساخت شناسهٔ عمومی نمایشگاه، نام کاربری نمایشگاه را وارد کنید.";
      else if (window.MR_PROFILE && (() => { const inp = form.querySelector('input[name="dealerUsername"]'); return inp && !inp.readOnly && inp.dataset.unameState && ["taken", "invalid"].includes(inp.dataset.unameState); })()) err = "نام کاربری نمایشگاه معتبر نیست یا قبلاً توسط شخص دیگری گرفته شده است.";
      else if (window.MR_PROFILE && (() => { const i = window.MR_PROFILE.handleInfo("dealer"); return i.current && i.left === 0 && window.MR_PROFILE.slugOf(username) && window.MR_PROFILE.slugOf(username) !== window.MR_PROFILE.slugOf(i.current); })()) err = "سهمیهٔ تغییر نام کاربری نمایشگاه (۲ بار) تمام شده است.";
      else if (!prev && !nidIn && !window.CARMA_API?.enabled) err = "کد ملی مالک نمایشگاه را وارد کنید.";
      else if (nidIn && !isValidNationalId(nidIn)) err = "کد ملی واردشده معتبر نیست.";
      if (err) { state = { ...state, dealershipDraft: { name, username, ownerName, address, nid: nidIn, tags: (fd.get("dealerTags") || "").toString() }, dealershipError: err }; render(); return; }
      if (window.CARMA_API?.enabled && window.CARMA_AUTH_USER) {
        const slug = username.trim().toLowerCase().replace(/^@/, "").replace(/[._]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug)) { state = { ...state, dealershipDraft: { name, username, city, ownerName, address, tags: (fd.get("dealerTags") || "").toString() }, dealershipError: "نام کاربری باید به شناسه‌ای با حداقل ۳ حرف انگلیسی، عدد یا خط تیره تبدیل شود." }; render(); return; }
        const submit = form.querySelector('[type="submit"]'); if (submit) submit.disabled = true;
        (async () => {
          async function uploadDraft(dataUrl) {
            if (!dataUrl || !String(dataUrl).startsWith('data:image/')) return null;
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], 'showroom-image', { type: blob.type || 'image/jpeg' });
            const result = await window.CARMA_API.uploads.image(file);
            if (!result?.image?.id) throw new Error('آپلود تصویر نمایشگاه تأیید نشد.');
            return result.image;
          }
          try {
            const logo = await uploadDraft(state.dealershipLogoDraft);
            const banner = await uploadDraft(state.dealershipBannerDraft);
            const payload = { slug, name, city, ownerName, address, description, phonePublic: false };
            if (logo) payload.logoImageId = logo.id;
            else if (state.dealership?.logo_image_id) payload.logoImageId = state.dealership.logo_image_id;
            if (banner) payload.bannerImageId = banner.id;
            else if (state.dealership?.banner_image_id) payload.bannerImageId = state.dealership.banner_image_id;
            if (window.MR_PROFILE) payload.tags = window.MR_PROFILE.parseTags((fd.get("dealerTags") || "").toString());
            const result = state.dealership?.id ? await window.CARMA_API.showrooms.update(payload) : await window.CARMA_API.showrooms.create(payload);
            const sr = result?.showroom;
            if (!sr?.id) throw new Error('پاسخ سرور برای ذخیرهٔ نمایشگاه معتبر نیست.');
            state = { ...state, dealership: { id: sr.id, slug: sr.slug || slug, name: sr.name || name, city: sr.city || city, address: sr.address || address, description: sr.description || description, ownerName, tags: Array.isArray(sr.tags) ? sr.tags : (payload.tags || []), status: sr.status || 'pending', verified: sr.status === 'approved', logo: logo?.public_url || sr.logo_url || state.dealership?.logo || '', banner: banner?.public_url || sr.banner_url || state.dealership?.banner || '', logo_image_id: sr.logo_image_id || logo?.id || null, banner_image_id: sr.banner_image_id || banner?.id || null, slugChangesLeft: Math.max(0, 2 - Number(sr.slug_changes || 0)) }, dealershipError: null, dealershipDraft: null, dealershipLogoDraft: null, dealershipBannerDraft: null };
            window.CARMA_SESSION?.upsertShowroom?.({ ...sr, logo_url: state.dealership.logo, banner_url: state.dealership.banner }); // approved → listed, pending → not listed
            navigateTo({ page: "account" });
            showToast(state.dealership.status === 'approved' ? "اطلاعات نمایشگاه ذخیره شد." : "نمایشگاه در سرور ثبت شد و پس از تأیید مدیریت فعال می‌شود.");
          } catch (err) {
            state = { ...state, dealershipDraft: { name, username, city, ownerName, address, tags: (fd.get("dealerTags") || "").toString() }, dealershipError: err.message || "ذخیرهٔ نمایشگاه انجام نشد." };
            render();
          } finally { if (submit && submit.isConnected) submit.disabled = false; }
        })();
        return;
      }
      if (window.MR_PROFILE) {
        const unameErr = window.MR_PROFILE.setUsername(sellerIdForPhone(state.account), username, "dealer");
        if (unameErr) { state = { ...state, dealershipDraft: { name, username, ownerName, address, nid: nidIn, tags: (fd.get("dealerTags") || "").toString() }, dealershipError: unameErr }; render(); return; }
      }
      const creating = !state.dealership;
      const nid = nidIn || (prev ? prev.nid : "");
      const changed = !prev || prev.name !== name || prev.owner !== ownerName || prev.address !== address || prev.nid !== nid;
      // Legacy dealerships (no record) are approved; any change to the
      // verified details sends the dealership back to review.
      const status = changed ? "pending" : (prev ? prev.status : "pending");
      MR_STORE.saveDealer(state.account, { name, owner: ownerName, address, nid, city, status, why: changed ? "" : (prev ? prev.why || "" : ""), at: Date.now() });
      const dealership = { name, city, description };
      saveDealership(state.account, dealership);
      if (creating && typeof window.showroomMarkJoined === "function") window.showroomMarkJoined(sellerIdForPhone(state.account));
      if (window.MR_PROFILE) window.MR_PROFILE.setDealerTags(sellerIdForPhone(state.account), (fd.get("dealerTags") || "").toString());
      if (state.dealershipLogoDraft) mrSetAvatar("d", sellerIdForPhone(state.account), state.dealershipLogoDraft);
      if (state.dealershipBannerDraft) mrSetAvatar("db", sellerIdForPhone(state.account), state.dealershipBannerDraft);
      state = { ...state, dealership: loadDealership(state.account), dealershipError: null, dealershipDraft: null, dealershipLogoDraft: null, dealershipBannerDraft: null };
      syncDealerNameToListings();
      navigateTo({ page: "account" });
      showToast(creating ? "نمایشگاه ثبت شد و پس از تأیید مدیریت فعال می‌شود." : (changed ? "تغییرات ثبت شد و برای تأیید مدیریت ارسال شد." : "اطلاعات نمایشگاه ذخیره شد."));
    } else if (action === "submitGetStarted") {
      e.preventDefault();
      state = { ...state, modal: null };
      updateOverlays();
      showToast("متشکریم! کارشناس ما به‌زودی با شما تماس می‌گیرد.");
    } else if (action === "saveAccountInfo") {
      e.preventDefault();
      const fd = new FormData(form);
      const firstName = (fd.get("firstName") || "").toString().trim();
      const lastName = (fd.get("lastName") || "").toString().trim();
      const email = (fd.get("email") || "").toString().trim();
      if (window.CARMA_PROFILE_SETUP && window.CARMA_PROFILE_SETUP.onSubmit(form)) return; // PROFILE-SETUP: فیلدهای اجباری
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        state = { ...state, accountEditError: "لطفاً یک ایمیل معتبر وارد کنید." };
        render();
        return;
      }
      const nickname = (fd.get("nickname") || "").toString().trim().slice(0, 40);

      if (nickname.length < 2) {
        state = { ...state, accountEditError: "انتخاب نام نمایشی با حداقل ۲ حرف الزامی است." };
        render();
        return;
      }

      if (firstName.length < 2 || lastName.length < 2) {
        state = { ...state, accountEditError: "نام و نام خانوادگی هر دو الزامی هستند." };
        render();
        return;
      }

      const unameRaw = (fd.get("username") || "")
        .toString().trim().toLowerCase().replace(/^@/, "");

      if (!/^[a-z][a-z0-9_.]{2,19}$/.test(unameRaw)) {
        state = {
          ...state,
          accountEditError: "نام کاربری باید ۳ تا ۲۰ کاراکتر انگلیسی کوچک، عدد، نقطه یا زیرخط باشد و با حرف شروع شود."
        };
        render();
        return;
      }
      {
        const uInp = form.querySelector('input[name="username"]');
        const uInfo = window.MR_PROFILE ? window.MR_PROFILE.handleInfo("user") : { current: "", left: null };
        if (uInp && !uInp.readOnly && unameRaw && unameRaw !== uInfo.current) {
          if (uInfo.current && uInfo.left === 0) { state = { ...state, accountEditError: "سهمیهٔ تغییر نام کاربری (۲ بار) تمام شده است." }; render(); return; }
          if (["taken", "invalid"].includes(uInp.dataset.unameState)) { state = { ...state, accountEditError: uInp.dataset.unameState === "taken" ? "این نام کاربری قبلاً توسط شخص دیگری گرفته شده است." : "نام کاربری معتبر نیست." }; render(); return; }
        }
      }
      if (window.CARMA_API?.enabled && window.CARMA_AUTH_USER) {
        const displayName = [firstName, lastName].filter(Boolean).join(" ").trim();
        if (displayName.length < 2) { state = { ...state, accountEditError: "نام و نام خانوادگی را وارد کنید." }; render(); return; }
        const submit = form.querySelector('[type="submit"]'); if (submit) submit.disabled = true;
        (async () => {
          try {
            async function uploadProfileImage(value, existing) {
              if (!value) return null;
              if (value === existing) return existing || null;
              if (!String(value).startsWith("data:image/")) throw new Error("برای تصویر پروفایل، تصویر را دوباره از دستگاه انتخاب کنید.");
              const blob = await (await fetch(value)).blob();
              const file = new File([blob], "profile-image", { type: blob.type || "image/jpeg" });
              const uploaded = await window.CARMA_API.uploads.image(file);
              if (!uploaded?.image?.public_url) throw new Error("آپلود تصویر پروفایل تأیید نشد.");
              return uploaded.image.public_url;
            }
            const currentUser = window.CARMA_AUTH_USER || {};
            const avatarUrl = state.accountProfile?.avatar ? await uploadProfileImage(state.accountProfile.avatar, currentUser.avatarUrl) : (currentUser.avatarUrl || null);
            const bannerUrl = state.accountProfile?.banner ? await uploadProfileImage(state.accountProfile.banner, currentUser.bannerUrl) : (currentUser.bannerUrl || null);
            const result = await window.CARMA_API.account.updateProfile({ displayName, nickname: nickname || null, email: email || null, ...(unameRaw && unameRaw !== (currentUser.username || "") ? { username: unameRaw } : {}), avatarUrl, bannerUrl });
            if (!result?.user?.id) throw new Error("پاسخ سرور برای ذخیره پروفایل معتبر نیست.");
            window.CARMA_AUTH_USER = result.user;
          try { window.dispatchEvent(new CustomEvent("carmaa:session-reset")); } catch (_) {}
            navigateTo((window.CARMA_PROFILE_SETUP ? window.CARMA_PROFILE_SETUP.afterSaveRoute() : { page: "account" }), { accountProfile: { ...state.accountProfile, firstName, lastName, nickname: result.user.nickname || "", email, avatar: result.user.avatarUrl || null, banner: result.user.bannerUrl || null }, accountEditError: null });
            showToast("اطلاعات حساب در سرور ذخیره شد");
          } catch (err) {
            state = { ...state, accountEditError: err.message || "ذخیره اطلاعات حساب انجام نشد." }; render();
          } finally { if (submit && submit.isConnected) submit.disabled = false; }
        })();
      } else {
        if (window.MR_PROFILE && state.account) {
          const unameErr = window.MR_PROFILE.setUsername(window.MR_PROFILE.myId(), unameRaw);
          if (unameErr) { state = { ...state, accountEditError: unameErr }; render(); return; }
        }
        navigateTo({ page: "account" }, { accountProfile: { ...state.accountProfile, firstName, lastName, nickname, email }, accountEditError: null });
        showToast("اطلاعات حساب ذخیره شد");
      }
    } else if (action === "submitSell") {
      e.preventDefault();
      if (sellPublishingInProgress || sellSubmitInFlight) return;
      // Dealership accounts must reach the last (panel) step before publishing;
      // stops Enter-key implicit submits from skipping it.
      if (typeof sellHasPanelStep === "function" && sellHasPanelStep() && (state.sellStep || 1) < sellTotalSteps()) return;
      if (!state.account) {
        resetOtpVerifiedAnimation();
        state = { ...state, modal: { type: "login", reason: "برای استفاده از این خدمات، ابتدا وارد حساب کاربری خود شوید." }, loginStep: "phone", loginPhone: "", loginReturnTo: { page: "sell" } };
        updateOverlays();
        return;
      }
      if (MR_STORE.isBlocked(state.account)) {
        showToast("ثبت آگهی برای حساب شما محدود شده است. با پشتیبانی تماس بگیرید.");
        return;
      }
      const fd = new FormData(form);
      const brand = (fd.get("brand") || state.sellForm.brand || "").toString().trim();
      const year = (fd.get("year") || state.sellForm.year || "").toString().trim();
      const model = (fd.get("model") || state.sellForm.model || "").toString().trim();
      const negotiable = readSellToggle(form, fd, "negotiable");
      const tradeIn = readSellToggle(form, fd, "tradeIn");
      const rawPrice = negotiable ? "" : String(fd.get("price") || state.sellForm.price || "").replace(/[^0-9]/g, "");
      const priceNum = negotiable ? null : parseInt(rawPrice, 10);
      const mileageType = state.sellForm.mileageType || "used";
      const deliveryTime = mileageType === "presale" ? String(state.sellForm.deliveryTime || "") : "";
      const milesNum = mileageType === "used" ? parseInt(String(fd.get("miles") || state.sellForm.miles || "").replace(/[^0-9]/g, ""), 10) : 0;
      const cylinders = sellNeedsEngineSpecs(state.sellForm) ? String(state.sellForm.cylinders || "") : "";
      const engineVolume = sellNeedsEngineSpecs(state.sellForm) ? String(state.sellForm.engineVolume || "") : "";
      const sellVideo = state.sellForm.video && state.sellForm.video.poster ? state.sellForm.video : null;
      const milesLabel = sellMilesLabel({ mileageType }, milesNum);
      const city = (fd.get("city") || state.sellForm.city || "").toString().trim();
      // Never trust the submitted "phone" field — the ad's contact number
      // must always be the logged-in account's number.
      const phone = (state.account || state.sellForm.phone || "").toString().trim();
      const color = (fd.get("color") || state.sellForm.color || "#c9c8c3").toString();
      const trim = (fd.get("trim") || state.sellForm.trim || "full").toString();
      const engineType = String(state.sellForm.engineType || "").trim();
      const documentType = String(state.sellForm.documentType || "").trim();
      const powerOfAttorneyStatus = String(state.sellForm.powerOfAttorneyStatus || "").trim();
      const insuranceStatus = String(state.sellForm.insuranceStatus || "").trim();
      const description = (fd.get("description") || state.sellForm.description || "").toString().trim();
      const photos = Array.isArray(state.sellForm.photos) ? state.sellForm.photos : [];
      const damagedParts = Array.isArray(state.sellForm.damagedParts) ? state.sellForm.damagedParts : [];
      const bodyConditionRating = Number.isFinite(state.sellForm.bodyConditionRating) ? state.sellForm.bodyConditionRating : null;
      const acceptsOffers = readSellToggle(form, fd, "acceptsOffers");
      const minPriceRaw = String(fd.get("minPrice") || state.sellForm.minPrice || "").replace(/[^0-9]/g, "");
      const minPrice = acceptsOffers && minPriceRaw ? Number(minPriceRaw) : null;

      const adTitle = String(state.sellForm.adTitle || "").trim().slice(0, 70);
      const sellForm = { adTitle, brand, year, model, engineType, fuelType: state.sellForm.fuelType || "", transmission: state.sellForm.transmission || "", interiorColor: state.sellForm.interiorColor || "", driveTrain: state.sellForm.driveTrain || "", cylinders, engineVolume, mileageType, deliveryTime, video: sellVideo, documentType, powerOfAttorneyStatus, insuranceStatus, price: rawPrice || "", miles: String(fd.get("miles") || state.sellForm.miles || "").replace(/[^0-9]/g, ""), color, trim, city, phone, description, photos, damagedParts, bodyConditionRating, negotiable, tradeIn, acceptsOffers, minPrice: minPriceRaw };

      if (mileageType === "presale" && !deliveryTime) {
        state = { ...state, sellForm, sellStep: 3, sellError: "لطفاً زمان تحویل را انتخاب کنید." };
        render();
        window.scrollTo(0, 0);
        return;
      }
      if (city && !state.sellForm.locConfirmed) {
        state = { ...state, sellForm: { ...state.sellForm }, sellStep: 5, sellError: "لطفاً موقعیت خودرو را روی نقشه با دکمه‌ی «تایید موقعیت» تایید کنید." };
        render();
        window.scrollTo(0, 0);
        return;
      }
      if (!brand || !year || !model || (!negotiable && !Number.isFinite(priceNum)) || !Number.isFinite(milesNum) || !city || !phone || !description) {
        state = { ...state, sellForm, sellStep: !description ? 1 : 5, sellError: !description ? "لطفاً توضیحات آگهی را وارد کنید؛ این بخش الزامی است." : "لطفاً اطلاعات الزامی مراحل قبلی را تکمیل کنید." };
        render();
        window.scrollTo(0, 0);
        return;
      }

      if (state.editingListingId) {
        const editId = state.editingListingId;
        const editEntry = state.myListings.find((m) => m.id === editId);
        // Editing only ever reaches this point for an already-published
        // listing (see the "editListing" action), so keep its original
        // createdAt — editing shouldn't bump it to the top of "newest".
        const originalCreatedAt = editEntry ? editEntry.listing.createdAt : Date.now();
        const updatedListing = {
          id: editId, brand,
          title: `${year} ${brand} ${fullSellModelName(brand, model)}`,
          adTitle,
          price: negotiable ? "توافقی" : priceNum.toLocaleString("fa-IR") + " تومان",
          priceAmount: negotiable ? null : priceNum,
          negotiable,
          miles: milesLabel,
          phone, color, trim,
          engineType,

          fuelType: state.sellForm.fuelType || "",
          transmission: state.sellForm.transmission || "",
          interiorColor: state.sellForm.interiorColor || "",
          driveTrain: state.sellForm.driveTrain || "",
          cylinders, engineVolume, mileageType, deliveryTime, video: sellVideo,
          documentType,
          powerOfAttorneyStatus,
          insuranceStatus,
          privateSeller: true,
          ...keptSellerFields(editEntry && editEntry.listing),
          city,
          region: state.sellForm.region || "",
          mapPos: state.sellForm.mapPos || { lat: DEFAULT_MAP_CENTER[0], lng: DEFAULT_MAP_CENTER[1] },
          description,
          photos,
          paintedParts: damagedParts,
          bodyConditionRating,
          tradeIn: sellForm.tradeIn,
          acceptsOffers,
          createdAt: originalCreatedAt,
        };

        let serverListingStatus = null;
        if (window.CARMA_MARKETPLACE?.saveListing) {
          sellSubmitInFlight = true; sellWait(true);
          try {
            const remote = await window.CARMA_MARKETPLACE.saveListing({ editId, draft: updatedListing, form: sellForm, minPrice, acceptsOffers });
            Object.assign(updatedListing, remote.card);
            serverListingStatus = remote.status;
          } catch (error) {
            state = { ...state, sellForm, sellError: error?.message || 'ذخیره آگهی در سرور انجام نشد.' };
            render();
            showToast(error?.message || 'ذخیره آگهی در سرور انجام نشد.');
            return;
          } finally { sellSubmitInFlight = false; sellWait(false); }
        }
        // Keep the live cards in sync after the server confirms the write.
        const previousListing = editEntry && editEntry.listing ? editEntry.listing : LISTINGS.find((l) => l.id === editId);
        if (!window.CARMA_API?.enabled && window.MARQUE_TRUST && typeof window.MARQUE_TRUST.recordPriceChange === "function") window.MARQUE_TRUST.recordPriceChange(previousListing, updatedListing);
        if (!window.CARMA_API?.enabled && window.MARQUE_TRUST && typeof window.MARQUE_TRUST.setSellerMinimumPrice === "function") window.MARQUE_TRUST.setSellerMinimumPrice(editId, minPrice, acceptsOffers);
        const listingsIdx = LISTINGS.findIndex((l) => l.id === editId);
        if (listingsIdx !== -1) LISTINGS[listingsIdx] = updatedListing;
        if (!window.CARMA_API?.enabled) mrPersistListing(updatedListing, "update");

        navigateTo(
          { page: "manageListings" },
          {
            sellForm: BLANK_SELL_FORM,
            sellStep: 1,
            sellDirection: "forward",
            sellError: null,
            editingListingId: null,
            myListings: state.myListings.map((m) => (m.id === editId ? { ...m, listing: updatedListing, status: serverListingStatus || ((m.status === "rejected" || m.status === "removed") ? "pending" : m.status), why: "" } : m)),
          }
        );
        showToast("تغییرات آگهی با موفقیت ذخیره شد.");
        return;
      }

      const submitButton = form.querySelector('[data-action="submitSell"]');
      if (submitButton) { submitButton.disabled = true; submitButton.setAttribute("aria-disabled", "true"); }
      sellSubmitInFlight = true;
      const releaseSubmit = () => { sellSubmitInFlight = false; };
      try {

      let id = "s" + Date.now();
      const createdAt = Date.now();
      const newListing = {
        id, brand,
        title: `${year} ${brand} ${fullSellModelName(brand, model)}`,
          adTitle,
        price: negotiable ? "توافقی" : priceNum.toLocaleString("fa-IR") + " تومان",
        priceAmount: negotiable ? null : priceNum,
        negotiable,
        miles: milesLabel,
        phone, color, trim,
        engineType,

        fuelType: state.sellForm.fuelType || "",
        transmission: state.sellForm.transmission || "",
        interiorColor: state.sellForm.interiorColor || "",
        driveTrain: state.sellForm.driveTrain || "",
        cylinders, engineVolume, mileageType, deliveryTime, video: sellVideo,
        documentType,
        powerOfAttorneyStatus,
        insuranceStatus,
        privateSeller: true,
        ...currentSellerFields(state.dealership ? (state.sellPanelLock === "dealer" ? "dealer" : (fd.get("publishAs") || state.lastPublishAs || "personal").toString()) : "personal"),
        city,
        region: state.sellForm.region || "",
        mapPos: state.sellForm.mapPos || { lat: DEFAULT_MAP_CENTER[0], lng: DEFAULT_MAP_CENTER[1] },
        description,
        photos,
        paintedParts: damagedParts,
        bodyConditionRating,
        tradeIn: sellForm.tradeIn,
        acceptsOffers,
        // Without this, the new listing has no createdAt while every
        // seeded listing does — under the default "newest" sort it was
        // treated as the oldest thing on the site and sank to the very
        // bottom instead of appearing as the top/newest card.
        createdAt,
      };

      let serverListingStatus = null;
      if (window.CARMA_MARKETPLACE?.saveListing) {
        // Same content => same key, so retrying after a timeout can never create a second ad.
        const fp = JSON.stringify([newListing.title, newListing.priceAmount, newListing.miles, newListing.city, newListing.description, photos.length, newListing.color, newListing.phone, newListing.sellerId || ""]);
        if (!sellSubmitKey || sellSubmitKey.fp !== fp) sellSubmitKey = { fp, key: "ad-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12) };
        sellWait(true);
        try {
          const remote = await window.CARMA_MARKETPLACE.saveListing({ editId: null, draft: newListing, form: sellForm, minPrice, acceptsOffers, idempotencyKey: sellSubmitKey.key });
          id = remote.card.id;
          Object.assign(newListing, remote.card);
          serverListingStatus = remote.status;
          sellSubmitKey = null; // saved: the next ad gets a new key
          sellWait(false);
        } catch (error) {
          sellWait(false);
          state = { ...state, sellForm, sellError: error?.message || 'ثبت آگهی در سرور انجام نشد.' };
          render();
          showToast(error?.message || 'ثبت آگهی در سرور انجام نشد.');
          if (submitButton) { submitButton.disabled = false; submitButton.removeAttribute("aria-disabled"); }
          return;
        }
      }

      const LISTING_REVIEW_MS = 2 * 1000;
      const myEntry = { id, listing: newListing, status: serverListingStatus || "pending", createdAt, readyAt: createdAt + LISTING_REVIEW_MS };
      listingStatsCache[id] = { views: 0, clicks: 0, likes: 0 };
      mrStatsTrack(id);
      if (!window.CARMA_API?.enabled) mrPersistListing(newListing, "submit", state.account);
      if (!window.CARMA_API?.enabled && window.MARQUE_TRUST && typeof window.MARQUE_TRUST.setSellerMinimumPrice === "function") window.MARQUE_TRUST.setSellerMinimumPrice(id, minPrice, acceptsOffers);

      // Keep the listing in state immediately, but delay navigation until
      // the publishing sheet completes its 5-second visual confirmation.
      // This prevents the form from disappearing instantly and gives the
      // user a clear, deterministic submission state.
      const __fasFirst = !state.myListings.some((m) => m && m.listing && (m.listing.sellerType || "personal") === (newListing.sellerType || "personal"));
      sellPublishingDraft = { ...sellForm, photos: [...photos], damagedParts: [...damagedParts] };
      sellPublishingId = id;
      state = {
        ...state,
        sellForm: BLANK_SELL_FORM,
        sellStep: 1,
        sellPanelLock: null,
        sellDirection: "forward",
        sellError: null,
        editingListingId: null,
        myListings: [...state.myListings, myEntry],
      };

      const sheetOpened = openSellPublishingSheet(() => {
        navigateTo(
          { page: "account" },
          {
            sellForm: BLANK_SELL_FORM,
            sellStep: 1,
            sellPanelLock: null,
            sellDirection: "forward",
            sellError: null,
            editingListingId: null,
            myListings: [...state.myListings],
          }
        );
        showToast("آگهی شما ثبت شد و در حال بررسی است.");
        try { window.CARMA_FIRST_AD_STORY && window.CARMA_FIRST_AD_STORY.offer(newListing, __fasFirst); } catch (_) {}
      });
      if (!sheetOpened) {
        navigateTo(
          { page: "account" },
          {
            sellForm: BLANK_SELL_FORM,
            sellStep: 1,
            sellPanelLock: null,
            sellDirection: "forward",
            sellError: null,
            editingListingId: null,
            myListings: [...state.myListings],
          }
        );
        showToast("آگهی شما ثبت شد و در حال بررسی است.");
        try { window.CARMA_FIRST_AD_STORY && window.CARMA_FIRST_AD_STORY.offer(newListing, __fasFirst); } catch (_) {}
      }
      // With manual review on (default) the ad waits for the admin panel.
      if (!window.CARMA_API?.enabled && !MR_STORE.settings().manual) {
        setTimeout(() => {
          MR_STORE.edit((d) => { if (d.entries[id]) d.entries[id].status = "listed"; });
          try { const en = MR_STORE.read().entries[id]; if (en && en.owner) MR_NOTIFS.push(en.owner, { type: "listing", icon: "ok", title: "آگهی شما تأیید شد", body: "«" + ((en.listing && en.listing.title) || "آگهی") + "» منتشر شد.", route: { page: "manageListings" }, data: { listingId: id } }); } catch (_) {}
          promoteListing(id);
        }, LISTING_REVIEW_MS);
      }
      } finally { releaseSubmit(); }
    }
  });

  // FIX (bug): this used to call the full render() every second whenever
  // any listing was pending — which tore down and rebuilt the ENTIRE page
  // (destroying/recreating Leaflet maps, replaying the card-fade-in entry
  // animation on every card, resetting scroll) just to tick a mm:ss label.
  // It also fired on the account page specifically, whose "listings" tab
  // (renderAccountPinCard) doesn't even show a countdown — so the whole
  // page was visibly "jumping" once a second for zero visual benefit.
  // Now we only touch the countdown text nodes themselves, wherever they
  // currently exist in the DOM (see data-pending-countdown in
  // renderMyListingCard), leaving the rest of the page untouched.
  function updatePendingCountdowns() {
    document.querySelectorAll("[data-pending-countdown]").forEach((el) => {
      const id = el.getAttribute("data-pending-countdown");
      const entry = state.myListings.find((m) => m.id === id);
      if (!entry) return;
      const remaining = Math.max(0, entry.readyAt - Date.now());
      const mm = Math.floor(remaining / 60000);
      const ss = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");
      el.textContent = `${mm}:${ss}`;
    });
  }
  setInterval(() => {
    if (state.myListings.some((m) => m.status === "pending")) {
      updatePendingCountdowns();
    }
  }, 1000);

  // Final sell step: remember which panel (personal / dealership) was picked.
  document.addEventListener("change", (e) => {
    if (e.target && e.target.name === "publishAs") state = { ...state, lastPublishAs: e.target.value === "dealer" ? "dealer" : "personal" };
  });

// Filter-chip dropdown (سال ساخت، مدل، شهر …): a tap anywhere outside the
// open dropdown and its chips closes the dropdown FIRST and is swallowed, so
// it doesn't also trigger whatever was underneath (card, button, link).
window.addEventListener("click", function (e) {
  if (!state.chipDropdownKey) return;
  const t = e.target;
  if (!(t instanceof Element)) return;
  if (t.closest(".toolbox-chip-dropdown") || t.closest('[data-action="openToolFilter"]')) return;
  e.stopPropagation();
  e.preventDefault();
  state = { ...state, chipDropdownKey: null };
  refreshLiveToolbar();
}, true);
