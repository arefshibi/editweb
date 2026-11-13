"use strict";

/* ---------------------------------------------------------------
   APP ROOT / RENDER / ROUTER (top part) — repositions sticky chrome, updates overlays, and the main render() function that swaps page content based on the current route.
// Edit the main render()/routing logic here.
--------------------------------------------------------------- */

  /* ---------------------------------------------------------------
     APP ROOT / RENDER / ROUTER
  --------------------------------------------------------------- */

  // FIX (structural): header, breadcrumb/title, and the sort/filter toolbar
  // used to be three independently `position:sticky` elements stacked with
  // JS-computed `top` offsets. On mobile that setup can visibly desync
  // during a scroll/fling (each sticky element can update on a slightly
  // different compositor frame), briefly exposing the grid content
  // scrolling underneath in the seam between them. Now there is exactly one
  // sticky element — #stickyHeaderGroup, "position:sticky; top:0" in
  // styles.css — and this function's only job is to relocate each page's
  // breadcrumb/title block (.page-header-sticky) and toolbar
  // (.toolbar-sticky) out of the page content and into the two persistent
  // slots inside that single sticky group, so they render as ordinary flow
  // children of one atomic compositor layer instead of separate sticky
  // contexts. No height math or offset variables are needed any more.
  function relocateStickyPageChrome(page) {
    const pageHeaderSlot = document.getElementById("pageHeaderSlot");
    const toolbarSlot = document.getElementById("toolbarSlot");
    const pageHeaderNode = page ? page.querySelector(".page-header-sticky") : null;
    const toolbarNode = page ? page.querySelector(".toolbar-sticky") : null;
    if (pageHeaderNode) pageHeaderNode.remove();
    if (toolbarNode) toolbarNode.remove();
    if (pageHeaderSlot) pageHeaderSlot.replaceChildren(...(pageHeaderNode ? [pageHeaderNode] : []));
    if (toolbarSlot) toolbarSlot.replaceChildren(...(toolbarNode ? [toolbarNode] : []));
  }

  // Updates every persistent overlay (header, burger drawer, modal, toast,
  // bottom dock) without touching #pageContent. Anything that only changes
  // modal/menu/toast state — not the route, filters, or listing data — can
  // call this instead of the full render() below and leave the current
  // page's cards completely untouched.
  function updateOverlays() {
    updateHeader();
    updateMenuDrawer();
    updateModalUI();
    updateToastUI();
    updateBottomDock();
    updateSearchOverlay();
    updatePhotoViewer();
  }

  function cleanupStaleListingsRefresh() {
    const pageContent = document.getElementById("pageContent");
    const listingsRoot = pageContent ? pageContent.querySelector('[data-page="listings"]') : null;
    if (listingsRoot && listingsRoot._listingsTopRefreshCleanup) {
      try { listingsRoot._listingsTopRefreshCleanup(); } catch (_) {}
    }
  }

  function render() {
    purgeExpiredListings();
    cleanupStaleListingsRefresh();
    // Private routes must never render without an authenticated account,
    // including when opened directly or restored from browser history.
    // The account landing page is intentionally public so signed-out users can reach its login / sign-up CTA. Only data-bearing account subpages stay protected.
    const privateRoutes = new Set(["accountEdit", "dealershipEdit", "saved", "manageListings", "messages", "conversation", "qaMine"]);
    if (!state.account && privateRoutes.has(state.route && state.route.page)) {
      // Do not silently bounce protected pages to Home: that made the Saved
      // and Sell actions appear broken when the API session had expired or
      // the visitor was signed out. Preserve the intended destination and ask
      // the visitor to sign in; successful auth returns them to that page.
      const requestedPrivateRoute = state.route;
      state = {
        ...state,
        route: { page: "home" },
        myListings: [],
        dealership: null,
        accountProfile: { firstName: "", lastName: "", email: "", avatar: null },
        editingListingId: null,
        modal: { type: "login", reason: "برای ادامه، ابتدا وارد حساب کاربری شوید." },
        modalClosing: false,
        loginStep: "phone",
        loginPhone: "",
        loginReturnTo: requestedPrivateRoute,
      };
      try { window.history.replaceState({ ...(window.history.state || {}), marqueRoute: { page: "home" } }, "", /^https?:$/.test(window.location.protocol) ? "/" : window.location.pathname + window.location.search); } catch (_) {}
    }
    // /account/<username> of another user → their public page (looked up through the API, then cached).
    if (window.CARMA_PROFILE_SETUP) window.CARMA_PROFILE_SETUP.gate(); // PROFILE-SETUP: پروفایل ناقص → صفحهٔ ویرایش اطلاعات
    if (typeof resolveAccountHandleRoute === "function") resolveAccountHandleRoute();
    const pageContent = document.getElementById("pageContent");
    const skeletonLoading = state.loading && state.loadingStage === "skeleton";

    document.documentElement.classList.toggle("theme-light", state.theme === "light");
    syncThemeColorMeta(state.theme);

    let page = null;
    if (skeletonLoading) {
      page = renderSkeletonScreen(state.pendingRoute ? state.pendingRoute.page : "home");
    } else if (state.route.page === "home" && typeof renderHomeScreen === "function") page = renderHomeScreen();
    else if (state.route.page === "brand") page = renderBrandModelsScreen(state.route.brand);
    else if (state.route.page === "listings") page = renderListingsScreen(state.route.brand);
    else if (state.route.page === "vehicle") page = renderVehicleScreen(state.route.listing);
    else if (state.route.page === "dealers") page = renderDealersScreen();
    else if (state.route.page === "seller") page = renderSellerScreen(state.route.sellerId, state.route.kind);
    else if (state.route.page === "dealerPublic") { const dealerId = window.MARQUE_TRUST && window.MARQUE_TRUST.resolveDealerSlug ? window.MARQUE_TRUST.resolveDealerSlug(state.route.slug) : null; page = renderSellerScreen(dealerId || "__missing_dealer_slug__"); }
    else if (state.route.page === "sell") page = renderSellScreen();
    else if (state.route.page === "account" && state.route.handle && typeof window.isOwnAccountHandle === "function" && !window.isOwnAccountHandle(state.route.handle)) page = (typeof renderSkeletonScreen === "function" ? renderSkeletonScreen("seller") : null); // still looking the user up
    else if (state.route.page === "account") page = renderAccountScreen();
    else if (state.route.page === "accountEdit") page = renderAccountEditScreen();
    else if (state.route.page === "dealershipEdit") page = renderDealershipEditScreen();
    else if (state.route.page === "saved") page = renderSavedScreen();
    else if (state.route.page === "manageListings") page = renderManageListingsScreen();
    else if (state.route.page === "messages") page = renderMessagesScreen();
    else if (state.route.page === "feed" && typeof renderSocialFeedScreen === "function") page = renderSocialFeedScreen();
    else if (state.route.page === "conversation") page = renderConversationScreen();
    else if (state.route.page === "news" && typeof renderNewsScreen === "function") page = renderNewsScreen();
    else if (state.route.page === "newsItem" && typeof renderNewsItemScreen === "function") page = renderNewsItemScreen(state.route.newsId);
    else if (state.route.page === "qa" && typeof renderQaListScreen === "function") page = renderQaListScreen();
    else if (state.route.page === "qaAsk" && typeof renderQaAskScreen === "function") page = renderQaAskScreen();
    else if (state.route.page === "qaQuestion" && typeof renderQaQuestionScreen === "function") page = renderQaQuestionScreen(state.route.questionId);
    else if (state.route.page === "qaMine" && typeof renderQaMineScreen === "function") page = renderQaMineScreen();

    // FIX (bug): same chip-row scroll reset as refreshLiveToolbar() above,
    // but for the full-render path — picking a value from a chip dropdown
    // (setChipFilterValue/setFilterValue) does need a full render since it
    // can change which listings show, and that rebuilds the toolbar too.
    // Preserve the chip row's scroll position across that rebuild as well.
    const prevChipsEl = document.querySelector('#toolbarSlot [data-slot="filter-chips"]');
    const prevChipsScrollLeft = prevChipsEl ? prevChipsEl.scrollLeft : null;

    relocateStickyPageChrome(page);
    if (pageContent) {
      destroyActiveLeafletMaps();
      pageContent.replaceChildren();
      if (page) {
        pageContent.appendChild(page);
        // Add a consistent back control to secondary pages that do not already
        // provide one. Keep it inside the page so it follows the app layout.
        // The account page already has a dedicated back button in the shared
        // app header. Do not inject a second in-flow back control above its profile.
        if (false /* universal arrow back button removed */ && state.route && state.route.page !== "home" && state.route.page !== "account" && !page.querySelector(
          '.cm-universal-back, [data-action="back"], [data-back], .back-button, .btn-back, .page-back, button[aria-label*="بازگشت"], button[title*="بازگشت"]'
        )) {
          const hasTextBack = Array.from(page.querySelectorAll('button, a, [role="button"]')).some((el) => /بازگشت|برگشت|صفحه قبل/.test((el.innerText || el.getAttribute('aria-label') || '').trim()));
          if (!hasTextBack) {
            const back = document.createElement('button');
            back.type = 'button';
            back.className = 'cm-universal-back';
            back.setAttribute('aria-label', 'بازگشت به صفحه قبل');
            back.innerHTML = '<span class="cm-universal-back__arrow" aria-hidden="true">←</span><span>بازگشت</span>';
            back.addEventListener('click', () => {
              const current = window.history.state;
              if (window.history.length > 1 && current && current.marqueRoute) window.history.back();
              else window.location.href = window.location.pathname + window.location.search;
            });
            const backHeader = page.querySelector('.page-header-sticky, .explore-header, .cm-showroom-page-header, [data-page-header], .page-header, header');
            if (backHeader) {
              backHeader.style.position = backHeader.style.position || 'relative';
              backHeader.appendChild(back);
              back.classList.add('cm-back-in-header');
            } else {
              page.insertBefore(back, page.firstChild);
            }
          }
        }
        const pageHeaderForBack = page.querySelector('.page-header-sticky, .explore-header, .cm-showroom-page-header, [data-page-header], .page-header, header');
        if (pageHeaderForBack) {
          page.querySelectorAll('[data-action="back"], [data-back], .back-button, .btn-back, .page-back, button[aria-label*="بازگشت"], button[title*="بازگشت"], .qa-back').forEach((backControl) => {
            if (!pageHeaderForBack.contains(backControl) && !backControl.closest('[role="dialog"], .modal, .sheet')) {
              backControl.classList.add('cm-back-in-header');
              pageHeaderForBack.appendChild(backControl);
            }
          });
        }
      }
    }

    if (prevChipsScrollLeft !== null) {
      const nextChipsEl = document.querySelector('#toolbarSlot [data-slot="filter-chips"]');
      if (nextChipsEl) nextChipsEl.scrollLeft = prevChipsScrollLeft;
    }

    syncListStyleFab(false); // layout switch removed — compact cards only
    updateOverlays();
    positionChipDropdown();
    if (typeof window.syncCanonicalUrl === "function") window.syncCanonicalUrl();
    if (typeof window.afterMarqueRender === "function") window.afterMarqueRender();
  }

