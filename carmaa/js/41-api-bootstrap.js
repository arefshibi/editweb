/* Restore server session and hydrate public/private listing views from API. */
(function () {
  // The signed-in user's own showroom lives on the server. Load it at startup AND after every login
  // (before, it was loaded only at page start, so a showroom looked deleted after logging in again).
  // ---- Public showroom directory (window.CARMA_SERVER_SHOWROOMS) ----------------------------------
  // The directory must come from the server, NOT from whoever is signed in. It used to be fetched only
  // once at page start and the signed-in user's own showroom was shown through `state.dealership`, so a
  // showroom approved after page start disappeared from the list as soon as its owner logged out.
  function showroomToServerShape(d) {
    if (!d || !d.id) return null;
    return {
      id: String(d.id), slug: d.slug || '', name: d.name || '', city: d.city || '', address: d.address || '',
      description: d.description || '', owner_name: d.ownerName || d.owner_name || '',
      logo_url: d.logo_url || d.logo || '', banner_url: d.banner_url || d.banner || '',
      logo_image_id: d.logo_image_id || null, banner_image_id: d.banner_image_id || null,
      status: d.status || 'pending', slug_changes: d.slug_changes || 0, created_at: d.created_at || '',
      follower_count: Number(d.follower_count || 0), rating: Number(d.rating || 0), review_count: Number(d.review_count || 0),
      published_listing_count: Number(d.published_listing_count || 0),
    };
  }
  function listOfShowrooms() { return Array.isArray(window.CARMA_SERVER_SHOWROOMS) ? window.CARMA_SERVER_SHOWROOMS : []; }
  // Keep the public list consistent with a showroom we just learned about: approved → listed, otherwise not.
  function upsertShowroom(d) {
    const row = showroomToServerShape(d);
    if (!row) return;
    const rest = listOfShowrooms().filter((x) => String(x.id) !== row.id);
    const prev = listOfShowrooms().find((x) => String(x.id) === row.id);
    window.CARMA_SERVER_SHOWROOMS = row.status === 'approved' ? [...rest, { ...(prev || {}), ...row }] : rest;
  }
  function showroomsSignature() {
    return JSON.stringify(listOfShowrooms().map((x) => [x.id, x.name, x.city, x.status, x.logo_url, x.banner_url, x.published_listing_count, x.follower_count]));
  }
  let showroomsFetchedAt = 0, showroomsInFlight = null;
  // Re-reads the public list from the server. A failed request keeps the list that is already on screen.
  // Resolves to true when the list changed.
  function refreshShowrooms(opts) {
    const o = opts || {};
    if (!window.CARMA_API?.enabled) return Promise.resolve(false);
    if (o.maxAgeMs && Date.now() - showroomsFetchedAt < o.maxAgeMs) return Promise.resolve(false);
    if (showroomsInFlight) return showroomsInFlight;
    const before = showroomsSignature();
    showroomsInFlight = (async () => {
      try {
        const res = await window.CARMA_API.showrooms.list({});
        if (!Array.isArray(res?.items)) return false;
        window.CARMA_SERVER_SHOWROOMS = res.items;
        try { window.CARMA_DEMO && window.CARMA_DEMO.apply(); } catch (_) {}
        showroomsFetchedAt = Date.now();
        return showroomsSignature() !== before;
      } catch (_) { return false; }
      finally { showroomsInFlight = null; }
    })();
    return showroomsInFlight;
  }

  // One-time: showroom hashtags that were saved only in this browser are pushed to the server (tags-only edits keep the approval).
  function migrateLocalTags(sr) {
    try {
      if (!sr || !sr.id || (Array.isArray(sr.tags) && sr.tags.length)) return;
      const P = window.MR_PROFILE;
      if (!P || !P.localDealerTags || typeof sellerIdForPhone !== 'function' || !state.account) return;
      const flag = 'mr_tags_migrated_v1:' + sr.id;
      if (localStorage.getItem(flag) === '1') return;
      const sid = sellerIdForPhone(state.account), local = P.localDealerTags(sid);
      localStorage.setItem(flag, '1');
      if (!local.length) return;
      window.CARMA_API.showrooms.update({ tags: local }).then((r) => {
        const tags = Array.isArray(r?.showroom?.tags) ? r.showroom.tags : local;
        P.clearLocalDealerTags(sid);
        if (typeof state !== 'undefined' && state.dealership && state.dealership.id === sr.id) state = { ...state, dealership: { ...state.dealership, tags } };
        upsertShowroom({ ...sr, tags });
      }).catch(() => { try { localStorage.removeItem(flag); } catch (_) {} });
    } catch (_) { /* best effort */ }
  }

  async function syncMyShowroom(retry) {
    if (!window.CARMA_API?.enabled || !window.CARMA_AUTH_USER) return false;
    try {
      const mine = await window.CARMA_API.showrooms.mine();
      const sr = mine?.showroom;
      if (typeof state === 'undefined') return false;
      if (sr) {
        state = { ...state, dealership: { id: sr.id, slug: sr.slug, name: sr.name, city: sr.city, address: sr.address, description: sr.description, ownerName: sr.owner_name || '', tags: Array.isArray(sr.tags) ? sr.tags : [], logo: sr.logo_url || '', banner: sr.banner_url || '', logo_image_id: sr.logo_image_id || null, banner_image_id: sr.banner_image_id || null, slugChangesLeft: Math.max(0, 2 - Number(sr.slug_changes || 0)), createdAt: sr.created_at || '', status: sr.status, verified: sr.status === 'approved' } };
        migrateLocalTags(sr);
        upsertShowroom(sr); // approved → in the public directory, otherwise removed from it
      } else if (state.dealership && state.dealership.id) {
        upsertShowroom({ id: state.dealership.id, status: 'removed' });
        state = { ...state, dealership: null }; // the server confirmed: this account has no showroom
      }
      return true;
    } catch (_) {
      // Keep whatever is on screen; try once more shortly instead of silently showing "no showroom".
      if (!retry) setTimeout(async () => { if (await syncMyShowroom(true) && typeof render === 'function') render(); }, 1500);
      return false;
    }
  }
  window.CARMA_SESSION = Object.freeze({ syncMyShowroom, refreshShowrooms, upsertShowroom });

  async function restoreSessionInner() {
    if (!window.CARMA_API?.enabled) return;
    let authenticated = false;
    try {
      const data = await window.CARMA_API.auth.me();
      const user = data?.user;
      if (user?.phone) {
        authenticated = true;
        window.CARMA_AUTH_USER = user;
        if (typeof state !== 'undefined') {
          state = {
            ...state,
            account: user.phone,
            accountProfile: {
              ...state.accountProfile,
              firstName: (user.displayName || '').split(' ')[0] || state.accountProfile?.firstName || '',
              lastName: (user.displayName || '').split(' ').slice(1).join(' ') || state.accountProfile?.lastName || '',
              nickname: user.nickname || '',
              email: user.email || state.accountProfile?.email || '',
              avatar: user.avatarUrl || null,
              banner: user.bannerUrl || null,
            },
          };
        }
      }
    } catch (error) {
      // Only a real "not signed in" answer clears the account. A network hiccup must not wipe the
      // signed-in state (that is what made the user's showroom vanish).
      if (error?.status === 401) {
        delete window.CARMA_AUTH_USER;
        if (typeof state !== 'undefined') state = { ...state, account: null, dealership: null, likedIds: [], myListings: [], accountProfile: { firstName: '', lastName: '', email: '', avatar: null } };
      } else console.warn('CarMaa API session could not be restored.');
    }
    // Public inventory and the public showroom directory do not depend on each other.
    // Load them concurrently to avoid adding the two endpoint latencies together on startup.
    const publicSync = await Promise.allSettled([
      Promise.resolve().then(() => window.CARMA_MARKETPLACE?.syncPublicListings?.()),
      Promise.resolve().then(() => refreshShowrooms()),
    ]);
    const showroomSync = publicSync[1];
    if (showroomSync.status === 'rejected' || showroomSync.value === false) {
      if (!Array.isArray(window.CARMA_SERVER_SHOWROOMS)) window.CARMA_SERVER_SHOWROOMS = [];
    }

    // Private reads also touch independent state slices (myListings, likedIds and dealership),
    // so they can run together after auth.me() has established the current user.
    if (authenticated) {
      await Promise.allSettled([
        Promise.resolve().then(() => window.CARMA_MARKETPLACE?.syncMyListings?.()),
        Promise.resolve().then(() => window.CARMA_MARKETPLACE?.syncFavorites?.()),
        Promise.resolve().then(() => syncMyShowroom()),
      ]);
    }
    if (typeof render === 'function') render();
  }
  /* Tells the startup code when the first server sync is over, so the app can show a loading
     skeleton instead of flashing the built-in sample data (old ads / old boxes) first. */
  async function restoreSession() {
    try { await restoreSessionInner(); }
    finally {
      window.CARMA_BOOT_DONE = true;
      try { window.dispatchEvent(new Event('carma:boot-done')); } catch (_) {}
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restoreSession, { once: true });
  else restoreSession();
})();
