/* CM-H3D — صحنه‌ی سه‌بعدی و اسکرولی «پنل نمایشگاه‌ها» (مستقل از کد رندر؛ با MutationObserver روی DOM اعمال می‌شود) */
(function () {
  "use strict";
  if (window.__cmH3d) return; window.__cmH3d = true;
  var reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var FA = "۰۱۲۳۴۵۶۷۸۹";
  function fa(n) { return String(n).replace(/\d/g, function (d) { return FA[d]; }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  var S = 'viewBox="0 0 24 24" aria-hidden="true"';
  var ICON = {
    trophy: '<svg ' + S + '><path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/></svg>',
    up: '<svg ' + S + '><path d="M4 16l6-6 4 4 6-7"/><path d="M15 7h5v5"/></svg>',
    user: '<svg ' + S + '><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/><path d="M19 5v4M17 7h4"/></svg>',
    list: '<svg ' + S + '><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 9h8M8 13h8M8 17h4"/></svg>',
    shield: '<svg ' + S + '><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="m9 12 2 2 4-4"/></svg>',
    star: '<svg ' + S + '><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8L3.5 9.7l5.9-.9L12 3.5z"/></svg>',
    eye: '<svg ' + S + '><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>'
  };

  var stages = [], decks = [], px = 0, py = 0, queued = false;

  function esc(s) { return s; }

  function buildStage() {
    var bars = [38, 55, 44, 70, 62, 86, 100], b = "";
    for (var i = 0; i < bars.length; i++) b += '<i style="--h:' + bars[i] + '%;--k:' + i + '"></i>';
    var d = document.createElement("div");
    d.className = "h3d-stage"; d.setAttribute("aria-hidden", "true");
    d.innerHTML =
      '<div class="h3d-scene"><div class="h3d-panel">' +
        '<div class="h3d-pbar"><span>نمونه‌ی پنل نمایشگاه</span></div>' +
        '<div class="h3d-kpis">' +
          '<div class="h3d-kpi"><small>بازدید امروز</small><b data-count="1284">' + fa(0) + '<em>▲</em></b></div>' +
          '<div class="h3d-kpi"><small>آگهی فعال</small><b data-count="24">' + fa(0) + '</b></div>' +
        '</div>' +
        '<div class="h3d-chart">' + b + '</div>' +
        '<div class="h3d-chip c1"><div>' + ICON.trophy + 'رتبه‌ی زنده<em>' + fa(3) + '</em></div></div>' +
        '<div class="h3d-chip c3"><div>' + ICON.user + 'مشتری جدید</div></div>' +
      '</div></div>';
    return d;
  }

  function buildDeck() {
    var items = [
      [ICON.list, "آگهی‌هایت یک‌جا", "همه‌ی خودروهای نمایشگاه را از یک صفحه اضافه، ویرایش و مدیریت کن."],
      [ICON.eye, "ببین چه کسی می‌بیند", "آمار بازدید هر آگهی را دنبال کن و بفهم کدام خودرو توجه بیشتری می‌گیرد."],
      [ICON.trophy, "رتبه‌ات زنده است", "جایگاهت را میان نمایشگاه‌ها ببین و با فعالیت بیشتر بالاتر برو."]
    ];
    var d = document.createElement("div");
    d.className = "h3d-deck";
    d.innerHTML = items.map(function (it, i) {
      return '<div class="h3d-card" style="--sd:' + (i * 1.3) + 's"><span class="h3d-num">' + fa(i + 1) + '</span><span class="h3d-ico">' + it[0] + '</span><div><h4>' + it[1] + '</h4><p>' + it[2] + '</p></div></div>';
    }).join("");
    return d;
  }

  function countUp(stage) {
    stage.querySelectorAll("[data-count]").forEach(function (el) {
      var to = +el.getAttribute("data-count"), em = el.querySelector("em"), t0 = performance.now(), dur = 1400;
      var tail = em ? em.outerHTML : "";
      if (reduce) { el.innerHTML = fa(to.toLocaleString("en")) + tail; return; }
      (function tick(now) {
        var k = clamp((now - t0) / dur, 0, 1), v = Math.round(to * ease(k));
        el.innerHTML = fa(v.toLocaleString("en")) + tail;
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }

  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting && !e.target.classList.contains("is-live")) {
        e.target.classList.add("is-live"); countUp(e.target);
      }
    });
  }, { threshold: 0.3 }) : null;

  function enhanceIntro(intro) {
    intro.setAttribute("data-h3d", "1");
    var h = intro.querySelector(".cm-sr-text"), chips = intro.querySelector(".cm-sr-chips"), cta = intro.querySelector(".cm-sr-cta");
    if (!h) return;
    var stage = buildStage(); h.insertAdjacentElement("afterend", stage);
    var deck = buildDeck();
    if (cta) { cta.insertAdjacentElement("beforebegin", deck); if (!cta.querySelector(".h3d-shine")) { var s = document.createElement("i"); s.className = "h3d-shine"; s.setAttribute("aria-hidden", "true"); cta.appendChild(s); } }
    else if (chips) chips.insertAdjacentElement("afterend", deck);
    stages.push({ el: stage, scene: stage.querySelector(".h3d-scene") });
    deck.querySelectorAll(".h3d-card").forEach(function (c, i) { decks.push({ el: c, dir: i % 2 ? 1 : -1 }); });
    if (io) io.observe(stage); else { stage.classList.add("is-live"); countUp(stage); }
    schedule();
  }

  function enhanceEmpty(el) {
    el.setAttribute("data-h3d", "1"); el.classList.add("h3d-empty");
    var lbl = document.querySelector(".cm-sr-cta span");
    var text = (lbl && lbl.textContent.trim()) || "ساخت پنل نمایشگاه";
    el.innerHTML =
      '<div class="h3d-ghosts" aria-hidden="true">' +
        '<div class="h3d-ghost g3"><i></i><i></i><i></i></div><div class="h3d-ghost g2"><i></i><i></i><i></i></div><div class="h3d-ghost g1"><i></i><i></i><i></i></div>' +
      '</div><b>جای نمایشگاه تو اینجا خالی است</b>' +
      '<p>اولین نمایشگاهی باش که اینجا دیده می‌شود.</p>' +
      '<button type="button" class="h3d-empty-cta" data-action="openDealershipEdit">' + text + '</button>';
  }

  function frame() {
    queued = false;
    var vh = window.innerHeight || 800, i, r, c, t, e, ex;
    for (i = stages.length - 1; i >= 0; i--) {
      var s = stages[i];
      if (!s.el.isConnected) { stages.splice(i, 1); continue; }
      r = s.el.getBoundingClientRect();
      if (r.bottom < -250 || r.top > vh + 250) continue;
      c = (r.top + r.height / 2) / vh;
      t = clamp((1.05 - c) / 0.62, 0, 1); e = ease(t);
      ex = clamp((0.32 - c) / 0.5, 0, 1);
      var fe = clamp((0.98 - c) / 0.4, 0, 1), fo = ease(fe);
      if (fo >= 0.995) { s.el.style.opacity = ""; s.el.style.filter = ""; }
      else { s.el.style.opacity = fo.toFixed(3); s.el.style.filter = "blur(" + ((1 - fo) * 16).toFixed(1) + "px) brightness(" + (0.12 + 0.88 * fo).toFixed(3) + ")"; }
      s.scene.style.setProperty("--pz", e.toFixed(3));
      s.scene.style.transform = "translate3d(0," + ((1 - e) * 36).toFixed(1) + "px,0) scale(" + (0.93 + 0.07 * e).toFixed(3) + ")";
    }
    for (i = decks.length - 1; i >= 0; i--) {
      var d = decks[i];
      if (!d.el.isConnected) { decks.splice(i, 1); continue; }
      r = d.el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) continue;
      t = clamp((vh * 0.96 - r.top) / (vh * 0.42), 0, 1); e = ease(t);
      d.el.style.opacity = e.toFixed(3);
      if (e >= 0.995) { d.el.style.filter = ""; d.el.style.boxShadow = ""; }
      else {
        d.el.style.filter = "blur(" + ((1 - e) * 12).toFixed(1) + "px) brightness(" + (0.15 + 0.85 * e).toFixed(3) + ")";
        d.el.style.boxShadow = "0 " + (28 * e).toFixed(1) + "px " + (46 * e).toFixed(1) + "px -26px rgba(0,113,227," + (0.6 * e).toFixed(2) + "),inset 0 1px 0 rgba(255,255,255," + (0.1 * e).toFixed(2) + ")";
      }
      d.el.style.transform = "perspective(820px) rotateX(" + ((1 - e) * 42).toFixed(1) + "deg) rotateY(" + (d.dir * (1 - e) * 16).toFixed(1) + "deg) translate3d(0," + ((1 - e) * 48).toFixed(1) + "px,0) scale(" + (0.9 + 0.1 * e).toFixed(3) + ")";
    }
  }
  function schedule() { if (!queued && !reduce) { queued = true; requestAnimationFrame(frame); } }

  function scan() {
    document.querySelectorAll(".cm-sr-intro:not([data-h3d])").forEach(enhanceIntro);
    document.querySelectorAll(".sr-home-empty:not([data-h3d])").forEach(function (el) {
      if (/ثبت نشده/.test(el.textContent)) enhanceEmpty(el);
    });
  }

  window.addEventListener("scroll", schedule, { passive: true, capture: true });
  window.addEventListener("resize", schedule, { passive: true });
  if (!reduce && window.matchMedia && matchMedia("(hover:hover)").matches) {
    if (false) window.addEventListener("pointermove", function (ev) {
      px = (ev.clientX / innerWidth - 0.5) * 2; py = (ev.clientY / innerHeight - 0.5) * 2; schedule();
    }, { passive: true });
  }
  var host = document.getElementById("pageContent") || document.body;
  new MutationObserver(scan).observe(host, { childList: true, subtree: true });
  scan(); schedule();
})();
