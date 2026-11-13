"use strict";
/* CarMaa — sliding indicator for the vehicle-detail segmented tabs.
   Same motion language as the bottom dock: one thumb that glides (with a soft overshoot)
   to the tapped tab, the label pops, and it reacts on pointerdown without waiting for the click. */
(function () {
  var reduce = function () { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); };
  var tapTimer = 0;

  function setup(bar) {
    if (bar.__cmInd) return;
    bar.__cmInd = true;
    var ind = document.createElement("span");
    ind.className = "cm-vx-ind"; ind.setAttribute("aria-hidden", "true");
    bar.insertBefore(ind, bar.firstChild);
    bar.classList.add("cm-ind-on");
    var placed = false, lastW = 0;

    function target() { return bar.querySelector(".vx-tab.is-tap") || bar.querySelector('.vx-tab[aria-selected="true"]'); }
    function place() {
      var t = target();
      if (!t) { ind.style.opacity = "0"; return; }
      var pr = bar.getBoundingClientRect(), tr = t.getBoundingClientRect();
      if (!tr.width || !pr.width) return;
      var x = tr.left - pr.left - bar.clientLeft, y = tr.top - pr.top - bar.clientTop;
      var snap = !placed || reduce();
      if (snap) ind.classList.add("cm-snap");
      ind.style.width = tr.width + "px"; ind.style.height = tr.height + "px";
      ind.style.transform = "translate3d(" + x + "px," + y + "px,0)";
      ind.style.opacity = "1";
      if (snap) { void ind.offsetWidth; ind.classList.remove("cm-snap"); placed = true; }
    }

    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var el = records[i].target;
        if (records[i].attributeName !== "aria-selected") continue;
        if (!el.classList || !el.classList.contains("vx-tab")) continue;
        var now = el.getAttribute("aria-selected") === "true";
        var was = records[i].oldValue === "true";
        if (now && !was && placed) { el.classList.add("cm-pop"); (function (e) { setTimeout(function () { e.classList.remove("cm-pop"); }, 520); })(el); }
      }
      place();
    }).observe(bar, { subtree: true, attributes: true, attributeFilter: ["aria-selected", "class"], attributeOldValue: true });

    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        var w = bar.getBoundingClientRect().width;
        if (!lastW && w) placed = false;
        lastW = w; place();
      }).observe(bar);
    }
    window.addEventListener("resize", function () { placed = false; place(); }, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(); });
    place();
  }

  function scan() {
    var bars = document.querySelectorAll(".vx-tabs");
    for (var i = 0; i < bars.length; i++) setup(bars[i]);
  }

  document.addEventListener("pointerdown", function (e) {
    var t = e.target.closest && e.target.closest(".vx-tabs .vx-tab");
    if (!t) return;
    var bar = t.parentNode;
    bar.querySelectorAll(".vx-tab.is-tap").forEach(function (x) { x.classList.remove("is-tap"); });
    t.classList.add("is-tap");
    clearTimeout(tapTimer);
    tapTimer = setTimeout(function () { t.classList.remove("is-tap"); }, 900);
  }, { passive: true, capture: true });
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest(".vx-tabs .vx-tab");
    if (t) setTimeout(function () { t.classList.remove("is-tap"); }, 60);
  }, true);

  var queued = false;
  function start() {
    scan();
    new MutationObserver(function () {
      if (queued) return; queued = true;
      requestAnimationFrame(function () { queued = false; scan(); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();

/* CM-SIMPLE-TABS: انیمیشن تب‌ها ساده و سبک (بدون فنر، بدون پاپ، بدون انیمیشن پنل) */
(function () {
  try {
    if (document.getElementById("cmSimpleTabsCss")) return;
    var st = document.createElement("style"); st.id = "cmSimpleTabsCss";
    st.textContent = 'html body .vehicle-demo-layout .vx-tabs .cm-vx-ind{transition:transform .18s ease-out,opacity .12s linear!important;will-change:transform;box-shadow:none!important}html body .vehicle-demo-layout .vx-tabs .cm-vx-ind.cm-snap{transition:none!important}html body .vehicle-demo-layout .vx-tab,html body .vehicle-demo-layout .vx-tab.cm-pop{animation:none!important;transition:color .15s linear!important}html body .vehicle-demo-layout .vx-pane,html body .vehicle-demo-layout .vx-pane.on{animation:none!important;transition:none!important}';
    document.head.appendChild(st);
  } catch (_) {}
})();
