"use strict";

/* ---------------------------------------------------------------
   SMALL RENDER PIECES — header, hamburger menu drawer, and the reusable skeleton-loading placeholders.
// Edit the site header or the menu drawer here.
--------------------------------------------------------------- */

  /* ---------------------------------------------------------------
     SMALL RENDER PIECES
  --------------------------------------------------------------- */

  // REDESIGN: the old per-scroll header-tint-matching system (recomputing
  // a flat background-color to match .home-demo-phone's gradient at the
  // header's seam) is gone — #siteHeader.home-page-active is now a real
  // frosted-glass panel (backdrop-filter blur, see styles.css), which
  // shows a correct blended tint of whatever's behind it automatically,
  // at every scroll position, with no JS involved.

  function updateHeader() {
    const header = document.getElementById("siteHeader");
    const page = (state.loading && state.pendingRoute) ? state.pendingRoute.page : state.route.page;
    const homeNavPages = new Set(["vehicle", "account", "accountEdit", "dealershipEdit", "sell", "saved", "messages", "conversation", "feed", "qa", "qaAsk", "qaQuestion", "qaMine", "seller", "news", "newsItem"]);
    const internalSearchPages = new Set(["brand", "listings", "dealers", "manageListings"]);
    const nonHome = page !== "home";
    const homeNavActive = homeNavPages.has(page);
    if (header) {
      header.classList.toggle("non-home-active", nonHome);
      header.classList.toggle("home-nav-active", homeNavActive);
      header.classList.toggle("home-page-active", page === "home");
      header.classList.toggle("account-header-active", page === "account" || page === "seller" || page === "vehicle");
      // Listings, sell and showroom-directory pages use a dedicated header;
      // account and individual showroom profiles reuse the shared home-style row.
      header.classList.toggle("listings-header-hidden", page === "listings" || page === "sell" || page === "dealers" || page === "news" || page === "feed");
      const internalRow = header.querySelector(".non-home-header-row");
      if (internalRow) internalRow.classList.toggle("internal-search-hidden", !internalSearchPages.has(page));
    }
    // Account + public showroom profile use the same simplified chrome:
    // back on the former left control, notifications in the former logo
    // position, and no search/profile shortcuts on the opposite side.
    const homeRow = header && header.querySelector(".header-home-row");
    const sideGroup = homeRow && homeRow.querySelector(":scope > div:first-child");
    const sideControl = sideGroup && sideGroup.querySelector("button");
    const centerControl = homeRow && homeRow.querySelector(".brand-mark");
    const rightGroup = homeRow && homeRow.querySelector(":scope > div:last-child");
    const rightControl = rightGroup && rightGroup.querySelector("button");
    const accountHeaderMode = page === "account" || page === "seller" || page === "vehicle";
    const bellMarkup = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg><span class="mr-bell-badge" hidden></span>';
    const backMarkup = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>';
    if (sideControl && centerControl && rightControl) {
      // Preserve each entrypoint's original header markup so the normal home
      // and internal routes are restored exactly when leaving these pages.
      if (sideControl.dataset.originalHeaderMarkup === undefined) {
        sideControl.dataset.originalHeaderMarkup = sideControl.innerHTML;
        sideControl.dataset.originalHeaderAction = sideControl.dataset.action || "";
        sideControl.dataset.originalHeaderLabel = sideControl.getAttribute("aria-label") || "";
        sideControl.dataset.originalBellClass = sideControl.classList.contains("mr-bell-btn") ? "1" : "0";
      }
      if (centerControl.dataset.originalHeaderMarkup === undefined) {
        centerControl.dataset.originalHeaderMarkup = centerControl.innerHTML;
        centerControl.dataset.originalHeaderAction = centerControl.dataset.action || "";
        centerControl.dataset.originalHeaderLabel = centerControl.getAttribute("aria-label") || "";
      }
      if (rightControl.dataset.originalHeaderMarkup === undefined) {
        rightControl.dataset.originalHeaderMarkup = rightControl.innerHTML;
        rightControl.dataset.originalHeaderAction = rightControl.dataset.action || "";
        rightControl.dataset.originalHeaderLabel = rightControl.getAttribute("aria-label") || "";
      }
      if (accountHeaderMode) {
        // Keep the brand logo centered. Notifications stay on the left;
        // the back button occupies the right side and the extra shortcut is hidden.
        sideControl.dataset.action = "openNotifications";
        sideControl.setAttribute("aria-label", "اعلان‌ها");
        sideControl.classList.add("mr-bell-btn");
        sideControl.innerHTML = bellMarkup;
        centerControl.dataset.action = "goHome";
        centerControl.removeAttribute("aria-label");
        centerControl.classList.remove("mr-bell-btn", "header-center-notifications");
        centerControl.innerHTML = centerControl.dataset.originalHeaderMarkup;
        rightControl.dataset.action = "vehicleBack";
        rightControl.setAttribute("aria-label", "بازگشت");
        rightControl.innerHTML = backMarkup;
        const extraRight = rightGroup.querySelectorAll("button");
        if (extraRight[1]) extraRight[1].hidden = true;
      } else {
        sideControl.dataset.action = sideControl.dataset.originalHeaderAction;
        if (sideControl.dataset.originalHeaderLabel) sideControl.setAttribute("aria-label", sideControl.dataset.originalHeaderLabel);
        else sideControl.removeAttribute("aria-label");
        sideControl.innerHTML = sideControl.dataset.originalHeaderMarkup;
        sideControl.classList.toggle("mr-bell-btn", sideControl.dataset.originalBellClass === "1");
        centerControl.dataset.action = centerControl.dataset.originalHeaderAction;
        if (centerControl.dataset.originalHeaderLabel) centerControl.setAttribute("aria-label", centerControl.dataset.originalHeaderLabel);
        else centerControl.removeAttribute("aria-label");
        centerControl.innerHTML = centerControl.dataset.originalHeaderMarkup;
        centerControl.classList.remove("mr-bell-btn", "header-center-notifications");
        rightControl.dataset.action = rightControl.dataset.originalHeaderAction;
        if (rightControl.dataset.originalHeaderLabel) rightControl.setAttribute("aria-label", rightControl.dataset.originalHeaderLabel);
        else rightControl.removeAttribute("aria-label");
        rightControl.innerHTML = rightControl.dataset.originalHeaderMarkup;
        rightControl.hidden = false;
        const extraRight = rightGroup.querySelectorAll("button");
        if (extraRight[1]) extraRight[1].hidden = false;
      }
    }
    const input = document.getElementById("toolSearchInput");
    if (input && input.value !== (state.search || "")) input.value = state.search || "";
    const clear = document.querySelector('.header-search-clear');
    if (clear) clear.hidden = !(state.search || "").trim();
    // Same has-value pattern as the search overlay itself: once there's
    // real typed text to show, the rotating placeholder copy steps aside.
    const hasBarValue = !!(state.search || "").trim();
    const homeBar = document.querySelector(".home-search-input");
    if (homeBar) homeBar.classList.toggle("has-value", hasBarValue);
    const toolBar = document.querySelector(".header-search-box");
    if (toolBar) toolBar.classList.toggle("has-value", hasBarValue);

    // FIX: the header's account icon (top bar, home page) always showed
    // the generic person-outline SVG, even once the user was logged in —
    // per request it should show their profile photo instead. Falls back
    // to their initial in a filled circle if they're logged in but
    // haven't set a photo, and back to the original outline icon once
    // logged out. Only touches the DOM when the icon actually needs to
    // change (or the avatar URL/initial itself changed), not on every
    // render.
    const accountBtn = document.getElementById("headerAccountBtn");
    if (accountBtn) {
      const logged = !!state.account;
      const profile = state.accountProfile || {};
      const avatar = profile.avatar;
      const desired = avatar ? "avatar" : ((logged && (profile.firstName || "").trim()) ? "initial" : "icon");
      if (accountBtn.dataset.iconState !== desired) {
        accountBtn.dataset.iconState = desired;
        if (desired === "avatar") {
          accountBtn.innerHTML = `<img src="${avatar}" alt="پروفایل" class="header-account-avatar"/>`;
        } else if (desired === "initial") {
          const initial = ((profile.firstName || state.account || "G").trim()[0] || "G").toUpperCase();
          accountBtn.innerHTML = `<span class="header-account-initial">${initial}</span>`;
        } else {
          accountBtn.innerHTML = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
        }
      } else if (desired === "avatar") {
        const img = accountBtn.querySelector("img");
        if (img && img.getAttribute("src") !== avatar) img.setAttribute("src", avatar);
      } else if (desired === "initial") {
        const initial = ((profile.firstName || state.account || "G").trim()[0] || "G").toUpperCase();
        const span = accountBtn.querySelector(".header-account-initial");
        if (span && span.textContent !== initial) span.textContent = initial;
      }
    }
  }

  function menuPromoCard(title, desc, cta, action) {
    const card=mountTemplate("tpl-menu-promo");
    card.querySelector('[data-slot="title"]').textContent=title;card.querySelector('[data-slot="desc"]').textContent=desc;card.querySelector('[data-slot="cta"]').textContent=cta;setDynamicHTML(card.querySelector('[data-slot="arrow"]'),icon("arrow-right",{width:"15",height:"15",strokeWidth:"2",class:"flip-x"}));card.querySelector('[data-action="promo"]').dataset.action=action;return card;
  }

  // Which route pages count as "active" for each of the 4 top-level menu
  // links, so the currently-open section can be highlighted (filled icon
  // circle + brighter label) in the fullscreen menu.
  const MENU_ACTIVE_PAGES = {
    goHome: ["home"],
    openSocialFeed: ["feed"],
    goListings: ["listings", "brand", "dealers"],
    openAccount: ["account", "accountEdit", "dealershipEdit", "saved", "manageListings"],
    goSell: ["sell"],
    openQa: ["qa", "qaAsk", "qaQuestion", "qaMine"],
  };

  function renderMenuScrollContent() {
    const wrap=document.createDocumentFragment();
    const page=(state.loading && state.pendingRoute) ? state.pendingRoute.page : state.route.page;
    MENU_NAV_ITEMS.forEach(({label,icon:iconName,action})=>{
      const item=mountTemplate("tpl-menu-item");
      item.dataset.action=action;
      item.dataset.label=label;
      if(action==="goListings")item.setAttribute("data-brand","all");
      item.classList.toggle("is-active", (MENU_ACTIVE_PAGES[action]||[]).includes(page));
      item.querySelector('[data-slot="label"]').textContent=label;
      setDynamicHTML(item.querySelector('[data-slot="icon"]'),icon(iconName,{width:"20",height:"20",strokeWidth:2}));
      wrap.appendChild(item);
    });
    return wrap;
  }

  function updateMenuDrawer() {
    const open = state.menuOpen;
    const overlayInner = document.getElementById("menuOverlayInner");
    if (!overlayInner) return;

    // FIX: opening the menu drawer previously left the page scrollable
    // underneath it — the user could drag/scroll the background content
    // while the drawer overlay sat on top. Locking scroll here follows the
    // exact same pattern already used for the auth/login flow (see
    // "html.auth-active" in styles.css): toggle a class on <html> and let
    // CSS apply `overflow: hidden !important` to both <html> and <body>
    // while the drawer is open, restoring normal scroll the instant it
    // closes.
    document.documentElement.classList.toggle("menu-active", open);
    overlayInner.classList.toggle("pointer-events-none", !open);

    const menuScroll = document.getElementById("menuScrollWrap");
    const wasOpen = overlayInner.classList.contains("is-open");

    if (open && !wasOpen) {
      // FIX: the veil-wipe + staggered-link entrance weren't animating at
      // all on open. Adding the "is-open" class AND mounting the (brand
      // new) link buttons in the same synchronous tick meant the browser
      // never got to paint their closed/off-screen resting state first —
      // a freshly inserted node that already matches ".is-open .menu-link"
      // the instant it's attached just renders at its final opacity/
      // transform with nothing to transition from. Fix: mount the links
      // first while still closed, force a layout flush so that state
      // actually gets painted, then flip "is-open" on the next frame so
      // there is a real before/after the browser can interpolate between.
      if (menuScroll) menuScroll.replaceChildren(renderMenuScrollContent());
      void overlayInner.offsetHeight; // force reflow — commits the closed state
      requestAnimationFrame(() => {
        requestAnimationFrame(() => overlayInner.classList.add("is-open"));
      });
    } else if (!open) {
      overlayInner.classList.remove("is-open");
    } else if (menuScroll) {
      // Already open and something unrelated changed (route/active state) —
      // refresh content in place without replaying the entrance animation.
      menuScroll.replaceChildren(renderMenuScrollContent());
    }
  }

  const SORT_LABELS = {
    newest: "جدیدترین آگهی‌ها",
    recommended: "پیشنهادی",
    "price-asc": "قیمت: کم به زیاد",
    "price-desc": "قیمت: زیاد به کم",
    "miles-asc": "کارکرد: کم به زیاد",
    "year-desc": "سال: جدیدترین ابتدا",
  };

  function appendSkeletonCards(container,count){for(let i=0;i<count;i++)container.appendChild(mountTemplate("tpl-skeleton-card"));}
  function appendExploreSkeletonCards(container,count){const tpl=(typeof state!=="undefined"&&state.listStyle==="compact")?"tpl-skeleton-explore-card-compact":"tpl-skeleton-explore-card";for(let i=0;i<count;i++)container.appendChild(mountTemplate(tpl));}
  function makeSkeletonBlock(className){const el=document.createElement("div");el.className=`skeleton-block ${className||""}`;return el;}
  function renderSkeletonScreen(page) {
    const route = state.pendingRoute || {};
    const sk = (style, cls = "") => `<span aria-hidden="true" class="skeleton-block ${cls}" style="display:block;${style}"></span>`;
    const bar = (width, height = 12, radius = 999, extra = "") => sk(`width:${width};height:${height}px;border-radius:${radius}px;${extra}`);
    const field = (labelWidth = "35%", height = 48) => `<div class="cm-sk-field"><span class="cm-sk-label">${bar(labelWidth, 10)}</span>${bar("100%", height, 14)}</div>`;
    const mark = (root) => { if (root) { root.classList.add("cm-skeleton-screen"); root.setAttribute("aria-busy", "true"); } return root; };
    const addFilterToolbar = (root) => {
      const slot = root && root.querySelector('[data-slot="toolbar"]');
      if (!slot) return;
      const toolbar = mountTemplate("tpl-toolbox");
      const chips = toolbar.querySelector('[data-slot="filter-chips"]');
      if (chips) {
        const main = chips.querySelector(".toolbox-filter-main");
        chips.replaceChildren();
        if (main) {
          main.classList.add("cm-sk-filter-main");
          main.setAttribute("aria-hidden", "true");
          main.removeAttribute("data-action");
          main.innerHTML = bar("48px", 12);
          chips.appendChild(main);
        }
        [[78, "brand"], [76, "model"], [66, "year"], [58, "city"]].forEach(([w, key]) => {
          const wrap = document.createElement("span"); wrap.className = "toolbox-chip-wrap cm-sk-filter-wrap";
          wrap.dataset.chipWrap = key;
          wrap.innerHTML = `<span class="toolbox-chip cm-sk-filter-chip">${bar(`${w}px`, 12)}</span>`;
          chips.appendChild(wrap);
        });
      }
      const layer = toolbar.querySelector('[data-slot="chip-dropdown-layer"]'); if (layer) layer.remove();
      const panel = toolbar.querySelector('[data-slot="filter-panel"]'); if (panel) panel.remove();
      slot.replaceWith(toolbar);
    };
    const savedCardMarkup = () => `<article class="card-fade-in rounded-2xl overflow-hidden bg-neutral-950 flex flex-col cm-saved-sk-card"><div class="relative aspect-[3/2] bg-neutral-900 rounded-[12px] overflow-hidden">${sk("position:absolute;inset:0;border-radius:0")}${sk("position:absolute;top:8px;left:8px;width:44px;height:20px;border-radius:6px")}${sk("position:absolute;bottom:8px;right:8px;width:40px;height:18px;border-radius:6px")}</div><div class="p-3 flex flex-col gap-1"><div class="cm-saved-sk-title">${bar("92%", 14)}${bar("62%", 10, 999, "margin-top:6px")}</div><div class="mt-1 flex items-center justify-between">${bar("52%", 16)}${bar("25%", 16, 6)}</div><div class="flex items-center justify-between text-[11px] mb-1.5 mt-1">${bar("36%", 10)}${bar("28%", 10)}</div>${bar("100%", 34, 999, "margin-top:2px")}</div></article>`;
    const managedCardMarkup = () => `<article class="rounded-2xl border border-neutral-800 bg-neutral-950 overflow-hidden cm-manage-sk-card"><div class="flex gap-3 p-3"><div class="w-20 h-16 rounded-lg overflow-hidden shrink-0">${sk("width:100%;height:100%;border-radius:9px")}</div><div class="flex-1 min-w-0 flex flex-col gap-2 pt-1">${bar("78%", 13)}${bar("48%", 13)}${bar("56%", 22, 999)}</div></div><div class="grid grid-cols-3 gap-2 px-3 pb-3">${[0,1,2].map(()=>`<div class="flex flex-col items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 py-3">${bar("24px",15,5)}${bar("38%",10)}${bar("52%",9)}</div>`).join("")}</div><div class="grid grid-cols-2 border-t border-neutral-800">${bar("76%", 11, 999, "margin:12px auto")}${bar("68%", 11, 999, "margin:12px auto")}</div></article>`;
    const makeExploreGrid = (container, count) => { container.dataset.listStyle = state.listStyle === "compact" ? "compact" : "large"; appendExploreSkeletonCards(container, count); };

    /* HOME — mirrors renderHomeScreen(): slogan, three-slide carousel, five shortcuts,
       horizontal newest-listing rail, editorial promo, showroom rail, trust strip, seller CTA. */
    if (page === "home") { /* CM-SK2 */
      const root = document.createElement("section"); root.dataset.page = "home"; root.className = "cm-home-page cm-home-skeleton cm-sk2";
      root.innerHTML = `<div class="cm-home-search-wrap" aria-hidden="true"><div class="cm-home-search"><svg class="cm-home-search-icon" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><span class="bar-search-field"><span class="bar-search-copy"><span class="bar-search-label">جستجو خودرو بر اساس</span><span class="bar-search-rotator"><span class="word active">برند</span></span></span></span></div></div><section class="sk2-ts"><div class="sk2-ts-rail"><div class="sk2-st"><span class="sk2b" style="width:72px;height:72px;border-radius:50%"></span><span class="sk2b" style="width:52px;height:10px;border-radius:999px;margin-top:10px"></span></div><div class="sk2-st"><span class="sk2b" style="width:72px;height:72px;border-radius:50%"></span><span class="sk2b" style="width:52px;height:10px;border-radius:999px;margin-top:10px"></span></div><div class="sk2-st"><span class="sk2b" style="width:72px;height:72px;border-radius:50%"></span><span class="sk2b" style="width:52px;height:10px;border-radius:999px;margin-top:10px"></span></div><div class="sk2-st"><span class="sk2b" style="width:72px;height:72px;border-radius:50%"></span><span class="sk2b" style="width:52px;height:10px;border-radius:999px;margin-top:10px"></span></div><div class="sk2-st"><span class="sk2b" style="width:72px;height:72px;border-radius:50%"></span><span class="sk2b" style="width:52px;height:10px;border-radius:999px;margin-top:10px"></span></div><div class="sk2-st"><span class="sk2b" style="width:72px;height:72px;border-radius:50%"></span><span class="sk2b" style="width:52px;height:10px;border-radius:999px;margin-top:10px"></span></div></div></section><section class="sk2-lt"><div class="sk2-head"><span class="sk2b" style="width:163px;height:28px;border-radius:8px"></span><span class="sk2b" style="width:116px;height:34px;border-radius:999px"></span></div><div class="sk2-lt-rail"><div class="sk2-lc"><span class="sk2b sk2-lc-photo"></span><div class="sk2-lc-body"><div class="sk2-lc-info"><span class="sk2b" style="width:64%;height:16px;border-radius:999px"></span><span class="sk2b" style="width:40%;height:12px;border-radius:999px;margin-top:9px"></span></div><div class="sk2-lc-end"><span class="sk2b" style="width:119px;height:20px;border-radius:999px"></span><span class="sk2b" style="width:26px;height:26px;border-radius:50%"></span></div></div></div><div class="sk2-lc"><span class="sk2b sk2-lc-photo"></span><div class="sk2-lc-body"><div class="sk2-lc-info"><span class="sk2b" style="width:64%;height:16px;border-radius:999px"></span><span class="sk2b" style="width:40%;height:12px;border-radius:999px;margin-top:9px"></span></div><div class="sk2-lc-end"><span class="sk2b" style="width:119px;height:20px;border-radius:999px"></span><span class="sk2b" style="width:26px;height:26px;border-radius:50%"></span></div></div></div></div></section><section class="sk2-dc"><div class="sk2-tabs"><span class="sk2-tab on"></span><span class="sk2-tab"></span></div><div class="sk2-chips"><span class="sk2-chip" style="width:153px"><span class="sk2b sk2-chip-th"></span><span class="sk2b" style="width:46px;height:11px;border-radius:999px"></span></span><span class="sk2-chip" style="width:139px"><span class="sk2b sk2-chip-th"></span><span class="sk2b" style="width:46px;height:11px;border-radius:999px"></span></span><span class="sk2-chip" style="width:185px"><span class="sk2b sk2-chip-th"></span><span class="sk2b" style="width:46px;height:11px;border-radius:999px"></span></span><span class="sk2-chip" style="width:150px"><span class="sk2b sk2-chip-th"></span><span class="sk2b" style="width:46px;height:11px;border-radius:999px"></span></span></div></section><section class="sk2-hb"><span class="sk2b sk2-hb-art"></span><span class="sk2-dots"><i class="on"></i><i></i><i></i><i></i></span></section><section class="sk2-sr"><div class="sk2-head sk2-head-sr"><div class="sk2-head-col"><span class="sk2b" style="width:118px;height:26px;border-radius:8px"></span><span class="sk2b" style="width:190px;height:11px;border-radius:6px;margin-top:9px"></span></div><span class="sk2b" style="width:128px;height:36px;border-radius:999px"></span></div><div class="sk2-intro"><span class="sk2b" style="width:118px;height:30px;border-radius:999px"></span><div class="sk2-intro-tx"><span class="sk2b" style="width:86%;height:20px;border-radius:8px"></span><span class="sk2b" style="width:74%;height:20px;border-radius:8px;margin-top:12px"></span><span class="sk2b" style="width:52%;height:20px;border-radius:8px;margin-top:12px"></span></div><div class="sk2-intro-ch"><span class="sk2b" style="width:107px;height:14px;border-radius:999px"></span><span class="sk2b" style="width:93px;height:14px;border-radius:999px"></span><span class="sk2b" style="width:87px;height:14px;border-radius:999px"></span></div><span class="sk2b" style="width:280px;height:48px;border-radius:16px"></span></div><div class="sk2-sc-rail"><article class="sk2-sc"><span class="sk2b sk2-sc-media"></span><div class="sk2-sc-body"><div class="sk2-sc-row"><span class="sk2b" style="width:50px;height:50px;border-radius:50%"></span><div class="sk2-sc-copy"><span class="sk2b" style="width:150px;height:13px;border-radius:999px"></span><span class="sk2b" style="width:90px;height:9px;border-radius:999px;margin-top:8px"></span></div><span class="sk2b" style="width:40px;height:40px;border-radius:50%"></span></div><i class="sk2-sc-div"></i><div class="sk2-sc-stats"><div class="sk2-sc-st"><span class="sk2b" style="width:40px;height:13px;border-radius:999px"></span><span class="sk2b" style="width:56px;height:8px;border-radius:999px;margin-top:9px"></span></div><div class="sk2-sc-st"><span class="sk2b" style="width:40px;height:13px;border-radius:999px"></span><span class="sk2b" style="width:56px;height:8px;border-radius:999px;margin-top:9px"></span></div><div class="sk2-sc-st"><span class="sk2b" style="width:40px;height:13px;border-radius:999px"></span><span class="sk2b" style="width:56px;height:8px;border-radius:999px;margin-top:9px"></span></div></div></div></article><article class="sk2-sc"><span class="sk2b sk2-sc-media"></span><div class="sk2-sc-body"><div class="sk2-sc-row"><span class="sk2b" style="width:50px;height:50px;border-radius:50%"></span><div class="sk2-sc-copy"><span class="sk2b" style="width:150px;height:13px;border-radius:999px"></span><span class="sk2b" style="width:90px;height:9px;border-radius:999px;margin-top:8px"></span></div><span class="sk2b" style="width:40px;height:40px;border-radius:50%"></span></div><i class="sk2-sc-div"></i><div class="sk2-sc-stats"><div class="sk2-sc-st"><span class="sk2b" style="width:40px;height:13px;border-radius:999px"></span><span class="sk2b" style="width:56px;height:8px;border-radius:999px;margin-top:9px"></span></div><div class="sk2-sc-st"><span class="sk2b" style="width:40px;height:13px;border-radius:999px"></span><span class="sk2b" style="width:56px;height:8px;border-radius:999px;margin-top:9px"></span></div><div class="sk2-sc-st"><span class="sk2b" style="width:40px;height:13px;border-radius:999px"></span><span class="sk2b" style="width:56px;height:8px;border-radius:999px;margin-top:9px"></span></div></div></div></article></div><span class="sk2-sc-dots"><i class="on"></i><i></i><i></i></span></section><section class="sk2-nws"><div class="sk2-head"><span class="sk2b" style="width:160px;height:28px;border-radius:8px"></span><span class="sk2b" style="width:116px;height:34px;border-radius:999px"></span></div><article class="sk2-nw"><div class="sk2-nw-h"><span class="sk2b" style="width:38px;height:38px;border-radius:50%"></span><div class="sk2-nw-w"><span class="sk2b" style="width:90px;height:12px;border-radius:999px"></span><span class="sk2b" style="width:140px;height:9px;border-radius:999px;margin-top:7px"></span></div></div><span class="sk2b sk2-nw-cover"></span><div class="sk2-nw-b"><span class="sk2b" style="width:90%;height:16px;border-radius:999px"></span><span class="sk2b" style="width:100%;height:11px;border-radius:999px;margin-top:12px"></span><span class="sk2b" style="width:66%;height:11px;border-radius:999px;margin-top:8px"></span></div><div class="sk2-nw-a"><span class="sk2b" style="width:48px;height:22px;border-radius:999px"></span><span class="sk2b" style="width:48px;height:22px;border-radius:999px"></span><span class="sk2b" style="width:48px;height:22px;border-radius:999px"></span></div></article></section><footer class="sk2-ft"><span class="sk2b sk2-ft-hero"></span><span class="sk2b" style="width:86px;height:12px;border-radius:999px;margin:26px auto 0"></span><div class="sk2-ft-soc"><span class="sk2b" style="width:48px;height:48px;border-radius:50%"></span><span class="sk2b" style="width:48px;height:48px;border-radius:50%"></span><span class="sk2b" style="width:48px;height:48px;border-radius:50%"></span><span class="sk2b" style="width:48px;height:48px;border-radius:50%"></span><span class="sk2b" style="width:48px;height:48px;border-radius:50%"></span></div><span class="sk2b" style="width:123px;height:38px;border-radius:999px;margin:40px auto 0"></span><span class="sk2b" style="width:200px;height:65px;border-radius:14px;margin:2px auto 0"></span></footer>`;
      return mark(root);
    }

    /* CHAT — actual in-module layouts are retained. */
    if (page === "messages" && window.MARQUE_CHAT && window.MARQUE_CHAT.skeletonMessages) return mark(window.MARQUE_CHAT.skeletonMessages());
    if (page === "conversation" && window.MARQUE_CHAT && window.MARQUE_CHAT.skeletonConversation) return mark(window.MARQUE_CHAT.skeletonConversation());
    if (page === "qa" && window.MARQUE_QA && window.MARQUE_QA.skeletonScreen) return mark(window.MARQUE_QA.skeletonScreen());
    if (page === "qaAsk" && window.MARQUE_QA && window.MARQUE_QA.skeletonAsk) return mark(window.MARQUE_QA.skeletonAsk());
    if (page === "qaQuestion" && window.MARQUE_QA && window.MARQUE_QA.skeletonQuestion) return mark(window.MARQUE_QA.skeletonQuestion());
    if (page === "qaMine" && window.MARQUE_QA && window.MARQUE_QA.skeletonMine) return mark(window.MARQUE_QA.skeletonMine());

    /* LISTINGS — preserves the real cm-lh title/subtitle/actions, toolbox, card shape and footer. */
    if (page === "listings") {
      const root = mountTemplate("tpl-listings");
      addFilterToolbar(root);
      let filteredCount = 0;
      try {
        const brand = route.brand || (state.route && state.route.brand) || "all";
        const source = brand === "all" ? LISTINGS : LISTINGS.filter((item) => item.brand === brand);
        const query = (state.search || "").trim().toLowerCase();
        const searchable = query ? source.filter((item) => `${item.title} ${item.brand} ${vehicleModelName(item)} ${DEALERS[item.brand] ? DEALERS[item.brand].city : ""}`.toLowerCase().includes(query)) : source;
        filteredCount = applyListingFilters(searchable).length;
      } catch (_) { filteredCount = 4; }
      const cards = root.querySelector('[data-slot="cards"]');
      if (cards) {
        if (filteredCount > 0) makeExploreGrid(cards, Math.max(1, Math.min(filteredCount, Number(state.visibleCount) || filteredCount)));
        else {
          const empty = mountTemplate("tpl-list-empty");
          const message = empty.querySelector('[data-slot="message"]');
          if (message) message.innerHTML = `${bar("82%",12)}<br>${bar("68%",10)}`;
          cards.replaceChildren(empty);
        }
      }
      const footer = root.querySelector('[data-slot="footer"]'); if (footer) footer.innerHTML = filteredCount ? `<div class="cm-listings-sk-footer">${bar("28%",10)}${bar("18%",10)}</div>` : "";
      return mark(root);
    }

    /* BRAND MODELS — the actual page is a 2-column model-card grid, with one “all models” card. */
    if (page === "brand") {
      const root = mountTemplate("tpl-brand-models");
      const title = root.querySelector('[data-slot="title"]'); if (title) title.remove();
      const crumbs = root.querySelector('[data-slot="breadcrumbs"]'); if (crumbs) crumbs.remove();
      addFilterToolbar(root);
      const grid = root.querySelector('[data-slot="models"]');
      if (grid) {
        const brandName = route.brand || (state.route && state.route.brand) || state.selectedBrand || "";
        let modelCount = 5;
        try {
          const byBrand = LISTINGS.filter((item) => item.brand === brandName);
          const modelMap = new Map();
          byBrand.forEach((item) => { const model = vehicleModelName(item) || brandName; modelMap.set(model, (modelMap.get(model) || 0) + 1); });
          const query = (state.search || "").trim().toLowerCase();
          modelCount = Array.from(modelMap.keys()).filter((model) => !query || `${brandName} ${model}`.toLowerCase().includes(query)).length;
        } catch (_) {}
        const all = mountTemplate("tpl-model-all-card");
        const markSlot = all.querySelector('[data-slot="mark"]'); if (markSlot) markSlot.innerHTML = bar("44px",44,999);
        const count = all.querySelector('[data-slot="count"]'); if (count) count.innerHTML = bar("62px",10);
        grid.appendChild(all);
        for (let i=0;i<modelCount;i++) { const card=mountTemplate("tpl-model-card"); const v=card.querySelector('[data-slot="visual"]'); if(v) v.innerHTML=bar("100%", 1, 0, "position:absolute;inset:0;height:100%;border-radius:0"); const m=card.querySelector('[data-slot="model"]'); if(m) m.innerHTML=bar(i%3===0?"77%":"58%",13); const c=card.querySelector('[data-slot="count"]'); if(c) c.innerHTML=bar("43%",10); grid.appendChild(card); }
      }
      return mark(root);
    }

    /* SHOWROOM DIRECTORY — the live page's own header controls, stats, search,
       showroom ranking cards, awards, activity metrics and rating row are mirrored. */
    if (page === "dealers") {
      const root = document.createElement("section"); root.dataset.page="dealers"; root.className="cm-showroom-directory sr-page cm-skeleton-screen";
      let showroomSkeletonCount = 4;
      try { if (typeof getShowroomDirectoryItems === "function") showroomSkeletonCount = getShowroomDirectoryItems().length; } catch (_) {}
      root.innerHTML = `<div class="page-header-sticky bg-neutral-950 cm-lh"><div class="cm-lh-text"><h1>نمایشگاه‌ها</h1><p>نمایشگاه‌های معتبر را پیدا و مقایسه کن</p></div><div class="cm-lh-btns"><button type="button" class="cm-lh-btn" aria-label="جستجوی نمایشگاه"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg></button><button type="button" class="cm-lh-btn" aria-label="ثبت آگهی"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div><div class="sr-chips" role="group"><span class="sr-select">همه شهرها <svg viewBox="0 0 12 12"><path d="m2.5 4.5 3.5 3.5 3.5-3.5"/></svg></span><i class="sr-chips-sep"></i><span class="sr-chip is-active">فعال‌ترین</span><span class="sr-chip">بیشترین آگهی</span><span class="sr-chip">جدیدترین فعالیت</span><span class="sr-chip">محبوب‌ترین</span><span class="sr-chip">بالاترین امتیاز</span></div></div>
      <div class="sr-group cm-showroom-sk-stats">${[0,1,2].map(()=>`<div><strong>${bar("32px",16)}</strong><span>${bar("42px",9)}</span></div>`).join("")}</div>
      <div class="sr-search cm-showroom-sk-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>${bar("74%",13)}</div><div class="sr-count">${bar("80px",11)}</div>
      <div class="sr-grid cm-showroom-sk-grid">${Array.from({length:showroomSkeletonCount},(_,i)=>i).map(()=>`<article class="sr-card"><div class="sr-media"><span class="skeleton-block cm-showroom-sk-cover"></span><span class="sr-rank"><b>${bar("18px",18)}</b>${bar("56px",10)}</span></div><div class="sr-body"><div class="sr-id"><span class="sr-avatar">${bar("100%",44,999)}</span><span class="sr-meta">${bar("112px",13)}${bar("74px",10)}</span>${bar("18px",18,999)}</div><div class="sr-awards cm-showroom-sk-awards">${bar("52px",18,999)}${bar("62px",18,999)}${bar("48px",18,999)}</div><dl class="sr-stats">${[0,1,2].map(()=>`<div><dd>${bar("34px",15)}</dd><dt>${bar("38px",9)}</dt></div>`).join("")}</dl><div class="sr-rate"><div class="sr-rate-sum">${bar("74px",11)}</div><div class="sr-stars">${[0,1,2,3,4].map(()=>bar("12px",12,999)).join("")}</div></div></div></article>`).join("")}</div><p class="sr-footnote">شاخص فعالیت از امتیاز کاربران جداست. رأی‌ها فعلاً در همین مرورگر ذخیره می‌شوند.</p>`;
      if (showroomSkeletonCount === 0) { const grid = root.querySelector('.cm-showroom-sk-grid'); if (grid) grid.innerHTML = `<div class="sr-empty">${bar("42px",14)}${bar("78%",11)}${bar("58%",10)}${bar("96px",32,999)}</div>`; }
      root.setAttribute("aria-busy","true"); return root;
    }

    /* VEHICLE DETAIL — clones the actual detail-page template and fills every real dynamic slot. */
    if (page === "vehicle") {
      const root = mountTemplate("tpl-vehicle");
      const crumbs = root.querySelector('[data-slot="vehicle-breadcrumbs"]'); if (crumbs) crumbs.innerHTML = `${bar("28px",10)}<i>›</i>${bar("48px",10)}<i>›</i>${bar("64px",10)}`;
      const hero = root.querySelector('[data-slot="hero"]'); if (hero) hero.innerHTML = sk("position:absolute;inset:0;width:100%;height:100%;border-radius:0", "cm-vehicle-sk-main-photo");
      const loadingListing = route.listing || (state.route && state.route.listing) || null;
      let loadingPhotoCount = 6;
      try { if (typeof vehiclePhotoCount === "function") loadingPhotoCount = vehiclePhotoCount(loadingListing); } catch (_) {}
      const thumbCount = Math.min(5, Math.max(0, Number(loadingPhotoCount) || 0));
      const thumbRow = root.querySelector('[data-slot="thumbs"]'); if (thumbRow) thumbRow.innerHTML = `${Array.from({length:thumbCount},()=>`<span class="skeleton-block cm-vehicle-sk-thumb"></span>`).join("")}`;
      const photoMini = root.querySelector('[data-slot="photo-count-mini"]'); if (photoMini) photoMini.innerHTML = bar("50px",10);
      const photoCount = root.querySelector('[data-slot="photo-count"]'); if (photoCount) photoCount.innerHTML = bar("42px",11);
      const title = root.querySelector('[data-slot="title"]'); if (title) title.innerHTML = bar("78%",22);
      const titleEn = root.querySelector('[data-slot="title-en"]'); if (titleEn) titleEn.innerHTML = bar("42%",12);
      const city = root.querySelector('[data-slot="city"]'); if (city) city.innerHTML = `${bar("56%",11)}${bar("26%",11)}`;
      const featured = root.querySelector('[data-slot="featured"]'); if(featured){featured.hidden=false;featured.innerHTML=bar("54px",17,999);}
      const patches = root.querySelector('[data-slot="status-patches"]'); if(patches){patches.hidden=false;patches.innerHTML=`${bar("52px",17,999)}${bar("64px",17,999)}`;}
      const price = root.querySelector('[data-slot="price-main"]'); if(price) price.innerHTML = bar("136px",36);
      const unit = root.querySelector('[data-slot="price-unit"]'); if(unit) unit.innerHTML = bar("42px",12);
      const negotiation = root.querySelector('[data-slot="negotiation-label"]'); if(negotiation) negotiation.innerHTML = bar("54px",11);
      const priceHint = root.querySelector('[data-slot="price-hint"]'); if(priceHint) priceHint.innerHTML = `${bar("96%",11)}${bar("72%",11)}`;
      const facts = root.querySelector('[data-slot="quick-facts"]'); if(facts) facts.innerHTML = ["کارکرد","سال ساخت","رنگ بدنه"].map((label)=>`<div class="fact"><span class="skeleton-block cm-vehicle-sk-fact-icon"></span><span class="skeleton-block cm-vehicle-sk-fact-value"></span><span class="fact-name">${label}</span></div>`).join("");
      const seller = root.querySelector('[data-slot="seller"]'); if(seller) seller.innerHTML = `<div class="seller-mini seller-mini--personal cm-vehicle-sk-seller"><span class="seller-avatar">${bar("100%",44,999)}</span><span class="seller-info"><span class="seller-name">${bar("116px",13)}</span><span class="seller-type">${bar("72px",10)}${bar("52px",10)}</span></span>${bar("92px",12)}</div>`;
      const desc = root.querySelector('[data-slot="vehicle-description"]'); if(desc) desc.innerHTML = `${bar("100%",12)}${bar("94%",12)}${bar("86%",12)}${bar("63%",12)}`;
      const technical = root.querySelector('[data-slot="technical-specs"]'); if(technical){technical.className="vds-grid";technical.innerHTML=[0,1,2,3].map(()=>`<div class="vds-tile">${bar("65%",10)}${bar("82%",15)}<span class="vds-tile-mark">${bar("17px",17,5)}</span></div>`).join("");}
      const ownership = root.querySelector('[data-slot="ownership-specs"]'); if(ownership){ownership.className="vds-docs";ownership.innerHTML=[0,1,2].map(()=>`<div class="vds-doc"><span class="vds-doc-badge">${bar("18px",18,5)}</span><span class="vds-doc-text">${bar("68%",10)}${bar("44%",13)}</span></div>`).join("");}
      const ownershipCaption=root.querySelector('[data-slot="ownership-caption"]');if(ownershipCaption)ownershipCaption.innerHTML=bar("110px",10);
      const tabs=root.querySelector('[data-slot="tab-content"]');if(tabs)tabs.innerHTML=`<div class="cm-vehicle-sk-tabs">${[0,1,2].map(()=>bar("64px",28,999)).join("")}</div><div class="cm-vehicle-sk-panel">${bar("92%",12)}${bar("80%",12)}${bar("70%",12)}</div>`;
      const map=root.querySelector('[data-slot="detail-map"]');if(map)map.innerHTML=`<div class="skeleton-block cm-vehicle-sk-map"></div>`;
      const locationCity=root.querySelector('[data-slot="location-city"]');if(locationCity)locationCity.innerHTML=bar("105px",13);
      const stickyPrice=root.querySelector('[data-slot="price-sticky"]');if(stickyPrice)stickyPrice.innerHTML=bar("120px",21,8);
      const stickyPhone=root.querySelector('[data-slot="phone-sticky"]');if(stickyPhone){stickyPhone.removeAttribute("data-action");stickyPhone.setAttribute("aria-hidden","true");stickyPhone.innerHTML=`<i class="skeleton-block cm-vehicle-sk-cta-icon"></i>`;}
      const stickyContact=root.querySelector('[data-slot-id="contact-sticky"]');if(stickyContact){stickyContact.removeAttribute("data-action");stickyContact.setAttribute("aria-hidden","true");stickyContact.style.pointerEvents="none";stickyContact.innerHTML=`<i class="skeleton-block cm-vehicle-sk-cta-icon cm-vehicle-sk-cta-icon--dark"></i><i class="skeleton-block cm-vehicle-sk-cta-label cm-vehicle-sk-cta-icon--dark"></i>`;}
      return mark(root);
    }

    /* SELLER / PUBLIC SHOWROOM PROFILE — real profile hero anatomy + explore-card rail. */
    if (page === "seller" || page === "dealerPublic") {
      const root = mountTemplate("tpl-seller");
      const hero = root.querySelector('[data-slot="hero"]');
      /* Showroom (dealer) profile has its own anatomy: full-bleed banner, NO avatar, name+handle low on the banner,
         stats first, then [icon][main button][icon], then the hexagon trophy rail. Personal profiles keep the avatar layout. */
      let skIsDealer = page === "dealerPublic" || (route.kind || (state.route && state.route.kind)) === "dealer";
      try {
        let skId = route.sellerId || route.id || (state.route && (state.route.sellerId || state.route.id));
        if (!skId && page === "dealerPublic" && window.MARQUE_TRUST && typeof window.MARQUE_TRUST.resolveDealerSlug === "function") skId = window.MARQUE_TRUST.resolveDealerSlug(route.slug || (state.route && state.route.slug));
        if (typeof sellerProfileById === "function" && skId) { const skProfile = sellerProfileById(skId, skIsDealer ? "dealer" : (route.kind || (state.route && state.route.kind) || "personal")); if (skProfile && skProfile.type === "dealer") skIsDealer = true; }
      } catch (_) {}
      const skPage = root.querySelector('[data-page="seller"]') || root;
      skPage.classList.add("sp-page");
      if (skIsDealer) skPage.classList.add("sp-dealer");
      if (hero && skIsDealer) hero.innerHTML = `<section class="pf-hero sp-hero sp-hero--has-banner cm-seller-sk-hero cm-seller-sk-hero--dealer"><div class="sp-banner-cover has-banner cm-seller-sk-cover"><span class="skeleton-block cm-seller-sk-banner"></span></div><div class="sp-id"><span class="skeleton-block cm-seller-sk-name"></span><span class="skeleton-block cm-seller-sk-handle"></span></div><div class="sp-stats">${[0,1,2].map(()=>`<div>${bar("34px",18)}${bar("54px",10)}</div>`).join("")}</div><div class="sp-actions sp-actions--dealer"><span class="skeleton-block cm-seller-sk-icon"></span><span class="skeleton-block cm-seller-sk-main"></span><span class="skeleton-block cm-seller-sk-icon"></span></div><section class="sp-troph cm-seller-sk-troph"><div class="sp-troph-rail">${[0,1,2,3,4].map(()=>`<span class="skeleton-block cm-seller-sk-hex"></span>`).join("")}</div><div class="cm-seller-sk-troph-cap">${bar("120px",13)}${bar("200px",10)}</div></section><div class="sp-list"><div class="sp-row">${bar("45%",11)}${bar("68%",11)}</div><div class="sp-row">${bar("40%",11)}${bar("82%",11)}</div></div><div class="sp-section"><h2></h2>${bar("42px",12)}</div></section>`;
      else if (hero) hero.innerHTML = `<section class="pf-hero sp-hero cm-seller-sk-hero"><div class="sp-banner-cover"><span class="skeleton-block cm-seller-sk-banner"></span></div><div class="sp-id"><span class="skeleton-block sp-avatar cm-seller-sk-avatar"></span><span class="skeleton-block cm-seller-sk-name"></span><span class="skeleton-block cm-seller-sk-handle"></span></div><div class="sp-actions">${bar("42%",36,999)}${bar("42%",36,999)}</div><div class="sp-stats">${[0,1,2].map(()=>`<div>${bar("34px",18)}${bar("54px",10)}</div>`).join("")}</div><div class="sp-awards cm-seller-sk-awards">${bar("66px",20,999)}${bar("74px",20,999)}${bar("56px",20,999)}</div><div class="sp-list"><div class="sp-row">${bar("45%",11)}${bar("68%",11)}</div><div class="sp-row">${bar("40%",11)}${bar("82%",11)}</div></div><div class="sp-section"><h2>آگهی‌ها</h2>${bar("42px",12)}</div></section>`;
      const cards=root.querySelector('[data-slot="cards"]');
      if(cards){
        let profileListingCount = state.listStyle==="compact"?5:3;
        try {
          let sellerId = route.sellerId || route.id || (state.route && (state.route.sellerId || state.route.id));
          if (!sellerId && page === "dealerPublic" && window.MARQUE_TRUST && typeof window.MARQUE_TRUST.resolveDealerSlug === "function") sellerId = window.MARQUE_TRUST.resolveDealerSlug(route.slug || (state.route && state.route.slug));
          const kind = route.kind || (state.route && state.route.kind) || (page === "dealerPublic" ? "dealer" : "personal");
          if (typeof sellerProfileById === "function" && sellerId) {
            const profile = sellerProfileById(sellerId, kind);
            profileListingCount = profile && Array.isArray(profile.listings) ? profile.listings.length : 0;
            // نمایشگاه: همان‌طور که صفحه‌ی واقعی دوک را نشان نمی‌دهد، در حالت لودینگ هم نشان داده نشود
            if (profile && profile.type === "dealer") { const sp = root.querySelector('[data-page="seller"]') || root; sp.classList.add("sp-dealer"); }
          }
        } catch (_) {}
        if(profileListingCount>0) makeExploreGrid(cards,Math.min(profileListingCount,state.listStyle==="compact"?5:3));
        else cards.innerHTML=`<div class="cm-seller-sk-empty">${bar("44%",12)}${bar("72%",10)}</div>`;
      }
      return mark(root);
    }

    /* SELL VEHICLE — uses the real step template and mirrors each active step's actual controls. */
    if (page === "sell") {
      const root = mountTemplate("tpl-sell-step");
      const step = Math.max(1, Number(state.sellStep || route.step || 1));
      const total = (typeof sellTotalSteps === "function" ? sellTotalSteps() : 5);
      const progress = buildSellStepper(step, total, { skeleton: true });
      const pslot=root.querySelector('[data-slot="progress"]');if(pslot)pslot.replaceWith(progress);
      const content=root.querySelector('[data-slot="step-content"]');
      const row = (labelWidth="28%") => `<div class="sell-row-wrap"><div class="sell-row cm-sell-sk-row"><span class="sell-row-label">${bar(labelWidth,10)}</span><span class="sell-row-value">${bar("92px",13)}</span><span class="sell-row-chev">›</span></div></div>`;
      const note = (text) => `<div class="sell-step-heading">${text}</div>`;
      let body = "";
      if (step===1) {
        const form = mountTemplate("tpl-sell-step4");
        const n=form.querySelector('[data-slot="note"]');if(n)n.remove();
        const mediaSk=form.querySelector('[data-slot="media"]');if(mediaSk){
          /* Keep the real static media block (title, rules, warning, illustration) and only swap the two interactive tiles for skeletons that reuse .sell-media-tile sizing. */
          const sf=state.sellForm||{};const hasMedia=(Array.isArray(sf.photos)&&sf.photos.length>0)||!!(sf.video&&sf.video.poster);
          mediaSk.querySelectorAll('.sell-media-tile').forEach((tile)=>{tile.removeAttribute('data-slot');tile.style.pointerEvents='none';tile.setAttribute('aria-hidden','true');tile.innerHTML=`${bar("26px",26,999)}${bar("62%",13)}`;});
          const mw=mediaSk.querySelector('[data-slot="media-warn"]');if(mw)mw.hidden=hasMedia;
          const mi=mediaSk.querySelector('[data-slot="media-illus"]');if(mi)mi.hidden=hasMedia;
          const mv=mediaSk.querySelector('[data-slot="video-preview"]');if(mv)mv.hidden=true;
          const mlink=mediaSk.querySelector('.sell-media-link');if(mlink)mlink.removeAttribute('data-action');
        }
        const photosSkHost=mediaSk;
        const photos=form.querySelector('[data-slot="photos"]');
        const photoCount=Math.min(6,(state.sellForm&&Array.isArray(state.sellForm.photos)?state.sellForm.photos.length:0));
        if(photos){photos.innerHTML=Array.from({length:photoCount},()=>`<div class="relative aspect-[4/3] rounded-xl overflow-hidden border border-neutral-700 bg-neutral-900"><span class="skeleton-block" style="position:absolute;inset:0;border-radius:0"></span><span class="skeleton-block" style="position:absolute;bottom:7px;right:7px;width:54px;height:15px;border-radius:99px"></span></div>`).join("");}
        const description=form.querySelector('textarea[name="description"]');if(description){const placeholder=document.createElement("span");placeholder.className="skeleton-block cm-sell-sk-textarea";description.replaceWith(placeholder);}
        body=form.outerHTML;
      } else if (step===2) {
        const specs = Array.isArray(SELL_EXTRA_SPECS) ? SELL_EXTRA_SPECS : [
          {label:"نوع موتور",input:true},{label:"نوع سوخت",options:[1,2,3,4,5,6]},
          {label:"نوع گیربکس",options:[1,2,3,4]},{label:"رنگ تریم داخلی",swatches:[1,2,3,4,5,6,7]},
          {label:"سیستم انتقال قدرت",options:[1,2,3,4]}
        ];
        const picker = (labelWidth) => `<div class="sell-row-wrap"><div class="sell-row cm-sell-sk-row"><span class="sell-row-label">${bar(labelWidth,10)}</span><span class="sell-row-value">${bar("96px",13)}</span><span class="sell-row-chev" aria-hidden="true">›</span></div></div>`;
        const extraSpecs = specs.map((spec)=>{const optionsCount=spec.input?0:(spec.swatches?Object.keys(spec.swatches).length:(spec.options||[]).length);return `<div class="sell-section cm-sell-sk-spec"><div class="sell-section-head"><span class="sell-section-title">${spec.label}</span>${spec.swatches?bar("40px",10):""}</div>${spec.input?bar("100%",44,12):`<div class="${spec.swatches?"sell-swatch-row":"sell-opt-grid sell-cols-"+(spec.key==="fuelType"?3:2)}">${Array.from({length:Math.min(7,optionsCount||4)},(_,i)=>bar(`${i%3===0?72:i%3===1?84:66}px`,28,999)).join("")}</div>`}</div>`;}).join("");
        body = `${note("خودرو را معرفی کنید")}<div class="sell-step2"><div class="sell-list">${picker("22%")}${picker("33%")}${picker("25%")}</div><div class="sell-sections">${extraSpecs}</div></div>`;
      } else if (step===3) {
        const form=mountTemplate("tpl-sell-step2");
        const n=form.querySelector('[data-slot="note"]');if(n)n.replaceWith(note("قیمت و وضعیت خودرو"));
        const priceInput=form.querySelector('.sell-price-input');if(priceInput){const repl=document.createElement("span");repl.className="skeleton-block cm-sell-sk-price-value";priceInput.replaceWith(repl);}
        const priceUnit=form.querySelector('.sell-price-unit');if(priceUnit)priceUnit.innerHTML=bar("38px",11);
        const offer=form.querySelector('.mr-sell-offer-toggle');if(offer){const copy=offer.querySelector('span');if(copy)copy.innerHTML=`<b>${bar("112px",12)}</b><small>${bar("96%",10)}${bar("82%",10)}</small>`;const checkbox=offer.querySelector('input');if(checkbox){const sw=document.createElement("span");sw.className="skeleton-block cm-sell-sk-switch";checkbox.replaceWith(sw);}}
        const minPrice=form.querySelector('.mr-sell-min-price input');if(minPrice){const repl=document.createElement("span");repl.className="skeleton-block cm-sk-form-control";repl.style.height="42px";minPrice.replaceWith(repl);}
        const trustNote=form.querySelector('.mr-trust-muted');if(trustNote)trustNote.innerHTML=`${bar("95%",10)}${bar("68%",10)}`;
        form.querySelectorAll('.sell-toggle').forEach((toggle)=>{const label=toggle.querySelector('.sell-toggle-text');if(label)label.innerHTML=bar("92px",11);const sw=toggle.querySelector('.sell-switch');if(sw)sw.classList.add("cm-sell-sk-switch");const input=toggle.querySelector('input');if(input)input.remove();});
        const miles=form.querySelector('input[name="miles"]');if(miles){const repl=document.createElement("span");repl.className="skeleton-block cm-sell-sk-row-value";miles.replaceWith(repl);}
        const colorLabel=form.querySelector('[data-slot="color-label"]');if(colorLabel)colorLabel.innerHTML=bar("76px",12);
        const colorSwatch=form.querySelector('[data-slot="color-swatch"]');if(colorSwatch){colorSwatch.classList.remove("is-empty");colorSwatch.classList.add("cm-sell-sk-switch");colorSwatch.style.background="";}
        const trimIcon=form.querySelector('[data-slot="trim-icon"]');if(trimIcon)trimIcon.innerHTML=bar("18px",18,5);
        const trimLabel=form.querySelector('[data-slot="trim-label"]');if(trimLabel)trimLabel.innerHTML=bar("52px",12);
        const ownership=form.querySelector('.sell-ownership-more');
        if(ownership){const f=state.sellForm||{};ownership.open=[f.documentType,f.powerOfAttorneyStatus,f.insuranceStatus].some(Boolean);ownership.querySelectorAll('.sell-ownership-sections .sell-section').forEach((section)=>{const grid=section.querySelector('[role="group"]');if(grid)grid.innerHTML=[0,1,2,3].map((_,i)=>bar(`${i%2?76:58}px`,25,999)).join("");const value=section.querySelector('.sell-section-value');if(value)value.innerHTML=bar("62px",10);});}
        body=form.outerHTML;
      } else if (step===4) {
        const damage = mountTemplate("tpl-sell-step-damage");
        const n=damage.querySelector('[data-slot="note"]');if(n){const heading=document.createElement("div");heading.className="sell-step-heading";heading.innerHTML=bar("54%",15);n.replaceWith(heading);}
        const diagram=damage.querySelector('[data-slot="diagram"]');if(diagram){
          let diagramMarkup="";
          try { if(typeof carPanelDiagramSVG==="function") diagramMarkup=carPanelDiagramSVG([],false); } catch (_) {}
          if(diagramMarkup){
            diagram.innerHTML=diagramMarkup.replace('<svg ','<svg class="cm-sell-sk-car-svg" ').replace('<image ','<image class="cm-sell-sk-car-image" ').replaceAll('fill="rgba(0,0,0,0.001)"','fill="rgba(150,155,170,.09)"').replaceAll('stroke="transparent"','stroke="rgba(150,155,170,.16)"');
            diagram.querySelectorAll('path.car-panel-shape').forEach(path=>path.classList.add('cm-sell-sk-car-panel'));
          } else diagram.innerHTML=`<div class="cm-sell-sk-car-diagram"><span class="skeleton-block cm-sell-sk-car-shape"></span>${[0,1,2,3,4,5,6].map(()=>`<i class="skeleton-block"></i>`).join("")}</div>`;
        }
        const chips=damage.querySelector('[data-slot="panel-chips"]');if(chips)chips.innerHTML=[0,1,2,3,4,5,6,7].map(()=>bar("64px",28,999)).join("");
        const summary=damage.querySelector('[data-slot="summary"]');if(summary)summary.innerHTML=bar("220px",11);
        const trigger=damage.querySelector('[data-slot="bodyConditionTrigger"]');if(trigger){const sub=trigger.querySelector('[data-slot="bcondTriggerSub"]');if(sub)sub.innerHTML=bar("65px",12);}
        body=damage.outerHTML;
      } else if (step===5) {
        body = `${note("چطور تماس بگیریم?")}<div class="sell-block-grid"><div class="sell-block-field"><label class="sell-block-label"><span>شهر شما</span><small>محل نگهداری خودرو</small></label><div class="skeleton-block cm-sell-sk-control"></div></div><div class="sell-block-field"><label class="sell-block-label"><span>منطقه</span><small>نقشه را بکشید تا دایره روی منطقه قرار بگیرد</small></label><div class="skeleton-block cm-sell-sk-map"></div>${bar("68%",10)}</div><div class="sell-block-field"><label class="sell-block-label"><span>شماره تماس</span><small>ثابت و غیرقابل تغییر</small></label><div class="skeleton-block cm-sell-sk-control"></div>${bar("90%",10)}</div></div>`;
      } else {
        body = `${note("ثبت آگهی در کدام پنل؟")}<div class="publish-as"><div class="publish-as-hint">${bar("90%",11)}${bar("70%",11)}</div><div class="acct-type-list">${[0,1].map(()=>`<div class="acct-type-card"><span class="skeleton-block cm-sell-sk-radio"></span><span class="acct-type-body">${bar("55%",13)}${bar("82%",10)}</span></div>`).join("")}</div></div>`;
      }
      if(content)content.innerHTML=body;
      const actions=root.querySelector('[data-slot="actions"]');if(actions)actions.innerHTML=`<span class="cm-sell-sk-action cm-sell-sk-action-ghost">${bar("46%",12)}</span><span class="skeleton-block cm-sell-sk-action cm-sell-sk-action-primary"></span>`;
      const terms=root.querySelector('[data-slot="terms"]');if(terms)terms.hidden=step!==total;
      return mark(root);
    }

    /* ACCOUNT — avatar, optional dealer card, tab bar, and the currently active content type. */
    if (page === "account") {
      const root=mountTemplate("tpl-account");
      const profileSlot=root.querySelector('[data-slot="profile"]');
      const logged=!!state.account;
      if(profileSlot) profileSlot.outerHTML=`<div class="account-profile cm-account-sk-profile"><div class="account-profile-banner-spacer" aria-hidden="true"></div><div class="account-avatar-wrap">${sk("width:84px;height:84px;border-radius:50%")}</div><div class="account-name">${bar(logged?"148px":"80px",24)}</div><div class="cm-account-sk-actions">${bar("122px",36,999)}${logged?bar("104px",36,999):""}</div></div>`;
      const body=root.querySelector('.account-body');
      if(logged && body){
        const tabsAnchor=body.querySelector('[data-slot="tabs"]');
        if(state.dealership){
          const dealer=document.createElement("div");dealer.className="dealership-card cm-account-sk-dealer-card";
          dealer.innerHTML=`<div class="dealership-card-head"><span class="dealership-card-logo cm-account-sk-dealer-logo">${bar("100%",52,14)}</span><div class="dealership-card-id"><div class="dealership-card-namerow">${bar("140px",13)}</div><div class="dealership-card-meta">${bar("72px",10)}${bar("86px",10)}</div></div></div>${bar("92%",10,"999","margin-top:12px")}<div class="dealership-card-actions cm-account-sk-dealer-actions">${state.dealership.status==="approved"?bar("44%",34,999):""}${bar(state.dealership.status==="approved"?"44%":"100%",34,999)}</div>`;
          if(tabsAnchor)tabsAnchor.before(dealer);
        } else {
          const create=document.createElement("button");create.type="button";create.className="dealership-create-btn cm-account-sk-create-dealer";create.innerHTML=`${bar("100%",38,999)}`;
          if(tabsAnchor)tabsAnchor.before(create);
        }
      }
      const tabs=root.querySelector('[data-slot="tabs"]');if(tabs)tabs.innerHTML=`<div class="account-tabs cm-account-sk-tabs">${[0,1,2,3].map(()=>`<div class="account-tab">${bar("22px",22,7)}</div>`).join("")}</div>`;
      const content=root.querySelector('[data-slot="tab-content"]');
      const currentTab=state.accountTab||"listings";
      let pinEntries=[];
      try { pinEntries=currentTab==="saved"?LISTINGS.filter((item)=>(state.likedIds||[]).includes(item.id)).map((listing)=>({listing,status:""})):(state.myListings||[]).map((entry)=>({listing:entry&&entry.listing?entry.listing:entry,status:entry&&entry.status?entry.status:""})).filter((entry)=>entry.listing); } catch (_) {}
      const count=pinEntries.length;
      if(content){
        if(currentTab==="inbox") content.innerHTML=`<div class="mr-account-inbox-shortcut cm-account-sk-inbox"><p>${bar("94%",12)}${bar("76%",12)}</p><span class="skeleton-block cm-account-sk-inbox-cta"></span></div>`;
        else if(currentTab==="feed") content.innerHTML=`<div class="mx-4 py-8 border border-dashed border-neutral-800 rounded-2xl cm-account-sk-empty">${bar("44%",12)}${bar("68%",10)}</div>`;
        else if(count) content.innerHTML=`<div class="account-pin-grid">${pinEntries.map((entry,i)=>{const status=entry.status||"";return `<div class="account-pin-card${currentTab==="listings"?" account-pin-card-static":""}${status==="pending"?" is-pending":""}${status==="rejected"?" is-rejected":""}"><div class="account-pin-image">${sk("position:absolute;inset:0;border-radius:0")}<span class="account-pin-avatar">${sk("width:100%;height:100%;border-radius:50%")}</span>${status==="rejected"||status==="removed"?`<span class="account-pin-rejected-badge">${bar("48px",10)}</span>`:""}</div><div class="account-pin-caption"><div class="account-pin-owner">${bar("48%",10)}</div><div class="account-pin-title">${bar(i%3===0?"88%":"72%",12)}</div></div>${currentTab==="listings"?`<div class="account-pin-actions">${bar("42%",30,999)}${bar("42%",30,999)}</div>`:""}</div>`;}).join("")}</div>`;
        else content.innerHTML=`<div class="mx-4 py-8 border border-dashed border-neutral-800 rounded-2xl cm-account-sk-empty">${bar("44%",12)}${bar("68%",10)}</div>`;
      }
      return mark(root);
    }

    /* EDIT PERSONAL ACCOUNT — actual avatar picker, five fields, helper lines and two actions. */
    if (page === "accountEdit") {
      const root=mountTemplate("tpl-account-edit");
      const avatar=root.querySelector('[data-slot="avatar-preview"]');if(avatar)avatar.innerHTML=sk("width:100%;height:100%;border-radius:50%","cm-account-edit-sk-avatar");
      root.querySelectorAll('input:not([type="file"])').forEach((el)=>{const repl=document.createElement("span");repl.className="skeleton-block cm-sk-form-control";repl.style.height="46px";repl.style.display="block";el.replaceWith(repl);});
      const button=root.querySelector('button[type="submit"]');if(button)button.innerHTML=bar("86px",12);
      const logout=root.querySelector('[data-action="logout"]');if(logout)logout.innerHTML=bar("64px",11);
      return mark(root);
    }

    /* EDIT / CREATE SHOWROOM — logo, profile hint, named fields, address, tags,
       owner-verification panel, national ID, then submit. */
    if (page === "dealershipEdit") {
      const root=mountTemplate("tpl-dealership-edit");
      const logo=root.querySelector('[data-slot="logo"]');if(logo)logo.innerHTML=sk("width:100%;height:100%;border-radius:50%","cm-dealer-edit-sk-logo");
      root.querySelectorAll('input:not([type="file"]),textarea').forEach((el)=>{const repl=document.createElement("span");repl.className="skeleton-block cm-sk-form-control";repl.style.display="block";repl.style.height=el.tagName==="TEXTAREA"?"76px":"46px";el.replaceWith(repl);});
      const hint=root.querySelector('[data-slot="nid-hint"]');if(hint)hint.innerHTML=`${bar("93%",10)}${bar("64%",10)}`;
      const submit=root.querySelector('[data-slot="submit"]');if(submit)submit.innerHTML=bar("92px",13);
      return mark(root);
    }

    /* SAVED ADS — regular vertical image cards, not explore cards or filter chips. */
    if (page === "saved") {
      const root=mountTemplate("tpl-saved");
      const crumbs=root.querySelector('[data-slot="breadcrumbs"]');if(crumbs)crumbs.remove();
      const title=root.querySelector('[data-slot="title"]');if(title)title.textContent="خودروهای نشان‌شده";
      const toolbar=root.querySelector('[data-slot="toolbar"]');if(toolbar)toolbar.remove();
      const cards=root.querySelector('[data-slot="cards"]');if(cards){
        const liked=Array.isArray(LISTINGS)?LISTINGS.filter((item)=>(state.likedIds||[]).includes(item.id)):[];
        if(liked.length) cards.innerHTML=liked.map((_,i)=>savedCardMarkup(i)).join("");
        else { const empty=mountTemplate("tpl-list-empty");const msg=empty.querySelector('[data-slot="message"]');if(msg)msg.innerHTML=`${bar("62%",12)}<br>${bar("86%",10)}`;cards.replaceChildren(empty); }
      }
      return mark(root);
    }

    /* MANAGE ADS — actual horizontal thumb/title/price/status, three stat tiles and 2 action cells. */
    if (page === "manageListings") {
      const root=mountTemplate("tpl-manage-listings");
      const crumbs=root.querySelector('[data-slot="breadcrumbs"]');if(crumbs)crumbs.remove();
      const title=root.querySelector('[data-slot="title"]');if(title)title.textContent="مدیریت آگهی‌های من";
      const toolbar=root.querySelector('[data-slot="toolbar"]');if(toolbar)toolbar.remove();
      const gate=root.querySelector('[data-slot="login-gate"]');if(gate)gate.hidden=!!state.account;
      const cards=root.querySelector('[data-slot="cards"]');if(cards){
        if(!state.account) cards.replaceChildren();
        else if((state.myListings||[]).length) cards.innerHTML=(state.myListings||[]).map((_,i)=>managedCardMarkup(i)).join("");
        else { const empty=mountTemplate("tpl-account-empty");empty.innerHTML=`${bar("54%",12)}${bar("78%",10)}`;cards.replaceChildren(empty); }
      }
      return mark(root);
    }

    /* FALLBACK for any newly-added route: use a non-misleading empty skeleton shell. */
    const root=mountTemplate("tpl-skeleton-shell");
    const title=root.querySelector('[data-slot="title"]');if(title)title.remove();
    const crumbs=root.querySelector('[data-slot="breadcrumbs"]');if(crumbs)crumbs.remove();
    const grid=root.querySelector('[data-slot="grid"]');if(grid)makeExploreGrid(grid,4);
    return mark(root);
  }

/* ---------------------------------------------------------------
   SELL STEPPER — round icon nodes joined by pill lines, current step
   caption underneath (shared by the real sell screen and its skeleton).
--------------------------------------------------------------- */
const SELL_STEPPER_STEPS = [
  { label: "عکس‌ها", icon: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.2"/>' },
  { label: "مشخصات", icon: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/>' },
  { label: "قیمت", icon: '<path d="M3.5 12.4V5.5a2 2 0 0 1 2-2h6.9a2 2 0 0 1 1.4.6l7.1 7.1a2 2 0 0 1 0 2.8l-6.9 6.9a2 2 0 0 1-2.8 0l-7.1-7.1a2 2 0 0 1-.6-1.4z"/><circle cx="8.3" cy="8.3" r="1.3"/>' },
  { label: "بدنه و رنگ", icon: '<path d="M5 16.5H3.8a.8.8 0 0 1-.8-.8v-3.2a2 2 0 0 1 1.5-1.9L6.3 10l1.6-3.3A2 2 0 0 1 9.7 5.5h4.6a2 2 0 0 1 1.8 1.2l1.6 3.3 1.8.6a2 2 0 0 1 1.5 1.9v3.2a.8.8 0 0 1-.8.8H19"/><circle cx="7.5" cy="16.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/><path d="M9.5 16.5h5"/>' },
  { label: "تماس", icon: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>' },
  { label: "پنل", icon: '<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 12.5V20h13v-7.5"/><path d="M10 20v-4.5h4V20"/>' }
];
let _ssLastStep = null, _ssAnimUntil = 0;
function buildSellStepper(step, total, opts) {
  const wrap = mountTemplate("tpl-sell-progress");
  const faNum = (n) => String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  total = Math.max(1, total || 5);
  step = Math.max(1, Math.min(total, step || 1));
  // 6-step flow (dealership accounts) uses the last icon/label for step 6.
  // Entry animations only when the step actually changed — option taps re-render the
  // whole screen and must not replay them. The pulse uses a clock-based negative delay so it stays in phase.
  const now = performance.now();
  let animate = false;
  if (!(opts && opts.skeleton)) {
    if (_ssLastStep !== step) { _ssLastStep = step; _ssAnimUntil = now + 700; }
    animate = now < _ssAnimUntil; // a double render right after a step change keeps the animation alive
  }
  const phase = -((now % 1600) / 1000).toFixed(2);
  const meta = (i) => SELL_STEPPER_STEPS[i === 6 ? 5 : i - 1] || SELL_STEPPER_STEPS[0];
  let track = "";
  for (let i = 1; i <= total; i++) {
    const state = i < step ? "is-done" : i === step ? "is-current" : "is-todo";
    track += `<li class="ss-node ${state}"${i === step ? ' aria-current="step"' : ""}><span class="ss-dot${animate && i === step ? " ss-enter" : ""}" data-step="${i}"${i === step ? ` style="--ss-phase:${phase}s"` : ""}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${meta(i).icon}</svg></span><span class="ss-sr">${escHtml(meta(i).label)}</span></li>`;
    if (i < total) {
      // lines fill only up to the current step's own icon
      const fill = i < step ? 1 : 0;
      track += `<li class="ss-line" aria-hidden="true"><i class="${animate && i === step - 1 ? "ss-grow" : ""}" style="--ss-fill:${fill}"></i></li>`;
    }
  }
  wrap.classList.add("sell-stepper");
  wrap.classList.toggle("ss-compact", total > 5);
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", "مراحل ثبت آگهی");
  wrap.innerHTML = `<ol class="ss-track">${track}</ol><div class="ss-caption"><div class="ss-title">${escHtml(meta(step).label)}</div><div class="ss-sub">مرحله ${faNum(step)} از ${faNum(total)}</div></div>`;
  return wrap;
}
