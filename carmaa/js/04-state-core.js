"use strict";

/* ---------------------------------------------------------------
   STATE + CORE — the single `state` object (current route, filters, etc.), routing helpers (serialize/resolve/navigate), vehicle-detail rendering pieces (tabs, photos, map), toast notifications, and listing-filter logic.
// Edit app state shape, routing, vehicle-detail tabs/photos, or the toast here.
--------------------------------------------------------------- */

  /* ---------------------------------------------------------------
     STATE
  --------------------------------------------------------------- */

  // Authentication is server-issued. Do not restore trust from client-editable localStorage.
  let storedAccount = null;

  // ---------------------------------------------------------------
  // ACCOUNT TYPE (شخصی / نمایشگاه)
  // There is no backend, so the per-phone account type lives in
  // localStorage ("marqueAccountMeta": { [phone]: { type, dealerName,
  // dealerCity } }). A phone with no entry has never finished sign-up, so
  // the login flow asks which kind of account it is (see the "type" step in
  // js/08-auth-modal-toast.js).
  // ---------------------------------------------------------------
  const ACCOUNT_META_KEY = "marqueAccountMeta";
  function readAccountMetaStore() {
    try { const o = JSON.parse(window.localStorage.getItem(ACCOUNT_META_KEY) || "{}"); return (o && typeof o === "object") ? o : {}; } catch (_) { return {}; }
  }
  // Profile pictures (account avatar "p:<sellerId>", dealership logo "d:<sellerId>")
  // live in one small localStorage map so they survive reloads and the chat /
  // seller pages can show them for any seller.
  function mrAvatarMap() { try { const o = JSON.parse(window.localStorage.getItem("mr_avatars_v1") || "{}"); return (o && typeof o === "object") ? o : {}; } catch (_) { return {}; } }
  function mrGetAvatar(kind, id) { return id ? (mrAvatarMap()[kind + ":" + id] || "") : ""; }
  function mrSetAvatar(kind, id, url) {
    if (!id) return;
    const m = mrAvatarMap();
    if (url) m[kind + ":" + id] = url; else delete m[kind + ":" + id];
    try { window.localStorage.setItem("mr_avatars_v1", JSON.stringify(m)); } catch (_) {}
  }
  function sellerAvatarFor(type, id) { return mrGetAvatar(type === "dealer" ? "d" : "p", id) || (type === "dealer" ? demoAvatarForId(id) : ""); }
  // Showroom banner (wide cover photo) — stored under "db:<sellerId>", separate from the profile photo "d:<sellerId>".
  function sellerBannerFor(id) { return mrGetAvatar("db", id) || demoAutoBanner(id); /* بنر انتخابی؛ وگرنه یکی از بنرهای ساخته‌شده (تصادفی و ثابت) */ }
  // A normal account may additionally own ONE dealership ({ name, city }).
  // (Older saves used { type:"dealer", dealerName, dealerCity }; still read.)
  function loadDealership(phone) {
    if (!phone) return null;
    const m = readAccountMetaStore()[phone];
    if (!m || !m.dealerName || m.type === "personal") return null;
    // Approval lives in the shared admin store. Dealerships created before
    // the approval flow existed have no record there and stay approved.
    const rec = MR_STORE.dealer(phone);
    return {
      name: String(m.dealerName), city: String(m.dealerCity || ""), description: String(m.dealerDescription || ""),
      ownerName: rec ? rec.owner : "", address: rec ? rec.address : "",
      status: rec ? rec.status : "approved", why: rec ? (rec.why || "") : "",
      logo: mrGetAvatar("d", sellerIdForPhone(phone)),
      banner: sellerBannerFor(sellerIdForPhone(phone)),
    };
  }
  function saveDealership(phone, d) {
    if (!phone) return;
    const store = readAccountMetaStore();
    if (d) store[phone] = { type: "dealer", dealerName: d.name, dealerCity: d.city || "", dealerDescription: d.description || "" };
    else delete store[phone];
    try { window.localStorage.setItem(ACCOUNT_META_KEY, JSON.stringify(store)); } catch (_) {}
  }
  // Public, non-reversible id used in routes/listings instead of the raw phone.
  function sellerIdForPhone(phone) { return "u" + hashStr(String(phone || "")).toString(36); }
  let state = {
    route: { page: "home" },
    loading: false,
    loadingStage: null,
    pendingRoute: null,
    menuOpen: false,
    buyOpen: false,
    thumb: 0,
    showMorePhotos: false,
    photoViewerOpen: false,
    theme: "light",
    sortOpen: false,
    sort: "newest",
    selectedBrand: null,
    search: "",
    filters: { model: null, city: null, color: null, condition: null, year: null, priceMin: null, priceMax: null, transmission: null, bodyStyle: null },
    filterOpenKey: null,
    toolFiltersOpen: false,
    filterOverlayOpen: false,
    chipDropdownKey: null,
    visibleCount: 12,
    listingsLoadingMore: false,
    activeTab: 0,
    modal: null,
    toast: null,
    menuNavOpen: null,
    account: storedAccount,
    // Optional dealership owned by this (normal) account — see account page.
    dealership: loadDealership(storedAccount),
    // Which panel the last ad was published to ("personal" | "dealer").
    lastPublishAs: "personal",
    sellPanelLock: null, // "dealer" وقتی آگهی از صفحه‌ی خود نمایشگاه شروع شده؛ مرحله‌ی انتخاب پنل نمایش داده نمی‌شود
    authSuccess: false,
    loginStep: "phone",
    loginPhone: "",
    loginReturnTo: null,
    sellForm: { brand: "", year: "", model: "", engineType: "", fuelType: "", transmission: "", interiorColor: "", driveTrain: "", cylinders: "", engineVolume: "", mileageType: "used", deliveryTime: "", video: null, documentType: "", powerOfAttorneyStatus: "", insuranceStatus: "", price: "", miles: "", color: "", trim: "full", city: "", region: "", mapPos: { lat: DEFAULT_MAP_CENTER[0], lng: DEFAULT_MAP_CENTER[1] }, phone: "", description: "", photos: [], damagedParts: [], bodyConditionRating: null, negotiable: false, tradeIn: false, acceptsOffers: false, minPrice: "" },
    listStyle: "compact", // the large card view was removed; the compact card is the only listings layout
    sellStep: 1,
    sellDirection: "forward",
    sellError: null,
    editingListingId: null,
    likedIds: [],
    myListings: [],
    accountTab: "listings",
    accountProfile: { firstName: "", lastName: "", email: "", avatar: null },
    accountEditError: null,
    searchOverlayOpen: false,
    searchOverlayQuery: "",
    searchOverlayLoading: false,
  };
  if (state.account) {
    const _savedAvatar = mrGetAvatar("p", sellerIdForPhone(state.account));
    if (_savedAvatar) state.accountProfile = { ...state.accountProfile, avatar: _savedAvatar };
  }

  let navigateTimer = null;
  let navigateFinishTimer = null;
  let navigationLock = false;
  let listingsScrollObserver = null;
  let listingsLoadMoreTimer = null;
  let searchLiveTimer = null;
  let searchOverlayDebounce = null;
  let searchOverlayLoadingTimer = null;
  let searchOverlayRailTimer = null;
  let searchOverlayRailIndex = 0;
  let searchOverlayRotatorTimer = null;
  let searchOverlayRotatorIndex = 0;
  let searchOverlayPauseUntil = 0;
  let barSearchRotatorTimer = null;
  let barSearchRotatorIndex = 0;

  // ---------------------------------------------------------------
  // BROWSER HISTORY INTEGRATION
  // The app never changed the URL/history, so the mobile back button had
  // nothing internal to go back to and just exited the site entirely.
  // We push one history entry per in-app navigation and restore the route
  // on popstate instead. Only plain, serializable route data goes into
  // history.state (a full listing object is reduced to its id and looked
  // back up on restore).
  // ---------------------------------------------------------------
  let restoringFromHistory = false;

  // The home dashboard is a real route; the all-listings page stays separate.
  function normalizeRoute(route) {
    if (!route || !route.page) return { page: "home" };
    if (route.page === "transparencyCard") return { page: "home" };
    return route;
  }

  // Q&A pages have a shareable address (hash route). Every other page keeps the
  // old behaviour: the URL never changes.
  //   #/qa  #/qa/ask  #/qa/mine  #/qa/q/<questionId>
  function qaHashForRoute(route) {
    if (!route) return null;
    if (route.page === "qa") return "#/qa";
    if (route.page === "qaAsk") return "#/qa/ask";
    if (route.page === "qaMine") return "#/qa/mine";
    if (route.page === "news") return "#/news";
    if (route.page === "newsItem") return "#/news/" + encodeURIComponent(String(route.newsId == null ? "" : route.newsId));
    if (route.page === "qaQuestion") return "#/qa/q/" + encodeURIComponent(String(route.questionId == null ? "" : route.questionId));
    if (route.page === "seller") return "#/seller/" + encodeURIComponent(String(route.sellerId || ""));
    if (route.page === "dealerPublic") return "#/n/" + encodeURIComponent(String(route.slug || ""));
    return null;
  }
  // ---------------------------------------------------------------
  // CLEAN ADDRESSES (path based, real URLs — the server returns index.html for all of them)
  //   /                         home                      /cars            all ads  (/cars?brand=Toyota)
  //   /cars/<adId>              ad page                   /brands/<brand>  brand page
  //   /showrooms                showroom list             /showrooms/<slug> a showroom
  //   /account/<username>       an account (own page, or the public page of that user)
  //   /account/<username>/edit  edit profile              /account/<username>/showroom  edit showroom
  //   /sell  /saved  /my-listings  /messages  /messages/<conversationId>
  //   /news  /news/<newsId>     /qa  /qa/ask  /qa/mine  /qa/<questionId>
  //   /seller/<id>?kind=dealer  fallback public page
  // Old forms keep working: #/seller/<id>, #/n/<slug>, #/news/<id>, #/p/<owner>/<ad> and carma.ir/<owner>/<ad>.
  // The default username is "user-<random 1..99999>", shown as "User-48213" (see backend/migrations/016).
  // ---------------------------------------------------------------
  const RESERVED_FIRST_SEGMENTS = new Set(["account", "cars", "brands", "showrooms", "showroom", "seller", "sell", "saved", "my-listings", "messages", "feed", "news", "qa", "api", "media", "assets", "icons", "images", "logos", "js", "deploy", "admin", "index.html"]);
  const PATH_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  // "user-48213" → "User-48213" (system-assigned ids are stored lower-case; everyone sees them capitalised)
  function prettyHandle(h) { h = String(h || ""); const m = /^user-(\d+)$/i.exec(h); return m ? "User-" + m[1] : h; }
  window.prettyHandle = prettyHandle;
  function myHandle() { try { return String((window.CARMA_AUTH_USER && window.CARMA_AUTH_USER.username) || ""); } catch (_) { return ""; } }
  function isOwnHandle(h) { const me = myHandle(); return !!me && String(h || "").toLowerCase() === me.toLowerCase(); }
  function knownHandleFor(userId) { try { const c = window.CARMA_USER_HANDLES; return (c && c[String(userId)]) || ""; } catch (_) { return ""; } }
  function pathForRoute(route) {
    const e = encodeURIComponent;
    switch (route && route.page) {
      case "home": return "/";
      case "listings": return route.brand && route.brand !== "all" ? "/cars?brand=" + e(route.brand) : "/cars";
      case "vehicle": { const id = route.listingId != null ? route.listingId : (route.listing && route.listing.id); return id != null ? "/cars/" + e(id) : "/cars"; }
      case "brand": return route.brand && route.brand !== "all" ? "/brands/" + e(route.brand) : "/cars";
      case "dealers": return "/showrooms";
      case "dealerPublic": return route.slug ? "/showrooms/" + e(route.slug) : "/showrooms";
      case "seller": {
        if (route.kind === "dealer") return "/seller/" + e(route.sellerId || "") + "?kind=dealer";
        const h = route.handle || knownHandleFor(route.sellerId);
        if (route.sellerId && window.CARMA_AUTH_USER && String(window.CARMA_AUTH_USER.id) === String(route.sellerId) && myHandle()) return "/account/" + e(prettyHandle(myHandle()));
        return "/account/" + e(prettyHandle(h || route.sellerId || ""));
      }
      case "account": { const h = route.handle || myHandle(); return h ? "/account/" + e(prettyHandle(h)) : "/account"; }
      case "accountEdit": { const h = myHandle(); return (h ? "/account/" + e(prettyHandle(h)) : "/account") + "/edit"; }
      case "dealershipEdit": { const h = myHandle(); return (h ? "/account/" + e(prettyHandle(h)) : "/account") + "/showroom"; }
      case "sell": return "/sell";
      case "saved": return "/saved";
      case "manageListings": return "/my-listings";
      case "messages": return "/messages";
      case "feed": return "/feed";
      case "conversation": return route.conversationId ? "/messages/" + e(route.conversationId) : "/messages";
      case "news": return "/news";
      case "newsItem": return route.newsId != null && route.newsId !== "" ? "/news/" + e(route.newsId) : "/news";
      case "qa": return "/qa";
      case "qaAsk": return "/qa/ask";
      case "qaMine": return "/qa/mine";
      case "qaQuestion": return route.questionId != null ? "/qa/" + e(route.questionId) : "/qa";
      default: return "/";
    }
  }
  // Reverse of pathForRoute(). Returns null when the path is not one of ours (→ caller falls back to the old forms).
  function routeFromPath(pathname, search) {
    const dec = (v) => { try { return decodeURIComponent(v); } catch (_) { return ""; } };
    const parts = String(pathname || "/").split("/").filter(Boolean).map(dec);
    if (!parts.length) return null;
    const q = new URLSearchParams(search || "");
    const [a, b, c] = parts;
    switch (a) {
      case "cars": if (parts.length === 1) return { page: "listings", brand: q.get("brand") || "all" }; return b ? { page: "vehicle", listingId: b } : null;
      case "brands": return b ? { page: "brand", brand: b } : { page: "listings", brand: "all" };
      case "showrooms": return b ? { page: "dealerPublic", slug: b } : { page: "dealers" };
      case "showroom": return b ? { page: "dealerPublic", slug: b } : { page: "dealers" };
      case "seller": return b ? { page: "seller", sellerId: b, ...(q.get("kind") === "dealer" ? { kind: "dealer" } : {}) } : null;
      case "account":
        if (!b) return { page: "account" };
        if (b === "edit") return { page: "accountEdit" };
        if (b === "showroom") return { page: "dealershipEdit" };
        if (c === "edit") return { page: "accountEdit" };
        if (c === "showroom") return { page: "dealershipEdit" };
        return { page: "account", handle: b };
      case "sell": return { page: "sell" };
      case "saved": return { page: "saved" };
      case "my-listings": return { page: "manageListings" };
      case "messages": return b ? { page: "conversation", conversationId: b } : { page: "messages" };
      case "feed": return { page: "feed" };
      case "news": return b ? { page: "newsItem", newsId: b } : { page: "news" };
      case "qa": if (b === "ask") return { page: "qaAsk" }; if (b === "mine") return { page: "qaMine" }; return b ? { page: "qaQuestion", questionId: b } : { page: "qa" };
      default: return null;
    }
  }
  // Keep the address bar in sync for pages whose path depends on data that arrives late (the account's username).
  function syncCanonicalUrl() {
    try {
      if (!/^https?:$/.test(location.protocol) || !state || !state.route) return;
      const pg = state.route.page;
      if (pg !== "account" && pg !== "accountEdit" && pg !== "dealershipEdit" && pg !== "seller") return;
      const want = pathForRoute(state.route), cur = location.pathname + location.search;
      if (want !== cur && decodeURI(want) !== decodeURI(cur)) history.replaceState(history.state, "", want);
    } catch (_) {}
  }
  window.syncCanonicalUrl = syncCanonicalUrl;
  // /account/<username> of somebody else → find that user (cached) and turn the route into their public page.
  // Returns true when the route was replaced synchronously (caller should re-read state.route).
  function resolveAccountHandleRoute() {
    const r = state.route;
    if (!r || r.page !== "account" || !r.handle || isOwnHandle(r.handle)) return false;
    const h = String(r.handle), key = h.toLowerCase();
    const ids = (window.CARMA_HANDLE_IDS = window.CARMA_HANDLE_IDS || {});
    const toSeller = (id) => { state = { ...state, route: { page: "seller", sellerId: id, handle: h } }; return true; };
    if (PATH_UUID_RE.test(h)) return toSeller(h);
    if (ids[key]) return toSeller(ids[key]);
    if (ids[key] === null || !(window.CARMA_API && window.CARMA_API.enabled && window.CARMA_API.social && window.CARMA_API.social.byUsername)) {
      state = { ...state, route: { page: "seller", sellerId: "__missing_user__", handle: h } }; return true;   // → "page not found" card
    }
    if (!ids.__pending) ids.__pending = {};
    if (!ids.__pending[key]) {
      ids.__pending[key] = true;
      window.CARMA_API.social.byUsername(h).then((res) => {
        const u = res && res.user;
        ids[key] = u && u.id ? String(u.id) : null;
        if (u && u.id) { window.CARMA_USER_HANDLES = window.CARMA_USER_HANDLES || {}; if (u.username) window.CARMA_USER_HANDLES[String(u.id)] = String(u.username); window.CARMA_SERVER_USERS = window.CARMA_SERVER_USERS || {}; window.CARMA_SERVER_USERS[String(u.id)] = u; }
      }).catch((err) => { if (err && err.status === 404) ids[key] = null; })
        .then(() => { delete ids.__pending[key]; const cur = state.route; if (cur && cur.page === "account" && String(cur.handle || "").toLowerCase() === key && typeof render === "function") render(); });
    }
    return false;
  }
  window.resolveAccountHandleRoute = resolveAccountHandleRoute;
  window.isOwnAccountHandle = isOwnHandle;

  function routeFromHash(hash) {
    const h = String(hash == null ? location.hash : hash);
    let m;
    // Clean path addresses (/account/User-48213, /news/…, /cars/…)
    if (hash == null && h === "") { const pr = routeFromPath(location.pathname, location.search); if (pr) return pr; }
    // Q&A disabled (temporary): #/qa* addresses are ignored (fall back to home).
    if (h === "#/qa" || h.indexOf("#/qa/") === 0) return null;
    if (h === "#/news" || h === "#/news/") return { page: "news" };
    if ((m = /^#\/news\/([^/]+)\/?$/.exec(h))) { let id = m[1]; try { id = decodeURIComponent(id); } catch (_) { id = ""; } return id ? { page: "newsItem", newsId: id } : { page: "news" }; }
    if ((m = /^#\/seller\/([^/]*)$/.exec(h))) { let id = m[1]; try { id = decodeURIComponent(id); } catch (_) { id = ""; } return { page: "seller", sellerId: id }; }
    if ((m = /^#\/n\/([^/]*)$/.exec(h))) { let slug = m[1]; try { slug = decodeURIComponent(slug); } catch (_) { slug = ""; } return { page: "dealerPublic", slug }; }
    // Ad link (hash form, works on any static host):  #/p/<owner>/<postId>
    if ((m = /^#\/p\/([^/]*)\/([^/]+)\/?$/.exec(h))) { let id = m[2]; try { id = decodeURIComponent(id); } catch (_) { id = ""; } return id ? { page: "vehicle", listingId: id } : null; }
    // Ad link (pretty form):  carma.ir/<owner>/<postId>  — needs the host to serve index.html for it (see README_POST_LINKS_FA.txt)
    if (hash == null) {
      const pm = /^\/([^/.]+)\/([^/.]+)\/?$/.exec(location.pathname);
      if (pm && h === "" && !RESERVED_FIRST_SEGMENTS.has(pm[1].toLowerCase())) { let id = pm[2]; try { id = decodeURIComponent(id); } catch (_) { id = ""; } return id ? { page: "vehicle", listingId: id } : null; }
    }
    return null;
  }
  // URL to store with a history entry for `route` (clean path; see pathForRoute).
  function urlForRoute(route) {
    route = normalizeRoute(route);
    if (!/^https?:$/.test(location.protocol)) return location.href;   // file:// preview: keep the address as is
    return pathForRoute(route);
  }

  function serializeRoute(route) {
    route = normalizeRoute(route);
    if (route.page === "vehicle" && route.listing) {
      return { page: "vehicle", listingId: route.listing.id };
    }
    const out = { page: route.page };
    if (route.questionId !== undefined) out.questionId = route.questionId;
    if (route.listingId !== undefined) out.listingId = route.listingId;
    if (route.brand !== undefined) out.brand = route.brand;
    if (route.sellerId !== undefined) out.sellerId = route.sellerId;
    if (route.kind !== undefined) out.kind = route.kind;
    if (route.slug !== undefined) out.slug = route.slug;
    if (route.conversationId !== undefined) out.conversationId = route.conversationId;
    if (route.handle !== undefined) out.handle = route.handle;
    if (route.newsId !== undefined) out.newsId = route.newsId;
    return out;
  }

  function resolveRoute(raw) {
    raw = normalizeRoute(raw);
    if (raw.page === "vehicle") {
      const listing = LISTINGS.find((l) => l.id === raw.listingId);
      return listing ? { page: "vehicle", listing } : { page: "listings", brand: "all" };
    }
    return raw;
  }

  function restoreRouteFromHistory(raw) {
    if (navigateTimer) { clearTimeout(navigateTimer); navigateTimer = null; }
    if (navigateFinishTimer) { clearTimeout(navigateFinishTimer); navigateFinishTimer = null; }
    navigationLock = false;
    document.documentElement.classList.remove("is-navigating");
    state = {
      ...state,
      route: resolveRoute(raw),
      loading: false,
      loadingStage: null,
      pendingRoute: null,
      menuOpen: false,
      modal: null,
      modalClosing: false,
    };
    window.scrollTo(0, 0);
    render();
  }

  window.addEventListener("popstate", (e) => {
    // Story viewer: its own history entry absorbs "back" (the viewer closes, the page stays put).
    if (window.__mrSkipPop) { window.__mrSkipPop = false; return; }
    if (window.__mrStoryHist || window.__mrAttachHist) return;
    restoringFromHistory = true;
    restoreRouteFromHistory((e.state && e.state.marqueRoute) || routeFromHash());
    restoringFromHistory = false;
  });

  // Render patching helpers. Static page chrome lives in index.html; only dynamic regions are patched.
  function navigateTo(route, extraState, opts) {
    route = normalizeRoute(route);
    if (listingsScrollObserver) { listingsScrollObserver.disconnect(); listingsScrollObserver = null; }
    if (listingsLoadMoreTimer) { clearTimeout(listingsLoadMoreTimer); listingsLoadMoreTimer = null; }
    if (!restoringFromHistory) {
      try { history.pushState({ marqueRoute: serializeRoute(route) }, "", urlForRoute(route)); } catch (_) {}
    }
    if (navigateTimer) { clearTimeout(navigateTimer); navigateTimer = null; }
    if (navigateFinishTimer) { clearTimeout(navigateFinishTimer); navigateFinishTimer = null; }

    /*
     * Navigation must not impose an artificial full-page skeleton delay.
     * All route renderers build their page synchronously, and data-backed
     * sections (Q&A, messages, etc.) already own their local loading states.
     * The old flow replaced the whole page with a skeleton for a fixed 1000ms
     * on every navigation, even when no wait was necessary. That made repeat
     * browsing tiring and hid already-available content.
     *
     * Render the destination immediately. Keep page-specific skeletons for
     * genuine async work; never blank the whole page just to animate a route.
     */
    navigationLock = false;
    document.documentElement.classList.remove("is-navigating");
    window.scrollTo(0, 0);
    state = {
      ...state,
      ...(extraState || {}),
      route,
      loading: false,
      loadingStage: null,
      pendingRoute: null,
    };
    render();
  }

  // FIX: uploaded photos come in whatever aspect ratio the seller's phone
  // produced (often a tall portrait screenshot, not the ~3:2 a car photo
  // usually is). Every card/thumbnail box on the site is a FIXED size —
  // it never grows or shrinks to match the photo. `fit` controls how the
  // photo fills that fixed box: "cover" (default, used by every card/grid/
  // thumbnail) crops the photo to completely fill the box with no empty
  // margin, so a tall or wide photo never looks different from a normal
  // one. "contain" (used only for the vehicle detail page's big hero
  // photo, where seeing the whole uncropped photo matters more than a
  // uniform box) letterboxes instead of cropping.
  function vehiclePhotoMarkup(listing, index = 0, cls = "", fit = "cover") {
    const photos = Array.isArray(listing.photos) ? listing.photos.filter(Boolean) : [];
    if (photos[index]) {
      const safe = String(photos[index]).replace(/"/g, '&quot;');
      return `<img src="${safe}" alt="عکس خودرو" class="${cls}" loading="lazy" referrerpolicy="no-referrer"${fit === "cover" ? " data-smart-photo" : ""} style="object-fit:${fit};display:block;width:100%;height:100%;" />`;
    }
    return carGlyphSVG(listing.color, cls, index, listing.id || listing.title || "vehicle");
  }

  function vehiclePhotoCount(listing) {
    const n = Array.isArray(listing.photos) ? listing.photos.filter(Boolean).length : 0;
    return n || 6;
  }

  function detailFact(iconName, label, value, swatchColor) {
    const badge = swatchColor
      ? `<div class="detail-fact-icon detail-fact-swatch" style="background:${swatchColor}"></div>`
      : `<div class="detail-fact-icon">${icon(iconName,{width:'15',height:'15'})}</div>`;
    return `<div class="detail-fact">${badge}<div class="detail-fact-value">${value ?? "—"}</div><div class="detail-fact-label">${label}</div></div>`;
  }

  function detailFeature(iconName, text) {
    return `<div class="detail-feature">${icon(iconName,{width:"16",height:"16",strokeWidth:"1.8"})}<span>${text}</span></div>`;
  }

  function detailSpecGroup(title, rows) {
    return `<div class="detail-spec-group"><h3>${title}</h3><div class="detail-spec-table">${rows.map(([k,v])=>`<div class="detail-spec-row"><span>${k}</span><b>${v ?? "—"}</b></div>`).join("")}</div></div>`;
  }

  function renderVehicleTabsInto(root, listing, specs, tabNames) {
    // This area is deliberately dedicated to body condition only. Description
    // and vehicle specifications have their own sections elsewhere on the page.
    const tabContent = root.querySelector('[data-slot="tab-content"]');
    if (!tabContent) return;

    const paintedParts = Array.isArray(listing.paintedParts) ? listing.paintedParts : [];
    const knownPaintedParts = paintedParts.filter(d => CAR_PANELS.some(p => p.key === d.key));
    const paintText = knownPaintedParts.length
      ? knownPaintedParts.map(d => {
          const p = CAR_PANELS.find(x => x.key === d.key);
          const info = partStatusInfo(d.status);
          return p ? `${p.label} (${info ? info.label : '—'})` : '';
        }).filter(Boolean).join('، ')
      : 'طبق اطلاعات ثبت‌شده، موردی برای رنگ یا تعویض بدنه اعلام نشده است.';
    const paintTags = knownPaintedParts.map(d => {
      const p = CAR_PANELS.find(x => x.key === d.key);
      const info = partStatusInfo(d.status);
      if (!p) return '';
      const color = info && /^#[0-9a-f]{3,8}$/i.test(info.color || '') ? info.color : '#888888';
      return `<span class="bc-chip" style="--bc-color:${color}">${escHtml(p.label)} · ${escHtml(info ? info.label : 'ثبت نشده')}</span>`;
    }).join('');

    tabContent.innerHTML = `
      <section class="bc-panel">
        <div class="bc-sheet">
          ${carPanelDiagramSVG(knownPaintedParts, false)}
        </div>
        <div class="bc-chips">${paintTags || '<span class="bc-chip is-clear">موردی برای رنگ یا تعویض بدنه ثبت نشده</span>'}</div>
      </section>`;

    // The map is a separate page section, not a tab. Keep it populated after
    // removing the old description/specification/body-condition tab switcher.
    const mapSlot = root.querySelector('[data-slot="detail-map"]');
    // v2 layout: the map lives in the third tab; the tab switcher builds it when that tab opens.
    if (mapSlot && (!root.querySelector('#vx-p3') || root.querySelector('#vx-p3.on'))) renderVehicleMapInto(root, listing, specs);
  }

  // Renders the small, LOCKED preview map on the vehicle detail page using
  // real OpenStreetMap tiles via Leaflet. It never plots the seller's real
  // point: a deterministic jitter (seeded by the listing id) offsets the
  // marker by a couple of kilometers, and a translucent circle communicates
  // "approximate area" — the exact-location text next to it stays accurate.
  // The location map is its own block at the very bottom of the vehicle page
  // (below the tab panels), but belongs to the "توضیحات" tab: it is filled
  // only while that tab is active and cleared on the other tabs.
  function renderVehicleMapInto(root, listing, specs) {
    const slot = root.querySelector('[data-slot="detail-map"]');
    if (!slot) return;
    slot.innerHTML = `
      <div class="vmap">
        <div class="vmap-canvas" data-slot="detailMapEl" data-map-for="${escHtml(listing.id)}"></div>
        <div class="vmap-panel">
          <div class="vmap-panel-text">
            <strong>${escHtml(specs.dealer.city)}</strong>
            <span>${listing.region ? `منطقه ${escHtml(listing.region)} · ` : ''}محدوده تقریبی خودرو</span>
            <small>موقعیت دقیق برای حفظ حریم خصوصی نمایش داده نمی‌شود؛ آدرس پس از هماهنگی با فروشنده اعلام می‌شود.</small>
          </div>
          <button type="button" class="vmap-cta" data-action="openContactSeller" data-id="${escHtml(listing.id)}">تماس با فروشنده</button>
        </div>
      </div>`;
    requestAnimationFrame(() => {
      if (typeof L !== "undefined" && L && typeof L.map === "function") {
        initDetailMap(slot, listing, specs);
        return;
      }
      // The detail map is below the fold and only exists in the active description tab.
      // Do not fetch Leaflet on home/listing pages; request it only when this map is rendered.
      if (typeof window.CARMA_LOAD_LEAFLET !== "function") return;
      window.CARMA_LOAD_LEAFLET().then((loaded) => {
        if (!loaded || !slot.isConnected) return;
        if (state.route?.page === "vehicle" && String(state.route.listing?.id) === String(listing.id)) {
          initDetailMap(slot, listing, specs);
        }
      });
    });
  }

  function initDetailMap(scopeEl, listing, specs) {
    const el = scopeEl.querySelector('[data-slot="detailMapEl"]');
    if (!el || typeof L === "undefined" || !L || typeof L.map !== "function") return;
    const base = (listing.mapPos && typeof listing.mapPos.lat === "number")
      ? [listing.mapPos.lat, listing.mapPos.lng]
      : cityCoords(specs.dealer.city);
    const [dLat, dLng] = seededOffset(String(listing.id || specs.stock || ""), 0.02);
    const center = [base[0] + dLat, base[1] + dLng];
    const map = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
      touchZoom: false,
    }).setView(center, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    L.circle(center, { radius: 1500, color: "#e7eaed", weight: 1, fillColor: "#e7eaed", fillOpacity: 0.15, className: "map-privacy-circle" }).addTo(map);
    L.marker(center, { icon: leafletPinIcon(), interactive: false }).addTo(map);
    const credit = document.createElement("div");
    credit.className = "leaflet-osm-credit";
    credit.textContent = "© OpenStreetMap";
    el.appendChild(credit);
    registerLeafletMap(map);
    requestAnimationFrame(() => map.invalidateSize());
  }

  function updateVehicleTabs() {
    // Refreshes the body-condition report without rebuilding the hero image,
    // thumbnails or the rest of the vehicle page.
    if (state.route.page !== "vehicle" || !state.route.listing) return;
    const section = document.querySelector('#pageContent [data-page="vehicle"]');
    if (!section) return;
    const listing = state.route.listing;
    const specs = buildVehicleSpecs(listing);
    renderVehicleTabsInto(section, listing, specs, []);
  }

  function updateVehiclePhoto() {
    // FIX: switching photos used to call the full render(), which tears down
    // and rebuilds the ENTIRE vehicle page (specs, tabs, similar listings,
    // everything) just to change one image. That full rebuild is what caused
    // the visible page jump/reload feeling on every photo change. This only
    // touches the hero image, the counter, and the thumbnail borders.
    if (state.route.page !== "vehicle" || !state.route.listing) return;
    const section = document.querySelector('#pageContent [data-page="vehicle"]');
    if (!section) return;
    const listing = state.route.listing;
    const thumb = state.thumb;
    const totalPhotos = vehiclePhotoCount(listing);
    const countEl = section.querySelector('[data-slot="photo-count"]');
    if (countEl) countEl.textContent = `${faNum(thumb + 1)} / ${faNum(totalPhotos)}`;
    const miniCount = section.querySelector('[data-slot="photo-count-mini"]');
    if (miniCount) miniCount.textContent = `${faNum(totalPhotos)} تصویر`;
    const heroSlot = section.querySelector('[data-slot="hero"]');
    if (heroSlot) setDynamicHTML(heroSlot, vehiclePhotoMarkup(listing, thumb, "hero-photo", "cover"));
    section.querySelectorAll('[data-slot="thumbs"] .thumb[data-index]').forEach((button) => {
      button.classList.toggle('active', Number(button.dataset.index) === thumb);
    });
    // keep the selected thumbnail centred in the horizontal rail (rail only; the page doesn't jump)
    const activeThumb = section.querySelector('[data-slot="thumbs"] .thumb.active');
    const rail = activeThumb && activeThumb.parentElement;
    if (rail) {
      const a = activeThumb.getBoundingClientRect(), r = rail.getBoundingClientRect();
      rail.scrollBy({ left: a.left + a.width / 2 - (r.left + r.width / 2), behavior: "smooth" });
    }
    if (state.photoViewerOpen) updatePhotoViewer();
  }

  // Full-screen photo viewer: opened by tapping the hero photo, navigated
  // with the same prevPhoto/nextPhoto/setThumb actions the hero strip uses
  // (single source of truth for the current photo index is state.thumb).
  function updatePhotoViewer() {
    const viewer = document.getElementById("vehiclePhotoViewer");
    if (!viewer) return;
    const open = !!state.photoViewerOpen && state.route.page === "vehicle" && !!state.route.listing;
    if (open) {
      const listing = state.route.listing;
      const thumb = state.thumb;
      const total = vehiclePhotoCount(listing);
      const stage = viewer.querySelector("#photoViewerStage");
      if (stage) setDynamicHTML(stage, vehiclePhotoMarkup(listing, thumb, "photo-viewer-image", "contain"));
      const counter = viewer.querySelector("#photoViewerCounter");
      if (counter) counter.textContent = `${thumb + 1} / ${total}`;
      const prevBtn = viewer.querySelector(".photo-viewer-prev");
      const nextBtn = viewer.querySelector(".photo-viewer-next");
      if (prevBtn) prevBtn.hidden = total <= 1;
      if (nextBtn) nextBtn.hidden = total <= 1;
      viewer.hidden = false;
      document.documentElement.classList.add("photo-viewer-open");
      requestAnimationFrame(() => viewer.classList.add("is-open"));
    } else {
      viewer.classList.remove("is-open");
      document.documentElement.classList.remove("photo-viewer-open");
      setTimeout(() => { if (!state.photoViewerOpen) viewer.hidden = true; }, 220);
    }
  }

  function updateVehicleMorePhotos() {
    if (state.route.page !== "vehicle" || !state.route.listing) return;
    const section = document.querySelector('#pageContent [data-page="vehicle"]');
    if (!section) return;
    const listing = state.route.listing;
    const totalPhotos = vehiclePhotoCount(listing);
    const moreWrap = section.querySelector('[data-slot="thumbs-more"]');
    const show = !!state.showMorePhotos;
    if (moreWrap) {
      if (show && !moreWrap.childElementCount) {
        for (let i = 4; i < totalPhotos; i++) {
          const t = mountTemplate("tpl-vehicle-thumb");
          t.dataset.index = i;
          t.classList.add(i === state.thumb ? "border-violet-400" : "border-transparent");
          setDynamicHTML(t.querySelector('[data-slot="image"]'), vehiclePhotoMarkup(listing, i, "w-full h-full block"));
          moreWrap.appendChild(t);
        }
      }
      moreWrap.hidden = !show;
    }
    const moreLabel = section.querySelector('[data-slot="more-label"]');
    if (moreLabel) moreLabel.textContent = show ? "بستن" : "+25";
  }

  let toastTimer = null;
  let toastExitTimer = null;
  // FIX (perf): toasts are a self-contained overlay — updateToastUI() just
  // toggles text/visibility on the existing #toastMessage element. This
  // used to call the full render() three times per toast (show, start
  // leaving, remove), which meant every toast — and toasts fire constantly
  // (copy-link, filters cleared, "به‌زودی" menu taps, listing submitted,
  // logout, etc.) — silently rebuilt the whole current page, cards
  // included, three times over ~2.9s. Swapping in updateToastUI() makes
  // toasts free of any page/card impact.
  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    if (toastExitTimer) clearTimeout(toastExitTimer);
    state = { ...state, toast: message, toastLeaving: false };
    updateToastUI();
    toastTimer = setTimeout(() => {
      state = { ...state, toastLeaving: true };
      updateToastUI();
      toastExitTimer = setTimeout(() => {
        toastExitTimer = null;
        state = { ...state, toast: null, toastLeaving: false };
        updateToastUI();
      }, 300);
    }, 2600);
  }

  // Listings expire 30 days after registration: they disappear from the
  // public lists and the owner's copy is marked "expired".
  function purgeExpiredListings() {
    let changed = false;
    for (let i = LISTINGS.length - 1; i >= 0; i--) {
      if (isListingObjExpired(LISTINGS[i])) { LISTINGS.splice(i, 1); changed = true; }
    }
    if (Array.isArray(state.myListings) && state.myListings.some((m) => m.status === "listed" && isListingObjExpired(m.listing))) {
      state = { ...state, myListings: state.myListings.map((m) => (m.status === "listed" && isListingObjExpired(m.listing) ? { ...m, status: "expired" } : m)) };
      changed = true;
    }
    return changed;
  }
  setInterval(() => { try { if (purgeExpiredListings() && typeof render === "function") render(); } catch (_) {} }, 60000);

  function promoteListing(id) {
    const entry = state.myListings.find((m) => m.id === id);
    if (!entry || entry.status !== "pending") return;
    LISTINGS.unshift(entry.listing);
    state = { ...state, myListings: state.myListings.map((m) => (m.id === id ? { ...m, status: "listed" } : m)) };
    showToast("آگهی شما اکنون منتشر شد!");
  }

  // Deletes one of the owner's own listings — used by the "مدیریت آگهی"
  // sheet's حذف row. myListings entries always share their id with the
  // underlying listing object (see the sell-form submit handler), so the
  // same id doubles as the LISTINGS/likedIds/listingStatsCache key.
  // Server-backed listings are deleted on the server too. Otherwise the next refresh brings the ad
  // back. The server call is held until the undo bar runs out, so "Undo" never has to resurrect
  // something that was already archived.
  const PENDING_SERVER_DELETES = new Set();
  window.CARMA_PENDING_DELETES = PENDING_SERVER_DELETES;
  const LISTING_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function commitServerDelete(id, keepalive) {
    if (!PENDING_SERVER_DELETES.has(id)) return;
    const api = window.CARMA_API;
    if (!api || !api.enabled) { PENDING_SERVER_DELETES.delete(id); return; }
    const req = keepalive ? api.request("/listings/" + encodeURIComponent(id), { method: "DELETE", keepalive: true }) : api.listings.remove(id);
    Promise.resolve(req).then(() => { PENDING_SERVER_DELETES.delete(id); }).catch((err) => {
      PENDING_SERVER_DELETES.delete(id);
      if (err && err.status === 404) return; // already gone on the server
      try { showToast("حذف آگهی روی سرور انجام نشد؛ لیست دوباره به‌روز می‌شود."); } catch (_) {}
      Promise.resolve().then(async () => {
        await window.CARMA_MARKETPLACE?.syncPublicListings?.();
        await window.CARMA_MARKETPLACE?.syncMyListings?.();
        if (typeof render === "function") render();
      }).catch(() => {});
    });
  }
  window.addEventListener("pagehide", () => { Array.from(PENDING_SERVER_DELETES).forEach((id) => commitServerDelete(id, true)); });

  function deleteMyListing(id) {
    const entry = state.myListings.find((m) => m.id === id);
    if (!entry) return;
    const onServer = !!(window.CARMA_API && window.CARMA_API.enabled && LISTING_UUID_RE.test(String(id)));
    if (onServer) PENDING_SERVER_DELETES.add(id);
    const idx = LISTINGS.findIndex((l) => l.id === id);
    // snapshot everything the delete touches so the undo bar can put it all back
    const snap = {
      id, entry,
      myIdx: state.myListings.findIndex((m) => m.id === id),
      listing: idx !== -1 ? LISTINGS[idx] : null, listingIdx: idx,
      store: (() => { try { return MR_STORE.read().entries[id] || null; } catch (_) { return null; } })(),
      stats: mrStats[id] ? JSON.parse(JSON.stringify(mrStats[id])) : null,
      liked: state.likedIds.includes(id), likedIdx: state.likedIds.indexOf(id),
    };
    if (idx !== -1) LISTINGS.splice(idx, 1);
    MR_STORE.remove(id);
    if (listingStatsCache[id]) delete listingStatsCache[id];
    mrStatsDrop(id);
    state = {
      ...state,
      myListings: state.myListings.filter((m) => m.id !== id),
      likedIds: state.likedIds.filter((x) => x !== id),
    };
    if (window.CM_UNDO_DELETE) window.CM_UNDO_DELETE.show({
      text: "آگهی حذف شد",
      onUndo: () => { PENDING_SERVER_DELETES.delete(id); restoreMyListing(snap); },
      onExpire: () => { if (onServer) commitServerDelete(id); },
    });
    else { showToast("آگهی حذف شد."); if (onServer) commitServerDelete(id); }
  }

  // Undo of deleteMyListing — puts the ad back in the same place everywhere.
  function restoreMyListing(snap) {
    if (!snap || state.myListings.some((m) => m.id === snap.id)) return;
    if (snap.store) MR_STORE.edit((d) => { d.entries[snap.id] = snap.store; });
    if (snap.listing && !LISTINGS.some((l) => l.id === snap.id)) LISTINGS.splice(Math.max(0, Math.min(snap.listingIdx, LISTINGS.length)), 0, snap.listing);
    if (snap.stats) { mrStats[snap.id] = snap.stats; mrStatsSave(); }
    const mine = state.myListings.slice();
    mine.splice(Math.max(0, Math.min(snap.myIdx, mine.length)), 0, snap.entry);
    let liked = state.likedIds;
    if (snap.liked && !liked.includes(snap.id)) { liked = liked.slice(); liked.splice(Math.max(0, Math.min(snap.likedIdx, liked.length)), 0, snap.id); }
    state = { ...state, myListings: mine, likedIds: liked };
    if (typeof render === "function") render();
    showToast("آگهی بازگردانی شد.");
  }

  // ---------------------------------------------------------------
  // SELLERS — every listing is either a personal seller or a dealership.
  //   • sellerType "dealer"  → user account that registered as a showroom
  //   • privateSeller w/o it → personal seller (also all older listings)
  //   • seed listings        → the brand's authorized dealership (DEALERS)
  // Dealerships get a public page listing all of their ads (route "seller").
  // ---------------------------------------------------------------
  function listingSeller(l) {
    if (l.sellerType === "dealer" && l.sellerId) {
      return { type: "dealer", id: l.sellerId, name: l.sellerName || "نمایشگاه", city: l.city || "" };
    }
    if (l.privateSeller) return { type: "personal", id: l.sellerId || null, name: "فروشنده شخصی", city: l.city || "" };
    const d = dealerFor(l.brand);
    return { type: "dealer", id: "brand:" + l.brand, name: d.name, city: d.city };
  }

  function sellerProfileById(id, kind) {
    const p = sellerProfileByIdBase(id, kind);
    const d = p && p.type === "dealer" ? demoShowroomById(id) : null;
    if (!d) return p;
    // نمایشگاه‌های نمایشی: نام، شهر، آدرس و توضیح فرضی؛ تأییدشده و با بنر
    return { ...p, name: d.name, city: d.city, address: String(d.address || "").replace(new RegExp("^" + d.city + "[،,]\\s*"), ""), description: d.description, hours: d.hours, since: d.since, tagline: d.tagline, verified: true, logo: p.logo || demoAvatarFor(d), banner: sellerBannerFor(id) };
  }
  function sellerProfileByIdBase(id, kind) {
    const apiShowroom = (window.CARMA_SERVER_SHOWROOMS || []).find((s) => String(s.id) === String(id));
    if (apiShowroom) {
      const listings = LISTINGS.filter((l) => String(l.showroomId || l.showroom_id || "") === String(id));
      return { type: "dealer", id: String(apiShowroom.id), name: String(apiShowroom.name || "نمایشگاه"), city: String(apiShowroom.city || ""), address: String(apiShowroom.address || ""), description: String(apiShowroom.description || ""), verified: apiShowroom.status === "approved", logo: String(apiShowroom.logo_url || ""), banner: String(apiShowroom.banner_url || ""), listings };
    }
    const listings = LISTINGS.filter((l) => { const s = listingSeller(l); return s.type === "dealer" && s.id === id; });
    if (listings.length) {
      const s = listingSeller(listings[0]);
      const withCity = listings.find((l) => l.city);
      const first = listings[0];
      const own = state.account && sellerIdForPhone(state.account) === id ? state.dealership : null;
      return { ...s, city: s.city || (withCity ? withCity.city : ""), address: (first && first.sellerAddress) || (own && own.address) || "", description: (first && first.sellerDescription) || (own && own.description) || "", phone: (first && first.phone) || (own && state.account) || "", verified: !!((first && first.sellerVerified === true) || (own && own.status === "approved")), logo: sellerAvatarFor("dealer", id), listings };
    }
    // The owner's approved dealership wins over their personal ads (both share the same seller id), so the
    // "صفحه نمایشگاه" button and showroom sharing never land on the personal-seller page.
    // Links that really mean the personal page pass kind === "personal".
    {
      const od = state.dealership;
      if (kind !== "personal" && od && state.account && sellerIdForPhone(state.account) === id && (kind === "dealer" || od.status === "approved")) {
        return { type: "dealer", id, name: od.name || "نمایشگاه", city: od.city || "", address: od.address || "", description: od.description || "", phone: state.account, verified: od.status === "approved", logo: od.logo || "", listings: [] };
      }
    }
    // Personal (non-dealer) sellers: a simple page with their ads.
    if (id && !String(id).startsWith("brand:")) {
      const mine = LISTINGS.filter((l) => l.sellerId === id && l.sellerType !== "dealer" && (l.privateSeller || l.sellerType === "personal"));
      if (mine.length) {
        const withCity = mine.find((l) => l.city);
        const su0 = window.CARMA_SERVER_USERS && window.CARMA_SERVER_USERS[String(id)]; // SU-FIX
        return { type: "personal", id, name: (su0 && su0.display_name) || "فروشنده شخصی", city: withCity ? withCity.city : "", listings: mine, logo: (su0 && su0.avatar_url) || "" };
      }
    }
    // The owner's own dealership page, before any ad has been published.
    const d = state.dealership;
    if (d && state.account && sellerIdForPhone(state.account) === id) {
      return { type: "dealer", id, name: d.name || "نمایشگاه", city: d.city || "", address: d.address || "", description: d.description || "", phone: state.account, verified: d.status === "approved", logo: d.logo || "", listings: [] };
    }
    // A real account has a public page whether or not it currently has published ads and whether or not
    // the visitor is logged in: use the public user record fetched from the server (GET /social/users/:id).
    const su = kind !== "dealer" && window.CARMA_SERVER_USERS && window.CARMA_SERVER_USERS[String(id)];
    if (su) {
      const owned = LISTINGS.filter((l) => String(l.sellerId || l.ownerId || l.owner_id || "") === String(id) && l.sellerType !== "dealer");
      return { type: "personal", id: String(id), name: su.display_name || "کاربر", city: "", listings: owned, logo: su.avatar_url || "" };
    }
    return null;
  }

  // Seller fields stamped on a listing: published from the dealership panel
  // ("dealer") when the account has one, otherwise the personal panel.
  function currentSellerFields(publishAs) {
    const d = state.dealership;
    if (publishAs === "dealer" && d && d.status === "approved" && state.account) {
      return { sellerType: "dealer", sellerId: sellerIdForPhone(state.account), sellerName: d.name || "نمایشگاه", sellerAddress: d.address || "", sellerDescription: d.description || "", sellerVerified: d.status === "approved" };
    }
    return { sellerType: "personal", sellerId: state.account ? sellerIdForPhone(state.account) : null };
  }

  // Editing keeps the seller the ad was published under.
  function keptSellerFields(listing) {
    if (listing && listing.sellerType) {
      const out = { sellerType: listing.sellerType, sellerId: listing.sellerId || null };
      if (listing.sellerName) out.sellerName = listing.sellerName;
      if (listing.sellerAddress) out.sellerAddress = listing.sellerAddress;
      if (listing.sellerDescription) out.sellerDescription = listing.sellerDescription;
      if (listing.sellerVerified !== undefined) out.sellerVerified = listing.sellerVerified;
      return out;
    }
    return currentSellerFields();
  }

  // After a dealership is renamed, refresh the name stored on its ads.
  function syncDealerNameToListings() {
    const d = state.dealership;
    if (!d || !state.account) return;
    const id = sellerIdForPhone(state.account), name = d.name || "نمایشگاه";
    LISTINGS.forEach((l) => { if (l.sellerId === id && l.sellerType === "dealer") Object.assign(l, { sellerName: name, sellerAddress: d.address || "", sellerDescription: d.description || "", sellerVerified: d.status === "approved" }); });
    state = { ...state, myListings: state.myListings.map((e) => (e.listing && e.listing.sellerId === id && e.listing.sellerType === "dealer") ? { ...e, listing: { ...e.listing, sellerName: name, sellerAddress: d.address || "", sellerDescription: d.description || "", sellerVerified: d.status === "approved" } } : e) };
  }

  function escHtml(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const SELLER_ICON_STORE = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8"/></svg>';
  const SELLER_ICON_USER = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';

  // Small "شخصی" / "نمایشگاه" pill shown on every listing card.
  function sellerTagMarkup(listing) {
    const s = listingSeller(listing);
    return s.type === "dealer"
      ? `<span class="seller-tag seller-tag-dealer">${SELLER_ICON_STORE}نمایشگاه</span>`
      : `<span class="seller-tag seller-tag-personal">${SELLER_ICON_USER}شخصی</span>`;
  }

  function vehicleModelName(listing) {
    const yearMatch = listing.title.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : "";
    return listing.title.replace(year, "").replace(listing.brand, "").trim();
  }

  function vehicleBodyStyle(listing) {
    if (listing.bodyStyle) return listing.bodyStyle;
    const model = vehicleModelName(listing);
    return /Cabriolet|Spider|Roadster|Volante|Convertible/i.test(model) ? "کروک" :
      /F-150|Raptor|Silverado|Ram|Ranger|Tacoma|Tundra/i.test(model) ? "وانت" :
      /Sportage|Tucson|RAV4|Q5|X5|GLE|Macan|CS35|Wrangler|Grand Cherokee|Defender|Range Rover|Escalade|Durango/i.test(model) ? "شاسی‌بلند" :
      /K5|Elantra|Camry|C300|A4|CT5|Arrizo/i.test(model) ? "سدان" :
      /Picanto|Rio|Fiesta|Golf|Yaris|Soul|i20|i30|Mini|Corolla Hatch|پیکانتو|ریو/i.test(model) ? "هاچ‌بک" :
      "کوپه";
  }

  // ---- Extra filter helpers (brand origin, seller type, special cases) ----
  const BRAND_COUNTRY = {
    "کیا": "کره‌ای", "هیوندا": "کره‌ای",
    "فورد": "آمریکایی", "شورلت": "آمریکایی", "دودج": "آمریکایی", "کادیلاک": "آمریکایی", "جیپ": "آمریکایی",
    "بنز": "آلمانی", "BMW": "آلمانی", "آئودی": "آلمانی", "پورشه": "آلمانی",
    "مازراتی": "ایتالیایی", "فراری": "ایتالیایی", "لامبورگینی": "ایتالیایی",
    "تویوتا": "ژاپنی", "لکسوس": "ژاپنی",
    "لند روور": "انگلیسی", "جگوار": "انگلیسی",
    "خودروهای چینی": "چینی",
  };
  const COLOR_FILTER_ALIAS = { "نوک مدادی": ["خاکستری"], "یشمی": ["سبز"], "سرمه‌ای": ["آبی"] };
  function listingCountry(l) { return l.country || BRAND_COUNTRY[l.brand] || ""; }
  function listingCityName(l) { return l.city || (DEALERS[l.brand] ? DEALERS[l.brand].city : "اسکاتسدیل، آریزونا"); }
  function listingYearNum(l) { const y = parseInt((String(l.title || "").match(/\b(19|20)\d{2}\b/) || [""])[0], 10); return Number.isFinite(y) ? y : null; }
  function listingHasInstallment(l) { return !!(l.installment || l.est); }
  function listingMatchesSpecial(l, key) {
    const text = String(l.title || "");
    if (key === "classic") { const y = listingYearNum(l); return !!l.classic || (y != null && y <= 1999); }
    if (key === "offroad") return !!l.offroad || /Raptor|Wrangler|Defender|Land Cruiser|Bronco|Gladiator|G-Class|G 63|G63|Tacoma|Tundra|Ranger|رنگلر|دیفندر|لندکروزر/i.test(text);
    if (key === "freezone") return !!l.freeZone || /منطقه آزاد/.test(String(l.documentType || l.deedType || l.ownershipDocumentType || l.plateType || ""));
    return false;
  }

  function vehicleTransmission(listing) {
    if (listing.transmission) return listing.transmission;
    const yearMatch = listing.title.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : 2022;
    return year < 1990 ? "دنده‌ای" : "اتوماتیک";
  }

  function applyListingFilters(list) {
    let out = list;
    const { model, city, color, condition, priceMin, priceMax, transmission, bodyStyle } = state.filters;
    const milesNum = (m) => parseInt(m.replace(/[^0-9]/g, ""), 10) || 0;
    const priceNum = (p) => {
      const n = parseInt(faToEnDigits(p).replace(/[^0-9]/g, ""), 10);
      return Number.isFinite(n) && n > 0 ? n : Infinity;
    };
    // "Negotiable" ads carry no number: they never match a price range and
    // always sink to the end of a price sort (asc or desc).
    const hasPrice = (l) => !l.negotiable && priceNum(l.price) !== Infinity;
    if (model) out = out.filter((l) => vehicleModelName(l) === model);
    if (state.filters.year) out = out.filter((l) => { const y = parseInt((l.title.match(/\b(19|20)\d{2}\b/) || [""])[0], 10); return String(y) === String(state.filters.year); });
    if (city) out = out.filter((l) => listingCityName(l) === city);
    if (state.filters.country) out = out.filter((l) => listingCountry(l) === state.filters.country);
    if (state.filters.sellerType) out = out.filter((l) => listingSeller(l).type === state.filters.sellerType);
    if (state.filters.installment) out = out.filter(listingHasInstallment);
    if (state.filters.electric) out = out.filter((l) => /برقی|تسلا|Tesla|Electric|\bEV\b|ID\.[3-9]|Ioniq|Leaf|e-tron|Taycan|Lucid|Rivian|Bolt/i.test(String(l.fuelType || l.fuel || "") + " " + String(l.title || "")));
    if (Array.isArray(state.filters.specials) && state.filters.specials.length) out = out.filter((l) => state.filters.specials.some((k) => listingMatchesSpecial(l, k)));
    if (color) out = out.filter((l) => { const n = colorName(l.color); return n === color || (COLOR_FILTER_ALIAS[color] || []).includes(n); });
    if (condition) out = out.filter((l) => (condition === "نو" ? /^0 مایل$/.test(l.miles) : !/^0 مایل$/.test(l.miles)));
    if (transmission) out = out.filter((l) => vehicleTransmission(l) === transmission);
    if (bodyStyle) out = out.filter((l) => vehicleBodyStyle(l) === bodyStyle);
    if (state.filters.urgent) out = out.filter((l) => isListingUrgent(l));
    if (priceMin != null) out = out.filter((l) => hasPrice(l) && priceNum(l.price) >= priceMin);
    if (priceMax != null) out = out.filter((l) => hasPrice(l) && priceNum(l.price) <= priceMax);

    out = out.slice();
    if (state.sort === "newest") out.sort((a, b) => listingSortTs(b) - listingSortTs(a));
    else if (state.sort === "price-asc") out.sort((a, b) => (hasPrice(a) ? priceNum(a.price) : 1e18) - (hasPrice(b) ? priceNum(b.price) : 1e18));
    else if (state.sort === "price-desc") out.sort((a, b) => (hasPrice(b) ? priceNum(b.price) : -1) - (hasPrice(a) ? priceNum(a.price) : -1));
    else if (state.sort === "miles-asc") out.sort((a, b) => milesNum(a.miles) - milesNum(b.miles));
    else if (state.sort === "year-desc") {
      out.sort((a, b) => {
        const ya = parseInt((a.title.match(/\b(19|20)\d{2}\b/) || [0])[0], 10) || 0;
        const yb = parseInt((b.title.match(/\b(19|20)\d{2}\b/) || [0])[0], 10) || 0;
        return yb - ya;
      });
    }
    return out;
  }

