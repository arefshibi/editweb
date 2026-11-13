"use strict";

/* ---------------------------------------------------------------
   HOME SCREEN — brand logo chip markup and the car listing card markup (grid cards + "my listing" cards).
// Edit how a car card looks here.
--------------------------------------------------------------- */

  /* ---------------------------------------------------------------
     HOME SCREEN
  --------------------------------------------------------------- */

  function renderBrandMark(b) {
    if (b.all) {
      return `<div class="grid grid-cols-6 gap-1.5 w-full px-1.5">${Array.from({ length: 18 }).map(() => '<span class="h-2 rounded-sm bg-neutral-700"></span>').join("")}</div>`;
    }
    if (!b.img) {
      if (b.generic) {
        return `<div class="brand-mono-ring flex items-center justify-center"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#e7eaed" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13.5 4.6 9a2 2 0 0 1 1.9-1.3h11a2 2 0 0 1 1.9 1.3L21 13.5"/><path d="M3 13.5h18v3a1 1 0 0 1-1 1h-1.2a1 1 0 0 1-1-.9L17.6 15H6.4l-.2 1.6a1 1 0 0 1-1 .9H4a1 1 0 0 1-1-1v-3Z"/><circle cx="7" cy="17.5" r="1.4"/><circle cx="17" cy="17.5" r="1.4"/></svg></div>`;
      }
      const initials = b.initials || b.name.trim().charAt(0);
      return `<div class="brand-mono-ring flex items-center justify-center"><span class="brand-mono">${initials}</span></div>`;
    }
    return `<img src="${b.img}" alt="${b.name}" class="max-h-full max-w-full object-contain" />`;
  }


  const TRIM_META = {
    full: { label: "FULL", bg: "#ffffff", color: "#1D1D1F" },
    half: { label: "HALF", bg: "#ffffff", color: "#1D1D1F" },
    basic: { label: "BASIC", bg: "#ffffff", color: "#1D1D1F" },
  };

  function milesToKmLabel(milesStr) {
    const raw = String(milesStr || "");
    if (/کیلومتر|صفر|حواله/.test(raw)) return escHtml(raw);
    const num = parseInt(raw.replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(num)) return escHtml(milesStr || "");
    const km = Math.round((num * 1.60934) / 10) * 10;
    return `${km.toLocaleString("en-US")} کیلومتر`;
  }

  // City shown as a small pin chip on the list + home cards (the vehicle detail
  // page already shows the city itself). Same source as the detail page:
  // listing.city, then the brand's showroom city. Nothing is rendered when unknown.
  function cardCityLabel(listing) {
    const c = (listing && listing.city) || (typeof DEALERS !== "undefined" && DEALERS[listing && listing.brand] ? DEALERS[listing.brand].city : "");
    const s = String(c || "").trim();
    return s && s !== "موقعیت ثبت نشده" ? s : "";
  }

  function paintedPartsLabel(listing) {
    const n = Array.isArray(listing.paintedParts) ? listing.paintedParts.length : 0;
    return n > 0 ? `${n} تکه رنگ` : "بدون رنگ‌شدگی";
  }

  // Small status patches shown under the listing card (and on the detail
  // page): "قابل معاوضه" (teal) when the seller ticked «مایل به معاوضه» in
  // the sell form, and the painted-parts count (amber) when > 0.
  // `cls` is the patch base class: "xpatch" (compact/detail) or "xc-chip" (large).
  function listingPatchesMarkup(listing, cls) {
    const n = Array.isArray(listing.paintedParts) ? listing.paintedParts.length : 0;
    const ic = (name) => icon(name, { width: "10", height: "10", strokeWidth: "2.4" });
    let out = "";
    if (listing.tradeIn) out += `<span class="${cls} ${cls}--trade">${ic("refresh-cw")}قابل معاوضه</span>`;
    // Keep paint-count chips on listing cards only; omit them from vehicle detail.
    if (n > 0 && cls !== "xpatch") out += `<span class="${cls} ${cls}--paint">${ic("paintbrush")}${n} تکه رنگ</span>`;
    return out;
  }

  // Reformats the demo $-priced listings into a Toman-based "amount +
  // unit" pair (e.g. "28,500" + "میلیون تومان") instead of a single long
  // "$28,500" string. Kept as two pieces (not one string) so the card CSS
  // can size/truncate the number and the unit label separately, and the
  // unit never forces the number to wrap or grow the box.
  function normalizePriceDigits(value) {
    return String(value ?? "")
      .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  }

  function formatTomanPrice(priceStr) {
    if (isNegotiablePrice(priceStr)) return { amount: "توافقی", unit: "" };
    const normalized = normalizePriceDigits(priceStr);
    const num = parseInt(normalized.replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(num)) return { amount: "تماس بگیرید", unit: "" };

    // Compact card presentation: keep the price block narrow while still
    // showing the real entered amount and an appropriate Persian unit.
    const compact = (value, divisor) => {
      const n = value / divisor;
      return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
    };
    if (num >= 1000000000) return { amount: compact(num, 1000000000), unit: "میلیارد تومان" };
    if (num >= 1000000) return { amount: compact(num, 1000000), unit: "میلیون تومان" };
    if (num >= 1000) return { amount: compact(num, 1000), unit: "هزار تومان" };
    return { amount: num.toLocaleString("en-US"), unit: "تومان" };
  }

  function renderListingCard(listing, index, opts) {
    const useThumb = !!(opts && opts.thumb);
    const tel = listing.phone.replace(/[^0-9+]/g, "");
    const delay = Math.min(index || 0, 10) * 55;
    const trim = TRIM_META[listing.trim] || null;
    const cardMarkup = `
    <div class="card-fade-in rounded-2xl overflow-hidden bg-neutral-950 flex flex-col cursor-pointer" style="animation-delay:${delay}ms" data-action="goVehicle" data-id="${escHtml(listing.id)}">
      <div class="relative aspect-[3/2] bg-neutral-900 rounded-[12px] overflow-hidden">
        ${useThumb ? cardPhotoMarkup(listing, 480) : vehiclePhotoMarkup(listing, 0, "w-full h-full block")}
        ${isListingUrgent(listing) ? `<span class="listing-urgent-badge" style="position:absolute;bottom:8px;right:8px">فوری</span>` : ""}
        ${listing.promoted ? `<div class="listing-promo-badge" style="position:absolute;top:8px;right:8px">تبلیغ‌شده</div>` : ""}
        ${listing.badge ? `<div class="absolute top-2 left-2 bg-neutral-950/90 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-violet-200">${escHtml(listing.badge)}</div>` : `<div class="absolute top-2 left-2">${sellerTagMarkup(listing)}</div>`}
        ${listing.ribbon ? `<div class="absolute inset-x-0 bottom-0 bg-violet-950/90 text-white text-[9.5px] font-semibold text-center py-1 uppercase tracking-wide">${escHtml(listing.ribbon)}</div>` : ""}
      </div>
      <div class="p-3 flex flex-col gap-1">
        <div class="text-[13.5px] font-bold leading-tight min-h-[34px]">${escHtml(listingDisplayTitle(listing))}</div>
        <div class="flex items-center justify-between mt-0.5">
          <div class="text-[15px] font-bold">${escHtml(listing.price)}</div>
          ${trim ? `<span class="font-bold rounded-md" style="padding:4px 5px;font-size:9px;background:${trim.bg};color:${trim.color};">${trim.label}</span>` : ""}
        </div>
        <div class="flex items-center justify-between text-[11px] text-neutral-400 mb-1.5">
          <span>${milesToKmLabel(listing.miles)}</span>
          <span>${paintedPartsLabel(listing)}</span>
        </div>
        <button data-action="goVehicle" data-id="${escHtml(listing.id)}" style="background-color:#bdbdff;color:#040566;" class="flex items-center justify-center gap-1.5 text-center bg-violet-600 text-white text-[12.5px] font-semibold rounded-full py-1.5 mt-0.5">
          ${icon("info", {width:"13", height:"13", strokeWidth:"2"})} اطلاعات بیشتر
        </button>
      </div>
    </div>`;
    // NOTE: swipe-to-save (js/19-swipe-save-card.js) is intentionally NOT
    // applied here — renderListingCard backs the search rail, the
    // similar-cars strip, and the saved page, none of which should offer
    // the swipe gesture. Only renderExploreListingCard (the listings/brand
    // grid page) wraps its markup in .swipe-row.
    return cardMarkup;
  }


  // Compact, "app-style" horizontal card used ONLY on the listings page
  // grid (see tpl-listings / renderListingsScreen): a fixed-width photo
  // beside a dense info column (brand, title, distance in km, then a
  // highlight/price row with a dedicated details CTA). No view-count —
  // removed per request. Sized so at least 3 cards are visible on one
  // screen without scrolling. Kept as its own function (not
  // renderListingCard) so the plainer vertical grid card used elsewhere
  // (similar-cars strip, saved page, search rail) is left untouched.
  // Saving is available two ways: swipe the card (see swipe-row wrapper
  // below / js/19-swipe-save-card.js) or from the vehicle detail page.
  // PERF: the list cards only show a ~140–152px thumbnail, but the photo
  // URLs in the data are 1200px-wide originals. Decoding 12–40 of those on
  // a phone is what made scrolling/loading the listings page heavy. Cards now
  // ask the image host for a 480px version (still sharp at 3x DPR) — the
  // vehicle detail page keeps using the full-size URL.
  const CARD_THUMB_WIDTH = 800;
  function cardThumbUrl(url, width) {
    const s = String(url);
    if (s.indexOf("images.unsplash.com") === -1) return s;
    return s.replace(/([?&])w=\d+/, "$1w=" + (width || CARD_THUMB_WIDTH));
  }
  // Same markup as vehiclePhotoMarkup(listing, 0, "") for a real photo, but
  // with the thumbnail URL and async decoding so decoding never blocks scroll.
  // Portrait (vertical) photos in landscape boxes: `cover` would crop the car
  // to a thin middle strip. Instead the whole photo is shown (`contain`) on top
  // of a blurred, darkened copy of itself that fills the box. Landscape photos
  // are untouched. (load doesn't bubble, hence the capture listener.)
  document.addEventListener("load", function (e) {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.hasAttribute("data-smart-photo") || img.dataset.smartDone) return;
    img.dataset.smartDone = "1";
    if (img.naturalHeight < img.naturalWidth * 1.1) return;
    const p = img.parentElement;
    if (!p) return;
    if (getComputedStyle(p).position === "static") p.style.position = "relative";
    p.style.overflow = "hidden";
    if (getComputedStyle(img).position === "static") img.style.position = "relative";
    const bg = document.createElement("img");
    bg.src = img.currentSrc || img.src;
    bg.alt = "";
    bg.setAttribute("aria-hidden", "true");
    bg.className = "smart-photo-bg";
    p.insertBefore(bg, img);
    img.classList.add("smart-photo-fg");
  }, true);

  function cardPhotoMarkup(listing, width) {
    const photos = Array.isArray(listing.photos) ? listing.photos.filter(Boolean) : [];
    if (!photos[0]) return vehiclePhotoMarkup(listing, 0, "");
    const safe = cardThumbUrl(photos[0], width).replace(/"/g, '&quot;');
    return `<img src="${safe}" alt="عکس خودرو" class="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-smart-photo style="object-fit:cover;display:block;width:100%;height:100%;" />`;
  }

  function renderExploreListingCardLarge(listing, index) {
    const delay = Math.min(index || 0, 10) * 55;
    const brand = BRANDS.find((b) => b.name === listing.brand);
    const avatar = brand ? renderBrandMark(brand) : "";
    const trim = TRIM_META[listing.trim] || null;
    const price = formatTomanPrice(listing.price);
    const cardYearMatch = String(listing.title || "").match(/\b(19|20)\d{2}\b/);
    const cardYear = cardYearMatch ? cardYearMatch[0] : "";
    // Hybrid cars: strip the "Hybrid" word out of the title text (it gets
    // its own blue badge under the yellow year badge instead — see
    // xcard-hybrid-badge below).
    const isHybrid = /\bhybrid\b/i.test(listing.title || "");
    const cardTitleText = String(listing.adTitle || "").trim() || (cardYear ? listing.title.replace(cardYear, "").trim() : listing.title)
      .replace(/\bhybrid\b/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    const liked = state.likedIds.includes(listing.id);
    return `
    <article class="xc card-fade-in" style="animation-delay:${delay}ms" data-action="goVehicle" data-id="${escHtml(listing.id)}">
      <div class="xc-media">
        <div class="xc-photo">${cardPhotoMarkup(listing)}</div>
        <div class="xc-top-end">
          ${isListingUrgent(listing) ? `<span class="listing-urgent-badge">فوری</span>` : ""}
          ${listing.promoted ? `<span class="xc-tag">تبلیغ‌شده</span>` : ""}
        </div>
        <div class="xc-glass xc-glass--tab">
          <div class="xc-glass-text">
            <div class="xc-b-head">
              <strong class="xc-title" dir="auto">${escHtml(cardTitleText)}</strong>
              ${cardYear ? `<span class="xc-b-year">${cardYear}</span>` : ""}
            </div>
            <div class="xc-b-meta">
              <span class="xc-b-item">${icon("gauge", { width: "12", height: "12", strokeWidth: "2.2" })}${milesToKmLabel(listing.miles)}</span>
              ${isHybrid ? `<span class="xc-b-item xc-b-item--hybrid">HYBRID</span>` : ""}
              ${listing.tradeIn ? `<span class="xc-b-item xc-b-item--trade">${icon("refresh-cw", { width: "12", height: "12", strokeWidth: "2.2" })}معاوضه</span>` : ""}
              ${(listing.paintedParts || []).length ? `<span class="xc-b-item xc-b-item--paint">${icon("paintbrush", { width: "12", height: "12", strokeWidth: "2.2" })}${listing.paintedParts.length} رنگ</span>` : ""}
            </div>
          </div>
          <div class="xc-price xc-price--tab${price.unit ? "" : " xc-price--text"}">
            <span class="xc-price-amount">${price.amount}</span>
            ${price.unit ? `<span class="xc-price-unit">${price.unit}</span>` : ""}
          </div>
        </div>
      </div>
    </article>`;
  }

  // Inline icon paths for the listing card (the #vd-i-* sprite lives inside the
  // vehicle-page <template>, so it is not in the DOM on the listings page).
  const XCD_ICON_PATHS = {"camera": "<path d=\"M4 7.5h3L9 5h6l2 2.5h3A1.5 1.5 0 0 1 21.5 9v9A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5Z\"></path><circle cx=\"12\" cy=\"13\" r=\"3.5\"></circle>", "engine": "<path d=\"M5 9h11l2 3h3v5h-3l-2 2H7l-2-2H3V9h2Zm3 0V6h5v3M9 13v3m4-3v3\"></path><path d=\"M18 12V9h2\"></path>", "gearbox": "<path d=\"M7 5v14M12 5v14M17 5v14M7 12h10\"></path><circle cx=\"7\" cy=\"5\" r=\"1.6\"></circle><circle cx=\"12\" cy=\"5\" r=\"1.6\"></circle><circle cx=\"17\" cy=\"5\" r=\"1.6\"></circle>", "fuel": "<path d=\"M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M4 21h12M7.5 8h5\"></path><path d=\"M15 9h2a2 2 0 0 1 2 2v5a1.7 1.7 0 0 0 3.4 0V8.5L19.5 6\"></path>", "drivetrain": "<path d=\"M9 4h6a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z\"></path><path d=\"M4.5 6.5v3.5M19.5 6.5v3.5M4.5 14v3.5M19.5 14v3.5M8 8h-3.5M16 8h3.5M8 16H4.5M16 16h3.5\"></path>", "gauge": "<path d=\"M4 18a9 9 0 1 1 16 0\"></path><path d=\"m12 13 4-4M7 18h10\"></path><circle cx=\"12\" cy=\"13\" r=\"1\"></circle>", "heart": "<path d=\"M20.8 8.8c0 5.2-8.8 10.1-8.8 10.1S3.2 14 3.2 8.8A4.7 4.7 0 0 1 12 6.5a4.7 4.7 0 0 1 8.8 2.3Z\"></path>", "chevron-left": "<path d=\"m14.5 5-7 7 7 7\"></path>"};
  function renderExploreListingCardCompact(listing, index, variant) {
    const delay = Math.min(index || 0, 10) * 55;
    const brand = BRANDS.find((b) => b.name === listing.brand);
    const avatar = brand ? renderBrandMark(brand) : "";
    const trim = TRIM_META[listing.trim] || null;
    const price = formatTomanPrice(listing.price);
    const cardYearMatch = String(listing.title || "").match(/\b(19|20)\d{2}\b/);
    const cardYear = cardYearMatch ? cardYearMatch[0] : "";
    // Hybrid cars: strip the "Hybrid" word out of the title text (it gets
    // its own blue badge under the yellow year badge instead — see
    // xcard-hybrid-badge below).
    const isHybrid = /\bhybrid\b/i.test(listing.title || "");
    const cardTitleText = String(listing.adTitle || "").trim() || (cardYear ? listing.title.replace(cardYear, "").trim() : listing.title)
      .replace(/\bhybrid\b/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    const liked = state.likedIds.includes(listing.id);
    const specsObj = listing.specs && typeof listing.specs === "object" ? listing.specs : {};
    const specVal = (...vals) => {
      for (const v of vals) { const t = v == null ? "" : String(v).trim(); if (t && t !== "null" && t !== "undefined") return t; }
      return "—";
    };
    const driveRaw = specVal(specsObj.driveTrain, listing.driveTrain);
    const driveM = driveRaw.match(/\(([^)]+)\)/);
    const specItems = [
      ["drivetrain", "نوع درایو", driveM ? driveM[1] : driveRaw],
      (() => {
        const cons = specVal(specsObj.fuelConsumption, listing.fuelConsumption, listing.consumption);
        return cons !== "—" ? ["fuel", "مصرف سوخت", cons] : ["fuel", "سوخت", specVal(specsObj.fuelType, listing.fuelType)];
      })(),
      ["gearbox", "گیربکس", specVal(specsObj.transmission, listing.transmission)],
      ["engine", "موتور", specVal(listing.engineType, listing.engine, specsObj.engine)],
    ];
    const kmNum = (() => {
      const n = parseInt(String(listing.miles || "").replace(/[^0-9]/g, ""), 10);
      return Number.isFinite(n) ? (Math.round((n * 1.60934) / 10) * 10).toLocaleString("en-US") : "—";
    })();
    const photoCount = Math.max(1, (Array.isArray(listing.photos) ? listing.photos.filter(Boolean).length : 0));
    const dots = Array.from({ length: Math.min(photoCount, 5) }).map((_, i) => `<i${i === 0 ? ' class="is-on"' : ""}></i>`).join("");
    const faDigits = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
    const vdIcon = (name) => `<svg class="xcd-ic" viewBox="0 0 24 24" aria-hidden="true">${XCD_ICON_PATHS[name] || ""}</svg>`;
    // Brand logos (files that exist in /logos and /home-demo-assets/logos).
    // h = logo height in cqw (wide wordmarks smaller, tall emblems larger); color = keep original colors
    // (white-silhouette filter would turn these into a blank blob).
    const XCD_LOGOS = {
      "کیا":        { src: "home-demo-assets/logos/kia.webp", h: 3.8 },
      "فورد":       { src: "logos/ford.webp", h: 4.4, color: true },
      "بنز":        { src: "logos/mercedes-benz.webp", h: 5.4 },
      "مازراتی":    { src: "home-demo-assets/logos/maserati.webp", h: 4.4 },
      "فراری":      { src: "logos/ferrari.webp", h: 5.6 },
      "لامبورگینی": { src: "logos/lamborghini.webp", h: 5.6 },
      "تویوتا":     { src: "logos/toyota.webp", h: 5.2 },
      "لکسوس":      { src: "logos/lexus.webp", h: 4.4 },
      "BMW":        { src: "logos/bmw.webp", h: 5.4 },
      "پورشه":      { src: "logos/porsche.webp", h: 5.6, color: true },
      "شورلت":      { src: "logos/chevrolet.webp", h: 3.8 },
      "آئودی":      { src: "logos/audi.webp", h: 3.6 },
      "لند روور":   { src: "logos/land-rover.webp", h: 4.6 },
      "جگوار":      { src: "logos/jaguar.webp", h: 4.6 },
      "دودج":       { src: "logos/dodge.webp", h: 5.2 },
      "کادیلاک":    { src: "logos/cadillac.webp", h: 4.4 },
      "جیپ":        { src: "logos/jeep.webp", h: 3.8 },
    };
    const logoDef = XCD_LOGOS[listing.brand];
    const logoImg = logoDef
      ? `<img class="xcd-logo${logoDef.color ? " xcd-logo--color" : ""}" style="height:${logoDef.h}cqw" src="${logoDef.src}" alt="${escHtml(listing.brand)}" loading="lazy" decoding="async" />`
      : "";
    const chips = [
      trim ? `<span class="xcd-chip xcd-chip--trim" data-trim="${escHtml(listing.trim)}">${trim.label}</span>` : "",
      cardYear ? `<span class="xcd-chip xcd-chip--year">${cardYear}</span>` : "",
      isHybrid ? `<span class="xcd-chip xcd-chip--hybrid">HYBRID</span>` : "",
      listing.tradeIn ? `<span class="xcd-chip xcd-chip--trade">${icon("refresh-cw", { width: "12", height: "12", strokeWidth: "2.4" })}قابل معاوضه</span>` : "",
      (listing.paintedParts || []).length ? `<span class="xcd-chip xcd-chip--paint">${icon("paintbrush", { width: "12", height: "12", strokeWidth: "2.4" })}${listing.paintedParts.length} تکه رنگ</span>` : "",
      cardCityLabel(listing) ? `<span class="xcd-chip xcd-chip--city">${icon("map-pin", { width: "12", height: "12", strokeWidth: "2.4" })}<span class="xcd-city-text">${escHtml(cardCityLabel(listing))}</span></span>` : "",
      listing.ribbon ? `<span class="xcd-chip xcd-chip--ribbon">${icon("star", { width: "12", height: "12", fill: "currentColor", stroke: "none" })}${escHtml(listing.ribbon)}</span>` : "",
    ].join("");
    const cardMarkup = `
    <div class="xcd-wrap${variant === "home" ? " xcd-wrap--home" : ""}"><article class="xcd card-fade-in" style="animation-delay:${delay}ms" data-action="goVehicle" data-id="${escHtml(listing.id)}">
      <div class="xcd-photo">
        <div class="xcd-photo-img">${cardPhotoMarkup(listing)}</div>
        ${isListingUrgent(listing) ? `<span class="xcd-flag xcd-flag--urgent">فوری</span>` : ""}
        ${listing.promoted ? `<span class="xcd-flag">تبلیغ‌شده</span>` : ""}
        <div class="xcd-count"><span class="xcd-count-text">${vdIcon("camera")}${faDigits(photoCount)} عکس</span><span class="xcd-dots" dir="ltr">${dots}</span></div>
      </div>
      <div class="xcd-info">
        <div class="xcd-head">
          ${logoImg}
        </div>
        <div class="xcd-titlerow">
          <h3 class="xcd-title" dir="auto">${escHtml(cardTitleText)}</h3>
        </div>
        ${kmNum !== "—" ? `<div class="xcd-kmrow">${vdIcon("gauge")}<span>${kmNum} کیلومتر</span></div>` : ""}
        ${chips ? `<div class="xcd-chips" dir="ltr">${chips}</div>` : ""}
        <div class="xcd-foot">
          <div class="xcd-price${price.unit ? "" : " xcd-price--text"}">
            <div class="xcd-price-in">
              <span class="xcd-price-label" role="img" aria-label="قیمت"><svg class="xcd-tagic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12V4.5A1.5 1.5 0 0 1 4.5 3H12l9 9-9 9z"/><circle cx="8" cy="8" r="1.6" fill="#1D1D1F"/></svg></span>
              <span class="xcd-price-row"><strong class="xcd-price-amount">${price.amount}</strong>${price.unit ? `<span class="xcd-price-unit">${price.unit}</span>` : ""}</span>
            </div>
          </div>
        </div>
      </div>
    </article></div>`;
    // Swipe-to-save was removed: the card is returned as-is (no .swipe-row wrapper).
    return cardMarkup;
  }

  // Listings/brand grid card — two selectable styles (state.listStyle):
  //   "large"   → big photo card with frosted info bar (renderExploreListingCardLarge)
  //   "compact" → the earlier horizontal photo + info row card (…Compact)
  function renderExploreListingCard(listing, index) {
    return renderExploreListingCardCompact(listing, index);
  }

  function renderSpecTile(iconName, label, value) {
    return `
    <div class="flex flex-col items-center justify-center gap-1 rounded-xl border border-neutral-800 bg-neutral-900 py-2.5">
      ${icon(iconName, {width:"15", height:"15", class:"text-neutral-400"})}
      <div class="text-[13px] font-bold leading-none">${value}</div>
      <div class="text-[10.5px] text-neutral-500 leading-none">${label}</div>
    </div>`;
  }

  function renderMyListingCard(item, index) {
    const listing = item.listing;
    const pending = item.status === "pending";
    const expired = item.status === "expired";
    const removed = item.status === "removed";
    const rejected = item.status === "rejected" || removed;
    const remaining = Math.max(0, item.readyAt - Date.now());
    const mm = Math.floor(remaining / 60000);
    const ss = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");
    const stats = getListingStats(listing.id);
    const likesDisplay = mrStats[listing.id] ? stats.likes : stats.likes + (state.likedIds.includes(listing.id) ? 1 : 0);
    const delay = Math.min(index || 0, 10) * 55;

    return `
    <div class="card-fade-in rounded-2xl border border-neutral-800 bg-neutral-950 overflow-hidden" style="animation-delay:${delay}ms">
      <div class="flex gap-3 p-3">
        <div class="w-20 h-16 rounded-lg overflow-hidden shrink-0">${vehiclePhotoMarkup(listing, 0, "w-full h-full block")}</div>
        <div class="flex-1 min-w-0">
          <div class="text-[13px] font-bold leading-tight truncate">${escHtml(listingDisplayTitle(listing))}</div>
          <div class="text-[13px] text-neutral-400">${escHtml(listing.price)}</div>
          ${pending
            ? `<div class="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-300 border border-violet-400 bg-neutral-900 rounded-full px-2.5 py-1">
                 ${MR_STORE.settings().manual ? "در انتظار تایید مدیریت" : `در انتظار — انتشار تا <span data-pending-countdown="${escHtml(item.id)}">${mm}:${ss}</span>`} ${icon("clock", {width:"12", height:"12", class:"animate-pulse"})}
               </div>`
            : rejected
              ? `<div class="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-400 border border-red-400 bg-neutral-900 rounded-full px-2.5 py-1">${removed ? "حذف شد توسط مدیریت" : "رد شد"}${item.why ? ": " + escHtml(item.why) : ""}</div>`
            : expired
              ? `<div class="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-400 border border-red-400 bg-neutral-900 rounded-full px-2.5 py-1">
                 منقضی شده ${icon("clock", {width:"12", height:"12"})}
               </div>`
              : `<div class="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 border border-emerald-400 bg-neutral-900 rounded-full px-2.5 py-1">
                 منتشر شده ${icon("check", {width:"12", height:"12"})}
               </div>`}
        </div>
      </div>
      ${pending
        ? `<div class="block w-full text-center text-[12.5px] font-semibold text-neutral-500 border-t border-neutral-800 py-2.5">ویرایش پس از انتشار آگهی فعال می‌شود</div>`
        : rejected
        ? `<div class="grid grid-cols-2 border-t border-neutral-800"><button data-action="editListing" data-id="${escHtml(item.id)}" class="text-center text-[12.5px] font-semibold text-violet-300 border-l border-neutral-800 py-2.5">اصلاح و ارسال دوباره</button><button data-action="previewListing" data-id="${escHtml(item.id)}" class="text-center text-[12.5px] font-semibold text-neutral-300 py-2.5">مشاهده</button></div>`
        : expired
        ? `<div class="block w-full text-center text-[12.5px] font-semibold text-neutral-500 border-t border-neutral-800 py-2.5">این آگهی پس از ۱ ماه منقضی شده است</div>`
        : `
      <div class="grid grid-cols-3 gap-2 px-3 pb-3">
        ${renderSpecTile("eye", "بازدید", stats.views)}
        ${renderSpecTile("mouse-pointer", "کلیک", stats.clicks)}
        ${renderSpecTile("bookmark", "نشان‌شده", likesDisplay)}
      </div>
      <div class="grid grid-cols-2 border-t border-neutral-800">
        <button data-action="editListing" data-id="${escHtml(item.id)}" class="text-center text-[12.5px] font-semibold text-neutral-300 border-l border-neutral-800 py-2.5">ویرایش</button>
        <button data-action="goVehicle" data-id="${escHtml(listing.id)}" class="text-center text-[12.5px] font-semibold text-violet-300 py-2.5">مشاهده آگهی</button>
      </div>`}
    </div>`;
  }

