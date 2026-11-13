"use strict";

/* ---------------------------------------------------------------
   ADMIN STORE — the one place the site and admin.html share data.
   Today it lives in localStorage (same browser only). Every read/write
   goes through MR_STORE, so moving to a real server later means
   replacing the bodies of read()/edit() with fetch() calls (see
   README-admin.md). Loaded by index.html AND admin.html.
--------------------------------------------------------------- */

const MR_STORE_KEY = "mr_store_v1";

const MR_STORE = (function () {
  const blank = () => ({ v: 1, entries: {}, hidden: {}, feat: {}, blocked: {}, verified: {}, dealers: {}, settings: { manual: true }, log: [] });

  function read() {
    try {
      const o = JSON.parse(localStorage.getItem(MR_STORE_KEY) || "null");
      if (o && o.v === 1) return Object.assign(blank(), o, { settings: Object.assign({ manual: true }, o.settings) });
    } catch (_) {}
    return blank();
  }
  function write(d) {
    try { localStorage.setItem(MR_STORE_KEY, JSON.stringify(d)); return true; } catch (_) {}
    // Quota hit: the admin activity log is the only thing safe to sacrifice.
    try {
      if (d.log && d.log.length > 5) { d.log = d.log.slice(0, 5); localStorage.setItem(MR_STORE_KEY, JSON.stringify(d)); return true; }
    } catch (_) {}
    return false;
  }
  function edit(fn) { const d = read(); fn(d); return write(d); }

  return {
    read,
    edit,
    settings() { return read().settings; },
    isBlocked(phone) { return !!phone && !!read().blocked[phone]; },

    // A new ad from the sell form. Starts "pending"; the admin (or the
    // auto-publish timer when manual review is off) flips it to "listed".
    // Returns false if the browser refuses the write (quota — photos are
    // data URLs). It never drops photos by itself any more: the caller
    // (mrPersistListing in 23-admin-sync.js) recompresses them and tells
    // the user if something really had to go.
    submit(listing, owner) {
      return edit((d) => { d.entries[listing.id] = { id: listing.id, listing, owner: owner || "", status: "pending", why: "", createdAt: listing.createdAt || Date.now() }; });
    },
    // Owner edited an ad. A rejected ad goes back to the review queue.
    update(id, listing) {
      return edit((d) => {
        const e = d.entries[id];
        if (!e) return;
        e.listing = listing;
        if (e.status === "rejected" || e.status === "removed") { e.status = "pending"; e.why = ""; }
      });
    },
    // Owner re-submits a rejected ad as-is (no edits) — back to the review queue.
    resubmit(id) {
      return edit((d) => {
        const e = d.entries[id];
        if (e && (e.status === "rejected" || e.status === "removed")) { e.status = "pending"; e.why = ""; }
      });
    },
    // Dealership registration (needs admin approval before it can publish ads).
    // rec = { name, owner, address, nid, city, status: pending|approved|rejected, why, at }
    // `nid` (national ID) is only ever shown in admin.html.
    dealer(phone) { return (read().dealers || {})[phone] || null; },
    saveDealer(phone, rec) {
      return edit((d) => {
        d.dealers = d.dealers || {};
        d.dealers[phone] = rec;
        if (rec.status !== "approved") delete d.verified[phone]; else d.verified[phone] = true;
      });
    },
    remove(id) { return edit((d) => { delete d.entries[id]; }); },
  };
})();

/* ---------------------------------------------------------------
   NOTIFICATIONS — in-site notifications per account (phone), shared by
   the site and admin.html (admin decisions notify the ad owner).
   mr_notifs_v1 : [{ id, phone, type, icon, title, body, route, data, read, at }]
--------------------------------------------------------------- */
const MR_NOTIFS = (function () {
  const KEY = "mr_notifs_v1", CAP = 300;
  function all() { try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a.slice(-CAP))); return true; } catch (_) { return false; } }
  const api = {
    push(phone, n) {
      if (!phone || !n) return null;
      const a = all();
      const rec = Object.assign({ id: "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), phone: String(phone), read: false, at: Date.now() }, n);
      a.push(rec); save(a); return rec;
    },
    list(phone) { return all().filter((n) => n.phone === String(phone)).sort((x, y) => y.at - x.at); },
    unread(phone) { return phone ? all().filter((n) => n.phone === String(phone) && !n.read).length : 0; },
    update(id, patch) { const a = all(); const n = a.find((x) => x.id === id); if (n) { Object.assign(n, patch); save(a); } return n || null; },
    markRead(phone, id) { const a = all(); a.forEach((n) => { if (n.phone === String(phone) && (id === "all" || n.id === id)) n.read = true; }); save(a); },
    clear(phone) { save(all().filter((n) => n.phone !== String(phone))); },
  };
  window.MR_NOTIFS = api;
  return api;
})();
