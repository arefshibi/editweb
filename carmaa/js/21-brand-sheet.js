"use strict";

/* ---------------------------------------------------------------
   BRAND SHEET — tapping the "برند ماشین" chip in the listings toolbar slides
   a bottom sheet up (about 68% of the screen; drag it up for full screen). It reuses the brand boxes that used
   to live on the old home page (HOME_DEMO_BRANDS + .home-demo-brand-card).
   Actions (handled in 17-chip-dropdown.js): openBrandSheet, closeBrandSheet,
   pickBrandSheet (data-brand = route brand, or "all").
--------------------------------------------------------------- */

let brandSheetEl = null;     // the sheet while it is open
let brandSheetCache = null;  // built once, then reused (opening = just append)
let brandSheetTimer = null;

function currentBrandForSheet() {
  const r = state.route || {};
  if ((r.page === "listings" || r.page === "brand") && r.brand && r.brand !== "all") return r.brand;
  return state.selectedBrand || null;
}

function buildBrandSheet() {
  const el = document.createElement("div");
  el.id = "brandSheet";
  el.className = "brand-sheet";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "انتخاب برند ماشین");
  el.innerHTML = `
    <div class="brand-sheet-backdrop" data-action="closeBrandSheet"></div>
    <div class="brand-sheet-panel">
      <div class="brand-sheet-drag" data-sheet-handle><span></span></div>
      <div class="brand-sheet-head" data-sheet-handle>
        <div class="brand-sheet-titles">
          <h2 class="brand-sheet-title">برند ماشین</h2>
          <p class="brand-sheet-sub">محبوب‌ترین برندهای موجود در بازار خودرو</p>
        </div>
        <button type="button" class="brand-sheet-close" data-action="closeBrandSheet" aria-label="بستن">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <div class="brand-sheet-scroll">
        <button type="button" class="brand-sheet-all" data-action="pickBrandSheet" data-brand="all">
          <span class="brand-sheet-all-name">همه برندها</span>
          <span class="brand-sheet-all-count"><b>${LISTINGS.length.toLocaleString("en-US")}</b> آگهی</span>
        </button>
        <div class="brand-sheet-grid" data-slot="grid"></div>
      </div>
    </div>`;

  const grid = el.querySelector('[data-slot="grid"]');
  const frag = document.createDocumentFragment();
  HOME_DEMO_BRANDS.forEach((brand) => {
    const count = LISTINGS.filter((l) => l.brand === brand.routeBrand).length;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "home-demo-card home-demo-brand-card";
    card.dataset.action = "pickBrandSheet";
    card.dataset.brand = brand.routeBrand;
    card.style.setProperty("--home-demo-tint", brand.tint);
    card.style.setProperty("--home-demo-brand-color", brand.color);
    card.setAttribute("aria-label", `${brand.name}، ${count} موجود`);

    const logo = document.createElement("span");
    logo.className = `home-demo-card-bg${brand.dark ? " dark-logo" : ""}`;
    logo.dataset.logoSrc = `home-demo-assets/logos/${brand.logo}`; // applied lazily (see ensureBrandLogos)
    if (brand.logoWidth) logo.style.width = brand.logoWidth;
    if (brand.logoHeight) logo.style.height = brand.logoHeight;

    // No per-card entrance animations here: they cost a lot while the sheet slides in.
    card.innerHTML = `
      <span class="home-demo-card-glow"></span>
      <span class="home-demo-card-shade"></span>
      <span class="home-demo-card-label">
        <span class="home-demo-card-name">${brand.name}</span>
        <span class="home-demo-card-count"><span class="home-demo-card-dot"></span><b>${count.toLocaleString("en-US")}</b><span>موجود</span></span>
      </span>`;
    card.insertBefore(logo, card.children[1]);
    frag.appendChild(card);
  });
  grid.appendChild(frag);
  attachBrandSheetDrag(el);
  // Scroll lock without touching <html>/<body> overflow (that forced a full
  // re-layout of the whole listings page the moment the sheet opened). The
  // backdrop has touch-action:none in CSS; this covers mouse wheels.
  el.querySelector(".brand-sheet-backdrop").addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  return el;
}

function syncBrandSheetSelection(el) {
  const selected = currentBrandForSheet();
  el.querySelector(".brand-sheet-all").classList.toggle("is-selected", !selected);
  el.querySelectorAll(".home-demo-brand-card").forEach((card) => {
    card.classList.toggle("home-demo-card-selected", !!selected && card.dataset.brand === selected);
  });
}

// Some brand logos are big vector files (Porsche 178 KB, Land Rover 166 KB,
// Mercedes 145 KB) or huge bitmaps (Jaguar 1521px). Re-rasterising those while
// the sheet slides in is what made opening it janky. At idle time we draw each
// logo ONCE into a small (<=256px) canvas and swap the card's background for
// that cheap bitmap. One logo per idle slice, so it never blocks the page.
const BRAND_LOGO_MAX = 256;
function rasterizeBrandLogos(el) {
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 60));
  const cards = el.querySelectorAll(".home-demo-brand-card");
  let i = 0;
  const next = () => {
    if (i >= HOME_DEMO_BRANDS.length) return;
    const b = HOME_DEMO_BRANDS[i];
    const bg = cards[i] && cards[i].querySelector(".home-demo-card-bg");
    i++;
    if (!bg) return idle(next);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      try {
        const w0 = img.naturalWidth, h0 = img.naturalHeight;
        if (w0 && h0) {
          const sc = BRAND_LOGO_MAX / Math.max(w0, h0);
          // Never upscale bitmaps; SVGs may scale freely.
          const k = /\.svg$/i.test(b.logo) ? sc : Math.min(1, sc);
          const cv = document.createElement("canvas");
          cv.width = Math.max(1, Math.round(w0 * k));
          cv.height = Math.max(1, Math.round(h0 * k));
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          cv.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const pre = new Image();
            pre.src = url;
            (pre.decode ? pre.decode() : Promise.resolve()).then(() => {
              bg.style.backgroundImage = `url("${url}")`;
            }).catch(() => {});
          }, "image/png");
        }
      } catch (e) { /* tainted canvas etc. — keep the original file */ }
      idle(next);
    };
    img.onerror = () => idle(next);
    img.src = encodeURI(`home-demo-assets/logos/${b.logo}`);
  };
  idle(next);
}

// Build the sheet and rasterise its logos while the browser is idle, so the
// first tap doesn't have to do that work during the slide-in animation.
function warmBrandSheet() {
  try {
    if (!brandSheetCache) brandSheetCache = buildBrandSheet();
    rasterizeBrandLogos(brandSheetCache);
  } catch (e) { /* non-critical */ }
}
// Perf: wait until the page has loaded and settled before warming the sheet,
// so ~1MB of logos / canvas work never competes with the first render.
window.addEventListener("load", () => setTimeout(() => (window.requestIdleCallback || ((fn) => setTimeout(fn, 0)))(warmBrandSheet), 4000), { once: true });

// Any logo the background warm-up has not rasterised yet falls back to the original file.
function ensureBrandLogos(el) {
  el.querySelectorAll(".home-demo-card-bg[data-logo-src]").forEach((bg) => {
    if (!bg.style.backgroundImage) bg.style.backgroundImage = `url("${encodeURI(bg.dataset.logoSrc)}")`;
  });
}

function openBrandSheet() {
  if (brandSheetEl) return;
  clearTimeout(brandSheetTimer);
  state = { ...state, chipDropdownKey: null };
  const el = brandSheetCache || (brandSheetCache = buildBrandSheet());
  const panel = el.querySelector(".brand-sheet-panel");
  el.classList.remove("is-open", "is-closing");
  panel.classList.remove("is-full");
  panel.style.cssText = "";
  el.querySelector(".brand-sheet-scroll").scrollTop = 0;
  syncBrandSheetSelection(el);
  ensureBrandLogos(el);
  brandSheetEl = el;
  (document.getElementById("appViewport") || document.body).appendChild(el);
  document.documentElement.classList.add("brand-sheet-lock");
  void el.offsetHeight; // commit the closed state so the transition runs
  el.classList.add("is-open");
}

function closeBrandSheet() {
  const el = brandSheetEl;
  if (!el) return;
  brandSheetEl = null;
  el.classList.remove("is-open");
  el.classList.add("is-closing");
  const panel = el.querySelector(".brand-sheet-panel");
  if (panel) { panel.style.transition = ""; panel.style.transform = ""; }
  document.documentElement.classList.remove("brand-sheet-lock");
  brandSheetTimer = setTimeout(() => { el.remove(); el.classList.remove("is-closing"); }, 380);
}

/* Drag behaviour. The panel is always full-screen tall and only ever moves with
   transform (GPU only, no layout while dragging):
     y = offFull  -> expanded: 90% of the screen visible (never full screen)
     y = offHalf  -> resting "half" position (about 68% of the screen visible)
     y = height   -> closed
   Drag from the handle/header, or from the grid itself (swipe up on the grid
   expands first; swipe down at the top of the grid while full collapses). */
function attachBrandSheetDrag(el) {
  const panel = el.querySelector(".brand-sheet-panel");
  const scroller = el.querySelector(".brand-sheet-scroll");

  let startY = null, startPos = 0, pos = 0, lastY = 0, lastT = 0, vel = 0;
  let panelH = 0, offHalf = 0, offFull = 0, dragging = false, fromScroll = false, raf = 0;

  const isFull = () => panel.classList.contains("is-full");
  const paint = () => { raf = 0; panel.style.transform = `translate3d(0,${pos}px,0)`; };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };

  const begin = (e, isScroll) => {
    if (!isScroll && e.target.closest("[data-action]")) return;
    startY = lastY = e.touches[0].clientY; lastT = e.timeStamp; vel = 0;
    panelH = panel.offsetHeight;
    offHalf = Math.round(panelH * 0.32);
    offFull = Math.round(panelH * 0.10);
    startPos = pos = isFull() ? offFull : offHalf;
    fromScroll = isScroll; dragging = false;
  };

  const startDrag = (y) => {
    dragging = true;
    startY = y;
    panel.style.transition = "none";
    panel.style.transform = `translate3d(0,${pos}px,0)`;
  };

  const move = (e) => {
    if (startY === null) return;
    const y = e.touches[0].clientY;
    const dt = e.timeStamp - lastT;
    if (dt > 0) vel = 0.8 * (y - lastY) / dt + 0.2 * vel; // px/ms, + = down
    lastY = y; lastT = e.timeStamp;
    const dy = y - startY;

    if (!dragging) {
      if (fromScroll) {
        const full = isFull();
        if ((!full && dy < -6) || (full && dy > 6 && scroller.scrollTop <= 0) || (!full && dy > 6 && scroller.scrollTop <= 0)) startDrag(y);
        return; // otherwise let the grid scroll normally
      }
      if (Math.abs(dy) > 2) startDrag(y); else return;
    }
    if (e.cancelable) e.preventDefault();
    pos = Math.max(offFull, startPos + (y - startY));
    schedule();
  };

  const end = () => {
    if (startY === null) return;
    startY = null;
    if (!dragging) return;
    dragging = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }

    const projected = pos + vel * 160;
    let target; // "full" | "half" | "close"
    if (pos > offHalf + 90 || projected > offHalf + 150) target = "close";
    else target = projected < (offFull + offHalf) / 2 ? "full" : "half";

    panel.style.transition = "";
    if (target === "close") { closeBrandSheet(); return; }
    // Re-assert the dragged position, then hand over to the CSS transition.
    panel.style.transform = `translate3d(0,${pos}px,0)`;
    void panel.offsetHeight;
    panel.classList.toggle("is-full", target === "full");
    panel.style.transform = "";
    if (target === "half") scroller.scrollTop = 0;
  };

  el.querySelectorAll("[data-sheet-handle]").forEach((h) => {
    h.addEventListener("touchstart", (e) => begin(e, false), { passive: true });
    h.addEventListener("touchmove", move, { passive: false });
    h.addEventListener("touchend", end);
    h.addEventListener("touchcancel", end);
  });
  scroller.addEventListener("touchstart", (e) => begin(e, true), { passive: true });
  scroller.addEventListener("touchmove", move, { passive: false });
  scroller.addEventListener("touchend", end);
  scroller.addEventListener("touchcancel", end);
}

window.addEventListener("popstate", () => closeBrandSheet());
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeBrandSheet(); });
