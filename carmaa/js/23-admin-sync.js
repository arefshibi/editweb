"use strict";

/* ---------------------------------------------------------------
   ADMIN SYNC — applies what the admin decided (js/02a-admin-store.js)
   to the live site: which ads are public, which are featured, and the
   signed-in owner's own ads with their review status. Runs on startup
   and whenever the admin panel changes the store in another tab.
--------------------------------------------------------------- */

// The original ads shipped in 01-data.js, before any admin change.
const MR_SEED = LISTINGS.slice();

function mrApplyStore() {
  // The server-backed app must never publish or moderate listings from mutable browser storage.
  if (window.CARMA_API?.enabled) return;
  const d = MR_STORE.read();
  const entries = Object.values(d.entries);

  const live = entries.filter((e) => e.status === "listed").map((e) => e.listing);
  live.sort((a, b) => listingSortTs(b) - listingSortTs(a));
  // Only ads that users actually registered (and that still exist) are loaded. The built-in sample
  // ads from 01-data.js are no longer mixed in; flip SHOW_SAMPLE_LISTINGS to bring them back for demos.
  const SHOW_SAMPLE_LISTINGS = false;
  const seed = SHOW_SAMPLE_LISTINGS ? MR_SEED.filter((l) => !d.hidden[l.id]) : [];
  LISTINGS.length = 0;
  LISTINGS.push(...live, ...seed);
  LISTINGS.forEach((l) => { if (d.feat[l.id] !== undefined) l.promoted = !!d.feat[l.id]; });

  if (state.account) {
    if (state.dealership) state = { ...state, dealership: loadDealership(state.account) };
    const mine = entries.filter((e) => e.owner === state.account).map((e) => ({
      id: e.id,
      listing: e.listing,
      status: e.status === "listed" ? (isListingObjExpired(e.listing) ? "expired" : "listed") : e.status,
      why: e.why || "",
      createdAt: e.createdAt,
      readyAt: e.createdAt + 2000,
    }));
    mine.forEach((e) => mrStatsTrack(e.id));
    state = { ...state, myListings: mine };
  }
  purgeExpiredListings();
}

window.addEventListener("storage", (e) => {
  if (e.key !== MR_STORE_KEY) return;
  try { mrApplyStore(); render(); } catch (_) {}
});

/* ---------------------------------------------------------------
   PHOTO-SAFE SAVING — photos are stored as data URLs in localStorage
   (~5 MB total). If a write is refused we first recompress the photos
   in smaller steps, and only as a last resort keep fewer of them —
   and we always tell the user. Nothing is dropped silently.
--------------------------------------------------------------- */
function mrRecompressPhoto(src, maxW, quality) {
  return new Promise((resolve) => {
    if (typeof src !== "string" || src.indexOf("data:image") !== 0) return resolve(src);
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) return resolve(src);
        const scale = Math.min(1, maxW / w);
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * scale));
        c.height = Math.max(1, Math.round(h * scale));
        const g = c.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        const out = mrCanvasToDataURL(c, quality);
        // always hand back WebP; keep the original only if conversion is not WebP and not smaller
        resolve(out.indexOf("data:image/webp") === 0 || out.length < src.length ? out : src);
      } catch (_) { resolve(src); }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

function mrReplaceListing(l) {
  const i = LISTINGS.findIndex((x) => x.id === l.id);
  if (i !== -1) LISTINGS[i] = l;
  state = { ...state, myListings: (state.myListings || []).map((m) => (m.id === l.id ? { ...m, listing: l } : m)) };
  try { render(); } catch (_) {}
}

// mode: "submit" (new ad, owner = phone) | "update" (edited ad)
async function mrPersistListing(listing, mode, owner) {
  const op = (l) => (mode === "submit" ? MR_STORE.submit(l, owner) : MR_STORE.update(l.id, l));
  const finish = (l) => {
    if (mode === "submit" && !MR_STORE.settings().manual) {
      MR_STORE.edit((d) => { if (d.entries[l.id] && d.entries[l.id].status === "pending") d.entries[l.id].status = "listed"; });
    }
    return l;
  };
  if (op(listing)) return finish(listing);

  const orig = (Array.isArray(listing.photos) ? listing.photos : []).filter(Boolean);
  let final = null, kept = orig.length;
  for (const [w, q] of [[1024, 0.66], [800, 0.55], [640, 0.48]]) {
    const l = { ...listing, photos: await Promise.all(orig.map((p) => mrRecompressPhoto(p, w, q))) };
    if (op(l)) { final = l; break; }
  }
  if (!final) {
    const small = await Promise.all(orig.map((p) => mrRecompressPhoto(p, 640, 0.48)));
    for (let n = small.length - 1; n >= 0 && !final; n--) {
      const l = { ...listing, photos: small.slice(0, n) };
      if (op(l)) { final = l; kept = n; }
    }
  }
  if (!final) { showToast("حافظه مرورگر پر است و آگهی ذخیره نشد. چند آگهی قدیمی را حذف کنید."); return null; }
  mrReplaceListing(final);
  if (kept < orig.length) showToast(`حافظه مرورگر پر است؛ فقط ${kept.toLocaleString("fa-IR")} عکس ذخیره شد. برای نگه‌داشتن همه‌ی عکس‌ها آگهی‌های قدیمی را حذف کنید.`);
  else showToast("عکس‌ها برای ذخیره‌شدن فشرده شدند.");
  return finish(final);
}
