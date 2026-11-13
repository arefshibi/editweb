"use strict";
/* CM-IVD2 — iOS Safari: داک + نوار تماس.
   قبلاً با هر اسکرول/لمس، top با جاوااسکریپت هر فریم دوباره محاسبه می‌شد و داک بالا/پایین می‌پرید.
   حالا: اول موقعیت طبیعیِ CSS (bottom) استفاده می‌شه (روی کامپوزیتور، بدون لگ)؛
   فقط اگه واقعاً با لبهٔ پایین ناحیهٔ دیدنی فرق داشت، با top اصلاح می‌شه — آن هم نه وسط اسکرول. */
(function () {
  var ua = navigator.userAgent || "";
  var isIOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!isIOS) return;

  var html = document.documentElement;
  var vv = window.visualViewport;
  var dockGap = null, raf = 0, timer = 0;

  var st = document.createElement("style");
  st.textContent =
    "html.ivd body:not(#x) #bottomDock#bottomDock.bottom-dock{top:var(--ivd-dock-top) !important;bottom:auto !important}" +
    "html.ivd body .detail-cta{top:var(--ivd-cta-top) !important;bottom:auto !important}";
  document.head.appendChild(st);

  function visibleBottom() { return vv ? (vv.offsetTop + vv.height) : window.innerHeight; }
  function usable() {
    if (vv && vv.scale && vv.scale > 1.02) return false;
    var full = Math.max(window.screen.height || 0, window.screen.width || 0);
    if (vv && full && vv.height < full * 0.55 && vv.height < window.innerHeight * 0.8) return false;
    return true;
  }
  function shown(el) { return !!(el && el.offsetHeight > 0); }

  function update() {
    raf = 0;
    var dock = document.getElementById("bottomDock");
    var cta = document.querySelector(".detail-cta");
    if (!usable()) { html.classList.remove("ivd"); return; }
    html.classList.remove("ivd");               // موقعیت طبیعی CSS
    var vb = visibleBottom(), ok = true;
    if (shown(dock)) {
      if (dockGap === null) { var g = parseFloat(getComputedStyle(dock).bottom); dockGap = isNaN(g) ? 12 : g; }
      if (Math.abs(dock.getBoundingClientRect().bottom - (vb - dockGap)) > 2) ok = false;
    }
    if (shown(cta) && Math.abs(cta.getBoundingClientRect().bottom - vb) > 2) ok = false;
    if (ok) return;
    if (shown(dock)) html.style.setProperty("--ivd-dock-top", Math.round((vb - dock.offsetHeight - (dockGap || 0)) * 100) / 100 + "px");
    if (shown(cta)) html.style.setProperty("--ivd-cta-top", Math.round((vb - cta.offsetHeight) * 100) / 100 + "px");
    html.classList.add("ivd");
  }
  function now() { if (timer) { clearTimeout(timer); timer = 0; } if (!raf) raf = requestAnimationFrame(update); }
  function later(ms) { if (timer) clearTimeout(timer); timer = setTimeout(function () { timer = 0; if (!raf) raf = requestAnimationFrame(update); }, ms); }

  // وسط اسکرول هیچ کاری نمی‌کنیم؛ فقط بعد از توقف.
  window.addEventListener("scroll", function () { later(200); }, { passive: true, capture: true });
  window.addEventListener("touchend", function () { later(280); }, { passive: true });
  window.addEventListener("resize", function () { later(120); });
  window.addEventListener("pageshow", function () { later(150); });
  window.addEventListener("orientationchange", function () { dockGap = null; later(300); });
  if (vv) { vv.addEventListener("resize", now); vv.addEventListener("scroll", function () { later(150); }); }
  new MutationObserver(function () { later(160); }).observe(document.body || html, { childList: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { later(100); });
  else later(100);
})();
