"use strict";

/* ---------------------------------------------------------------
   CARMAA HOME DASHBOARD
   Mobile-first automotive marketplace homepage with prioritized search,
   editorial service cards, latest listings, showroom recommendations, and
   a clear seller CTA. Existing app routes/actions are preserved.
--------------------------------------------------------------- */

/* Brand logos for the homepage auto-scrolling marquee (files in /logos and
   /home-demo-assets/logos). h = display height in px, w = width at that height
   (kept so the strip never jumps while images load); color = keep original colors. */
const CM_MARQUEE_LOGOS = [
  { name: "کیا", src: "home-demo-assets/logos/kia.webp", h: 45, w: 45 },
  { name: "فورد", src: "logos/ford.webp", h: 45, w: 117, color: true },
  { name: "بنز", src: "logos/mercedes-benz.webp", h: 57, w: 57 },
  { name: "مازراتی", src: "home-demo-assets/logos/maserati.webp", h: 54, w: 39 },
  { name: "فراری", src: "logos/ferrari.webp", h: 57, w: 42 },
  { name: "لامبورگینی", src: "logos/lamborghini.webp", h: 57, w: 51 },
  { name: "تویوتا", src: "logos/toyota.webp", h: 48, w: 66 },
  { name: "لکسوس", src: "logos/lexus.webp", h: 45, w: 63 },
  { name: "BMW", src: "logos/bmw.webp", h: 57, w: 57 },
  { name: "پورشه", src: "logos/porsche.webp", h: 57, w: 45, color: true },
  { name: "شورلت", src: "logos/chevrolet.webp", h: 36, w: 82 },
  { name: "آئودی", src: "logos/audi.webp", h: 33, w: 93 },
  { name: "لند روور", src: "logos/land-rover.webp", h: 45, w: 86 },
  { name: "جگوار", src: "logos/jaguar.webp", h: 42, w: 82 },
  { name: "دودج", src: "logos/dodge.webp", h: 48, w: 64 },
  { name: "کادیلاک", src: "logos/cadillac.webp", h: 42, w: 111 },
  { name: "جیپ", src: "logos/jeep.webp", h: 36, w: 88 },
];

function bindHomeEdgePullToOpen(rail, onOpen, helperText) {
  if (!rail || rail.dataset.cmEdgePullBound === "1") return;
  rail.dataset.cmEdgePullBound = "1";
  const section = rail.closest(".cm-home-latest, .cm-home-showrooms") || rail.parentElement;
  if (!section) return;
  section.classList.add("cm-edge-pull-host");
  const indicator = document.createElement("div");
  indicator.className = "cm-edge-pull-indicator";
  indicator.setAttribute("aria-hidden", "true");
  indicator.innerHTML = `<span class="cm-edge-pull-plus">+</span><span class="cm-edge-pull-label">${helperText || "بیشتر بکش"}</span>`;
  section.appendChild(indicator);

  let gesture = null;
  let suppressClick = false;
  const isRTL = getComputedStyle(rail).direction === "rtl";
  rail.addEventListener("click", (event) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  function hasOverflow() { return rail.scrollWidth > rail.clientWidth + 8; }
  function isAtEnd() {
    if (!hasOverflow()) return false;
    const last = rail.lastElementChild;
    if (!last) return false;
    const railRect = rail.getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();
    return isRTL ? lastRect.left <= railRect.left + 22 : lastRect.right >= railRect.right - 22;
  }
  function showPull(distance) {
    const progress = Math.max(0, Math.min(1, distance / 58));
    indicator.classList.add("is-visible");
    indicator.classList.toggle("is-ready", distance >= 58);
    indicator.style.opacity = String(Math.min(1, 0.3 + progress * 0.7));
    indicator.style.transform = `translateY(-50%) translateX(${(-18 + progress * 18) * (isRTL ? 1 : -1)}px) scale(${0.78 + progress * 0.22})`;
    rail.classList.add("cm-edge-pull-resisting");
  }
  function resetPull() {
    indicator.classList.remove("is-visible", "is-ready");
    indicator.style.opacity = "0";
    indicator.style.transform = `translateY(-50%) translateX(${isRTL ? -18 : 18}px) scale(.78)`;
    rail.classList.remove("cm-edge-pull-resisting");
  }
  function haptic() {
    try { if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(18); } catch (_) {}
  }
  rail.addEventListener("touchstart", (event) => {
    if (!event.touches || event.touches.length !== 1) { gesture = null; return; }
    const t = event.touches[0];
    gesture = { startX:t.clientX, startY:t.clientY, lastX:t.clientX, lastY:t.clientY, lastScrollLeft:rail.scrollLeft, lastMoveDirection:0, progressDirection:0, axis:"undecided", pulling:false, distance:0, shown:false };
  }, { passive:true });
  rail.addEventListener("touchmove", (event) => {
    if (!gesture || !event.touches || event.touches.length !== 1) return;
    const t = event.touches[0];
    const dx = t.clientX - gesture.lastX;
    const totalX = t.clientX - gesture.startX;
    const totalY = t.clientY - gesture.startY;
    const currentScrollLeft = rail.scrollLeft;
    const scrollDelta = currentScrollLeft - gesture.lastScrollLeft;
    if (Math.abs(scrollDelta) > 0.15 && gesture.lastMoveDirection) gesture.progressDirection = gesture.lastMoveDirection;
    gesture.lastScrollLeft = currentScrollLeft;
    gesture.lastX = t.clientX;
    gesture.lastY = t.clientY;
    if (gesture.axis === "undecided" && (Math.abs(totalX) > 7 || Math.abs(totalY) > 7)) {
      gesture.axis = Math.abs(totalX) > Math.abs(totalY) * 1.12 ? "x" : "y";
    }
    if (gesture.axis === "y") return;
    // Learn which finger direction actually advanced this browser's RTL/LTR
    // scroll position; this also handles engines with different RTL scrollLeft models.
    const fallbackPushDirection = isRTL ? 1 : -1;
    const pushDirection = gesture.progressDirection || fallbackPushDirection;
    if (!gesture.pulling && gesture.axis === "x" && Math.sign(dx) === pushDirection && isAtEnd()) gesture.pulling = true;
    gesture.lastMoveDirection = Math.sign(dx) || gesture.lastMoveDirection;
    if (!gesture.pulling) return;
    event.preventDefault();
    gesture.distance = Math.min(100, gesture.distance + Math.max(0, -dx) * 0.5);
    if (!gesture.shown && gesture.distance >= 3) {
      gesture.shown = true;
      haptic();
    }
    showPull(gesture.distance);
  }, { passive:false });
  const finishGesture = () => {
    if (!gesture) return;
    const completed = gesture.pulling && gesture.distance >= 58;
    gesture = null;
    if (completed) {
      suppressClick = true;
      try { onOpen && onOpen(); } catch (_) {}
      window.setTimeout(() => { suppressClick = false; }, 650);
    }
    resetPull();
  };
  rail.addEventListener("touchend", finishGesture, { passive:true });
  rail.addEventListener("touchcancel", finishGesture, { passive:true });
}

/* One horizontal wheel/touchpad gesture advances one item only.
   Touch swipes are bounded by scroll-snap-stop:always in home-d.css. */
function bindOneCardPerWheelGesture(rail, selector, alignment) {
  if (!rail || rail.dataset.cmOneStepWheelBound === "1") return;
  rail.dataset.cmOneStepWheelBound = "1";
  let burstLocked = false;
  let releaseTimer = 0;

  rail.addEventListener("wheel", (event) => {
    if (event.ctrlKey) return; // Preserve browser zoom gestures.
    const delta = event.shiftKey ? event.deltaY : event.deltaX;
    if (!Number.isFinite(delta) || Math.abs(delta) < 2) return;
    // A mostly vertical wheel gesture should continue scrolling the page.
    if (!event.shiftKey && Math.abs(delta) < Math.max(4, Math.abs(event.deltaY) * 0.72)) return;
    event.preventDefault();

    window.clearTimeout(releaseTimer);
    releaseTimer = window.setTimeout(() => { burstLocked = false; }, 380);
    if (burstLocked) return;
    burstLocked = true;

    const items = Array.from(rail.querySelectorAll(selector)).filter((item) => item.parentElement === rail);
    if (items.length < 2) return;
    const railRect = rail.getBoundingClientRect();
    const centered = alignment === "center";
    const rtl = getComputedStyle(rail).direction === "rtl";
    let currentIndex = 0;
    let bestDistance = Infinity;
    items.forEach((item, index) => {
      const rect = item.getBoundingClientRect();
      const distance = centered
        ? Math.abs((rect.left + rect.right) / 2 - (railRect.left + railRect.right) / 2)
        : Math.abs(rtl ? rect.right - railRect.right : rect.left - railRect.left);
      if (distance < bestDistance) { bestDistance = distance; currentIndex = index; }
    });

    // A positive horizontal wheel gesture moves to the next item in rail order.
    const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + (delta > 0 ? 1 : -1)));
    if (nextIndex === currentIndex) return;
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    items[nextIndex].scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest", inline: centered ? "center" : "start" });
  }, { passive: false });
}

/* ---- بنرهای صفحه اصلی: از پنل ادمین مدیریت می‌شوند (GET /banners). تا رسیدن پاسخ، آخرین نسخهٔ ذخیره‌شده یا بنرهای پیش‌فرض نمایش داده می‌شود. ---- */
const CM_BANNER_KEY = "cm_home_banners_v1";
const CM_BANNER_DEFAULTS = [
  { imageUrl: "assets/home-banner-1-newspaper.webp?v=cm-perf-20261103-1", action: "goSell", linkUrl: "", alt: "هزینه ثبت آگهی رایگان شد" },
  { imageUrl: "assets/home-banner-4-top-showroom.webp?v=cm-perf-20261103-1", action: "browseDealers", linkUrl: "", alt: "نمایشگاه برتر شهرت شو" },
  { imageUrl: "assets/home-banner-2-khuzestan.webp?v=cm-perf-20261103-1", action: "goListings", linkUrl: "", alt: "خوزستان کف دستته" },
  { imageUrl: "assets/home-banner-3-direct.webp?v=cm-perf-20261103-1", action: "goListings", linkUrl: "", alt: "بدون واسطه انجامش بده" },
];
/* CM-LT: latest listings rail (horizontal cards) + promo image fallback */
function cmLtFa(v) { return String(v).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]); }
function cmLtCard(l) {
  const esc = (v) => (typeof escHtml === "function" ? escHtml(String(v == null ? "" : v)) : String(v == null ? "" : v));
  const title = (typeof listingDisplayTitle === "function" ? listingDisplayTitle(l) : "") || l.adTitle || l.title || "";
  const miles = parseInt(String(l.miles == null ? "" : l.miles).replace(/[^0-9]/g, ""), 10);
  const km = Number.isFinite(miles) ? Math.round((miles * 1.60934) / 10) * 10 : null;
  const raw = typeof normalizePriceDigits === "function" ? normalizePriceDigits(l.price) : l.price;
  let num = Number(l.priceAmount);
  if (!Number.isFinite(num) || num <= 0) num = parseInt(String(raw == null ? "" : raw).replace(/[^0-9]/g, ""), 10);
  const nego = typeof isNegotiablePrice === "function" && isNegotiablePrice(l.price);
  const priceHtml = Number.isFinite(num) && num > 0 && !nego ? `<b dir="ltr">${cmLtFa(num.toLocaleString("en-US"))}</b><small>تومان</small>` : `<b>${nego ? "توافقی" : "تماس بگیرید"}</b>`;
  const city = typeof cardCityLabel === "function" ? cardCityLabel(l) : (l.city || "");
  const urgent = typeof isListingUrgent === "function" && isListingUrgent(l);
  let dealer = false; try { dealer = typeof listingSeller === "function" && listingSeller(l).type === "dealer"; } catch (_) {}
  const tag = urgent ? "فوری" : (dealer ? "فروشگاهی" : "شخصی");
  let liked = false; try { liked = typeof state !== "undefined" && state.likedIds.includes(l.id); } catch (_) {}
  const photo = typeof cardPhotoMarkup === "function" ? cardPhotoMarkup(l) : "";
  /* CM-CARD-A */
  const cmFaEn = (s) => String(s).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  let yrM = cmFaEn(l.year == null ? "" : l.year).match(/\b(19|20)\d{2}\b/);
  if (!yrM) yrM = cmFaEn(title).match(/\b(19|20)\d{2}\b/);
  const chips = (urgent ? '<span class="cm-ca-chip is-urgent">فوری</span>' : "") + (yrM ? `<span class="cm-ca-chip">${cmLtFa(yrM[0])}</span>` : "") + (km != null ? `<span class="cm-ca-chip">${cmLtFa(km.toLocaleString("en-US"))} کیلومتر</span>` : "");
  return `<article class="cm-lt-card cm-ca" data-action="goVehicle" data-id="${esc(l.id)}">
    <div class="cm-lt-photo">${photo}</div>
    <button type="button" class="cm-lt-heart${liked ? " is-on" : ""}" data-action="toggleLike" data-id="${esc(l.id)}" aria-label="ذخیره آگهی"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>
    <div class="cm-ca-top">${chips}</div>
    <div class="cm-lt-body">
      <div class="cm-ca-info"><h3 class="cm-lt-title" dir="auto">${esc(title)}</h3>${city ? `<p class="cm-lt-sub">${esc(city)}</p>` : ""}</div>
      <div class="cm-ca-end"><div class="cm-lt-price">${priceHtml}</div><span class="cm-ca-go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></span></div>
    </div>
  </article>`;
}
function cmLtFill(rail, sorted, page) {
  if (!rail) return;
  rail.innerHTML = sorted.slice(0, 10).map(cmLtCard).join("");
  const wrap = rail.parentElement;
  const next = wrap && wrap.querySelector(".cm-lt-next"), prev = wrap && wrap.querySelector(".cm-lt-prev");
  const step = () => Math.max(200, Math.round(rail.clientWidth * 0.8));
  const sync = () => {
    const max = rail.scrollWidth - rail.clientWidth, pos = Math.abs(rail.scrollLeft);
    if (prev) prev.hidden = pos < 8;
    if (next) next.hidden = max <= 8 || pos > max - 8;
  };
  if (next) next.addEventListener("click", (e) => { e.stopPropagation(); rail.scrollBy({ left: -step(), behavior: "smooth" }); });
  if (prev) prev.addEventListener("click", (e) => { e.stopPropagation(); rail.scrollBy({ left: step(), behavior: "smooth" }); });
  rail.addEventListener("scroll", sync, { passive: true });
  window.requestAnimationFrame(sync); window.setTimeout(sync, 400);
  const pi = page && page.querySelector(".cm-lt-promo-img");
  if (pi) {
    const fallback = () => { if (pi.dataset.fb) return; pi.dataset.fb = "1"; pi.classList.add("is-flip"); pi.src = "assets/promo-suv-light.webp?v=cm-perf-20261103-1"; };
    pi.addEventListener("error", fallback);
    if (pi.complete && pi.naturalWidth === 0 && pi.getAttribute("src")) fallback();
  }
}
/* CM-BR:BEGIN (v5 - brand rail; list is preserved from the previous block) */
const CM_BRAND_RAIL = [{"fa":"نیسان","en":"Nissan","src":"home-demo-assets/logos/nissan.webp","mono":false},{"fa":"رنو","en":"Renault","src":"","mono":true},{"fa":"پژو","en":"Peugeot","src":"home-demo-assets/logos/peugeot.webp","mono":false},{"fa":"کیا","en":"KIA","src":"home-demo-assets/logos/kia.webp","mono":true},{"fa":"هیوندا","en":"Hyundai","src":"","mono":true},{"fa":"بنز","en":"Mercedes","src":"logos/mercedes-benz.webp","mono":true},{"fa":"BMW","en":"BMW","src":"logos/bmw.webp","mono":true},{"fa":"تویوتا","en":"Toyota","src":"logos/toyota.webp","mono":true}];
function cmBrandRailHtml() {
  const esc = (v) => (typeof escHtml === "function" ? escHtml(String(v == null ? "" : v)) : String(v == null ? "" : v));
  const chev = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>';
  const items = CM_BRAND_RAIL.map((b) => {
    const logo = b.src
      ? `<img src="${esc(b.src)}" alt="" width="58" height="42" loading="lazy" decoding="async" draggable="false" data-no-sk />`
      : `<span class="cm-br5-wm">${esc(b.en.replace(/-.*$/, ""))}</span>`;
    return `<button type="button" class="cm-br5-tile${b.mono ? " cm-br5-mono" : ""}" role="listitem" data-action="pickBrandSheet" data-brand="${esc(b.fa)}" aria-label="${esc("آگهی‌های " + b.fa)}"><span class="cm-br5-logo">${logo}</span></button>`;
  }).join("");
  return `<section class="cm-br cm-br5" dir="rtl" aria-label="برندهای خودرو"><div class="cm-br5-box cm-br5-ml"><div class="cm-br5-rail" dir="rtl" role="list">${items}<button type="button" class="cm-br5-all" data-action="openBrandSheet" aria-label="همه برندها"><span class="cm-br5-ic">${chev}</span><span>همه برندها</span></button></div><button type="button" class="cm-br5-hint" aria-label="برندهای بیشتر" tabindex="-1">${chev}</button></div></section>`;
}
/* CM-BR:END */
function cmBannerList() {
  try {
    const c = JSON.parse(localStorage.getItem(CM_BANNER_KEY) || "null");
    if (Array.isArray(c)) return c;
  } catch (_) {}
  return CM_BANNER_DEFAULTS;
}
function cmBannerEsc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function cmBannerSlide(b, i) {
  const src = String(b.imageUrl || "");
  if (!/^(assets\/|\/media\/|https:\/\/)/.test(src)) return "";
  const alt = cmBannerEsc(b.alt || "");
  const img = `<img src="${cmBannerEsc(src)}" alt="" width="1672" height="941"${i === 0 ? ' decoding="async" fetchpriority="high"' : ' loading="lazy" decoding="async"'} />`;
  const cls = "cm-hb-slide cm-hb-slide--img";
  if (b.action === "url" && /^(https:\/\/\S+|\/(?!\/)\S*)$/.test(String(b.linkUrl || ""))) {
    const ext = String(b.linkUrl).startsWith("https://");
    return `<a class="${cls}" href="${cmBannerEsc(b.linkUrl)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""} aria-label="${alt}">${img}</a>`;
  }
  if (["goSell", "browseDealers", "goListings", "goNews"].includes(b.action)) {
    return `<button type="button" class="${cls}" data-action="${b.action}"${b.action === "goListings" ? ' data-brand="all"' : ""} aria-label="${alt}">${img}</button>`;
  }
  return `<div class="${cls} cm-hb-slide--static" role="img" aria-label="${alt}">${img}</div>`;
}
function cmBannerSlidesHtml(list) { return list.map(cmBannerSlide).filter(Boolean).join(""); }
function cmBannerDotsHtml(n) { let h = ""; for (let k = 0; k < n; k++) h += `<button type="button" class="cm-hb-dot${k === 0 ? " is-on" : ""}" aria-label="بنر ${k + 1}"></button>`; return h; }
async function cmFetchBanners() {
  const base = String(window.CARMA_API_BASE || "/api/v1").replace(/\/$/, "");
  try {
    const r = await fetch(base + "/banners", { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d && d.items) ? d.items : null;
  } catch (_) { return null; }
}

/* CM-HERO: بالای صفحه اصلی — خوش‌آمد، جستجو + فیلتر، چهار دسترسی سریع، کارت ویژه، شهرهای پرطرفدار */
function cmHeroHtml() {
  const esc = (v) => (typeof escHtml === "function" ? escHtml(String(v == null ? "" : v)) : String(v == null ? "" : v));
  const fa = (v) => (typeof cmLtFa === "function" ? cmLtFa(v) : String(v));
  const ic = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  let name = "";
  try { const p = (typeof state !== "undefined" && state.accountProfile) || {}; name = String(p.firstName || "").trim(); } catch (_) {}
  const hello = name ? `سلام، ${esc(name)} 👋` : "سلام 👋";
  const tiles = [
    { a: 'data-action="goListings" data-brand="all"', t: "خرید", on: true, i: '<path d="M5 16l1.4-4.2A2 2 0 0 1 8.3 10.4h7.4a2 2 0 0 1 1.9 1.4L19 16"/><path d="M4 16h16v3H4z"/><circle cx="8" cy="19" r="0.6"/><circle cx="16" cy="19" r="0.6"/>' },
    { a: 'data-action="goSell"', t: "فروش", i: '<path d="M12 5v14M5 12h14"/>' },
    { a: 'data-action="browseDealers"', t: "نمایشگاه‌ها", i: '<path d="M4 10l1.2-4.5A1 1 0 0 1 6.2 5h11.6a1 1 0 0 1 1 .5L20 10"/><path d="M5 10v9h14v-9"/><path d="M4 10a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 10"/>' },
    { a: 'data-cm-bm="1"', t: "بازار سیاه", blk: true, i: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>' },
  ].map((x) => `<button type="button" class="cm-hh-tile${x.on ? " is-on" : ""}${x.blk ? " cm-hh-tile--black" : ""}" ${x.a}><span class="cm-hh-tile-ic">${ic(x.i)}</span><span>${x.t}</span></button>`).join("");
  const all = Array.isArray(LISTINGS) ? LISTINGS.slice() : [];
  const card = (l, i, label) => {
    const title = (typeof listingDisplayTitle === "function" ? listingDisplayTitle(l) : "") || l.adTitle || l.title || "";
    const miles = parseInt(String(l.miles == null ? "" : l.miles).replace(/[^0-9]/g, ""), 10);
    const km = Number.isFinite(Number(l.mileageKm)) && l.mileageKm !== "" && l.mileageKm != null ? Number(l.mileageKm) : (Number.isFinite(miles) ? Math.round((miles * 1.60934) / 10) * 10 : null);
    const raw = typeof normalizePriceDigits === "function" ? normalizePriceDigits(l.price) : l.price;
    let num = Number(l.priceAmount);
    if (!Number.isFinite(num) || num <= 0) num = parseInt(String(raw == null ? "" : raw).replace(/[^0-9]/g, ""), 10);
    const nego = typeof isNegotiablePrice === "function" && isNegotiablePrice(l.price);
    const price = Number.isFinite(num) && num > 0 && !nego ? `<b dir="ltr">${fa(num.toLocaleString("en-US"))}</b><small>تومان</small>` : `<b>${nego ? "توافقی" : "تماس بگیرید"}</b>`;
    const city = typeof cardCityLabel === "function" ? cardCityLabel(l) : (l.city || "");
    const yr = String(l.year == null ? "" : l.year).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).match(/(19|20)\d{2}/);
    const specs = [yr ? fa(yr[0]) : (l.year ? fa(l.year) : ""), km === 0 ? "صفر کیلومتر" : (km != null ? fa(km.toLocaleString("en-US")) + " کیلومتر" : ""), l.transmission ? esc(l.transmission) : ""].filter(Boolean).map((t) => `<span>${t}</span>`).join("");
    let liked = false; try { liked = state.likedIds.includes(l.id); } catch (_) {}
    const photo = typeof cardPhotoMarkup === "function" ? cardPhotoMarkup(l) : "";
    return `<article class="cm-hh-card" data-action="goVehicle" data-id="${esc(l.id)}">
      <div class="cm-hh-photo">${photo}</div>
      <span class="cm-hh-badge">${esc(label || (l.promoted ? "ویژه" : "جدید"))}</span>
      <button type="button" class="cm-hh-heart${liked ? " is-on" : ""}" data-action="toggleLike" data-id="${esc(l.id)}" aria-label="ذخیره آگهی">${ic('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>')}</button>
      <div class="cm-hh-info">
        <div class="cm-hh-main"><h3 dir="auto">${esc(title)}</h3>${city ? `<p>${ic('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>')}${esc(city)}</p>` : ""}</div>
        <div class="cm-hh-price">${price}</div>
      </div>
      ${specs ? `<div class="cm-hh-specs">${specs}</div>` : ""}
    </article>`;
  };
  const empty = `<article class="cm-hh-card cm-hh-card--empty"><div class="cm-hh-empty-ic">${ic('<path d="M5 16l1.4-4.2A2 2 0 0 1 8.3 10.4h7.4a2 2 0 0 1 1.9 1.4L19 16"/><path d="M4 16h16v3H4z"/>')}</div><h3>هنوز آگهی‌ای ثبت نشده</h3><p>اولین خودرو را رایگان ثبت کن.</p><button type="button" class="cm-hh-cta" data-action="goSell">ثبت آگهی</button></article>`;
  /* CM-HERO-SLIDES: آگهی برتر، نمایشگاه برتر، جدیدترین، صفر کیلومتر، اقساطی */
  const used = new Set(), slides = [];
  const views = (l) => Number(l.viewCount) || 0, created = (l) => Number(l.createdAt) || 0;
  const take = (arr, label) => { const l = arr.find((x) => !used.has(x.id)); if (l) { used.add(l.id); slides.push(card(l, slides.length, label)); } };
  const byTop = all.slice().sort((a, b) => ((b.promoted ? 1 : 0) - (a.promoted ? 1 : 0)) || (views(b) - views(a)));
  take(byTop, "آگهی برتر");
  try {
    const dir = typeof getShowroomDirectoryItems === "function" ? getShowroomDirectoryItems() : [];
    const ranked = typeof sortShowroomsForRanking === "function" ? sortShowroomsForRanking(dir, "activity") : dir.slice();
    const sr = ranked[0];
    if (sr && sr.id) {
      const cover = typeof showroomCoverHTML === "function" ? showroomCoverHTML(sr) : "";
      const cnt = Array.isArray(sr.listings) ? sr.listings.length : 0;
      const fol = Math.max(0, Number(sr.followers) || 0);
      const rt = sr.rating || (typeof showroomRatingFor === "function" ? showroomRatingFor(sr.id) : { count: 0, average: 0 });
      const rtl = rt && rt.count ? Number(rt.average).toLocaleString("fa-IR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " امتیاز" : "";
      const pin = ic('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>');
      const sp = [fa(cnt) + " آگهی فعال", fol ? fa(fol) + " دنبال‌کننده" : "", rtl].filter(Boolean).map((t) => `<span>${t}</span>`).join("");
      slides.push(`<article class="cm-hh-card cm-hh-card--sr" data-action="goSeller" data-seller-id="${esc(sr.id)}">
      <div class="cm-hh-photo">${cover}</div>
      <span class="cm-hh-badge">نمایشگاه برتر</span>
      <div class="cm-hh-info">
        <div class="cm-hh-main"><h3 dir="auto">${esc(sr.name || "نمایشگاه خودرو")}</h3>${sr.city ? `<p>${pin}${esc(sr.city)}</p>` : ""}</div>
        <span class="cm-hh-go" aria-hidden="true">مشاهده نمایشگاه</span>
      </div>
      <div class="cm-hh-specs">${sp}</div>
    </article>`);
    }
  } catch (_) {}
  take(all.slice().sort((a, b) => created(b) - created(a)), "جدیدترین آگهی");
  take(all.filter((l) => l.mileageType === "zero" || /صفر/.test(String(l.miles || ""))).sort((a, b) => views(b) - views(a)), "صفر کیلومتر");
  take(all.filter((l) => l.installment || l.est).sort((a, b) => views(b) - views(a)), "اقساطی");
  const cards = slides.length ? slides.join("") : empty;
  const dots = slides.length > 1 ? slides.map((_, k) => `<i class="${k === 0 ? "is-on" : ""}"></i>`).join("") : "";
  const counts = {};
  all.forEach((l) => { const c = String((typeof cardCityLabel === "function" ? cardCityLabel(l) : l.city) || "").trim(); if (c) counts[c] = (counts[c] || 0) + 1; });
  let cities = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  ["اهواز", "آبادان", "دزفول", "ماهشهر", "بهبهان", "شوشتر"].forEach((c) => { if (cities.length < 6 && !cities.includes(c)) cities.push(c); });
  cities = cities.slice(0, 8);
  const cityHtml = cities.map((c, k) => `<button type="button" class="cm-hh-city" data-cm-city="${esc(c)}" style="--k:${k % 4}"><span class="cm-hh-city-ini" aria-hidden="true">${esc(c.charAt(0))}</span><b>${esc(c)}</b><small>${counts[c] ? fa(counts[c]) + " آگهی" : "مشاهده آگهی‌ها"}</small></button>`).join("");
  return `<section class="cm-hh" aria-label="شروع">
    <div class="cm-hh-searchrow">
      <button type="button" class="cm-hh-search" data-action="openSearchOverlay" aria-label="جستجو در خودروها، برندها و مدل‌ها">
        ${ic('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>')}
        <span class="bar-search-field"><input id="homeToolSearchInput" type="text" tabindex="-1" readonly autocomplete="off" aria-hidden="true" /><span class="bar-search-copy" aria-hidden="true"><span class="bar-search-label">جستجو خودرو بر اساس</span><span class="bar-search-rotator" id="homeSearchRotator"></span></span></span>
      </button>
      <button type="button" class="cm-hh-filter" data-action="toggleToolFilters" aria-label="فیلترها">${ic('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>')}</button>
    </div>
    <div class="cm-hh-promo" role="group" aria-label="معرفی">
      <div class="cm-hp-track" tabindex="0">
        <article class="cm-hp-slide">
          <div class="cm-hp-copy"><span class="cm-hp-hello">${hello}</span><h1>خودروی مناسبت را پیدا کن</h1><p>آگهی‌های معتبر، یک‌جا و بدون واسطه</p><button type="button" class="cm-hp-btn" data-action="goListings" data-brand="all">مشاهده آگهی‌ها</button></div>
          <img class="cm-hp-img" src="assets/promo-suv-light.webp" alt="" width="1440" height="612" loading="eager" decoding="async" draggable="false" />
        </article>
        <article class="cm-hp-slide">
          <div class="cm-hp-copy"><span class="cm-hp-hello">فروش خودرو</span><h2>خودروت را سریع بفروش</h2><p>در چند دقیقه آگهی ثبت کن</p><button type="button" class="cm-hp-btn" data-action="goSell">ثبت آگهی</button></div>
          <img class="cm-hp-img" src="assets/home-experience-car.webp" alt="" width="1472" height="824" loading="lazy" decoding="async" draggable="false" />
        </article>
      </div>
      <div class="cm-hp-dots" aria-hidden="true"><i class="is-on"></i><i></i></div>
    </div>
    <div class="cm-hh-tiles">${tiles}</div>
    <div class="cm-hh-feat"><div class="cm-hh-track" tabindex="0" aria-label="آگهی‌های ویژه">${cards}</div>${dots ? `<div class="cm-hh-dots" aria-hidden="true">${dots}</div>` : ""}</div>
    <div class="cm-hh-sechead"><h2>شهرهای پرطرفدار</h2><button type="button" class="cm-hh-all" data-action="goListings" data-brand="all">مشاهده همه</button></div>
    <div class="cm-hh-cities">${cityHtml}</div>
  </section>`;
}
function renderHomeScreen() {
  const page = document.createElement("section");
  page.dataset.page = "home";
  page.className = "cm-home-page";
  page.innerHTML = `

    ${cmHeroHtml()}

    ${window.MARQUE_STORIES && typeof window.MARQUE_STORIES.renderTop === "function" ? window.MARQUE_STORIES.renderTop() : ""}

    ${(() => { const _bl = cmBannerList(); const _slides = cmBannerSlidesHtml(_bl); const _n = _bl.filter((b) => cmBannerSlide(b, 0)).length; return _n ? `<section class="cm-hb" aria-label="تبلیغات">
      <div class="cm-hb-banner">
        <div class="cm-hb-track" tabindex="0" aria-label="بنرها">${_slides}</div>
        <div class="cm-hb-dots" role="group" aria-label="انتخاب بنر">${cmBannerDotsHtml(_n)}</div>
      </div>
    </section>` : ""; })()}

    

    <!-- CM-BR removed -->

    <!-- CM-LT -->
<section class="cm-lt-sec" aria-label="جدیدترین آگهی‌ها">
      <div class="cm-lt-head"><h2>جدیدترین آگهی‌ها</h2><button type="button" class="cm-lt-all" data-action="goListings" data-brand="all">مشاهده همه <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button></div>
      <div class="cm-lt-wrap">
        <div class="cm-lt-rail" data-slot="latest-listings" aria-label="آگهی‌های جدید"></div>
        <button type="button" class="cm-lt-nav cm-lt-prev" aria-label="قبلی" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>
        <button type="button" class="cm-lt-nav cm-lt-next" aria-label="بعدی"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>
      </div>
    </section>

    <section class="cm-lt-promo cm-xp" aria-label="تبلیغ">
      <img class="cm-lt-promo-img" src="assets/home-experience-car.webp?v=xp1" alt="" width="1472" height="824" loading="lazy" decoding="async" draggable="false" />
      <div class="cm-lt-promo-copy"><h3>تجربه‌ای متفاوت در خرید خودرو</h3><button type="button" class="cm-lt-cta" data-action="goListings" data-brand="all">شروع کنید <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m0 0 6-6m-6 6 6 6"/></svg></button></div>
    </section>

    <section class="cm-lay-section cm-lay-section--showrooms" aria-label="نمایشگاه‌ها">
      <div class="cm-lay-head cm-lay-head--showrooms">
        <div class="cm-lay-showrooms-heading"><h2>نمایشگاه‌ها</h2><p>نمایشگاه‌های برتر خودرو، در یک نگاه</p></div>
        <button type="button" class="cm-lay-link" data-action="browseDealers">همه نمایشگاه‌ها <span aria-hidden="true">←</span></button>
      </div>
      
      <div class="cm-lay-showrooms" data-slot="featured-showrooms" aria-label="نمایشگاه‌های برتر" tabindex="0"></div>
    </section>

    <section class="cm-lay-section cm-lay-section--news" aria-label="اخبار روز خودرو">
      <div class="cm-lay-head"><h2>اخبار روز خودرو</h2><button type="button" class="cm-lay-link" data-action="goNews">مشاهده همه <span aria-hidden="true">←</span></button></div>
      <div class="cm-lay-feed" data-slot="home-news"></div>
    </section>


    <!-- CM-POPBRANDS START --><section class="cm-pb" dir="rtl" aria-label="برندهای پرتقاضا"><div class="cm-hh-sechead"><h2>برندهای پرتقاضا</h2></div><div class="cm-pb-grid"><button type="button" class="cm-pb-tile" data-action="pickBrandSheet" data-brand="پژو" aria-label="آگهی‌های پژو"><span class="cm-pb-logo"><img src="home-demo-assets/logos/peugeot.webp" alt="" loading="lazy" decoding="async" draggable="false" data-no-sk /></span><span class="cm-pb-name">پژو</span></button><button type="button" class="cm-pb-tile" data-action="pickBrandSheet" data-brand="تویوتا" aria-label="آگهی‌های تویوتا"><span class="cm-pb-logo"><img src="logos/toyota.webp" alt="" loading="lazy" decoding="async" draggable="false" data-no-sk /></span><span class="cm-pb-name">تویوتا</span></button><button type="button" class="cm-pb-tile" data-action="pickBrandSheet" data-brand="BMW" aria-label="آگهی‌های ب ام و"><span class="cm-pb-logo"><img src="logos/bmw.webp" alt="" loading="lazy" decoding="async" draggable="false" data-no-sk /></span><span class="cm-pb-name">ب ام و</span></button><button type="button" class="cm-pb-tile" data-action="pickBrandSheet" data-brand="کی ام سی" aria-label="آگهی‌های کی ام سی"><span class="cm-pb-logo"><span class="cm-pb-wm">KMC</span></span><span class="cm-pb-name">کی ام سی</span></button><button type="button" class="cm-pb-tile" data-action="pickBrandSheet" data-brand="کیا" aria-label="آگهی‌های کیا"><span class="cm-pb-logo"><img src="home-demo-assets/logos/kia.webp" alt="" loading="lazy" decoding="async" draggable="false" data-no-sk /></span><span class="cm-pb-name">کیا</span></button><button type="button" class="cm-pb-tile" data-action="pickBrandSheet" data-brand="بنز" aria-label="آگهی‌های بنز"><span class="cm-pb-logo"><img src="logos/mercedes-benz.webp" alt="" loading="lazy" decoding="async" draggable="false" data-no-sk /></span><span class="cm-pb-name">بنز</span></button><button type="button" class="cm-pb-tile" data-action="pickBrandSheet" data-brand="لاماری" aria-label="آگهی‌های لاماری"><span class="cm-pb-logo"><span class="cm-pb-wm">LAMARI</span></span><span class="cm-pb-name">لاماری</span></button><button type="button" class="cm-pb-tile" data-action="pickBrandSheet" data-brand="مزدا" aria-label="آگهی‌های مزدا"><span class="cm-pb-logo"><img class="cm-pb-raw" src="home-demo-assets/logos/mazda.webp" alt="" loading="lazy" decoding="async" draggable="false" data-no-sk /></span><span class="cm-pb-name">مزدا</span></button><button type="button" class="cm-pb-tile" data-action="pickBrandSheet" data-brand="تارا" aria-label="آگهی‌های تارا"><span class="cm-pb-logo"><span class="cm-pb-wm">TARA</span></span><span class="cm-pb-name">تارا</span></button><button type="button" class="cm-pb-tile cm-pb-x" data-action="pickBrandSheet" data-brand="نیسان" aria-label="آگهی‌های نیسان"><span class="cm-pb-logo"><img class="cm-pb-raw" src="home-demo-assets/logos/nissan.webp" alt="" loading="lazy" decoding="async" draggable="false" data-no-sk /></span><span class="cm-pb-name">نیسان</span></button><button type="button" class="cm-pb-tile cm-pb-x" data-action="pickBrandSheet" data-brand="فولکس‌واگن" aria-label="آگهی‌های فولکس‌واگن"><span class="cm-pb-logo"><img class="cm-pb-raw" src="home-demo-assets/logos/volkswagen.webp" alt="" loading="lazy" decoding="async" draggable="false" data-no-sk /></span><span class="cm-pb-name">فولکس‌واگن</span></button><button type="button" class="cm-pb-tile cm-pb-x" data-action="pickBrandSheet" data-brand="ام جی" aria-label="آگهی‌های ام جی"><span class="cm-pb-logo"><img class="cm-pb-raw" src="home-demo-assets/logos/mg.webp" alt="" loading="lazy" decoding="async" draggable="false" data-no-sk /></span><span class="cm-pb-name">ام جی</span></button><button type="button" class="cm-pb-tile cm-pb-x" data-action="pickBrandSheet" data-brand="میتسوبیشی" aria-label="آگهی‌های میتسوبیشی"><span class="cm-pb-logo"><img class="cm-pb-raw" src="home-demo-assets/logos/mitsubishi.webp" alt="" loading="lazy" decoding="async" draggable="false" data-no-sk /></span><span class="cm-pb-name">میتسوبیشی</span></button><button type="button" class="cm-pb-tile cm-pb-x" data-action="pickBrandSheet" data-brand="هیوندا" aria-label="آگهی‌های هیوندا"><span class="cm-pb-logo"><span class="cm-pb-wm">HYUNDAI</span></span><span class="cm-pb-name">هیوندا</span></button><button type="button" class="cm-pb-tile cm-pb-x" data-action="pickBrandSheet" data-brand="رنو" aria-label="آگهی‌های رنو"><span class="cm-pb-logo"><span class="cm-pb-wm">RENAULT</span></span><span class="cm-pb-name">رنو</span></button></div><button type="button" class="cm-pb-more" data-pb-more aria-expanded="false"><span data-pb-label>بیشتر</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></section><!-- CM-POPBRANDS END -->

    <!-- CM-FT2 START --><footer class="cm-ft cm-ft2" aria-label="پاورقی سایت" data-ft><section class="cm-ft-hero" data-r style="--d:0"><span class="cm-ft-eyebrow"><i class="cm-ft-dot" aria-hidden="true"></i>کارما</span><h3 class="cm-ft-title">خودروی رویایی‌ات<br><em>همین‌جاست</em></h3><p class="cm-ft-sub">جستجو، مقایسه و گفت‌وگو با فروشنده؛ همه در کارما.</p><div class="cm-ft-cta"><button type="button" class="cm-ft-btn is-primary" data-action="goSell"><span>ثبت آگهی رایگان</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m0 0 6-6m-6 6 6 6"/></svg></button><button type="button" class="cm-ft-btn" data-action="goListings" data-brand="all"><span>مشاهده آگهی‌ها</span></button></div></section><div class="cm-ft-follow" data-r style="--d:2"><span>ما را دنبال کن</span></div><ul class="cm-ft-social" aria-label="شبکه‌های اجتماعی" data-r style="--d:3">
        <!-- آدرس‌ها موقتاً صفحه اصلی هر شبکه‌اند؛ با لینک واقعی کارما جایگزین شوند -->
        <li><a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="فیس‌بوک"><svg class="is-fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.8c0-.9.3-1.5 1.6-1.5h1.7V3.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.4H7.7V13h2.7v8z"/></svg></a></li>
        <li><a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="اینستاگرام"><svg class="is-stroke" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.1" cy="6.9" r=".6" fill="currentColor"/></svg></a></li>
        <li><a href="https://x.com/" target="_blank" rel="noopener noreferrer" aria-label="ایکس (توییتر)"><svg class="is-fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a></li>
        <li><a href="mailto:info@carma.ir" aria-label="ایمیل"><svg class="is-stroke" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m4 7.5 8 6 8-6"/></svg></a></li>
        <li><a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer" aria-label="یوتیوب"><svg class="is-fill" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.200.4 4.800a2.500 2.500 0 0 0 1.800 1.800C5.800 19 12 19 12 19s6.200 0 7.800-.4a2.500 2.500 0 0 0 1.800-1.800c.4-1.600.4-4.800.4-4.800s0-3.200-.4-4.800zM10 15V9l5.200 3z"/></svg></a></li>
      </ul><ul class="cm-ft-trust" aria-label="نمادهای اعتماد و مجوزها" data-r style="--d:4">
        <li class="cm-ft-trust-item"><div class="cm-ft-trust-seal"><a referrerpolicy="origin" target="_blank" href="https://trustseal.enamad.ir/?id=8368554&Code=FKomOATI2C6rxtFVRLBNwtPi9fnbzKIX"><img referrerpolicy="origin" src="https://trustseal.enamad.ir/logo.aspx?id=8368554&Code=FKomOATI2C6rxtFVRLBNwtPi9fnbzKIX" alt="" onerror="var l=this.closest('.cm-ft-trust-item');if(l)l.style.display='none'" style="cursor:pointer" code="FKomOATI2C6rxtFVRLBNwtPi9fnbzKIX"></a></div></li>
        <!-- مجوزهای بعدی: یک <li class="cm-ft-trust-item"> دیگر مثل بالا همین‌جا اضافه کن -->
      </ul><button type="button" class="cm-ft-top" data-ft-top data-r style="--d:5" aria-label="بازگشت به بالا"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m0 0-6 6m6-6 6 6"/></svg><span>بازگشت به بالا</span></button><p class="cm-ft-mark" lang="en" dir="ltr" aria-hidden="true">Carma</p></footer><!-- CM-FT2 END -->
  `;

  /* CM-HERO-PROMO: نقطه‌های باکس معرفی */
  (function () {
    const tr = page.querySelector(".cm-hp-track"), dots = page.querySelectorAll(".cm-hp-dots i");
    if (!tr || !dots.length) return;
    tr.addEventListener("scroll", () => {
      const k = Math.min(dots.length - 1, Math.max(0, Math.round(Math.abs(tr.scrollLeft) / (tr.clientWidth || 1))));
      dots.forEach((d, i) => d.classList.toggle("is-on", i === k));
    }, { passive: true });
  })();
  /* CM-HERO: نقطه‌های کارت ویژه + کلیک شهرها */
  (function () {
    const tr = page.querySelector(".cm-hh-track"), dots = page.querySelectorAll(".cm-hh-dots i");
    if (tr && dots.length) tr.addEventListener("scroll", () => {
      const c = tr.firstElementChild; if (!c) return;
      const k = Math.min(dots.length - 1, Math.max(0, Math.round(Math.abs(tr.scrollLeft) / (c.offsetWidth + 12))));
      dots.forEach((d, i) => d.classList.toggle("is-on", i === k));
    }, { passive: true });
    page.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cm-city]"); if (!b) return;
      const city = b.getAttribute("data-cm-city");
      navigateTo({ page: "listings", brand: "all" }, { menuOpen: false, selectedBrand: null, filters: { model: null, city, color: null, condition: null, year: null, priceMin: null, priceMax: null, transmission: null, bodyStyle: null }, sort: "newest", visibleCount: 12, listingsLoadingMore: false });
    });
  })();

  // Keep the home search word in sync with the header search rotator, including after route re-renders.
  if (typeof buildBarSearchRotator === "function") buildBarSearchRotator(page.querySelector("#homeSearchRotator")); /* CM-ROT-FIX: page هنوز داخل DOM نیست، getElementById جواب نمی‌داد */

  // Banner carousel: native scroll-snap, dots that follow the scroll position,
  // and a gentle auto-advance every 5s (pauses while the user touches it,
  // while it is off-screen or the tab is hidden; off for "reduce motion").
  const hbTrack = page.querySelector(".cm-hb-track");
  let hbDots = Array.from(page.querySelectorAll(".cm-hb-dot"));
  const hbDotsBox = page.querySelector(".cm-hb-dots");
  bindOneCardPerWheelGesture(hbTrack, ".cm-hb-slide", "center");
  if (hbTrack && hbDots.length) {
    const HB_DELAY = 4000, HB_RESUME = 4000;
    let hbRaf = 0, hbIdx = 0, hbPaused = false, hbResume = 0, hbSeen = false, hbVisible = true, hbTimer = 0;
    const hbGoTo = (k) => {
      const slide = hbTrack.children[k];
      if (!slide) return;
      const dx = slide.getBoundingClientRect().left - hbTrack.getBoundingClientRect().left;
      hbTrack.scrollBy({ left: dx, behavior: "smooth" });
    };
    const hbSync = () => {
      hbRaf = 0;
      const step = (hbTrack.firstElementChild ? hbTrack.firstElementChild.offsetWidth : hbTrack.clientWidth) + 10;
      hbIdx = Math.min(hbDots.length - 1, Math.max(0, Math.round(Math.abs(hbTrack.scrollLeft) / step)));
      hbDots.forEach((d, k) => { d.classList.toggle("is-on", k === hbIdx); d.setAttribute("aria-current", k === hbIdx ? "true" : "false"); });
    };
    const hbHold = () => { hbPaused = true; window.clearTimeout(hbResume); };
    const hbRelease = () => { window.clearTimeout(hbResume); hbResume = window.setTimeout(() => { hbPaused = false; }, HB_RESUME); };
    hbTrack.addEventListener("scroll", () => { if (!hbRaf) hbRaf = requestAnimationFrame(hbSync); }, { passive: true });
    hbTrack.addEventListener("pointerdown", hbHold, { passive: true });
    hbTrack.addEventListener("touchstart", hbHold, { passive: true });
    hbTrack.addEventListener("pointerup", hbRelease, { passive: true });
    hbTrack.addEventListener("touchend", hbRelease, { passive: true });
    hbTrack.addEventListener("pointercancel", hbRelease, { passive: true });
    hbTrack.addEventListener("focusin", hbHold);
    hbTrack.addEventListener("focusout", hbRelease);
    if (hbDotsBox) hbDotsBox.addEventListener("click", (e) => {
      const d = e.target.closest(".cm-hb-dot"); const k = d ? hbDots.indexOf(d) : -1;
      if (k >= 0) { hbHold(); hbGoTo(k); hbRelease(); }
    });
    page.__cmBannerPatch = (list) => {
      const html = cmBannerSlidesHtml(list); const n = list.filter((b) => cmBannerSlide(b, 0)).length;
      const sec = hbTrack.closest(".cm-hb");
      if (!n) { if (sec) sec.hidden = true; return; }
      if (sec) sec.hidden = false;
      hbTrack.innerHTML = html; hbDotsBox.innerHTML = cmBannerDotsHtml(n);
      hbDots = Array.from(hbDotsBox.children); hbIdx = 0; hbTrack.scrollLeft = 0;
    };
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      if ("IntersectionObserver" in window) {
        new IntersectionObserver((entries) => { hbVisible = entries.some((e) => e.isIntersecting); }, { threshold: 0.4 }).observe(hbTrack);
      }
      hbTimer = window.setInterval(() => {
        if (!hbTrack.isConnected) { if (hbSeen) window.clearInterval(hbTimer); return; }
        hbSeen = true;
        if (document.hidden || hbPaused || !hbVisible) return;
        hbGoTo((hbIdx + 1) % hbDots.length);
      }, HB_DELAY);
    }
  }

  cmFetchBanners().then((list) => {
    if (!list) return;
    const fresh = JSON.stringify(list), had = localStorage.getItem(CM_BANNER_KEY);
    if (fresh === had) return;
    try { localStorage.setItem(CM_BANNER_KEY, fresh); } catch (_) {}
    if (typeof page.__cmBannerPatch === "function" && page.isConnected) page.__cmBannerPatch(list);
  });

  const ftTop = page.querySelector("[data-ft-top]");
  if (ftTop) ftTop.addEventListener("click", () => {
    let el = page; while (el && el !== document.body) { if (el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) break; el = el.parentElement; }
    (el && el !== document.body ? el : window).scrollTo({ top: 0, behavior: "smooth" });
  });

  const rail = page.querySelector('[data-slot="latest-listings"]');
  /* Newest first by registration time (createdAt), regardless of how LISTINGS happens to be ordered. */
  const latestSorted = Array.isArray(LISTINGS) ? LISTINGS.slice().sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)) : [];
  cmLtFill(rail, latestSorted, page);
  const latest = [];
  if (latest.length && rail) {
    latest.forEach((listing, index) => {
      if (typeof renderExploreListingCardCompact === "function") {
        const holder = document.createElement("div");
        holder.innerHTML = renderExploreListingCardCompact(listing, index);
        if (holder.firstElementChild) rail.appendChild(holder.firstElementChild);
      }
    });
  }
  /* Third listing: a faded, non-clickable peek behind the "+" button (bright at the top, dark and nearly gone at the bottom). */
  const moreWrap = page.querySelector('[data-slot="latest-more"]');
  const peekListing = latestSorted[2] || null;
  if (moreWrap && peekListing && typeof renderExploreListingCardCompact === "function") {
    const peek = document.createElement("div");
    peek.className = "cm-lay-list cm-lay-peek";
    peek.setAttribute("aria-hidden", "true");
    peek.setAttribute("inert", "");
    peek.innerHTML = renderExploreListingCardCompact(peekListing, 2);
    peek.querySelectorAll("a,button,[tabindex],[data-action]").forEach((el) => { el.setAttribute("tabindex", "-1"); el.removeAttribute("data-action"); });
    moreWrap.insertBefore(peek, moreWrap.firstChild);
    moreWrap.classList.add("has-peek");
  }
  if (rail && !rail.children.length) {
    rail.innerHTML = `<div class="cm-home-empty-latest">هنوز آگهی‌ای برای نمایش نیست. اولین خودرو را ثبت کن.</div>`;
  }

  const showroomRail = page.querySelector('[data-slot="featured-showrooms"]');
  if (showroomRail && typeof getShowroomDirectoryItems === "function") {
    const showroomDirectory = getShowroomDirectoryItems();
    const rankedShowrooms = typeof sortShowroomsForRanking === "function"
      ? sortShowroomsForRanking(showroomDirectory, "activity")
      : showroomDirectory.slice().sort((a, b) => (Number(b.activityScore) || 0) - (Number(a.activityScore) || 0));
    const activeShowrooms = rankedShowrooms.slice(0, 3);
    const rankContext = typeof buildShowroomRankContext === "function" ? buildShowroomRankContext(showroomDirectory) : null;
    const esc = (v) => (typeof escHtml === "function" ? escHtml(v) : String(v ?? ""));
    const fa = (v) => Number(v || 0).toLocaleString("fa-IR");
    const storeIcon = typeof SR_ICON_STORE === "string" ? SR_ICON_STORE : "";
    const iconCar = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 1.8-4.1A2 2 0 0 1 7.6 5.7h8.8a2 2 0 0 1 1.8 1.2L20 11v6H4z"/><path d="M4 12h16M7 17v1.5M17 17v1.5"/><circle cx="7.5" cy="14.5" r="1.2"/><circle cx="16.5" cy="14.5" r="1.2"/></svg>';
    const iconUsers = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19v-1.6A4.4 4.4 0 0 1 7.9 13h2.2a4.4 4.4 0 0 1 4.4 4.4V19z"/><path d="M16 5.4a3 3 0 0 1 0 5.8M17.2 13.4a4.2 4.2 0 0 1 3.3 4.1V19"/></svg>';
    const iconStar = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/></svg>';
    const iconPin = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10.2c0 5-7 10.2-7 10.2S5 15.2 5 10.2a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/></svg>';
    const iconFlame = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.4 2.5c.4 3-1.2 4.6-2.6 6.2C8.400 10.300 7 11.800 7 14.300a5 5 0 0 0 10 0c0-2-.9-3.400-1.900-4.500-.2 1.200-.8 1.900-1.500 2.300.5-3.300-.1-6.600-1.200-9.600z" fill="currentColor" stroke="none"/></svg>';
    const iconArrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m0 0 6-6m-6 6 6 6"/></svg>';
    showroomRail.innerHTML = activeShowrooms.length ? activeShowrooms.map((item, index) => {
      const id = esc(item.id);
      const name = esc(item.name || "نمایشگاه خودرو");
      const city = esc(item.city || "موقعیت ثبت نشده");
      const rank = rankContext?.ranksBySort?.activity?.[String(item.id)] || (index + 1);
      const count = Array.isArray(item.listings) ? item.listings.length : 0;
      const followers = Math.max(0, Number(item.followers) || 0);
      const rating = item.rating || (typeof showroomRatingFor === "function" ? showroomRatingFor(item.id) : { count: 0, average: 0 });
      const ratingLabel = rating.count ? Number(rating.average).toLocaleString("fa-IR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "جدید";
      const mv = rankContext?.movementsBySort?.activity?.[String(item.id)] || (typeof demoShowroomRankMovement === "function" ? demoShowroomRankMovement(rank) : null);
      const mvDelta = mv ? Number(mv.delta) || 0 : 0;
      const moveHtml = mvDelta ? `<span class="cm-hfs-move ${mvDelta > 0 ? 'is-up' : 'is-down'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${mvDelta > 0 ? 'M12 20V5m0 0-6 6m6-6 6 6' : 'M12 4v15m0 0-6-6m6 6 6-6'}"/></svg>${mvDelta > 0 ? '+' : '-'}${Math.abs(mvDelta).toLocaleString("en-US")}</span>` : '';
      const cover = typeof showroomCoverHTML === "function" ? showroomCoverHTML(item) : `<div class="cm-hfs-no-cover">${storeIcon}</div>`;
      const avatar = item.logo
        ? `<img src="${esc(item.logo)}" alt="" loading="lazy" decoding="async" />`
        : `<span class="cm-hfs-avatar-placeholder">${storeIcon}</span>`;
      const verified = item.verified ? '<span class="cm-hfs-verified" aria-label="نمایشگاه تأییدشده" title="نمایشگاه تأییدشده"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.1L19 6.8"/></svg></span>' : '';
      return `<article class="cm-home-feature-showroom${index === 0 ? ' is-leading' : ''}">
        <button type="button" class="cm-hfs-media" data-action="goSeller" data-seller-id="${id}" aria-label="مشاهده نمایشگاه ${name}">
          ${cover}<span class="cm-hfs-image-shade" aria-hidden="true"></span>
          <span class="cm-hfs-rank" dir="ltr"><b>#${rank}</b>${moveHtml}</span>
          ${index === 0 ? `<span class="cm-hfs-featured">پرترافیک‌ترین ${iconFlame}</span>` : ''}
        </button>
        <div class="cm-hfs-body">
          <div class="cm-hfs-profile-row">
            <button type="button" class="cm-hfs-profile" data-action="goSeller" data-seller-id="${id}" aria-label="ورود به پروفایل ${name}">
              <span class="cm-hfs-avatar">${avatar}</span>
              <span class="cm-hfs-copy"><strong><span class="cm-hfs-name">${name}</span>${verified}</strong><small>${iconPin}<span>${city}</span></small></span>
            </button>
            <button type="button" class="cm-hfs-open" data-action="goSeller" data-seller-id="${id}" aria-label="مشاهده ${name}">${iconArrow}</button>
          </div>
          <div class="cm-hfs-divider" aria-hidden="true"></div>
          <dl class="cm-hfs-stats">
            <div><dd>${iconCar}<b>${fa(count)}</b></dd><dt>آگهی فعال</dt></div>
            <div><dd>${iconUsers}<b>${fa(followers)}</b></dd><dt>دنبال‌کننده</dt></div>
            <div><dd>${iconStar}<b>${ratingLabel}</b></dd><dt>امتیاز کاربران</dt></div>
          </dl>
        </div>
      </article>`;
    }).join("") : `<div class="sr-home-empty">هنوز نمایشگاهی برای نمایش ثبت نشده است.</div>`;

    // Keep the homepage showroom rail aligned one card at a time on touchpads and mouse wheels.
    bindOneCardPerWheelGesture(showroomRail, ".cm-home-feature-showroom", "start");

    // Pager dots (RTL: first dot = first card, on the right).
    let dots = showroomRail.parentElement.querySelector(".cm-hfs-dots");
    if (dots) dots.remove();
    const cards = Array.from(showroomRail.querySelectorAll(".cm-home-feature-showroom"));
    if (cards.length > 1) {
      dots = document.createElement("div");
      dots.className = "cm-hfs-dots";
      dots.setAttribute("aria-hidden", "true");
      dots.innerHTML = cards.map((_, i) => `<i${i === 0 ? ' class="is-active"' : ''}></i>`).join("");
      showroomRail.insertAdjacentElement("afterend", dots);
      let cardW = 0, lastIdx = -1;
      const sync = () => {
        if (!cardW) cardW = (cards[0].offsetWidth + 12) || 1;
        // RTL scroller: scrollLeft goes 0 -> negative; index = distance scrolled / card step
        const idx = Math.min(cards.length - 1, Math.max(0, Math.round(Math.abs(showroomRail.scrollLeft) / cardW)));
        if (idx === lastIdx) return;
        lastIdx = idx;
        Array.from(dots.children).forEach((el, i) => el.classList.toggle("is-active", i === idx));
      };
      { let t = false; showroomRail.addEventListener("scroll", () => { if (t) return; t = true; requestAnimationFrame(() => { t = false; sync(); }); }, { passive: true }); window.addEventListener("resize", () => { cardW = 0; }, { passive: true }); }
    }
  }

  const newsSlot = page.querySelector('[data-slot="home-news"]');
  if (newsSlot && typeof window.CARMA_NEWS_HOME_HTML === "function") newsSlot.innerHTML = window.CARMA_NEWS_HOME_HTML();


  /* CM-HOME-CLEAN:BEGIN */
  (function () {
    const lt = page.querySelector(".cm-lt-sec");
    const hb = page.querySelector(".cm-hb");
    const promo = page.querySelector(".cm-lt-promo");
    if (lt && hb) lt.after(hb);
    const syncPromo = () => { if (promo) promo.hidden = !!(hb && !hb.hidden); };
    syncPromo();
    const prevPatch = page.__cmBannerPatch;
    if (typeof prevPatch === "function") page.__cmBannerPatch = (list) => { prevPatch(list); syncPromo(); };
    const sw = page.querySelector(".cm-home-search-wrap");
    if (sw && !page.querySelector(".cm-qf")) {
      const items = ["سدان", "شاسی‌بلند", "هاچ‌بک", "وانت", "کوپه", "مینی‌ون"];
      const qf = document.createElement("div");
      qf.className = "cm-qf"; qf.setAttribute("role", "group"); qf.setAttribute("aria-label", "میانبر نوع بدنه");
      qf.innerHTML = items.map((v) => `<button type="button" class="cm-qf-chip" data-qf="${v}">${v}</button>`).join("");
      sw.after(qf);
      qf.addEventListener("click", (e) => {
        const b = e.target.closest("[data-qf]"); if (!b) return;
        if (typeof navigateTo !== "function") return;
        navigateTo({ page: "listings", brand: "all" }, {
          menuOpen: false, selectedBrand: null, sort: "newest", filterOpenKey: null, sortOpen: false, toolFiltersOpen: false, visibleCount: 12, listingsLoadingMore: false,
          filters: { model: null, city: null, color: null, condition: null, year: null, priceMin: null, priceMax: null, transmission: null, bodyStyle: b.getAttribute("data-qf") }
        });
      });
    }
  })();
  /* CM-ORDER: ریل استوری‌ها بعد از ریل برندها */
  (function () {
    const ts = page.querySelector(".cm-ts"), b5 = page.querySelector(".cm-br5, .cm-br");
    if (ts && b5) { b5.after(ts); b5.style.marginTop = "14px"; }
  })();
  /* CM-ORDER3: ریل استوری‌ها بالای چیپ‌های نوع بدنه (سدان، هاچ‌بک، ...) */
  (function () {
    const ts = page.querySelector(".cm-ts"), qf = page.querySelector(".cm-qf");
    if (!ts || !qf) return;
    const anchor = qf.closest(".cm-fx") || qf;
    anchor.before(ts);
    ts.style.margin = "4px 0 0";
  })();
  /* CM-QF6:BEGIN - کارت واحد «نوع بدنه | برندها» با دو تب؛ استایل از داخل JS تزریق می‌شود */
  (function () {
    if (!document.getElementById("cm-qf6-css")) {
      const st = document.createElement("style");
      st.id = "cm-qf6-css";
      st.textContent = [
        ".cm-home-page .cm-dc{position:relative;margin:14px 16px 0!important;padding:12px 12px 14px!important;border-radius:30px!important;background:linear-gradient(180deg,#19161b 0%,#0f0d11 100%)!important;border:1px solid rgba(255,255,255,.09)!important;box-shadow:0 18px 40px -22px rgba(0,0,0,.9)!important;direction:rtl}",
        ".cm-home-page .cm-dc::before{content:'';position:absolute;top:-1px;left:50%;width:120px;height:3px;margin-left:-60px;border-radius:0 0 4px 4px;background:#ffffff;box-shadow:0 0 14px rgba(255,255,255,.42);pointer-events:none}",
        ".cm-dc-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06)}",
        ".cm-dc-tabs button{height:42px;border:0;border-radius:999px;background:transparent;color:#a9abb4;font:inherit;font-size:14px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .2s ease,color .2s ease,box-shadow .2s ease}",
        ".cm-dc-tabs button.is-on{background:#ffffff;color:#1D1D1F;box-shadow:0 8px 18px -8px rgba(255,255,255,.4)}",
        ".cm-dc-pane{margin-top:14px;min-height:62px}",
        ".cm-dc-pane[hidden]{display:none!important}",
        /* چیپ‌های نوع بدنه */
        ".cm-home-page .cm-dc .cm-qf{display:flex!important;gap:10px!important;padding:0 2px!important;margin:0!important;overflow-x:auto!important;scrollbar-width:none}",
        ".cm-home-page .cm-dc .cm-qf .cm-qf-chip{flex:0 0 auto!important;display:inline-flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;height:60px!important;min-height:60px!important;padding:0 20px 0 6px!important;border-radius:999px!important;border:1px solid rgba(255,255,255,.1)!important;background:rgba(255,255,255,.05)!important;color:#f2f4f8!important;font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif!important;font-size:14px!important;font-weight:600!important;letter-spacing:.03em!important;line-height:1!important;transition:background .18s ease,border-color .18s ease,color .18s ease,transform .15s ease}",
        ".cm-dc .cm-qf6-th{flex:0 0 auto!important;display:flex!important;align-items:center!important;justify-content:center!important;width:70px!important;height:44px!important;border-radius:999px!important;background:#fff!important;overflow:hidden!important;color:#2a2a30!important}",
        ".cm-dc .cm-qf6-th img{display:block!important;width:56px!important;height:auto!important;max-height:32px!important;object-fit:contain!important;margin:0!important}",
        ".cm-dc .cm-qf6-th svg{width:28px!important;height:28px!important}",
        ".cm-dc .cm-qf6-tx{display:block!important;color:inherit!important;font:inherit!important}",
        ".cm-home-page .cm-dc .cm-qf .cm-qf-chip:active,.cm-home-page .cm-dc .cm-qf .cm-qf-chip.is-on{background:#ffffff!important;border-color:#ffffff!important;color:#1D1D1F!important;transform:scale(.97)}",
        /* ریل برندها داخل کارت: بدون باکس و قاب جدا */
        ".cm-home-page .cm-dc .cm-br5,.cm-home-page .cm-dc .cm-br{margin:0!important}",
        ".cm-dc .cm-br5-box{background:none!important;border:0!important;box-shadow:none!important;border-radius:0!important;overflow:visible!important}",
        ".cm-dc .cm-br5-box::before,.cm-dc .cm-br5-box::after{display:none!important}",
        ".cm-dc .cm-br5-rail{padding:0 2px!important;gap:6px!important;align-items:flex-start}",
        ".cm-dc .cm-br5-tile{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;gap:6px!important;width:74px!important;height:auto!important;min-height:60px!important;padding:2px 0 0!important;border-radius:16px!important}",
        ".cm-dc .cm-br5-tile::after{display:none!important}",
        ".cm-dc .cm-br5-hint{display:none!important}",
        ".cm-dc .cm-br5-logo{height:40px!important;margin:0!important;width:100%!important}",
        ".cm-dc .cm-br5-logo img{max-width:56px!important;max-height:36px!important}",
        ".cm-dc .cm-dc-bn{display:block;max-width:100%;font-size:11.5px;font-weight:600;line-height:1.2;color:#aeb0b9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
        ".cm-dc .cm-br5-all{width:74px!important;height:60px!important;margin:0 4px 0 0!important;border-radius:999px!important}",
        /* تم روشن */
        "html.theme-light .cm-home-page .cm-dc,body.theme-light .cm-home-page .cm-dc{background:#fff!important;border-color:rgba(0,0,0,.08)!important;box-shadow:0 10px 26px -14px rgba(20,24,35,.18)!important}",
        "html.theme-light .cm-dc-tabs,body.theme-light .cm-dc-tabs{background:rgba(0,0,0,.05);border-color:rgba(0,0,0,.05)}",
        "html.theme-light .cm-dc-tabs button,body.theme-light .cm-dc-tabs button{color:#5b606a}",
        "html.theme-light .cm-dc-tabs button.is-on,body.theme-light .cm-dc-tabs button.is-on{color:#fff}",
        "html.theme-light .cm-home-page .cm-dc .cm-qf .cm-qf-chip,body.theme-light .cm-home-page .cm-dc .cm-qf .cm-qf-chip{color:#1c1c1f!important;background:rgba(0,0,0,.04)!important;border-color:rgba(0,0,0,.1)!important}",
        "html.theme-light .cm-home-page .cm-dc .cm-qf .cm-qf-chip.is-on,body.theme-light .cm-home-page .cm-dc .cm-qf .cm-qf-chip.is-on,html.theme-light .cm-home-page .cm-dc .cm-qf .cm-qf-chip:active{background:#ffffff!important;border-color:#ffffff!important;color:#1D1D1F!important}",
        "html.theme-light .cm-dc .cm-dc-bn,body.theme-light .cm-dc .cm-dc-bn{color:#4b5058}",
        "@media (min-width:760px){.cm-home-page .cm-dc{grid-column:1/-1;margin-inline:0!important}}"
      ].join("\n");
      document.head.appendChild(st);
    }
    const EN = { "سدان": "Sedan", "شاسی‌بلند": "SUV", "هاچ‌بک": "Hatchback", "وانت": "Pickup", "کوپه": "Coupe", "مینی‌ون": "Minivan" };
    const IMG = { "سدان": "sedan", "شاسی‌بلند": "suv", "هاچ‌بک": "hatchback", "وانت": "pickup", "کوپه": "coupe" };
    const CAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11"/><rect x="3.5" y="11" width="17" height="6" rx="2.5"/><path d="M6.5 17v1.8M17.5 17v1.8"/><circle cx="7.6" cy="14" r=".8" fill="currentColor"/><circle cx="16.4" cy="14" r=".8" fill="currentColor"/></svg>';
    const qf = page.querySelector(".cm-qf");
    if (!qf || page.querySelector(".cm-dc")) return;
    qf.querySelectorAll(".cm-qf-chip").forEach((btn) => {
      const fa = btn.getAttribute("data-qf") || btn.textContent.trim();
      const thumb = IMG[fa]
        ? '<img src="assets/filter/' + IMG[fa] + '.webp" alt="" width="56" height="32" loading="lazy" decoding="async" draggable="false" data-no-sk />'
        : CAR;
      btn.innerHTML = '<span class="cm-qf6-th">' + thumb + '</span><span class="cm-qf6-tx">' + (EN[fa] || fa) + '</span>';
      btn.setAttribute("dir", "ltr");
      btn.setAttribute("aria-label", fa);
    });
    qf.addEventListener("pointerdown", (e) => { const c = e.target.closest(".cm-qf-chip"); if (c) c.classList.add("is-on"); });
    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => qf.addEventListener(ev, () => qf.querySelectorAll(".is-on").forEach((x) => x.classList.remove("is-on"))));

    const br = page.querySelector(".cm-br5, .cm-br");
    const card = document.createElement("section");
    card.className = "cm-dc";
    card.setAttribute("aria-label", "جستجوی سریع خودرو");
    card.innerHTML = '<div class="cm-dc-tabs" role="tablist"><button type="button" role="tab" class="is-on" data-t="body" aria-selected="true">نوع بدنه</button>' + (br ? '<button type="button" role="tab" data-t="brand" aria-selected="false">برندها</button>' : "") + '</div><div class="cm-dc-pane" data-p="body"></div>' + (br ? '<div class="cm-dc-pane" data-p="brand" hidden></div>' : "");
    qf.before(card);
    card.querySelector('[data-p="body"]').appendChild(qf);
    if (br) {
      br.querySelectorAll(".cm-br5-tile").forEach((t) => {
        if (t.querySelector(".cm-dc-bn")) return;
        const n = document.createElement("span"); n.className = "cm-dc-bn"; n.textContent = t.getAttribute("data-brand") || ""; t.appendChild(n);
      });
      card.querySelector('[data-p="brand"]').appendChild(br);
    }
    card.querySelector(".cm-dc-tabs").addEventListener("click", (e) => {
      const tb = e.target.closest("[data-t]"); if (!tb) return;
      card.querySelectorAll(".cm-dc-tabs button").forEach((x) => { const on = x === tb; x.classList.toggle("is-on", on); x.setAttribute("aria-selected", on ? "true" : "false"); });
      card.querySelectorAll(".cm-dc-pane").forEach((p) => { p.hidden = p.getAttribute("data-p") !== tb.getAttribute("data-t"); });
    });
  })();
  /* CM-QF6:END */
  /* CM-QF7:BEGIN - ریل استوری‌ها زیر کارت «نوع بدنه | برندها» */
  (function () {
    const card = page.querySelector(".cm-dc"), st = page.querySelector(".cm-ts");
    if (card && st) { card.after(st); st.style.margin = "16px 0 0"; }
  })();
  /* CM-QF7:END */
  /* CM-QF8:BEGIN - کارت «نوع بدنه | برندها» فول‌عرض (لبه تا لبه) */
  (function () {
    if (document.getElementById("cm-qf8-css")) return;
    const st = document.createElement("style");
    st.id = "cm-qf8-css";
    st.textContent = [
      ".cm-home-page section.cm-dc{margin:14px 0 0!important;padding:14px 16px 16px!important;border-radius:0!important;border-left:0!important;border-right:0!important;width:auto!important}",
      "@media (min-width:760px){.cm-home-page section.cm-dc{margin-inline:0!important}}"
    ].join("\n");
    document.head.appendChild(st);
  })();
  /* CM-QF8:END */
  /* CM-QF10:BEGIN - ریل چیپ‌های نوع بدنه تا لبه‌ی صفحه؛ باکس «هنوز آگهی‌ای نیست» هم‌ارتفاع یک کارت آگهی */
  (function () {
    if (document.getElementById("cm-qf10-css")) return;
    const st = document.createElement("style");
    st.id = "cm-qf10-css";
    st.textContent = [
      ".cm-home-page .cm-dc .cm-qf{margin-inline:-16px!important;padding-inline:16px!important;scroll-padding-inline:16px}",
      ".cm-home-page .cm-lt-rail>.cm-home-empty-latest{box-sizing:border-box;display:flex;align-items:center;justify-content:center;height:calc(min(272px,68vw)*.75 + 103px);min-height:0}"
    ].join("\n");
    document.head.appendChild(st);
  })();
  /* CM-QF10:END */
  /* CM-QF9:BEGIN - کارت «نوع بدنه | برندها» زیر «جدیدترین آگهی‌ها»؛ استوری‌ها بالای صفحه زیر جستجو */
  (function () {
    const card = page.querySelector(".cm-dc"), lt = page.querySelector(".cm-lt-sec");
    const st = page.querySelector(".cm-ts"), sw = page.querySelector(".cm-home-search-wrap");
    if (card && lt) { lt.after(card); card.style.setProperty("margin-top", "20px", "important"); }
    if (st && sw) { sw.after(st); st.style.margin = "4px 0 0"; }
  })();
  /* CM-QF9:END */
  /* CM-HERO-STORIES: «استوری‌های تازه» درست زیر «شهرهای پرطرفدار» */
  (function () {
    const hero = page.querySelector(".cm-hh"), st = page.querySelector(".cm-ts");
    if (!hero || !st) return;
    const h = document.createElement("div");
    h.className = "cm-hh-sechead cm-hh-stories-head";
    h.innerHTML = "<h2>استوری‌های تازه</h2>";
    hero.after(h); h.after(st); st.style.margin = "0 0 6px";
  })();
  /* CM-USECASE: «بر اساس کاربرد» زیر استوری‌ها */
  (function () {
    const st = page.querySelector(".cm-ts"); if (!st) return;
    const esc = (v) => (typeof escHtml === "function" ? escHtml(String(v)) : String(v));
    const U = [
      { t: "شهری", img: "images/usecase/city.webp", tags: ["جمع‌وجور", "اتوماتیک", "استفاده روزمره"], body: "هاچ‌بک" },
      { t: "آفرود", img: "images/usecase/offroad.webp", tags: ["طبیعت‌گردی", "شاسی مستقل"], body: "وانت" },
      { t: "لوکس", img: "images/usecase/luxury.webp", tags: ["پرآپشن", "پرقدرت"], body: "سدان" },
      { t: "خانوادگی", img: "images/usecase/family.webp", tags: ["جادار", "ایمن", "سفر"], body: "شاسی‌بلند" },
      { t: "اقتصادی", img: "images/listings/car-08.webp", tags: ["کم‌مصرف", "قیمت مناسب"], body: "سدان" },
    ];
    const sec = document.createElement("section");
    sec.className = "cm-uc";
    sec.setAttribute("aria-label", "بر اساس کاربرد");
    sec.innerHTML = `<div class="cm-hh-sechead"><h2>بر اساس کاربرد</h2><button type="button" class="cm-uc-all" data-action="goListings" data-brand="all">نمایش همه آگهی‌ها</button></div>
      <div class="cm-uc-rail">${U.map((u) => `<button type="button" class="cm-uc-card" data-cm-body="${esc(u.body)}" aria-label="${esc("آگهی‌های " + u.t)}">${u.img ? `<img class="cm-uc-img" src="${esc(u.img)}" alt="" width="400" height="600" loading="lazy" decoding="async" draggable="false" />` : ""}<span class="cm-uc-body"><b>${esc(u.t)}</b><span class="cm-uc-tags">${u.tags.map((x) => `<i>${esc(x)}</i>`).join("")}</span></span></button>`).join("")}</div>`;
    st.after(sec);
    sec.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cm-body]"); if (!b) return;
      navigateTo({ page: "listings", brand: "all" }, { menuOpen: false, selectedBrand: null, filters: { model: null, city: null, color: null, condition: null, year: null, priceMin: null, priceMax: null, transmission: null, bodyStyle: b.getAttribute("data-cm-body") }, sort: "newest", visibleCount: 12, listingsLoadingMore: false });
    });
  })();
  /* CM-POPFILTERS: «فیلترهای پرطرفدار» زیر «بر اساس کاربرد» */
  (function () {
    const uc = page.querySelector(".cm-uc"); if (!uc) return;
    const S = (d) => `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">${d}</svg>`;
    const F = [
      { t: "اقساطی", img: "images/filters/installment.webp", f: { installment: true }, ic: S('<path d="M6 2h12v2h-1.2c-.1 3-1.6 4.9-3.2 6 1.6 1.1 3.1 3 3.2 6H18v2H6v-2h1.2c.1-3 1.6-4.9 3.2-6C8.8 8.9 7.3 7 7.2 4H6V2zm3.2 2c.1 2 1.2 3.4 2.8 4.3 1.6-.9 2.7-2.3 2.8-4.3H9.2zM12 13.7c-1.6.9-2.7 2.3-2.8 4.3h5.6c-.1-2-1.2-3.4-2.8-4.3z"/><path d="M5 20h14v2H5z"/>') },
      { t: "صفر", img: "images/filters/zero.webp?v=wf1", f: { condition: "نو" }, ic: S('<path d="M12 1.5c.7 4.6 2.4 7.4 4.6 8.6 1.6.9 3.8 1.5 6.4 1.9-2.6.4-4.8 1-6.4 1.9-2.2 1.2-3.9 4-4.6 8.6-.7-4.6-2.4-7.4-4.6-8.6C5.8 12.9 3.6 12.3 1 11.9c2.6-.4 4.8-1 6.4-1.9C9.6 8.9 11.3 6.1 12 1.5z"/>') },
      { t: "برقی", img: "images/filters/electric.webp?v=wf1", f: { electric: true }, ic: S('<path d="M8 2h2v5h4V2h2v5h1v3a5 5 0 0 1-4 4.9V22h-2v-7.1A5 5 0 0 1 7 10V7h1V2z"/>') },
      { t: "چینی", img: "images/filters/chinese.webp?v=wf1", f: { country: "چینی" }, ic: S('<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.1 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z"/>') },
    ];
    const sec = document.createElement("section");
    sec.className = "cm-pf";
    sec.setAttribute("aria-label", "فیلترهای پرطرفدار");
    sec.innerHTML = `<div class="cm-hh-sechead"><h2>فیلترهای پرطرفدار</h2></div>
      <div class="cm-pf-rail">${F.map((x, i) => `<button type="button" class="cm-pf-card" data-pf="${i}" aria-label="${x.t}">${x.img ? `<img class="cm-pf-img" src="${x.img}" alt="" width="188" height="251" loading="lazy" decoding="async" draggable="false" />` : ""}<b>${x.t}</b><span class="cm-pf-ic">${x.ic}</span></button>`).join("")}</div>`;
    uc.after(sec);
    sec.addEventListener("click", (e) => {
      const b = e.target.closest("[data-pf]"); if (!b) return;
      const x = F[+b.getAttribute("data-pf")];
      navigateTo({ page: "listings", brand: "all" }, { menuOpen: false, selectedBrand: null, filters: Object.assign({ model: null, city: null, color: null, condition: null, year: null, priceMin: null, priceMax: null, transmission: null, bodyStyle: null }, x.f), sort: "newest", visibleCount: 12, listingsLoadingMore: false });
    });
  })();
  /* CM-POPBRANDS: باز/بسته شدن «بیشتر» */
  (function () {
    const sec = page.querySelector(".cm-pb"); if (!sec) return;
    sec.addEventListener("click", (e) => {
      const m = e.target.closest("[data-pb-more]"); if (!m) return;
      const on = sec.classList.toggle("is-open");
      m.setAttribute("aria-expanded", on ? "true" : "false");
      const l = m.querySelector("[data-pb-label]"); if (l) l.textContent = on ? "کمتر" : "بیشتر";
    });
  })();
  /* CM-STD-ORDER: ترتیب استاندارد صفحه‌ی اصلی
     جستجو ← استوری‌ها ← میانبرها (کاربرد، فیلترها، برندها) ← جدیدترین آگهی‌ها ← بنر ← تبلیغ ← نمایشگاه‌ها ← اخبار ← فوتر */
  (function () {
    const pf = page.querySelector(".cm-pf"), pb = page.querySelector(".cm-pb");
    if (pf && pb) pf.after(pb);
  })();
  /* CM-BODYRAIL: ریل «نوع بدنه» بین فیلترهای پرطرفدار و برندها */
  (function () {
    const pf = page.querySelector(".cm-pf"); if (!pf) return;
    const esc = (v) => (typeof escHtml === "function" ? escHtml(String(v)) : String(v));
    const B = [
      { t: "سدان", v: "سدان", img: "sedan" },
      { t: "شاسی‌بلند", v: "شاسی‌بلند", img: "suv" },
      { t: "هاچ‌بک", v: "هاچ‌بک", img: "hatchback" },
      { t: "کراس‌اوور", v: "شاسی‌بلند", img: "crossover" },
      { t: "وانت", v: "وانت", img: "truck" },
      { t: "کوپه", v: "کوپه", img: "coupe" },
      { t: "کروک", v: "کروک", img: "convertible" },
      { t: "ون", v: "مینی‌ون", img: "van" },
    ];
    const sec = document.createElement("section");
    sec.className = "cm-bt";
    sec.setAttribute("aria-label", "نوع بدنه");
    sec.innerHTML = `<div class="cm-hh-sechead"><h2>نوع بدنه</h2><button type="button" class="cm-hh-all" data-action="goListings" data-brand="all">مشاهده همه</button></div>
      <div class="cm-bt-rail">${B.map((x) => `<button type="button" class="cm-bt-tile" data-cm-body="${esc(x.v)}" aria-label="${esc("آگهی‌های " + x.t)}"><img src="images/body/${x.img}.webp" alt="" width="192" height="96" loading="lazy" decoding="async" draggable="false" /><span>${esc(x.t)}</span></button>`).join("")}</div>`;
    pf.after(sec);
    sec.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cm-body]"); if (!b) return;
      navigateTo({ page: "listings", brand: "all" }, { menuOpen: false, selectedBrand: null, filters: { model: null, city: null, color: null, condition: null, year: null, priceMin: null, priceMax: null, transmission: null, bodyStyle: b.getAttribute("data-cm-body") }, sort: "newest", visibleCount: 12, listingsLoadingMore: false });
    });
  })();
  /* CM-SR-UNDER-PB: نمایشگاه‌ها زیر «برندهای پرتقاضا» */
  (function () {
    const pb = page.querySelector(".cm-pb"), sr = page.querySelector(".cm-lay-section--showrooms");
    if (pb && sr) pb.after(sr);
  })();
  /* CM-BM-TILE */
  (function () {
    page.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cm-bm]"); if (!b) return;
      e.preventDefault();
      try { if (window.CARMA_PARTNERS && typeof window.CARMA_PARTNERS.open === "function") window.CARMA_PARTNERS.open(); } catch (_) {}
    });
  })();
  /* CM-HOME-CLEAN:END */
  /* CM-SWAP-LATEST: «جدیدترین آگهی‌ها» جای باکس بزرگ بالای صفحه؛ باکس بزرگ جای قبلی جدیدترین‌ها */
  (function () {
    const hero = page.querySelector(".cm-hh"), feat = hero && hero.querySelector(".cm-hh-feat"), lt = page.querySelector(".cm-lt-sec");
    if (!hero || !feat || !lt) return;
    const mark = document.createComment("cm-lt-slot");
    lt.before(mark);
    feat.before(lt);
    lt.classList.add("cm-lt-sec--top");
    feat.classList.add("cm-hh-feat--low");
    feat.remove(); /* باکس بزرگ آگهی ویژه حذف شد */
    mark.remove();
  })();
  return page;
}


/* Showrooms banner: the phone rises from the bottom as the page scrolls (scroll-linked, reversible).
   One passive scroll listener, only active while the banner is near the viewport; it writes a single
   CSS variable (--sr-p: 0..1) on the banner, so no layout work happens per frame. */
(function () {
  if (window.__cmSrPhoneInit) return;
  window.__cmSrPhoneInit = true;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let box = null, raf = 0, active = false;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  function update() {
    raf = 0;
    if (!box || !box.isConnected) return;
    const vh = window.innerHeight || 800;
    const top = box.getBoundingClientRect().top;
    // 0 when the banner's top edge enters at the bottom of the screen, 1 when it reaches ~30% from the top
    const p = reduce ? 1 : clamp((vh - top) / (vh * 0.70));
    box.style.setProperty("--sr-p", p.toFixed(3));
    if (p > 0.02) box.classList.add("is-in");
  }
  function onScroll() { if (!raf) raf = requestAnimationFrame(update); }
  function setActive(on) {
    if (on === active) return; active = on;
    if (on) { window.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("resize", onScroll, { passive: true }); onScroll(); }
    else { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); }
  }
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => {
    es.forEach((e) => setActive(e.isIntersecting));
  }, { rootMargin: "60px 0px 60px 0px" }) : null;
  function scan() {
    const b = document.querySelector(".cm-lay-showrooms-banner");
    if (!b || b === box) return;
    if (io && box) io.unobserve(box);
    box = b; active = false;
    if (io) io.observe(box); else { box.classList.add("is-in"); box.style.setProperty("--sr-p", "1"); }
  }
  const host = document.getElementById("pageContent") || document.body;
  new MutationObserver(scan).observe(host, { childList: true, subtree: true });
  scan();
})();

/* >>> CM-SR-INTRO JS START */
(function () {
  if (window.__cmSrIntroInit) return;
  window.__cmSrIntroInit = true;
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { threshold: 0.35 }) : null;
  function scan() {
    document.querySelectorAll("[data-sr-intro]:not(.is-in):not([data-sr-seen])").forEach((el) => {
      el.setAttribute("data-sr-seen", "1");
      if (io) io.observe(el); else el.classList.add("is-in");
    });
  }
  const host = document.getElementById("pageContent") || document.body;
  new MutationObserver(scan).observe(host, { childList: true, subtree: true });
  scan();
})();
/* <<< CM-SR-INTRO JS END */

/* >>> CM-FT2 JS START */
(function () {
  if (window.__cmFt2Init) return;
  window.__cmFt2Init = true;
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { threshold: 0.12 }) : null;
  function scan() {
    document.querySelectorAll("[data-ft]:not(.is-in):not([data-ft-seen])").forEach((el) => {
      el.setAttribute("data-ft-seen", "1");
      if (io) io.observe(el); else el.classList.add("is-in");
    });
  }
  document.addEventListener("click", (e) => {
    const b = e.target && e.target.closest && e.target.closest("[data-ft-top]");
    if (!b) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });
  const host = document.getElementById("pageContent") || document.body;
  new MutationObserver(scan).observe(host, { childList: true, subtree: true });
  scan();
})();
/* <<< CM-FT2 JS END */

/* >>> CM-BR5 JS START */
(function () {
  if (window.__cmBr5Init) return;
  window.__cmBr5Init = true;
  function sync(box, rail) {
    const max = rail.scrollWidth - rail.clientWidth, pos = Math.abs(rail.scrollLeft);
    box.classList.toggle("cm-br5-ml", max > 6 && pos < max - 6);
    box.classList.toggle("cm-br5-mr", max > 6 && pos > 6);
  }
  function enhance() {
    document.querySelectorAll(".cm-br5-box").forEach((box) => {
      const rail = box.querySelector(".cm-br5-rail");
      if (!rail || rail.getAttribute("data-br5")) return;
      rail.setAttribute("data-br5", "1");
      let raf = 0;
      const go = () => { raf = 0; sync(box, rail); };
      rail.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(go); }, { passive: true });
      window.addEventListener("resize", () => { if (!raf) raf = requestAnimationFrame(go); }, { passive: true });
      const hint = box.querySelector(".cm-br5-hint");
      if (hint) hint.addEventListener("click", (e) => { e.stopPropagation(); rail.scrollBy({ left: -Math.max(160, Math.round(rail.clientWidth * 0.7)), behavior: "smooth" }); });
      sync(box, rail);
      requestAnimationFrame(go);
      setTimeout(go, 400);
    });
  }
  const host = document.getElementById("pageContent") || document.body;
  let t = 0;
  new MutationObserver(() => { if (t) return; t = setTimeout(() => { t = 0; enhance(); }, 60); }).observe(host, { childList: true, subtree: true });
  enhance();
})();
/* <<< CM-BR5 JS END */

/* >>> CM-LTMORE JS START */
(function () {
  if (window.__cmLtMoreInit) return;
  window.__cmLtMoreInit = true;
  const ICON = '<span class="cm-lt-more-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/></svg></span>';
  function enhance() {
    document.querySelectorAll(".cm-lt-sec").forEach((sec) => {
      const rail = sec.querySelector(".cm-lt-rail");
      if (!rail) return;
      const first = rail.querySelector(".cm-lt-card");
      if (!first) return;
      let more = rail.querySelector(".cm-lt-more");
      if (!more) {
        more = document.createElement("div");
        more.className = "cm-lt-more";
        more.setAttribute("role", "link");
        more.setAttribute("tabindex", "0");
        more.innerHTML = ICON + "<b>ادامه‌ی جاده</b><span>همه‌ی آگهی‌های تازه</span>";
        const go = () => { const a = sec.querySelector(".cm-lt-all"); if (a) a.click(); };
        more.addEventListener("click", go);
        more.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
        rail.appendChild(more);
      } else if (rail.lastElementChild !== more) {
        rail.appendChild(more);
      }
      const w = Math.round(first.getBoundingClientRect().width);
      if (w > 60) { more.style.width = w + "px"; more.style.flexBasis = w + "px"; }
    });
  }
  const host = document.getElementById("pageContent") || document.body;
  let t = 0;
  new MutationObserver(() => { if (t) return; t = setTimeout(() => { t = 0; enhance(); }, 60); }).observe(host, { childList: true, subtree: true });
  window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => { t = 0; enhance(); }, 120); }, { passive: true });
  enhance();
})();
/* <<< CM-LTMORE JS END */

/* CM-CT: scroll-driven headline animation (progress is written per word from the scroll position) */
(function () {
  if (window.__cmCtInit) return;
  window.__cmCtInit = true;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const ease = (t) => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(",");
  let raf = 0;
  function update() {
    raf = 0;
    const vh = window.innerHeight || 800;
    const light = document.documentElement.classList.contains("theme-light");
    document.querySelectorAll(".cm-ct").forEach((el) => {
      const top = el.getBoundingClientRect().top;
      const p = reduce ? 1 : clamp((vh * 0.96 - top) / (vh * 0.5));
      if (el.__p === p) return;
      el.__p = p;
      const mode = el.getAttribute("data-ct");
      const ws = el.querySelectorAll(".cm-ct-w");
      const n = ws.length;
      ws.forEach((w, i) => {
        const t = ease(clamp(p * (n + 2) - i));
        if (mode === "fill") {
          const hl = w.classList.contains("cm-ct-hl");
          const from = light ? (hl ? [236, 190, 192] : [200, 200, 206]) : (hl ? [96, 30, 36] : [66, 66, 74]);
          const to = light ? (hl ? [200, 20, 31] : [14, 14, 14]) : (hl ? [255, 74, 85] : [245, 245, 247]);
          w.style.color = "rgb(" + mix(from, to, t) + ")";
          w.style.transform = "translateY(" + ((1 - t) * 6).toFixed(1) + "px)";
        } else {
          w.style.opacity = t.toFixed(3);
          w.style.transform = "translateY(" + ((1 - t) * 30).toFixed(1) + "px) scale(" + (0.94 + 0.06 * t).toFixed(3) + ")";
          w.style.filter = t >= 0.999 ? "none" : "blur(" + ((1 - t) * 7).toFixed(1) + "px)";
        }
      });
      const rule = el.querySelector(".cm-ct-rule");
      if (rule) { rule.style.setProperty("--r", (0.15 + 0.85 * ease(clamp(p * 1.4 - 0.3))).toFixed(3)); rule.style.setProperty("--ro", (0.25 + 0.75 * p).toFixed(3)); }
    });
  }
  function onScroll() { if (!raf) raf = requestAnimationFrame(update); }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  const host = document.getElementById("pageContent") || document.body;
  new MutationObserver(onScroll).observe(host, { childList: true, subtree: true });
  onScroll();
})();

/* CM-HL6: smoothed scroll-driven hero (lines + glass bar) */
(function () {
  if (window.__cmHl6Init) return;
  window.__cmHl6Init = true;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const ease = (t) => t * t * (3 - 2 * t);
  let raf = 0, last = 0;
  function target(el) {
    if (reduce) return 1;
    const vh = window.innerHeight || 800;
    return clamp((vh * 0.94 - el.getBoundingClientRect().top) / (vh * 0.45));
  }
  function paint(el, p) {
    el.style.setProperty("--p", p.toFixed(4));
    const lines = el.querySelectorAll(".cm-hl-l");
    const n = lines.length, w = 0.5, step = n > 1 ? (1 - w) / (n - 1) : 0;
    lines.forEach((l, i) => {
      const pi = ease(clamp((p - i * step) / w));
      l.style.setProperty("--pp", pi.toFixed(4));
      l.style.setProperty("--e", (-25 + pi * 150).toFixed(2));
    });
    el.style.setProperty("--pb", ease(clamp((p - 0.45) / 0.55)).toFixed(4));
  }
  function tick(now) {
    raf = 0;
    const dt = Math.min(64, last ? now - last : 16);
    last = now;
    const k = reduce ? 1 : 1 - Math.exp(-dt / 120);
    let busy = false;
    document.querySelectorAll(".cm-hl").forEach((el) => {
      const t = target(el);
      let c = el.__c || 0;
      const d = t - c;
      if (Math.abs(d) > 0.0004) { c += d * k; busy = true; } else { c = t; }
      if (c !== el.__c) { el.__c = c; paint(el, c); }
    });
    if (busy) raf = requestAnimationFrame(tick); else last = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick, { passive: true });
  const host = document.getElementById("pageContent") || document.body;
  new MutationObserver(kick).observe(host, { childList: true, subtree: true });
  kick();
})();
