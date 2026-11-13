"use strict";
/* LIVE UPDATES — the server pushes a tiny "something changed" hint (Server-Sent Events, GET /api/v1/live)
   and the page re-fetches just that data. Hints carry no content; everything is re-read through the normal
   authorised API. Each module also listens to the `carma:live` event on window:
     detail = { t: "listings" | "showrooms" | "stories" | "news" | "notifications" | "messages", c?: conversationId }
   If the stream is unavailable the existing polling keeps working, and the stream reconnects by itself. */
(function () {
  if (!window.CARMA_API || !window.CARMA_API.enabled || typeof EventSource === "undefined") return;
  const url = String(window.CARMA_API.base || "/api/v1").replace(/\/$/, "") + "/live";
  let es = null, userId = null, retryMs = 2000, timers = {};

  const authId = () => String((window.CARMA_AUTH_USER && window.CARMA_AUTH_USER.id) || "");
  const debounce = (key, ms, fn) => { clearTimeout(timers[key]); timers[key] = setTimeout(fn, ms); };

  // Never re-render under someone who is typing / editing a form / has a dialog open.
  const EDIT_PAGES = new Set(["sell", "accountEdit", "dealershipEdit", "conversation", "qaAsk", "qaQuestion"]);
  function canRender() {
    try {
      const a = document.activeElement;
      if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return false;
      if (typeof state === "undefined") return false;
      if (state.modal || state.loading) return false;
      if (EDIT_PAGES.has(state.route && state.route.page)) return false;
      return typeof render === "function";
    } catch (_) { return false; }
  }
  function softRender() {
    if (!canRender()) return;
    const sc = document.scrollingElement || document.documentElement;
    const y = sc ? sc.scrollTop : 0;
    try { render(); } catch (_) { return; }
    if (sc && sc.scrollTop !== y) sc.scrollTop = y;
  }

  const listingsSig = () => {
    try { return JSON.stringify((Array.isArray(LISTINGS) ? LISTINGS : []).map((l) => [l.id, l.status, l.price, l.title, l.updatedAt, (l.photos || []).length])); } catch (_) { return ""; }
  };
  const mineSig = () => { try { return JSON.stringify((state.myListings || []).map((e) => [e.id, e.status, e.listing && e.listing.updatedAt])); } catch (_) { return ""; } };

  async function onListings() {
    const M = window.CARMA_MARKETPLACE; if (!M) return;
    const before = listingsSig() + "|" + mineSig() + "|" + ((state.likedIds || []).length);
    try { await M.syncPublicListings(); } catch (_) {}
    if (window.CARMA_AUTH_USER) { try { await M.syncMyListings(); await M.syncFavorites(); } catch (_) {} }
    if (listingsSig() + "|" + mineSig() + "|" + ((state.likedIds || []).length) !== before) softRender();
  }
  async function onShowrooms() {
    const S = window.CARMA_SESSION; if (!S) return;
    window.CARMA_RANK_MOVEMENTS_AT = 0;
    let changed = false;
    try { changed = !!(await S.refreshShowrooms()); } catch (_) {}
    if (window.CARMA_AUTH_USER) { try { await S.syncMyShowroom(); } catch (_) {} }
    // follower counts / reviews change without the list signature changing, so repaint those pages too
    const page = state && state.route && state.route.page;
    if (changed || ["dealers", "home", "dealerPublic", "seller"].includes(page)) softRender();
  }

  function dispatch(detail) {
    try { window.dispatchEvent(new CustomEvent("carma:live", { detail })); } catch (_) {}
    if (detail.t === "listings") debounce("listings", 700, onListings);
    else if (detail.t === "showrooms") debounce("showrooms", 900, onShowrooms);
  }

  function connect() {
    close();
    userId = authId();
    try { es = new EventSource(url, { withCredentials: true }); } catch (_) { return; }
    es.onopen = () => { retryMs = 2000; };
    es.onmessage = (ev) => { try { const d = JSON.parse(ev.data); if (d && typeof d.t === "string") dispatch(d); } catch (_) {} };
    es.onerror = () => {
      // EventSource retries by itself; if the browser gave up, rebuild with a growing delay.
      if (es && es.readyState === 2) { close(); setTimeout(connect, retryMs); retryMs = Math.min(retryMs * 2, 30000); }
    };
  }
  function close() { if (es) { try { es.close(); } catch (_) {} es = null; } }

  // Sign-in / sign-out changes who the private topics belong to -> reconnect so the stream is authenticated as the right user.
  setInterval(() => { if (!document.hidden && authId() !== userId) connect(); }, 15000);
  // Coming back to the tab: make sure the stream is alive and catch up on anything missed while hidden.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (authId() !== userId || !es || es.readyState === 2) connect();
    debounce("catchup-l", 300, onListings); debounce("catchup-s", 600, onShowrooms);
    ["stories", "news", "notifications", "messages"].forEach((t) => dispatch({ t }));
  });
  window.addEventListener("online", connect);
  window.addEventListener("pagehide", close);

  // Wait for the first session sync so the stream starts with the right user.
  if (window.CARMA_BOOT_DONE) connect(); else window.addEventListener("carma:boot-done", connect, { once: true });
  window.CARMA_LIVE = Object.freeze({ reconnect: connect, close });
})();
