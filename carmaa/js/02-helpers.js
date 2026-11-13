"use strict";

/* عنوان نمایشی آگهی: اگر فروشنده عنوان نوشته باشد همان (بدون برند/مدل)، وگرنه عنوان قبلی. */
function listingDisplayTitle(l) {
  const a = String((l && l.adTitle) || "").trim();
  return a || String((l && l.title) || "");
}

/* ---------------------------------------------------------------
   HELPERS — small utility/formatting functions: hashing, per-listing view/call stats, color naming, price parsing, vehicle spec building, car glyph SVG.
// Edit generic helper/formatting logic here.
--------------------------------------------------------------- */

  /* ---------------------------------------------------------------
     HELPERS
  --------------------------------------------------------------- */


  /* Every uploaded image is stored as WebP (lighter than JPEG/PNG). Falls back to JPEG
     only on browsers whose canvas cannot encode WebP (it then silently returns PNG). */
  function mrCanvasToDataURL(canvas, quality) {
    let out = "";
    try { out = canvas.toDataURL("image/webp", quality); } catch (_) {}
    if (out && out.indexOf("data:image/webp") === 0) return out;
    return canvas.toDataURL("image/jpeg", quality);
  }

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  // Per-day counters for the owner's own ads (drives آمار آگهی). Saved in
  // this browser: { [adId]: { "YYYY-MM-DD": { views, clicks, likes } } }.
  const MR_STATS_KEY = "mr_ad_stats_v1";
  let mrStats = {};
  try { mrStats = JSON.parse(window.localStorage.getItem(MR_STATS_KEY) || "{}") || {}; } catch (_) { mrStats = {}; }
  function mrStatsSave() { try { window.localStorage.setItem(MR_STATS_KEY, JSON.stringify(mrStats)); } catch (_) {} }
  function mrDayKey(ts) { const d = new Date(ts); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function mrStatsTrack(id) { if (id && !mrStats[id]) { mrStats[id] = {}; mrStatsSave(); } }
  function mrStatsDrop(id) { if (mrStats[id]) { delete mrStats[id]; mrStatsSave(); } }

  const listingStatsCache = {};
  function getListingStats(id) {
    if (mrStats[id]) {
      const t = { views: 0, clicks: 0, likes: 0 };
      Object.values(mrStats[id]).forEach((r) => { t.views += r.views || 0; t.clicks += r.clicks || 0; t.likes += r.likes || 0; });
      t.likes = Math.max(0, t.likes);
      return t;
    }
    if (!listingStatsCache[id]) {
      const h = hashStr(id);
      listingStatsCache[id] = { views: 40 + (h % 260), clicks: 5 + (h % 40), likes: 2 + (h % 25) };
    }
    return listingStatsCache[id];
  }
  function bumpStat(id, key, delta) {
    delta = delta || 1;
    if (mrStats[id]) {
      const day = mrDayKey(Date.now());
      const rec = mrStats[id][day] || (mrStats[id][day] = { views: 0, clicks: 0, likes: 0 });
      rec[key] = (rec[key] || 0) + delta;
      mrStatsSave();
      return;
    }
    if (key === "likes") return;
    const s = getListingStats(id);
    s[key] = (s[key] || 0) + 1;
  }

  function colorName(hex) {
    const map = {
      "#e7e5e0": "سفید", "#f2f0ec": "سفید", "#dfe0e2": "نقره‌ای", "#c9cdd2": "نقره‌ای", "#c9c8c3": "نقره‌ای",
      "#1D1D1F": "مشکی", "#1D1D1F": "مشکی", "#1D1D1F": "مشکی", "#262628": "مشکی",
      "#245c3b": "سبز", "#2e7d4f": "سبز", "#0e5c4c": "سبز", "#1c8f4a": "سبز",
      "#8f1c1c": "قرمز", "#c7a72f": "زرد", "#e0a800": "زرد", "#0e2454": "آبی",
    };
    return map[hex] || "خاکستری";
  }

  const COLOR_SWATCHES = [
    { name: "سفید", hex: "#f3f2ee" },
    { name: "نقره‌ای", hex: "#c9c8c3" },
    { name: "مشکی", hex: "#1D1D1F" },
    { name: "سبز", hex: "#245c3b" },
    { name: "قرمز", hex: "#8f1c1c" },
    { name: "زرد", hex: "#c7a72f" },
    { name: "آبی", hex: "#0e2454" },
    { name: "خاکستری", hex: "#8a8a86" },
  ];

  function parsePrice(p) {
    const n = parseInt(String(p || "").replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }

  // ---- Listing age + expiry -------------------------------------------
  // Real registration time (listing.createdAt) drives the "x ago" label.
  // A listing lives for 30 days, then expires (see purgeExpiredListings).
  const LISTING_DAY_MS = 24 * 60 * 60 * 1000;
  const LISTING_TTL_MS = 30 * LISTING_DAY_MS;
  function faToEnDigits(s) { return String(s).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)); }
  // Iranian national ID: 10 digits + checksum.
  function isValidNationalId(code) {
    if (!/^\d{10}$/.test(code) || /^(\d)\1{9}$/.test(code)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(code[i], 10) * (10 - i);
    const r = sum % 11, c = parseInt(code[9], 10);
    return r < 2 ? c === r : c === 11 - r;
  }
  function faNum(n) { return String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]); }
  function listingAgeLabel(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const min = diff / 60000;
    if (min < 2) return "چند لحظه پیش";
    if (min < 60) return "دقایقی پیش";
    if (min < 24 * 60) return "ساعتی پیش";
    const days = Math.floor(diff / LISTING_DAY_MS);
    if (days < 2) return "یک روز پیش";
    if (days < 7) return "چند روز پیش";
    if (days < 14) return "یک هفته پیش";
    if (days < 21) return `${faNum(2)} هفته پیش`;
    if (days < 30) return `${faNum(3)} هفته پیش`;
    return `${faNum(1)} ماه پیش`;
  }
  function isListingExpired(ts) { return !!ts && (Date.now() - ts) >= LISTING_TTL_MS; }
  // Paid services move these per-listing fields (see js/24-paid-services.js):
  //   expiresAt  — set by «تمدید آگهی»; otherwise createdAt + 30 days
  //   bumpedAt   — set by «نردبان»; the "newest" order uses max(createdAt, bumpedAt)
  //   urgentUntil — set by «برچسب فوری»; the badge + «فوری‌ها» filter use it
  function listingExpiresAt(l) { return (l && l.expiresAt) || (((l && l.createdAt) || 0) + LISTING_TTL_MS); }
  function isListingObjExpired(l) { return !!l && !!l.createdAt && Date.now() >= listingExpiresAt(l); }
  function isListingUrgent(l) { return !!l && !!l.urgentUntil && l.urgentUntil > Date.now(); }
  function listingSortTs(l) { return Math.max((l && l.createdAt) || 0, (l && l.bumpedAt) || 0); }

  function buildVehicleSpecs(listing) {
    const brand = listing.brand, title = listing.title, phone = listing.phone, color = listing.color || "#8a8a86";
    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : "2022";
    const model = title.replace(year, "").replace(brand, "").replace("Used", "").replace("for sale", "").trim();
    const dealer = listing.privateSeller
      ? { name: listing.sellerName || "فروشنده خصوصی", city: listing.city || "اسکاتسدیل، آریزونا" }
      : dealerFor(brand);
    const h = hashStr(title + phone);
    const bodyStyle =
      /Cabriolet|Spider|Roadster|Volante|Convertible/i.test(model) ? "کروک" :
      /F-150|Raptor|Silverado|Ram|Ranger|Tacoma|Tundra/i.test(model) ? "وانت" :
      /Sportage|Tucson|RAV4|Q5|X5|GLE|Macan|CS35|Wrangler|Grand Cherokee|Defender|Range Rover|Escalade|Durango/i.test(model) ? "شاسی‌بلند" :
      /K5|Elantra|Camry|C300|A4|CT5|Arrizo/i.test(model) ? "سدان" :
      "کوپه";
    const transmission = listing.transmission || (parseInt(year, 10) < 1990 ? "دنده‌ای" : "اتوماتیک");
    const interiorColor = listing.interiorColor || (h % 2 === 0 ? "مشکی" : "کرم");
    const driveTrain = listing.driveTrain || DRIVETRAIN[brand] || "دو چرخ محرک جلو (FWD)";
    const fuelType = listing.fuelType || "ثبت نشده";
    const vin = "ZFF" + (92000000000 + (h % 7999999)).toString().slice(0, 10).toUpperCase() + "X";
    const stock = "CONS" + ((h % 90000) + 10000);
    const ratingPool = [3.5, 4.0, 4.2, 4.5, 4.7, 4.8, 5.0];
    const dealerRating = ratingPool[h % ratingPool.length];
    const listedDaysAgo = listing.createdAt ? Math.floor((Date.now() - listing.createdAt) / LISTING_DAY_MS) : 0;
    const listedAgo = listing.createdAt ? listingAgeLabel(listing.createdAt) : "چند لحظه پیش";
    return {
      year, model, dealer,
      make: brand,
      vin, stock, bodyStyle, transmission, driveTrain, interiorColor, fuelType,
      exteriorColor: colorName(color),
      engine: ENGINES[brand] || "4.0L V8",
      dealerRating,
      listedDaysAgo, listedAgo,
    };
  }

  function carGlyphSVG(color, cls, photoIndex = null, seed = "") {
    // Real photos from public used-vehicle listings. They are intentionally
    // generic: the UI is a marketplace demo, so the photo does not claim to
    // be the exact vehicle described by the listing metadata.
    // Sources represented here include dealer inventory pages and vehicle
    // marketplaces such as CarsForSale, CarGurus, AutoTrader and dealer sites.
    const usedListingPhotos = [
      "https://imagescdn.dealercarsearch.com/Media/17831/23568758/639069527420326300.jpg", // Used 2019 BMW X5 — Auto Plaza
      "https://pictures.dealer.com/b/bidlemanfordfd/1454/40efbfa1a6f984e122ba22c90a448edfx.jpg?imdensity=1&impolicy=downsize_bkpt&w=414", // Used 2021 Ford F-150 — Bidleman Ford
      "https://vehicle-images.carscommerce.inc/6bfc-11000361/1FTFW1E51MFA48144/0112dcc2707cf119c860995bf02ae26d.jpg", // Used 2021 Ford F-150 — Dave Arbogast
      "https://mkt-vehicleimages-prd.autotradercdn.ca/photos/import/202603/1415/4915/e66e662d-cb2b-4a9b-bc45-ec1f885602dc.jpg", // Used 2020 Toyota Camry — AutoTrader
      "https://static.cargurus.com/images/forsale/2026/05/18/16/29/2019_dodge_charger-pic-1371491625219204822-1024x768.jpeg", // Used 2019 Dodge Charger — CarGurus
      "https://assets.cai-media-management.com/resize/1920x1920/common-vehicle-media/b8a0de36-d22a-47f6-9e1b-da74604aeb4d.jpg", // Used 2022 Porsche 911 — Brickell Luxury Motors
      "https://static.overfuel.com/photos/437/259978/997495171.webp?q=80&w=1920", // Used 2021 Kia Sportage — Bob Ruth Ford
      "https://images.autotrader.com/scaler/1200/630/hn/c/8e1548bc4d9b43489cc5e18ea1a45c08.jpg", // Used 2022 Porsche 911 — AutoTrader
      "https://static.cargurus.com/images/forsale/2025/08/16/22/24/2019_maserati_ghibli-pic-3618381303061177301-1024x768.jpeg", // Used 2019 Maserati Ghibli — CarGurus
      "https://autoimage.capitalone.com/dealer/2019-Maserati-Ghibli-Base-ZAM57XSA9K1310088-vauto_ZAM57XSA9K1310088_MP24708-efd8e6a67f3f36597a6e979941bfbcb1.jpg?height=480&width=640", // Used 2019 Maserati Ghibli — Capital One Auto Navigator
    ];

    const baseSeed = String(seed || color || "") + String(cls || "");
    const safeHash = typeof hashStr === "function" ? hashStr(baseSeed) : baseSeed.length;
    const offset = safeHash % usedListingPhotos.length;
    const index = photoIndex == null
      ? offset
      : (offset + Math.abs(Number(photoIndex) || 0)) % usedListingPhotos.length;

    return `<img src="${usedListingPhotos[index]}" class="car-photo ${cls}" alt="خودرو دست دوم" loading="lazy" referrerpolicy="no-referrer" style="object-fit:cover;display:block;width:100%;height:100%;" onload="this.classList.add('img-ready')" onerror="this.style.display='none';this.nextElementSibling?.classList.add('img-fallback-visible')" /><span class="img-fallback" aria-hidden="true"></span>`;
  }

  // Keeps the status-bar / browser-chrome area visually part of the page
  // instead of a hidden or mismatched strip: the <meta name="theme-color">
  // tag is what Android/Chrome uses to tint the status bar and what iOS
  // Safari (15+) uses to tint its address bar, so it needs to track
  // whichever background is actually showing (dark app bg vs. light theme)
  // rather than staying fixed at one color.
  const THEME_COLOR_DARK = "#1D1D1F";  // matches .bg-neutral-950 in styles.css
  const THEME_COLOR_LIGHT = "#F5F5F7"; // matches html.theme-light background
  function syncThemeColorMeta(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? THEME_COLOR_LIGHT : THEME_COLOR_DARK);
  }

