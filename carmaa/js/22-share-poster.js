"use strict";
/* ---------------------------------------------------------------
   SHARE POSTER — builds a 1080×1920 Instagram-story poster for a listing
   on a <canvas> and shows it in the generic bottom sheet with
   "share to story" / "save image" / "copy link" actions.
   Entry points: openSharePoster(listing) and buildSharePosterBody(modal).
--------------------------------------------------------------- */
(function () {
  const W = 1080, H = 1920;
  const GOLD = "#cdbb94", INK = "#1D1D1F", TEXT = "#eceef0", DIM = "#8f959a";
  const cache = new Map(); // listing id -> { url, blob }

  function loadImage(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      if (!/^data:|^blob:/.test(src)) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function ensureFonts() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.all([
        document.fonts.load('italic 600 80px "Playfair Display"'),
        document.fonts.load('600 80px "Playfair Display"'),
        document.fonts.load('600 80px "Fredoka"', "Carma"),
        document.fonts.load('500 30px "Vazirmatn"'),
        document.fonts.load('700 30px "Vazirmatn"'),
        document.fonts.load('800 30px "Vazirmatn"'),
      ]);
    } catch (_) {}
  }

  function posterData(listing) {
    const specs = buildVehicleSpecs(listing);
    const model = (vehicleModelName(listing) || specs.model || listing.title || "").trim();
    const parts = [specs.year, listing.miles, specs.transmission, specs.fuelType && specs.fuelType !== "ثبت نشده" ? specs.fuelType : ""].filter(Boolean);
    return {
      brand: listing.brand || "",
      model,
      parts,
      price: listing.price || "",
      city: (specs.dealer && specs.dealer.city) || "",
      photo: Array.isArray(listing.photos) && listing.photos.length ? listing.photos[0] : "",
    };
  }

  function coverDraw(ctx, img, x, y, w, h, focusY) {
    const s = Math.max(w / img.width, h / img.height);
    const dw = img.width * s, dh = img.height * s;
    const dx = x + (w - dw) / 2;
    const dy = y + Math.min(0, Math.max(h - dh, (h - dh) * focusY));
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function fitText(ctx, text, maxW, startPx, font) {
    let px = startPx;
    do { ctx.font = font(px); px -= 2; } while (ctx.measureText(text).width > maxW && px > 28);
  }

  function spaced(ctx, text, x, y, spacing) {
    // centered text with manual letter-spacing (latin only)
    const chars = [...text];
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
    let cx = x - total / 2;
    const prev = ctx.textAlign; ctx.textAlign = "left";
    chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + spacing; });
    ctx.textAlign = prev;
  }

  function draw(canvas, d, img) {
    const ctx = canvas.getContext("2d");
    canvas.width = W; canvas.height = H;
    ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);

    // ---- photo, full-bleed on top, melting into the background
    const photoH = 1300;
    if (img) {
      coverDraw(ctx, img, 0, 0, W, photoH, 0.5);
    } else {
      const g = ctx.createLinearGradient(0, 0, W, photoH);
      g.addColorStop(0, "#262628"); g.addColorStop(1, "#1D1D1F");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, photoH);
    }
    let g = ctx.createLinearGradient(0, photoH - 560, 0, photoH + 40);
    g.addColorStop(0, "rgba(29,29,31,0)"); g.addColorStop(0.65, "rgba(29,29,31,.92)"); g.addColorStop(1, INK);
    ctx.fillStyle = g; ctx.fillRect(0, photoH - 560, W, 600);
    g = ctx.createLinearGradient(0, 0, 0, 420);
    g.addColorStop(0, "rgba(29,29,31,.65)"); g.addColorStop(1, "rgba(29,29,31,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 420);

    ctx.textBaseline = "alphabetic"; ctx.textAlign = "center";

    // ---- wordmark (inside the story safe area)
    ctx.direction = "ltr"; ctx.fillStyle = TEXT;
    ctx.font = 'italic 600 54px "Playfair Display", Georgia, serif';
    ctx.fillText("C♻️RMA", W / 2, 292);
    ctx.fillStyle = GOLD; ctx.font = '600 22px "Playfair Display", Georgia, serif';
    spaced(ctx, "", W / 2, 334, 11);

    // ---- brand (small), model (large)
    let y = 1196;
    ctx.direction = "rtl"; ctx.fillStyle = GOLD;
    ctx.font = '600 32px "Vazirmatn", Tahoma, sans-serif';
    ctx.fillText(d.brand, W / 2, y);

    y += 108;
    ctx.direction = /[؀-ۿ]/.test(d.model) ? "rtl" : "ltr"; ctx.fillStyle = TEXT;
    const maxW = W - 180;
    fitText(ctx, d.model, maxW, 104, (px) => /[؀-ۿ]/.test(d.model) ? `800 ${px}px "Vazirmatn", Tahoma, sans-serif` : `600 ${px}px "Playfair Display", Georgia, serif`);
    ctx.fillText(d.model, W / 2, y);

    // ---- spec line
    y += 78;
    ctx.direction = "rtl"; ctx.fillStyle = DIM;
    ctx.font = '500 34px "Vazirmatn", Tahoma, sans-serif';
    ctx.fillText(d.parts.join("   ·   "), W / 2, y);

    // ---- hairline
    y += 66;
    ctx.fillStyle = GOLD; ctx.fillRect(W / 2 - 40, y, 80, 2);

    // ---- price
    y += 128;
    const latin = /^[\s$€£0-9.,]+$/.test(d.price);
    ctx.direction = latin ? "ltr" : "rtl"; ctx.fillStyle = TEXT;
    fitText(ctx, d.price, maxW, 120, (px) => latin ? `600 ${px}px "Playfair Display", Georgia, serif` : `800 ${px}px "Vazirmatn", Tahoma, sans-serif`);
    ctx.fillText(d.price, W / 2, y);

    // ---- footer (above the story reply bar)
    ctx.direction = "rtl"; ctx.fillStyle = DIM;
    ctx.font = '500 28px "Vazirmatn", Tahoma, sans-serif';
    ctx.fillText(d.city ? d.city : "مشاهدهٔ آگهی در C♻️RMA", W / 2, 1668);
  }

  function toBlob(canvas) {
    return new Promise((resolve, reject) => {
      try { canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/png"); }
      catch (e) { reject(e); }
    });
  }

  async function buildPoster(listing) {
    await ensureFonts();
    const d = posterData(listing);
    const img = await loadImage(d.photo);
    const canvas = document.createElement("canvas");
    draw(canvas, d, img);
    try {
      return await toBlob(canvas);
    } catch (_) {
      draw(canvas, d, null); // tainted by a cross-origin photo → render without it
      return await toBlob(canvas);
    }
  }

  function getPoster(listing) {
    const hit = cache.get(listing.id);
    if (hit) return Promise.resolve(hit);
    return (listing.kind === "showroom" ? buildShowroomPoster(listing) : buildPoster(listing)).then((blob) => {
      const entry = { blob, url: URL.createObjectURL(blob) };
      cache.set(listing.id, entry);
      return entry;
    });
  }


  /* ===================== SHOWROOM BANNER =====================
     A 1080×1920 branded banner that mirrors the public showroom page: big CARMA
     wordmark on top, full-bleed showroom photo fading to dark, name + verified seal,
     @handle · city, tagline, three stats, a minimal row of small honour medals and
     a QR block (same design as the listing story banner) at the bottom. */
  const fa = (n) => String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  const QR_LIBS = ["https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js", "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"];
  const MEDAL_TINT = { activity: "#8fa8c9", inventory: "#b7824d", fresh: "#7a63c8", quality: "#4f9a78", rating: "#d2a93a", popular: "#c4577a", profile: "#7d8794" };

  function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  async function ensureQR() {
    if (window.QRCode) return true;
    for (const src of QR_LIBS) { try { await loadScript(src); if (window.QRCode) return true; } catch (_) {} }
    return false;
  }
  // Returns the drawn <canvas> of a QR code for `text`, or null when the library can't load.
  async function makeQR(text) {
    if (!(await ensureQR())) return null;
    try {
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none";
      document.body.appendChild(host);
      new window.QRCode(host, { text: text || location.href, width: 560, height: 560, colorDark: "#1D1D1F", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.M });
      const cv = host.querySelector("canvas");
      const out = document.createElement("canvas"); out.width = 560; out.height = 560;
      if (cv) out.getContext("2d").drawImage(cv, 0, 0, 560, 560);
      host.remove();
      return cv ? out : null;
    } catch (_) { return null; }
  }

  function showroomData(id) {
    const prof = (typeof sellerProfileById === "function" && sellerProfileById(id)) || {};
    const P = window.MR_PROFILE || {};
    const listings = (prof.listings || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const photoOf = (l) => (Array.isArray(l.photos) ? l.photos.filter(Boolean)[0] : l.photo) || "";
    const url = window.MARQUE_TRUST && window.MARQUE_TRUST.sellerPublicUrl ? window.MARQUE_TRUST.sellerPublicUrl(id) : location.href;
    const followers = P.followersCount ? Number(P.followersCount(id)) || 0 : 0;
    // Same hero photo as the public page: the showroom's own picture, old banner only as a fallback.
    const logo = prof.logo || (typeof sellerAvatarFor === "function" ? sellerAvatarFor("dealer", id) : "") || "";
    const banner = logo || prof.banner || (typeof sellerBannerFor === "function" ? sellerBannerFor(id) : "") || "";
    let joined = "", awards = [];
    try { // membership: year only
      if (typeof showroomJoinedAt === "function") { const t = showroomJoinedAt(id); if (t) joined = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric" }).format(new Date(t)); }
      if (!joined && typeof showroomJoinedLabel === "function") { const l = String(showroomJoinedLabel(id) || "").trim(); if (l && l !== "—") joined = l.split(/\s+/).pop(); }
    } catch (_) {}
    try {
      if (typeof getShowroomAwards === "function" && typeof getShowroomDirectoryItems === "function") {
        const dir = getShowroomDirectoryItems();
        const match = dir.find((e) => String(e.id) === String(id)) || {};
        const latestAt = listings.reduce((m, l) => Math.max(m, Number(l && l.createdAt) || 0), 0);
        const item = {
          ...match, id, name: prof.name || match.name || "", city: prof.city || match.city || "",
          description: prof.description || match.description || "", logo: logo || match.logo || "", banner,
          verified: !!prof.verified, listings, latestAt: Math.max(latestAt, Number(match.latestAt) || 0), followers,
          rating: typeof showroomRatingFor === "function" ? showroomRatingFor(id) : { count: 0, average: 0 },
          activityScore: typeof showroomActivityScore === "function" ? showroomActivityScore(listings, followers) : 0,
        };
        awards = getShowroomAwards(item, dir) || [];
      }
    } catch (_) { awards = []; }
    return {
      id, url,
      name: prof.name || "نمایشگاه",
      verified: !!prof.verified,
      handle: P.getUsername ? P.getUsername(id, "dealer") : "",
      city: prof.city || "",
      tagline: prof.tagline || "",
      logo, banner,
      count: listings.length,
      followers, joined, awards,
      heroFallback: listings.map(photoOf).find(Boolean) || "",
    };
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function hexPath(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath();
  }

  // The page's verified seal (same SVG path as .sr-verified).
  const SEAL_PATH = "M12 1.8l2.6 1.8 3.1-.2 1.2 2.9 2.7 1.6-.7 3.1 1.2 2.8-2.2 2.2-.3 3.1-3 .8-2 2.4-2.6-1.8-3.1.2-1.2-2.9-2.7-1.6.7-3.1L2.5 11.9l2.2-2.2.3-3.1 3-.8z";

  // Page cover: photo + blur that grows towards the bottom (mask transparent 55% → opaque 100%).
  // Blur is done by down/up-scaling so it also works on browsers without ctx.filter (iOS Safari).
  function drawBlurredHero(ctx, hero, HH) {
    const sc = 0.07;
    const small = document.createElement("canvas"); small.width = Math.max(8, Math.round(W * sc)); small.height = Math.max(8, Math.round(HH * sc));
    const sx = small.getContext("2d"); sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = "high";
    coverDraw(sx, hero, 0, 0, small.width, small.height, 0.2);
    const big = document.createElement("canvas"); big.width = W; big.height = HH;
    const bx = big.getContext("2d"); bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = "high";
    bx.drawImage(small, 0, 0, W, HH);
    bx.globalCompositeOperation = "destination-in";
    const mg = bx.createLinearGradient(0, 0, 0, HH); mg.addColorStop(0.55, "rgba(0,0,0,0)"); mg.addColorStop(1, "rgba(0,0,0,1)");
    bx.fillStyle = mg; bx.fillRect(0, 0, W, HH);
    ctx.drawImage(big, 0, 0);
  }

  function drawShowroom(canvas, d, imgs) {
    const ctx = canvas.getContext("2d");
    canvas.width = W; canvas.height = H;
    // The page is ~390 css px wide; the banner is 1080 px → every page size × 2.77.
    const FONT = '"Vazirmatn", "SF Pro Text", -apple-system, "Segoe UI", Tahoma, sans-serif';
    const BG = "#1D1D1F", MUTED = "rgba(235,235,245,.62)", ACCENT = "#b9a9ff";
    const M = 55, R = W - M;
    ctx.textBaseline = "alphabetic";
    const rtl = (align) => { ctx.direction = "rtl"; ctx.textAlign = align || "right"; };

    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);

    // ---- cover (same as the page): photo "cover" at 20%, blur from 55% down, dark gradient on top
    const HH = 1163;
    const hero = imgs.logo || imgs.banner || imgs.hero;
    if (hero) { coverDraw(ctx, hero, 0, 0, W, HH, 0.2); drawBlurredHero(ctx, hero, HH); }
    else { const g0 = ctx.createLinearGradient(0, 0, W, HH); g0.addColorStop(0, "#262628"); g0.addColorStop(1, "#1D1D1F"); ctx.fillStyle = g0; ctx.fillRect(0, 0, W, HH); }
    const og = ctx.createLinearGradient(0, 0, 0, HH);
    og.addColorStop(0, "rgba(0,0,0,.34)"); og.addColorStop(0.22, "rgba(0,0,0,.04)"); og.addColorStop(0.46, "rgba(0,0,0,.10)");
    og.addColorStop(0.68, "rgba(29,29,31,.56)"); og.addColorStop(0.88, "rgba(29,29,31,.90)"); og.addColorStop(1, BG);
    ctx.fillStyle = og; ctx.fillRect(0, 0, W, HH + 1);

    // ---- "Carma" wordmark — the exact header lettering (Fredoka 600), larger than the header; no side buttons
    ctx.save();
    ctx.direction = "ltr"; ctx.textAlign = "center"; ctx.fillStyle = "#F5F5F7";
    const WM = (px) => `600 ${px}px "Fredoka", "Baloo 2", "Nunito", "Varela Round", ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "-2px"; // -0.01em like the header
    let wmPx = 150; ctx.font = WM(wmPx);
    while (ctx.measureText("Carma").width > 430 && wmPx > 90) { wmPx -= 4; ctx.font = WM(wmPx); } // keeps it modest even if Fredoka is missing
    // top shadow: almost black at the very top, fading smoothly until it is gone exactly at the grey line
    const LY = 270 - wmPx * 0.3;
    {
      const tg = ctx.createLinearGradient(0, 0, 0, LY);
      [[0, .98], [.2, .92], [.4, .78], [.6, .56], [.8, .3], [.92, .12], [1, 0]].forEach(([t, a]) => tg.addColorStop(t, `rgba(0,0,0,${a})`));
      ctx.save(); ctx.fillStyle = tg; ctx.fillRect(0, 0, W, LY); ctx.restore();
    }
    // layered wordmark shadow: wide soft halo + mid shadow + tight crisp edge shadow
    [["rgba(0,0,0,.45)", 40, 9], ["rgba(0,0,0,.45)", 14, 5], ["rgba(0,0,0,.5)", 4, 2]].forEach(([c, b, oy]) => {
      ctx.shadowColor = c; ctx.shadowBlur = b; ctx.shadowOffsetY = oy;
      ctx.fillText("Carma", W / 2, 270);
    });
    const wmW = ctx.measureText("Carma").width;
    ctx.restore();

    // ---- two faint grey lines: from the start of the wordmark to the left edge, from its end to the right edge
    {
      const ly = LY, GAPL = 30, LH = 3;
      ctx.save();
      ctx.fillStyle = "rgba(205,207,215,.15)";
      const lx = W / 2 - wmW / 2 - GAPL, rx2 = W / 2 + wmW / 2 + GAPL;
      if (lx > 0) ctx.fillRect(0, ly - LH / 2, lx, LH);
      if (rx2 < W) ctx.fillRect(rx2, ly - LH / 2, W - rx2, LH);
      ctx.restore();
    }

    // ---- name (23px/800, white, soft shadow) + verified seal on its left (19px)
    const SHIFT = 130; // whole info block (name → QR) sits lower on the banner
    const nMedals = Math.min(8, (d.awards || []).length), medalRows = Math.max(1, Math.ceil(nMedals / 4));
    let y = 938 + SHIFT - (medalRows - 1) * 62; // an extra medal row pushes the block up so the QR stays put
    const SEAL = 53, SGAP = 17;
    ctx.save();
    ctx.fillStyle = "#fff"; rtl("right"); ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 39; ctx.shadowOffsetY = 3;
    fitText(ctx, d.name, W - M * 2 - (d.verified ? SEAL + SGAP : 0), 64, (p) => `800 ${p}px ${FONT}`);
    const nw = ctx.measureText(d.name).width;
    const total0 = nw + (d.verified ? SEAL + SGAP : 0);
    ctx.fillText(d.name, W / 2 + total0 / 2, y);
    ctx.restore();
    if (d.verified) {
      const sx = W / 2 - total0 / 2, sy = y - 22 - SEAL / 2, sc = SEAL / 24;
      ctx.save(); ctx.translate(sx, sy); ctx.scale(sc, sc);
      ctx.fillStyle = "#0071E3"; ctx.fill(new Path2D(SEAL_PATH));
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.stroke(new Path2D("m8.4 12.2 2.4 2.4 4.9-5"));
      ctx.restore();
    }

    // ---- @handle • city (14px, 62% white) — handle on the right, like the page
    y += 79;
    const handle = d.handle ? "@" + d.handle : "";
    ctx.font = `700 39px ${FONT}`; ctx.direction = "ltr"; const hw = handle ? ctx.measureText(handle).width : 0;
    rtl("right"); const cw2 = d.city ? ctx.measureText(d.city).width : 0;
    const DOT = 8, SG = 22, hasBoth = !!(handle && d.city);
    const totalSub = hw + cw2 + (hasBoth ? DOT + SG * 2 : 0);
    let rx = W / 2 + totalSub / 2; // right edge of the line
    ctx.fillStyle = "rgba(255,255,255,.62)";
    if (handle) { ctx.font = `700 39px ${FONT}`; ctx.direction = "ltr"; ctx.textAlign = "right"; ctx.fillText(handle, rx, y); rx -= hw; }
    if (hasBoth) { rx -= SG; ctx.beginPath(); ctx.arc(rx - DOT / 2, y - 14, DOT / 2, 0, Math.PI * 2); ctx.fillStyle = "rgba(235,235,245,.34)"; ctx.fill(); rx -= DOT + SG; }
    if (d.city) { ctx.fillStyle = "rgba(255,255,255,.62)"; rtl("right"); ctx.font = `700 39px ${FONT}`; ctx.fillText(d.city, rx, y); }

    // ---- tagline (12.5px/700, accent lavender)
    if (d.tagline) { y += 76; ctx.fillStyle = ACCENT; rtl("center"); ctx.font = `700 35px ${FONT}`; ctx.fillText(d.tagline, W / 2, y); }

    // ---- stats: label above, number below (19px/800), three equal columns — followers · listings · joined (year)
    y += 118;
    const stats = [[fa(d.followers), "دنبال‌کننده"], [fa(d.count), "آگهی"], [d.joined || "—", "تاریخ عضویت"]];
    const colW = (W - M * 2) / 3;
    stats.forEach((st, i) => {
      const cx = R - colW * i - colW / 2;
      rtl("center"); ctx.fillStyle = MUTED; ctx.font = `700 35px ${FONT}`; ctx.fillText(st[1], cx, y);
      ctx.fillStyle = "#fff"; fitText(ctx, st[0], colW - 16, 53, (p) => `800 ${p}px ${FONT}`); ctx.fillText(st[0], cx, y + 66);
    });
    y += 66;

    // ---- honour medals: small label-only chips, at most 4 per row (extra medals wrap to the next row)
    y += 52;
    const medals = (d.awards || []).slice(0, 8);
    if (medals.length) {
      const CH = 50, PADX = 22, GAP = 10, RGAP = 12, FS = 22, PER_ROW = 4;
      ctx.font = `700 ${FS}px ${FONT}`;
      const items = medals.map((m) => { const label = m.label || m.title || ""; return { label, w: PADX * 2 + ctx.measureText(label).width }; });
      for (let r = 0; r * PER_ROW < items.length; r++) {
        const row = items.slice(r * PER_ROW, r * PER_ROW + PER_ROW);
        const tw = row.reduce((sum, it) => sum + it.w, 0) + GAP * (row.length - 1);
        let x = W / 2 + tw / 2; // right edge of this centred row
        row.forEach((it) => {
          const cg = ctx.createLinearGradient(x - it.w, y, x, y + CH); cg.addColorStop(0, "rgba(255,255,255,.075)"); cg.addColorStop(1, "rgba(255,255,255,.025)");
          rr(ctx, x - it.w, y, it.w, CH, 17); ctx.fillStyle = cg; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,.09)"; ctx.stroke();
          ctx.fillStyle = "#fff"; rtl("center"); ctx.font = `700 ${FS}px ${FONT}`; ctx.fillText(it.label, x - it.w / 2, y + CH / 2 + 8);
          x -= it.w + GAP;
        });
        y += CH + (r * PER_ROW + PER_ROW < items.length ? RGAP : 0);
      }
    }

    // ---- QR block — same design as the listing banner (compact): white rounded QR (left) + caption (right)
    // QR (left) and caption (right) with three equal gaps: left margin = gap between them = right margin
    const QS = 210, qy = Math.max(y + 60, 1380);
    const CAP1 = "اسکن کن", CAP2 = "همه‌ی آگهی‌ها و مشخصات";
    rtl("right");
    ctx.font = `800 40px ${FONT}`; const c1w = ctx.measureText(CAP1).width;
    ctx.font = `700 30px ${FONT}`; const c2w = ctx.measureText(CAP2).width;
    const capW = Math.max(c1w, c2w), EG = Math.round((W - QS - capW) / 3);
    const qx = EG, capR = W - EG;
    if (imgs.qr) {
      rr(ctx, qx, qy, QS, QS, 30); ctx.fillStyle = "#fff"; ctx.fill();
      ctx.drawImage(imgs.qr, qx + 17, qy + 17, QS - 34, QS - 34);
    }
    rtl("right"); ctx.fillStyle = "#fff"; ctx.font = `800 40px ${FONT}`; ctx.fillText(CAP1, capR, qy + QS / 2 - 2);
    ctx.fillStyle = "rgba(235,235,245,.62)"; ctx.font = `700 30px ${FONT}`; ctx.fillText(CAP2, capR, qy + QS / 2 + 44);
  }


  async function buildShowroomPoster(listing) {
    await ensureFonts();
    try { await document.fonts.load('800 60px "Vazirmatn"'); } catch (_) {}
    const d = showroomData(listing.showroomId);
    const [logo, banner, hero, qr] = await Promise.all([loadImage(d.logo), loadImage(d.banner), loadImage(d.heroFallback), makeQR(d.url)]);
    const imgs = { logo, banner, hero, qr };
    const canvas = document.createElement("canvas");
    drawShowroom(canvas, d, imgs);
    try { return await toBlob(canvas); }
    catch (_) { drawShowroom(canvas, d, { logo: null, banner: null, hero: null, qr }); return await toBlob(canvas); }
  }

  window.openShowroomPoster = function (sellerId) {
    const d = showroomData(sellerId);
    state = { ...state, modal: { type: "sharePoster", listing: { id: "showroom-" + sellerId, showroomId: sellerId, title: d.name, url: d.url, kind: "showroom" } }, modalClosing: false };
    updateOverlays();
  };

  function listingUrl(l) { return (l && l.kind === "showroom" && l.url) || (l && l.kind !== "showroom" && typeof listingPostUrl === "function" ? listingPostUrl(l) : ((l && l.url) || window.location.href)); }

  // ---- Story-template slider (js/22a-carmaa-story-share.js) ----
  const LOGO_BY_BRAND = { "بنز": "logos/mercedes-benz.webp", "فورد": "logos/ford.webp", "مازراتی": "logos/maserati.webp", "فراری": "logos/ferrari.webp", "لامبورگینی": "logos/lamborghini.webp", "تویوتا": "logos/toyota.webp", "لکسوس": "logos/lexus.webp", "BMW": "logos/bmw.webp", "پورشه": "logos/porsche.webp", "شورلت": "logos/chevrolet.webp", "آئودی": "logos/audi.webp", "لند روور": "logos/land-rover.webp", "جگوار": "logos/jaguar.webp", "دودج": "logos/dodge.webp", "کادیلاک": "logos/cadillac.webp", "جیپ": "logos/jeep.webp", "کیا": "logos/kia.webp" };
  const TRIM_LABEL = { full: "فول", half: "نیمه‌فول", basic: "بیسیک" };

  // ---- Ad link:  carma.ir/<dealer slug or seller id>/<post id> ----
  const SITE_ORIGIN = "https://carma.ir";
  function postOwnerSegment(listing) {
    try {
      const s = typeof listingSeller === "function" ? listingSeller(listing) : null;
      if (s && s.id) {
        if (s.type === "dealer" && window.MARQUE_TRUST && window.MARQUE_TRUST.sellerSlug && !String(s.id).startsWith("brand:")) return window.MARQUE_TRUST.sellerSlug(s.id);
        return String(s.id).replace(/^brand:/, "brand-");
      }
    } catch (_) {}
    return listing && listing.sellerId ? String(listing.sellerId) : "ad";
  }
  function listingPostUrl(listing) {
    if (!listing || listing.id == null) return window.location.href;
    const local = /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname) || location.protocol === "file:";
    const origin = (local && location.protocol !== "file:") ? location.origin : SITE_ORIGIN;
    return origin + "/" + encodeURIComponent(postOwnerSegment(listing)) + "/" + encodeURIComponent(String(listing.id));
  }
  window.carmaaListingPostUrl = listingPostUrl;

  function storyShareData(listing) {
    let model = "", year = "";
    try { const sp = buildVehicleSpecs(listing); model = (vehicleModelName(listing) || sp.model || "").trim(); year = sp.year || ""; } catch (_) {}
    const brand = listing.brand || "";
    const photos = Array.isArray(listing.photos) ? listing.photos.filter(Boolean) : [];
    const painted = Array.isArray(listing.paintedParts) ? listing.paintedParts.length : 0;
    return {
      title: String(listing.adTitle || "").trim() || (String(listing.title || "").replace(year, "").replace(/\s+/g, " ").trim()) || (brand + " " + model).trim() || "آگهی خودرو",
      image: photos[0] || "",
      images: photos,
      url: listingPostUrl(listing),
      year: year ? parseInt(year, 10) : "",
      trim: TRIM_LABEL[listing.trim] || "",
      exchange: !!listing.tradeIn,
      paint: painted > 0 ? painted + " تکه رنگ" : "بدون رنگ‌شدگی",
      brandLogo: brand === "کیا" ? "" : (LOGO_BY_BRAND[brand] || ""),
    };
  }

  window.carmaaStoryShareData = storyShareData;
  window.openSharePoster = function (listing) {
    // Regular listings → full-screen slider of story templates; showrooms keep the original banner sheet.
    if (listing && listing.kind !== "showroom" && window.CarmaaStoryShare && typeof window.CarmaaStoryShare.open === "function") {
      try { window.CarmaaStoryShare.open(storyShareData(listing)); return; } catch (_) { /* fall back to the classic sheet */ }
    }
    state = { ...state, modal: { type: "sharePoster", listing }, modalClosing: false };
    updateOverlays();
  };

  window.buildSharePosterBody = function (m) {
    const listing = m.listing;
    const wrap = document.createElement("div");
    wrap.className = "poster-sheet";
    wrap.innerHTML =
      '<div class="poster-frame"><img class="poster-img" alt="پوستر استوری" hidden/><div class="poster-loading" aria-live="polite">در حال ساخت پوستر…</div></div>' +
      '<button type="button" class="poster-primary" data-action="posterShare" disabled>' + (listing.kind === "showroom" ? "اشتراک‌گذاری بنر نمایشگاه" : "اشتراک در استوری") + '</button>' +
      '<div class="poster-secondary"><button type="button" data-action="posterSave" disabled>ذخیره تصویر</button><button type="button" data-action="posterCopyLink">کپی لینک</button></div>';
    const img = wrap.querySelector(".poster-img"), loading = wrap.querySelector(".poster-loading");
    getPoster(listing).then((p) => {
      const live = document.getElementById("modalBody");
      const target = live && live.querySelector(".poster-img") ? live : wrap;
      const i = target.querySelector(".poster-img");
      i.src = p.url; i.hidden = false;
      const l = target.querySelector(".poster-loading"); if (l) l.remove();
      target.querySelectorAll(".poster-primary,[data-action=posterSave]").forEach((b) => (b.disabled = false));
    }).catch(() => { loading.textContent = "ساخت پوستر ممکن نشد"; });
    if (cache.has(listing.id)) { img.src = cache.get(listing.id).url; img.hidden = false; loading.remove(); wrap.querySelectorAll(".poster-primary,[data-action=posterSave]").forEach((b) => (b.disabled = false)); }
    return wrap;
  };

  document.addEventListener("click", async (e) => {
    const el = e.target.closest && e.target.closest("[data-action^='poster']");
    if (!el) return;
    const m = state.modal;
    if (!m || m.type !== "sharePoster") return;
    const listing = m.listing, action = el.getAttribute("data-action");
    if (action === "posterCopyLink") {
      try { await navigator.clipboard.writeText(listingUrl(listing)); showToast(listing.kind === "showroom" ? "لینک صفحه نمایشگاه کپی شد" : "لینک آگهی کپی شد"); }
      catch (_) { showToast("امکان کپی لینک وجود ندارد"); }
      return;
    }
    const p = cache.get(listing.id);
    if (!p) return;
    const name = `carma-${listing.id}.png`;
    if (action === "posterShare") {
      const file = new File([p.blob], name, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share(listing.kind === "showroom" ? { files: [file], title: listing.title, url: listing.url } : { files: [file], title: listing.title || "آگهی خودرو" }); } catch (_) {}
        return;
      }
    }
    // save (or share fallback): download the PNG
    const a = document.createElement("a");
    a.href = p.url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    showToast(action === "posterShare" ? "تصویر ذخیره شد؛ آن را در استوری یا پست اینستاگرام بارگذاری کنید" : "تصویر ذخیره شد");
  });
})();
