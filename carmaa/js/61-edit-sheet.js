"use strict";
/* EDIT-SHEET — «ویرایش اطلاعات» به‌صورت پاپ‌آپ از پایین صفحه (۷۵٪ ارتفاع)، نه تمام‌صفحه.
   پاپ‌آپ روی <body> ساخته می‌شود و render() به آن (و اینپوت‌ها) دست نمی‌زند؛
   باز/بسته شدنش صفحهٔ «حساب من» را دوباره نمی‌سازد (بدون رفرش و پرش اسکرول).
   مسیر accountEdit، آدرس /account/<نام>/edit و گیت «تکمیل اطلاعات» بدون تغییر کار می‌کنند. */
(function () {
  if (window.CARMA_EDIT_SHEET) return;
  if (typeof render !== "function" || typeof renderAccountEditScreen !== "function" || typeof renderAccountScreen !== "function") return;

  var RATIO = 0.87;
  var origEdit = renderAccountEditScreen;
  var origRender = window.render;
  var origNav = typeof navigateTo === "function" ? navigateTo : null;
  var origHeader = typeof updateHeader === "function" ? updateHeader : null;

  var sheet = null;
  var baseH = window.innerHeight, baseW = window.innerWidth;
  var pushedByNav = false;
  var savedY = null;
  var backTimer = 0;
  var softClose = false;     // بستن با ✕/کشیدن/Back: صفحهٔ حساب دوباره ساخته نشود

  function onEditRoute() { return !!(state && state.route && state.route.page === "accountEdit"); }
  function isSetup() { try { var P = window.CARMA_PROFILE_SETUP; return !!(P && P.isIncomplete && P.isIncomplete()); } catch (_) { return false; } }
  function coarse() { try { return window.matchMedia("(pointer:coarse)").matches; } catch (_) { return false; } }
  function blurActive() { try { var a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); } catch (_) {} }

  function injectCss() {
    if (document.getElementById("edit-sheet-css")) return;
    var css = document.createElement("style"); css.id = "edit-sheet-css";
    css.textContent = [
      "@media (pointer:coarse){html.es-open,html.es-open body{overflow:hidden!important;overscroll-behavior:none}}",
      ".es-root{--es-bg:#1D1D1F;--es-line:rgba(255,255,255,.09);--es-grab:rgba(255,255,255,.28);--es-scrim:rgba(0,0,0,.6);--ps-card:#1D1D1F;--ps-line:#262628;--ps-t:#F5F5F7;--ps-s:#8e8e98;--ps-btn:#F5F5F7;--ps-btnt:#1D1D1F;--ps-sh:rgba(0,0,0,.4);--ps-av:#262628;--ps-ring:#333336;",
      "position:fixed;inset:0;z-index:55;visibility:hidden;pointer-events:none;direction:rtl;color:var(--ps-t);-webkit-tap-highlight-color:transparent}",
      "html.theme-light .es-root{--es-bg:#f3f3f6;--es-line:rgba(0,0,0,.08);--es-grab:rgba(0,0,0,.22);--es-scrim:rgba(0,0,0,.38);--ps-card:#ffffff;--ps-line:#e3e3e8;--ps-t:#1D1D1F;--ps-s:#6d6d78;--ps-btn:#1D1D1F;--ps-btnt:#ffffff;--ps-sh:rgba(0,0,0,.08);--ps-av:#e8e8ee;--ps-ring:#d6d6de}",
      ".es-root.is-on{visibility:visible}",
      ".es-scrim{position:absolute;inset:0;background:var(--es-scrim);opacity:0;transition:opacity .34s ease;pointer-events:auto;touch-action:none}",
      ".es-root.is-in .es-scrim{opacity:1}",
      ".es-root.is-out .es-scrim{opacity:0;transition-duration:.26s}",
      ".es-panel{position:absolute;left:0;right:0;bottom:var(--es-kb,0px);margin-inline:auto;width:100%;max-width:560px;height:87vh;height:var(--es-h,87dvh);",
      "display:flex;flex-direction:column;background:var(--es-bg);border-radius:28px 28px 0 0;border-top:1px solid var(--es-line);box-shadow:0 -6px 24px rgba(0,0,0,.35);overflow:hidden;pointer-events:auto;",
      "transform:translate3d(0,104%,0);transition:transform .44s cubic-bezier(.22,1,.36,1),height .22s ease,bottom .22s ease;will-change:transform;contain:layout paint}",
      ".es-root.is-in .es-panel{transform:translate3d(0,var(--es-drag,0px),0)}",
      ".es-root.is-out .es-panel{transform:translate3d(0,104%,0);transition:transform .3s cubic-bezier(.5,0,.75,0)}",
      ".es-root.is-drag .es-panel{transition:none}",
      ".es-grab{flex:none;height:22px;display:flex;align-items:center;justify-content:center;touch-action:none;cursor:grab}",
      ".es-grab span{width:42px;height:5px;border-radius:99px;background:var(--es-grab)}",
      ".es-root[data-setup=\"1\"] .es-grab{cursor:default}",
      ".es-head{flex:none;touch-action:none}",
      ".es-root .es-panel .es-head .page-header-sticky{position:relative!important;top:auto!important;z-index:auto!important;margin:0!important;background:transparent!important;background-color:transparent!important;box-shadow:none!important}",
      ".es-panel .ps-head{padding:2px 64px 12px!important;border-bottom:1px solid var(--es-line)}",
      ".es-panel .ps-head h1{font-size:17px!important;line-height:1.5}",
      ".es-panel .ps-close{top:0;right:14px;width:38px;height:38px;box-shadow:none;cursor:pointer;touch-action:manipulation}",
      ".es-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;scroll-padding-block:24px}",
      ".es-panel .ps-form{gap:12px!important;padding-top:12px!important;padding-bottom:calc(28px + env(safe-area-inset-bottom,0px))!important}",
      ".es-panel .ps-section{display:none}",
      ".es-panel .ps-form .account-edit-avatar-wrap,.es-panel .ps-form .account-edit-avatar{width:92px;height:92px}",
      ".es-panel .ps-form .account-edit-avatar{font-size:32px}",
      ".es-panel .ps-form .account-edit-avatar-badge{width:32px;height:32px}",
      ".es-panel .ps-form>div.items-center{padding-block:0!important;gap:6px!important}",
      ".es-panel [data-ps-banner]{font-size:12px!important;line-height:1.75!important;padding:8px 12px!important}",
      ".es-root.is-kb .ps-form{padding-bottom:96px!important}",
      ".es-panel .ps-form>button[type=\"submit\"]{position:sticky;bottom:calc(8px + env(safe-area-inset-bottom,0px));z-index:3;box-shadow:0 10px 26px rgba(0,0,0,.35)}",
      ".es-root.is-kb .ps-form>button[type=\"submit\"]{bottom:8px}",
      ".es-panel .ps-input{touch-action:manipulation;-webkit-user-select:text!important;user-select:text!important;min-height:24px}",
      ".es-panel .ps-row{touch-action:manipulation}",
      "html.theme-light .es-panel .ps-card{background:#fff!important}",
      ".es-panel .account-edit-avatar-wrap{touch-action:manipulation}",
      "@media (prefers-reduced-motion:reduce){.es-panel,.es-scrim{transition-duration:.01s!important}}"
    ].join("\n");
    document.head.appendChild(css);
  }

  function layout() {
    if (!sheet) return;
    var vv = window.visualViewport, ih = window.innerHeight, iw = window.innerWidth;
    if (iw !== baseW) { baseW = iw; baseH = ih; }
    if (ih > baseH) baseH = ih;
    var vh = vv ? vv.height : ih;
    var layoutResized = ih < baseH - 80;
    var kb = 0;
    if (vv && !layoutResized) kb = Math.max(0, Math.round(ih - vh - vv.offsetTop));
    var avail = Math.min(ih, vh);
    var h = Math.min(Math.round(baseH * RATIO), avail - 12);
    h = Math.max(h, Math.min(280, avail - 12));
    var open = kb > 80 || layoutResized;
    sheet.root.style.setProperty("--es-h", h + "px");
    sheet.root.style.setProperty("--es-kb", kb + "px");
    sheet.root.classList.toggle("is-kb", open);
  }

  function centerField(el) {
    if (!sheet || !el) return;
    try {
      var row = el.closest(".ps-row") || el, s = sheet.scroll;
      var r = row.getBoundingClientRect(), sr = s.getBoundingClientRect();
      var delta = (r.top + r.height / 2) - (sr.top + sr.height * 0.42);
      if (Math.abs(delta) > 6) s.scrollBy({ top: delta, behavior: "smooth" });
    } catch (_) {}
  }

  function createSheet() {
    var page = origEdit();
    if (!page) return false;
    var head = page.querySelector(".page-header-sticky");
    var form = page.querySelector("form");
    if (!form) return false;
    var setup = isSetup();

    var attrs = {
      nickname: { autocomplete: "off", enterkeyhint: "next", autocapitalize: "words", autocorrect: "off" },
      firstName: { autocomplete: "given-name", enterkeyhint: "next", autocapitalize: "words", autocorrect: "off" },
      lastName: { autocomplete: "family-name", enterkeyhint: "next", autocapitalize: "words", autocorrect: "off" },
      username: { autocomplete: "off", enterkeyhint: "next", autocapitalize: "none", autocorrect: "off", spellcheck: "false", dir: "ltr" },
      email: { autocomplete: "email", enterkeyhint: "done", autocapitalize: "none", autocorrect: "off", spellcheck: "false", dir: "ltr", inputmode: "email" },
      phone: { dir: "ltr" }
    };
    Object.keys(attrs).forEach(function (n) {
      var el = form.querySelector('input[name="' + n + '"]'); if (!el) return;
      Object.keys(attrs[n]).forEach(function (k) { el.setAttribute(k, attrs[n][k]); });
    });
    var em = form.querySelector('input[name="email"]'); if (em && em.type === "email") em.type = "text";

    var root = document.createElement("div");
    root.id = "esRoot"; root.className = "es-root"; root.setAttribute("dir", "rtl");
    root.setAttribute("data-setup", setup ? "1" : "0");
    root.innerHTML = '<div class="es-scrim"></div><section class="es-panel" role="dialog" aria-modal="true" aria-labelledby="esTitle">' +
      '<div class="es-grab" aria-hidden="true"><span></span></div><div class="es-head"></div><div class="es-scroll"></div></section>';
    var panel = root.querySelector(".es-panel"), scroll = root.querySelector(".es-scroll"), headBox = root.querySelector(".es-head"), scrim = root.querySelector(".es-scrim");
    if (head) { headBox.appendChild(head); var h1 = head.querySelector("h1"); if (h1) h1.id = "esTitle"; }
    scroll.appendChild(form);

    var s = sheet = { root: root, panel: panel, scroll: scroll, form: form, setup: setup, closing: false, timer: 0, off: [] };
    function on(t, ev, fn, opt) { t.addEventListener(ev, fn, opt); s.off.push(function () { t.removeEventListener(ev, fn, opt); }); }

    on(scrim, "click", function (e) { e.preventDefault(); requestClose(); });
    on(scrim, "touchmove", function (e) { e.preventDefault(); }, { passive: false });
    on(scrim, "wheel", function (e) { e.preventDefault(); }, { passive: false });
    on(panel, "click", function (e) {
      var x = e.target.closest && e.target.closest(".ps-close");
      if (x) { e.preventDefault(); e.stopImmediatePropagation(); requestClose(); }
    }, true);
    on(document, "keydown", function (e) { if (e.key === "Escape") requestClose(); });

    if (!setup) bindDrag(s, root.querySelector(".es-grab")), bindDrag(s, headBox);

    on(form, "keydown", function (e) {
      if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
      var t = e.target; if (!t || t.tagName !== "INPUT") return;
      var list = [].filter.call(form.querySelectorAll("input.ps-input"), function (i) { return !i.readOnly && !i.disabled && i.type !== "file"; });
      var i = list.indexOf(t);
      if (i > -1 && i < list.length - 1) { e.preventDefault(); list[i + 1].focus(); }
    });
    on(form, "focusin", function (e) {
      var t = e.target; if (!t || t.tagName !== "INPUT") return;
      layout();
      if (t.getAttribute("dir") === "ltr" && t.value && !t.readOnly) {
        requestAnimationFrame(function () {
          try { if (document.activeElement === t && t.selectionStart === 0 && t.selectionEnd === 0) t.setSelectionRange(t.value.length, t.value.length); } catch (_) {}
        });
      }
      setTimeout(function () { centerField(t); }, 60);
      setTimeout(function () { layout(); centerField(t); }, 380);
    });
    on(form, "focusout", function () { setTimeout(layout, 120); setTimeout(layout, 450); });
    on(form, "input", function () {
      var box = form.querySelector('[data-slot="form-error"]');
      if (box && !box.hidden) box.hidden = true;
    });

    on(window, "resize", layout);
    on(window, "orientationchange", function () { setTimeout(layout, 250); });
    if (window.visualViewport) { on(window.visualViewport, "resize", layout); on(window.visualViewport, "scroll", layout); }

    document.body.appendChild(root);
    try { if (window.CARMA_FIELD_PAGE) window.CARMA_FIELD_PAGE.attach(form); } catch (_) {}   // FIELD-PAGE
    layout();
    if (coarse()) document.documentElement.classList.add("es-open");
    root.classList.add("is-on");
    void root.offsetWidth;
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (sheet === s && !s.closing) root.classList.add("is-in"); }); });
    return true;
  }

  function bindDrag(s, el) {
    var active = false, startY = 0, dy = 0, t0 = 0, pid = null;
    el.addEventListener("pointerdown", function (e) {
      if (s.closing || (e.pointerType === "mouse" && e.button !== 0)) return;
      if (e.target.closest && e.target.closest("button,a,input,textarea,select,label")) return;
      active = true; startY = e.clientY; dy = 0; t0 = Date.now(); pid = e.pointerId;
      try { el.setPointerCapture(pid); } catch (_) {}
      s.root.classList.add("is-drag"); blurActive();
    });
    el.addEventListener("pointermove", function (e) {
      if (!active) return;
      dy = Math.max(0, e.clientY - startY);
      s.root.style.setProperty("--es-drag", dy + "px");
    });
    function end() {
      if (!active) return; active = false;
      var v = dy / Math.max(1, Date.now() - t0);
      s.root.classList.remove("is-drag"); s.root.style.removeProperty("--es-drag");
      if (dy > 120 || (dy > 40 && v > 0.55)) requestClose();
    }
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  }

  function requestClose() {
    if (!sheet || sheet.closing || sheet.setup) return;
    blurActive();
    if (backTimer) return;
    softClose = true; setTimeout(function () { softClose = false; }, 1500);
    if (pushedByNav && history.length > 1) {
      try { history.back(); } catch (_) {}
      backTimer = setTimeout(function () {
        backTimer = 0;
        if (sheet && !sheet.closing && onEditRoute() && origNav) navigateTo({ page: "account" }, { menuOpen: false });
      }, 500);
      return;
    }
    if (origNav) navigateTo({ page: "account" }, { menuOpen: false });
  }

  function closeSheet() {
    var s = sheet; if (!s || s.closing) return;
    s.closing = true; blurActive();
    try { if (window.CARMA_FIELD_PAGE) window.CARMA_FIELD_PAGE.dismiss(true); } catch (_) {}
    if (backTimer) { clearTimeout(backTimer); backTimer = 0; }
    s.root.classList.remove("is-in"); s.root.classList.add("is-out");
    s.timer = setTimeout(function () { finalize(s); }, 360);
    try { if (state && state.route && state.route.page === "account" && savedY != null) window.scrollTo(0, savedY); } catch (_) {}
  }
  function finalize(s) {
    if (!s) return;
    clearTimeout(s.timer);
    try { if (window.CARMA_FIELD_PAGE) window.CARMA_FIELD_PAGE.detach(); } catch (_) {}
    s.off.forEach(function (f) { try { f(); } catch (_) {} });
    try { s.root.remove(); } catch (_) {}
    if (sheet === s) { sheet = null; pushedByNav = false; savedY = null; softClose = false; }
    if (!sheet) document.documentElement.classList.remove("es-open");
  }

  function syncSheet() {
    var s = sheet; if (!s) return;
    var box = s.form.querySelector('[data-slot="form-error"]');
    var err = state && state.accountEditError;
    if (box) { box.hidden = !err; if (err) box.textContent = err; }
    var sub = s.form.querySelector('button[type="submit"]'); if (sub && err) sub.disabled = false;
    if (err && box) { try { box.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (_) {} }
  }

  renderAccountEditScreen = function () {
    try {
      if (sheet && sheet.closing) finalize(sheet);
      if (!sheet) {
        if (state && state.accountEditError) state = { ...state, accountEditError: null };
        injectCss();
        if (!createSheet()) { sheet = null; return origEdit(); }
      } else {
        syncSheet();
      }
    } catch (e) {
      try { console.warn("edit-sheet:", e); } catch (_) {}
      if (sheet) finalize(sheet);
      return origEdit();
    }
    return renderAccountScreen();
  };

  function accountMounted() {
    var pc = document.getElementById("pageContent");
    return !!(pc && pc.querySelector(':scope > [data-page="account"]'));
  }
  function repaintChrome() {
    try { if (typeof updateOverlays === "function") updateOverlays(); } catch (_) {}
    try { if (typeof window.syncCanonicalUrl === "function") window.syncCanonicalUrl(); } catch (_) {}
  }

  window.render = function carmaaEditSheetRender() {
    try {
      // باز شدن از صفحهٔ «حساب من»: صفحه دست‌نخورده می‌ماند، فقط پاپ‌آپ سوار می‌شود (بدون رفرش/فلش).
      if (!sheet && onEditRoute() && accountMounted() && !(state && state.loading)) {
        if (state && state.accountEditError) state = { ...state, accountEditError: null };
        injectCss();
        if (createSheet()) { repaintChrome(); return; }
        sheet = null;
      }
      // بستن بدون تغییر داده: صفحهٔ حساب همان است که بود.
      else if (sheet && !sheet.closing && !onEditRoute() && softClose && state && state.route && state.route.page === "account" && accountMounted()) {
        softClose = false; closeSheet(); repaintChrome(); return;
      }
    } catch (e) { try { console.warn("edit-sheet:", e); } catch (_) {} }
    var r = origRender.apply(this, arguments);
    try { if (sheet && !sheet.closing && !onEditRoute()) closeSheet(); } catch (_) {}
    return r;
  };

  if (origNav) {
    navigateTo = function (route) {
      var openingFromAccount = !!(route && route.page === "accountEdit" && state && state.route && state.route.page === "account" && !sheet);
      var y = window.pageYOffset || 0;
      if (openingFromAccount) { pushedByNav = true; savedY = y; }
      else if (route && route.page === "accountEdit" && !sheet) { pushedByNav = false; savedY = null; }
      var quiet = openingFromAccount || (sheet && !sheet.closing && softClose && route && route.page === "account");
      var st = window.scrollTo;
      if (quiet) window.scrollTo = function () {};
      try { return origNav.apply(this, arguments); }
      finally { if (quiet) window.scrollTo = st; }
    };
  }

  if (origHeader) {
    updateHeader = function () {
      if (sheet && !sheet.closing && onEditRoute()) {
        var keep = state;
        state = { ...state, route: { ...state.route, page: "account" } };
        try { return origHeader.apply(this, arguments); } finally { state = keep; }
      }
      return origHeader.apply(this, arguments);
    };
  }

  window.CARMA_EDIT_SHEET = Object.freeze({
    isOpen: function () { return !!sheet && !sheet.closing; },
    close: requestClose
  });
})();
