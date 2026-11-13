"use strict";
/* FIELD-PAGE — تایپ هر فیلدِ «ویرایش اطلاعات» در یک صفحهٔ جدا (فقط یک اینپوت).
   مشکل قبلی: اینپوت‌ها داخل پاپ‌آپ فوکوس می‌گرفتند و کیبرد با ارتفاع/اسکرول شیت درگیر می‌شد
   (لگ، باز و بسته شدن کیبرد، رفتن فیلد زیر کیبرد).
   حالا: اینپوت‌های داخل شیت هیچ‌وقت فوکوس نمی‌گیرند؛ لمس هر ردیف یک صفحهٔ تمام‌صفحه با یک اینپوت باز می‌کند
   (به اندازهٔ visualViewport، بالای صفحه، بدون اسکرول). با «تأیید» مقدار به فرم برمی‌گردد.
   ذخیرهٔ نهایی همچنان با دکمهٔ «ذخیره» در شیت و همان saveAccountInfo انجام می‌شود.
   توسط 61-edit-sheet.js صدا زده می‌شود: attach(form) / dismiss(discard) / detach(). */
(function () {
  if (window.CARMA_FIELD_PAGE) return;

  var RE_USERNAME = /^[a-z][a-z0-9_.]{2,19}$/;
  var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var NAMES = ["nickname", "firstName", "lastName", "username", "email"];
  var FADE_MS = 200;

  var ICON_BACK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  var ICON_X = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var cur = null;   // { form, off[] } — فرمِ شیتِ فعلی
  var ui = null;    // DOM صفحهٔ فیلد (تا وقتی شیت هست زنده می‌ماند)
  var fld = null;   // فیلدِ در حال ویرایش
  var hideTimer = 0, raf = 0, noteObs = null;

  function apiOn() {
    return !!(window.CARMA_API && window.CARMA_API.enabled && window.CARMA_AUTH_USER && window.CARMA_AUTH_USER.phone);
  }

  function injectCss() {
    if (document.getElementById("field-page-css")) return;
    var css = document.createElement("style"); css.id = "field-page-css";
    css.textContent = [
      /* اینپوت‌های شیت فقط نمایشی‌اند؛ لمس به ردیف می‌رسد و کیبرد هرگز داخل شیت باز نمی‌شود */
      ".es-panel .ps-input{pointer-events:none!important;-webkit-user-select:none!important;user-select:none!important}",
      ".es-panel .ps-row:not(.is-ro){cursor:pointer;-webkit-tap-highlight-color:rgba(255,255,255,.06)}",
      ".es-panel .ps-row:not(.is-ro):active{background:rgba(255,255,255,.05)}",
      "html.theme-light .es-panel .ps-row:not(.is-ro):active{background:rgba(0,0,0,.04)}",
      ".es-panel .ps-hint{display:none!important}",

      ".fp-root{--fp-bg:#1D1D1F;--fp-card:#1D1D1F;--fp-line:#262628;--fp-t:#F5F5F7;--fp-s:#8e8e98;--fp-acc:#a78bfa;--fp-err:#ffffff;--fp-ok:#22c55e;--fp-btn:#F5F5F7;--fp-btnt:#1D1D1F;",
      "position:fixed;left:0;right:0;top:0;height:100%;z-index:70;display:flex;flex-direction:column;background:var(--fp-bg);color:var(--fp-t);direction:rtl;",
      "visibility:hidden;opacity:0;pointer-events:none;transition:opacity .16s ease;overflow:hidden;overscroll-behavior:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;font-family:inherit}",
      "html.theme-light .fp-root{--fp-bg:#f3f3f6;--fp-card:#ffffff;--fp-line:#e3e3e8;--fp-t:#1D1D1F;--fp-s:#6d6d78;--fp-acc:#6d4fe0;--fp-btn:#1D1D1F;--fp-btnt:#ffffff}",
      ".fp-root.is-on{visibility:visible;pointer-events:auto}",
      ".fp-root.is-in{opacity:1}",
      ".fp-inner{width:100%;max-width:560px;margin-inline:auto;display:flex;flex-direction:column;min-height:0;flex:1 1 auto}",
      ".fp-head{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:calc(8px + env(safe-area-inset-top,0px)) 10px 8px;border-bottom:1px solid var(--fp-line)}",
      ".fp-back,.fp-spacer{flex:none;width:44px;height:44px}",
      ".fp-back{display:flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--fp-t);border-radius:50%;cursor:pointer;padding:0}",
      ".fp-back:active{background:rgba(127,127,140,.18)}",
      ".fp-title{flex:1;min-width:0;margin:0;text-align:center;font-size:16px;font-weight:700;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fp-body{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:18px 16px 24px;display:flex;flex-direction:column;gap:10px}",
      ".fp-field{display:flex;align-items:center;gap:6px;background:var(--fp-card);border:1.5px solid var(--fp-line);border-radius:16px;padding:0 14px;transition:border-color .15s}",
      ".fp-field:focus-within{border-color:var(--fp-acc)}",
      ".fp-field.is-bad{border-color:var(--fp-err)}",
      ".fp-input{flex:1;min-width:0;height:54px;background:transparent;border:0;outline:0;box-shadow:none;margin:0;padding:0;border-radius:0;-webkit-appearance:none;appearance:none;",
      "color:var(--fp-t);font-family:inherit;font-size:16px;font-weight:600;text-align:start}",
      ".fp-input::placeholder{color:var(--fp-s);font-weight:500}",
      ".fp-clear{flex:none;width:26px;height:26px;border-radius:50%;border:0;padding:0;background:rgba(127,127,140,.28);color:var(--fp-t);display:flex;align-items:center;justify-content:center;cursor:pointer}",
      ".fp-clear[hidden]{display:none}",
      ".fp-note{min-height:18px;margin:0;font-size:12px;line-height:1.8;color:var(--fp-s);text-align:right}",
      ".fp-note:empty{display:none}",
      ".fp-hints{display:flex;flex-direction:column;gap:6px}",
      ".fp-hint{margin:0;font-size:12px;line-height:1.9;color:var(--fp-s);text-align:right}",
      ".fp-err{margin:0;font-size:12.5px;line-height:1.8;color:var(--fp-err);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.21);border-radius:12px;padding:9px 12px;text-align:right}",
      ".fp-err[hidden]{display:none}",
      ".fp-save{width:100%;margin-top:4px;border:0;border-radius:16px;padding:15px;background:var(--fp-btn);color:var(--fp-btnt);font-family:inherit;font-size:15px;font-weight:800;cursor:pointer}",
      ".fp-save:active{opacity:.85}",
      "@media (prefers-reduced-motion:reduce){.fp-root{transition-duration:.01s!important}}"
    ].join("\n");
    document.head.appendChild(css);
  }

  function build() {
    var root = document.createElement("div");
    root.className = "fp-root"; root.id = "fpRoot"; root.setAttribute("dir", "rtl");
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-labelledby", "fpTitle");
    root.innerHTML =
      '<div class="fp-inner">' +
        '<div class="fp-head">' +
          '<button type="button" class="fp-back" aria-label="بازگشت">' + ICON_BACK + '</button>' +
          '<h2 class="fp-title" id="fpTitle"></h2><span class="fp-spacer" aria-hidden="true"></span>' +
        '</div>' +
        '<div class="fp-body">' +
          '<div class="fp-field"><input class="fp-input" id="fpInput" type="text" enterkeyhint="done"/>' +
            '<button type="button" class="fp-clear" aria-label="پاک کردن" hidden>' + ICON_X + '</button></div>' +
          '<p class="fp-note" aria-live="polite"></p>' +
          '<p class="fp-err" role="alert" hidden></p>' +
          '<div class="fp-hints"></div>' +
          '<button type="button" class="fp-save">تأیید</button>' +
        '</div>' +
      '</div>';
    var q = function (s) { return root.querySelector(s); };
    return {
      root: root, title: q(".fp-title"), input: q(".fp-input"), field: q(".fp-field"), clear: q(".fp-clear"),
      note: q(".fp-note"), err: q(".fp-err"), hints: q(".fp-hints"), save: q(".fp-save"), back: q(".fp-back")
    };
  }

  /* ---- هم‌اندازه با ناحیهٔ دیدنیِ واقعی (بالای کیبرد) ---- */
  function place() {
    raf = 0;
    if (!ui || !fld) return;
    var vv = window.visualViewport;
    var top = vv ? vv.offsetTop : 0, h = vv ? vv.height : window.innerHeight;
    ui.root.style.top = Math.max(0, Math.round(top)) + "px";
    ui.root.style.height = Math.round(h) + "px";
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(place); }
  function bindViewport(on) {
    var vv = window.visualViewport;
    var m = on ? "addEventListener" : "removeEventListener";
    if (vv) { vv[m]("resize", schedule); vv[m]("scroll", schedule); }
    window[m]("resize", schedule);
  }

  function labelText(row) {
    var l = row && row.querySelector(".ps-label, label"); if (!l) return "";
    var c = l.cloneNode(true);
    [].forEach.call(c.querySelectorAll("[data-ps-star],svg"), function (n) { n.remove(); });
    return (c.textContent || "").replace(/\*/g, "").trim();
  }

  function fire(el, type) { try { el.dispatchEvent(new Event(type, { bubbles: true })); } catch (_) {} }

  function showErr(msg) {
    ui.err.textContent = msg; ui.err.hidden = false; ui.field.classList.add("is-bad");
  }
  function clearErr() { ui.err.hidden = true; ui.field.classList.remove("is-bad"); }

  function syncNote() {
    if (!fld || !fld.noteEl) { ui.note.textContent = ""; return; }
    ui.note.textContent = fld.noteEl.textContent || "";
    ui.note.style.color = fld.noteEl.style.color || "";
  }

  function validate(name, v, inp) {
    if (name === "nickname") { if (v.length < 2) return "نام نمایشی باید حداقل ۲ حرف باشد."; }
    else if (name === "firstName") { if (v.length < 2) return "نام را وارد کنید (حداقل ۲ حرف)."; }
    else if (name === "lastName") { if (v.length < 2) return "نام خانوادگی را وارد کنید (حداقل ۲ حرف)."; }
    else if (name === "username") {
      if (!v) return "نام کاربری را وارد کنید.";
      if (!RE_USERNAME.test(v)) return "نام کاربری باید ۳ تا ۲۰ حرف انگلیسی کوچک، عدد، _ یا . باشد و با حرف شروع شود.";
      var st = inp.dataset.unameState;
      if (st === "taken") return "این نام کاربری قبلاً توسط شخص دیگری گرفته شده است.";
      if (st === "invalid") return "نام کاربری معتبر نیست.";
      if (st === "checking") return "چند لحظه صبر کنید تا بررسی نام کاربری تمام شود.";
    } else if (name === "email") {
      if (!v) return apiOn() ? "ایمیل را وارد کنید." : "";
      if (!RE_EMAIL.test(v)) return "لطفاً یک ایمیل معتبر وارد کنید.";
    }
    return "";
  }

  /* ---- باز کردن صفحهٔ فیلد؛ باید همان‌جا داخل رویداد لمس صدا زده شود تا کیبرد iOS باز شود ---- */
  function open(name) {
    if (!cur || fld) return;
    var inp = cur.form.querySelector('input[name="' + name + '"]');
    if (!inp || inp.readOnly || inp.disabled) return;
    var row = inp.closest(".ps-row") || inp.parentElement;
    injectCss();
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = 0; }

    var noteEl = row && row.querySelector('[data-slot="uname-note"]');
    fld = { name: name, inp: inp, row: row, orig: inp.value, noteEl: noteEl, fired: inp.value };

    ui.title.textContent = labelText(row) || name;
    ui.input.setAttribute("aria-label", ui.title.textContent);
    ["autocomplete", "autocapitalize", "autocorrect", "spellcheck", "inputmode", "maxlength"].forEach(function (a) {
      var v = inp.getAttribute(a);
      if (v == null || v === "") ui.input.removeAttribute(a); else ui.input.setAttribute(a, v);
    });
    ui.input.setAttribute("dir", inp.getAttribute("dir") || "rtl");
    ui.input.placeholder = inp.placeholder || "";
    ui.input.value = inp.value;
    ui.clear.hidden = !ui.input.value;

    ui.hints.innerHTML = "";
    if (row) [].forEach.call(row.querySelectorAll(".ps-hint"), function (h) {
      if (h.getAttribute("data-slot") === "uname-note") return;
      var t = (h.textContent || "").trim(); if (!t) return;
      var p = document.createElement("p"); p.className = "fp-hint"; p.textContent = t; ui.hints.appendChild(p);
    });
    clearErr(); syncNote();
    if (noteEl) {
      noteObs = new MutationObserver(syncNote);
      noteObs.observe(noteEl, { childList: true, characterData: true, subtree: true, attributes: true });
    }

    place(); bindViewport(true);
    ui.root.classList.remove("is-in");
    ui.root.classList.add("is-on");
    try { ui.input.focus({ preventScroll: true }); } catch (_) { try { ui.input.focus(); } catch (__) {} }
    try { var n = ui.input.value.length; ui.input.setSelectionRange(n, n); } catch (_) {}
    requestAnimationFrame(function () { if (fld) ui.root.classList.add("is-in"); });
  }

  function finish() {
    if (noteObs) { try { noteObs.disconnect(); } catch (_) {} noteObs = null; }
    bindViewport(false);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    try { if (document.activeElement === ui.input) ui.input.blur(); } catch (_) {}
    ui.root.classList.remove("is-in");
    fld = null;
    hideTimer = setTimeout(function () {
      hideTimer = 0;
      if (ui && !fld) { ui.root.classList.remove("is-on"); ui.root.style.top = ""; ui.root.style.height = ""; }
    }, FADE_MS);
  }

  function confirm() {
    if (!fld) return;
    var f = fld, v = ui.input.value.trim();
    if (f.name === "username") v = v.toLowerCase().replace(/^@/, "");
    var msg = validate(f.name, v, f.inp);
    if (msg) { showErr(msg); try { ui.input.focus({ preventScroll: true }); } catch (_) {} return; }
    f.inp.value = v;
    if (v !== f.fired) { fire(f.inp, "input"); f.fired = v; }
    fire(f.inp, "change");
    finish();
  }

  function cancel() {
    if (!fld) return;
    var f = fld;
    if (f.inp.value !== f.orig) { f.inp.value = f.orig; fire(f.inp, "input"); }
    finish();
  }

  function onInput() {
    if (!fld) return;
    clearErr();
    var v = ui.input.value;
    if (fld.name === "username") {
      var low = v.toLowerCase();
      if (low !== v) { ui.input.value = low; v = low; }
      fld.inp.value = v; fire(fld.inp, "input"); fld.fired = v;   // بررسی زندهٔ آزاد بودن نام کاربری
    }
    ui.clear.hidden = !v;
  }

  function attach(form) {
    if (!form) return;
    detach();
    injectCss();
    cur = { form: form, off: [] };
    ui = build();
    document.body.appendChild(ui.root);

    function on(t, ev, fn, opt) { t.addEventListener(ev, fn, opt); cur.off.push(function () { t.removeEventListener(ev, fn, opt); }); }

    NAMES.forEach(function (n) { var el = form.querySelector('input[name="' + n + '"]'); if (el) el.setAttribute("tabindex", "-1"); });

    // لمس ردیف → صفحهٔ فیلد. در فاز capture تا هندلر قدیمیِ ردیف (inp.focus()) اصلاً اجرا نشود.
    on(form, "click", function (e) {
      var row = e.target.closest && e.target.closest(".ps-row");
      if (!row || !form.contains(row)) return;
      var inp = row.querySelector("input.ps-input"); if (!inp || NAMES.indexOf(inp.name) < 0) return;
      if (inp.readOnly) return;
      e.preventDefault(); e.stopPropagation();
      open(inp.name);
    }, true);

    // هر فوکوس برنامه‌ای روی اینپوت‌های شیت (مثلاً showError) را بگیر؛ کیبرد نباید داخل شیت باز شود.
    on(form, "focusin", function (e) {
      var t = e.target;
      if (t && t.tagName === "INPUT" && t.classList.contains("ps-input") && NAMES.indexOf(t.name) > -1) { try { t.blur(); } catch (_) {} }
    }, true);

    on(ui.input, "input", onInput);
    on(ui.input, "keydown", function (e) {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); confirm(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); }
    });
    on(ui.clear, "click", function (e) {
      e.preventDefault();
      ui.input.value = ""; onInput();
      try { ui.input.focus({ preventScroll: true }); } catch (_) {}
    });
    on(ui.save, "click", function (e) { e.preventDefault(); confirm(); });
    on(ui.back, "click", function (e) { e.preventDefault(); cancel(); });
    // پشت صفحه فقط همین لایه لمس می‌شود؛ هیچ اسکرول/لمسی به شیت نرسد.
    on(ui.root, "touchmove", function (e) { if (!e.target.closest || !e.target.closest(".fp-body")) e.preventDefault(); }, { passive: false });
  }

  // بستن از بیرون (مثلاً شیت بسته شد). discard=true: مقدارِ نیمه‌تمام برگردد.
  function dismiss(discard) {
    if (!fld) return;
    if (discard) cancel(); else finish();
  }

  function detach() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = 0; }
    if (noteObs) { try { noteObs.disconnect(); } catch (_) {} noteObs = null; }
    if (fld) { bindViewport(false); fld = null; }
    if (cur) { cur.off.forEach(function (f) { try { f(); } catch (_) {} }); cur = null; }
    if (ui) { try { ui.root.remove(); } catch (_) {} ui = null; }
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  window.CARMA_FIELD_PAGE = Object.freeze({
    attach: attach, detach: detach, dismiss: dismiss,
    isOpen: function () { return !!fld; }
  });
})();
