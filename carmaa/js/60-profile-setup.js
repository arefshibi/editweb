"use strict";
/* PROFILE-SETUP — تکمیل اجباری اطلاعات حساب بعد از اولین ورود
   تا وقتی نام، نام خانوادگی، نام نمایشی (Nickname)، نام کاربری (انتخابی، نه user-123) و ایمیل
   کامل نشده باشد، کاربر فقط به صفحهٔ «ویرایش اطلاعات» دسترسی دارد (یا می‌تواند خارج شود). */
(function () {
  if (window.CARMA_PROFILE_SETUP) return;

  var RE_USERNAME = /^[a-z][a-z0-9_.]{2,19}$/;
  var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var MSG_GATE = "برای ادامه، ابتدا اطلاعات حساب خود را کامل کنید.";
  var returnTo = null;   // صفحه‌ای که کاربر قصد رفتن به آن را داشت
  var draft = null;      // مقادیر تایپ‌شده؛ بعد از خطای سرور دوباره پر می‌شوند
  var lastToast = 0;

  function apiOn() {
    return !!(window.CARMA_API && window.CARMA_API.enabled && window.CARMA_AUTH_USER && window.CARMA_AUTH_USER.phone);
  }
  function str(v) { return String(v == null ? "" : v).trim(); }

  // فهرست فیلدهای ناقص یک کاربر (خالی = پروفایل کامل است)
  function missing(user) {
    var out = [];
    if (!user) return out;
    var parts = str(user.displayName).split(/\s+/).filter(Boolean);
    if (parts.length < 1) out.push("firstName");
    if (parts.length < 2) out.push("lastName");
    if (str(user.nickname).length < 2) out.push("nickname");
    if (!user.username || user.usernameAuto) out.push("username");
    if (!RE_EMAIL.test(str(user.email))) out.push("email");
    return out;
  }
  function isIncomplete() { return apiOn() && missing(window.CARMA_AUTH_USER).length > 0; }

  function setActiveClass(on) {
    try { document.documentElement.classList.toggle("profile-setup-active", !!on); } catch (_) {}
  }

  // از داخل render() صدا زده می‌شود. اگر پروفایل ناقص باشد مسیر را به صفحهٔ ویرایش اطلاعات برمی‌گرداند.
  function gate() {
    try {
      if (typeof state === "undefined" || !state || !state.account || !isIncomplete()) { setActiveClass(false); return false; }
      var page = state.route && state.route.page;
      if (page === "accountEdit") { setActiveClass(true); return false; }
      returnTo = state.route || null;
      var route = { page: "accountEdit" };
      state = { ...state, route: route, loading: false, loadingStage: null, pendingRoute: null, accountEditError: null };
      try { window.scrollTo(0, 0); } catch (_) {}
      try {
        if (typeof urlForRoute === "function" && typeof serializeRoute === "function") {
          history.replaceState({ ...(history.state || {}), marqueRoute: serializeRoute(route) }, "", urlForRoute(route));
        }
      } catch (_) {}
      setActiveClass(true);
      var now = Date.now();
      if (now - lastToast > 1500 && typeof showToast === "function") { lastToast = now; setTimeout(function () { try { showToast(MSG_GATE); } catch (_) {} }, 50); }
      return true;
    } catch (_) { return false; }
  }

  function afterSaveRoute() {
    var r = returnTo; returnTo = null; draft = null;
    if (!r || !r.page || r.page === "accountEdit") return { page: "account" };
    return r;
  }

  function showError(form, field, msg) {
    var box = form.querySelector('[data-slot="form-error"]');
    if (box) { box.hidden = false; box.textContent = msg; }
    var inp = field ? form.querySelector('input[name="' + field + '"]') : null;
    if (inp) {
      var tgt = inp.closest(".ps-row") || inp;
      tgt.style.boxShadow = "inset 0 0 0 1.5px #ffffff"; inp.style.borderColor = "#ffffff";
      inp.addEventListener("input", function once() { tgt.style.boxShadow = ""; inp.style.borderColor = ""; inp.removeEventListener("input", once); });
      try { inp.focus({ preventScroll: true }); inp.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}
    }
  }

  // قبل از ذخیره صدا زده می‌شود. true یعنی «متوقف کن» (خطا همان‌جا و بدون پاک شدن فرم نمایش داده شد).
  function onSubmit(form) {
    if (!apiOn() || !form) return false;
    var v = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? str(el.value) : ""; };
    var vals = { firstName: v("firstName"), lastName: v("lastName"), nickname: v("nickname"), email: v("email"), username: v("username").toLowerCase().replace(/^@/, "") };
    draft = vals;
    var u = window.CARMA_AUTH_USER || {};
    var uInp = form.querySelector('input[name="username"]');
    if (vals.nickname.length < 2) { showError(form, "nickname", "نام نمایشی (Nickname) را وارد کنید (حداقل ۲ حرف)."); return true; }
    if (!vals.firstName) { showError(form, "firstName", "نام را وارد کنید."); return true; }
    if (!vals.lastName) { showError(form, "lastName", "نام خانوادگی را وارد کنید."); return true; }
    if (!vals.username) { showError(form, "username", "نام کاربری را وارد کنید."); return true; }
    if (!RE_USERNAME.test(vals.username)) { showError(form, "username", "نام کاربری باید ۳ تا ۲۰ حرف انگلیسی کوچک، عدد، _ یا . باشد و با حرف شروع شود."); return true; }
    if ((!u.username || u.usernameAuto) && vals.username === str(u.username)) { showError(form, "username", "نام کاربری خودکار پذیرفته نیست؛ یک نام کاربری دلخواه انتخاب کنید."); return true; }
    if (uInp && uInp.dataset.unameState === "taken") { showError(form, "username", "این نام کاربری قبلاً توسط شخص دیگری گرفته شده است."); return true; }
    if (!vals.email) { showError(form, "email", "ایمیل را وارد کنید."); return true; }
    if (!RE_EMAIL.test(vals.email)) { showError(form, "email", "لطفاً یک ایمیل معتبر وارد کنید."); return true; }
    return false;
  }


  var ICON_CHEV = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
  var ICON_PENCIL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 7.5l3 3"/></svg>';
  var ICON_USER = '<svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.55"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
  var ICON_X = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  // ظاهر جدید صفحه: کارت گروهی با ردیف‌های لمسی، آواتار بزرگ با مداد، دکمهٔ بستن گرد (فقط تم تیره)
  function restyle(root, form, setup) {
    if (form.classList.contains("ps-form")) return;
    form.classList.add("ps-form"); form.setAttribute("dir", "rtl"); form.noValidate = true;
    var head = root.querySelector(".page-header-sticky"); if (head) head.classList.add("ps-head");
    var bc = root.querySelector('[data-slot="breadcrumbs"]'); if (bc) bc.hidden = true;
    var sub = head && head.querySelector("p"); if (sub && !setup) sub.hidden = true;
    if (head && !setup && !head.querySelector(".ps-close")) {
      var x = document.createElement("button"); x.type = "button"; x.className = "ps-close";
      x.setAttribute("data-action", "openAccount"); x.setAttribute("aria-label", "بستن"); x.innerHTML = ICON_X; head.appendChild(x);
    }
    var pv = form.querySelector('[data-slot="avatar-preview"]');
    if (pv && !pv.querySelector("img") && (!pv.textContent.trim() || /^[+\d]/.test(pv.textContent.trim()))) pv.innerHTML = ICON_USER;
    var badge = form.querySelector(".account-edit-avatar-badge"); if (badge) badge.innerHTML = ICON_PENCIL;
    var avWrap = form.querySelector(".account-edit-avatar-wrap");
    var avBlock = avWrap && avWrap.parentElement;
    if (avBlock) { var sec = document.createElement("div"); sec.className = "ps-section"; sec.textContent = "پروفایل"; form.insertBefore(sec, avBlock); }
    var card = document.createElement("div"); card.className = "ps-card";
    ["nickname", "firstName", "lastName", "username", "email", "phone"].forEach(function (n) {
      var inp = form.querySelector('[name="' + n + '"]'); if (!inp) return;
      var row = inp.parentElement; row.className = "ps-row";
      var label = row.querySelector("label"); if (label) label.className = "ps-label";
      inp.className = "ps-input"; inp.removeAttribute("tabindex");
      Array.prototype.forEach.call(row.children, function (c) {
        if (c.tagName === "SPAN" && !c.hasAttribute("data-ps-star")) c.classList.add("ps-hint");
        if (c.getAttribute && c.getAttribute("data-slot") === "uname-note") c.classList.add("ps-hint");
      });
      if (inp.readOnly) row.classList.add("is-ro");
      var ch = document.createElement("span"); ch.className = "ps-chev"; ch.setAttribute("aria-hidden", "true"); ch.innerHTML = ICON_CHEV; row.appendChild(ch);
      row.addEventListener("click", function (e) { if (e.target !== inp && !inp.readOnly) { try { inp.focus(); } catch (_) {} } });
      card.appendChild(row);
    });
    var err = form.querySelector('[data-slot="form-error"]');
    form.insertBefore(card, err || null);
    // نوتِ نام کاربری بعد از decorateField ساخته می‌شود؛ هر تغییر بعدی هم کلاس را می‌گیرد
    var un = form.querySelector('input[name="username"]');
    if (un && un.parentElement) new MutationObserver(function () {
      var n = un.parentElement.querySelector('[data-slot="uname-note"]'); if (n) n.classList.add("ps-hint");
    }).observe(un.parentElement, { childList: true });
  }

  // بعد از ساخت صفحهٔ ویرایش اطلاعات (از renderAccountEditScreen) صدا زده می‌شود.
  function decorateEditPage(root) {
    try {
      if (!root) return;
      var form = root.querySelector('form[data-action="saveAccountInfo"]');
      if (!form) return;
      restyle(root, form, apiOn() && missing(window.CARMA_AUTH_USER).length > 0);
      if (!apiOn()) return;
      var user = window.CARMA_AUTH_USER;
      var setup = missing(user).length > 0;
      form.noValidate = true;
      var em = form.querySelector('input[name="email"]'); if (em) em.placeholder = "name@example.com";

      // ستارهٔ اجباری روی برچسب‌ها
      ["nickname", "firstName", "lastName", "username", "email"].forEach(function (n) {
        var inp = form.querySelector('input[name="' + n + '"]'); if (!inp) return;
        inp.setAttribute("aria-required", "true");
        var label = inp.parentElement && inp.parentElement.querySelector("label");
        if (label && !label.querySelector("[data-ps-star]")) {
          var s = document.createElement("span"); s.setAttribute("data-ps-star", ""); s.setAttribute("aria-hidden", "true");
          s.style.cssText = "color:#ffffff;margin-inline-start:4px"; s.textContent = "*"; label.appendChild(s);
        }
      });

      if (setup) {
        var bc = root.querySelector('[data-slot="breadcrumbs"]'); if (bc) bc.hidden = true;
        var h1 = root.querySelector("h1"); if (h1) h1.textContent = "تکمیل اطلاعات حساب";
        var sub = root.querySelector(".page-header-sticky p"); if (sub) sub.textContent = "برای ادامه، همهٔ موارد ستاره‌دار را تکمیل کنید.";
        var btn = form.querySelector('button[type="submit"]'); if (btn) btn.textContent = "ذخیره و ادامه";
        if (!form.querySelector("[data-ps-banner]")) {
          var b = document.createElement("div"); b.setAttribute("data-ps-banner", ""); b.setAttribute("dir", "rtl");
          b.style.cssText = "background:rgba(139,92,246,.12);border:1px solid rgba(167,139,250,.45);color:#ddd6fe;font-size:12.5px;line-height:1.9;border-radius:14px;padding:10px 14px;text-align:right";
          b.textContent = "خوش آمدید! قبل از استفاده از سایت، نام نمایشی، نام و نام خانوادگی، نام کاربری و ایمیل خود را وارد کنید. عکس پروفایل اختیاری است.";
          form.insertBefore(b, form.firstChild);
        }
        // نام کاربری خودکار (user-123) را خالی کن تا کاربر خودش انتخاب کند
        var un = form.querySelector('input[name="username"]');
        if (un && (!user.username || user.usernameAuto)) {
          un.value = ""; un.dataset.unameOrig = ""; un.dataset.unameState = "";
          var note = un.parentElement && un.parentElement.querySelector('[data-slot="uname-note"]');
          if (note) { note.style.color = "#9ca3af"; note.textContent = "نام کاربری دلخواه خود را انتخاب کنید. اولین انتخاب رایگان است؛ بعد از آن فقط ۲ بار می‌توانید آن را تغییر دهید."; note.dataset.base = note.textContent; note.dataset.baseColor = note.style.color; }
        }
      }

      // بعد از خطای سرور، مقادیر تایپ‌شده را برگردان
      if (draft && state && state.accountEditError) {
        ["nickname", "firstName", "lastName", "email", "username"].forEach(function (n) {
          var el = form.querySelector('input[name="' + n + '"]');
          if (el && !el.readOnly && draft[n] != null && draft[n] !== "") { el.value = draft[n]; if (n === "username") { try { el.dispatchEvent(new Event("input", { bubbles: true })); } catch (_) {} } }
        });
      } else if (!(state && state.accountEditError)) { draft = null; }
    } catch (e) { try { console.warn("profile-setup:", e); } catch (_) {} }
  }

  try {
    if (!document.getElementById("profile-setup-css")) {
      var css = document.createElement("style"); css.id = "profile-setup-css";
      css.textContent = [
        ".profile-setup-active #bottomDock{display:none!important}",
        ':root{--ps-card:#1D1D1F;--ps-line:#262628;--ps-t:#F5F5F7;--ps-s:#8e8e98;--ps-btn:#F5F5F7;--ps-btnt:#1D1D1F;--ps-sh:rgba(0,0,0,.4);--ps-av:#262628;--ps-ring:#333336}',
        /*ES-BG-REMOVED*/
        '.ps-head{position:relative;background:#1D1D1F!important;padding:16px 64px 6px;text-align:center}',
        '.ps-head h1{font-family:inherit!important;font-size:17px!important;font-weight:700!important;text-align:center!important;padding:0!important;margin:0;color:var(--ps-t)}',
        '.ps-head p{text-align:center!important;padding:6px 0 0!important}',
        '.ps-close{position:absolute;right:16px;top:10px;width:42px;height:42px;border-radius:50%;border:1px solid var(--ps-line);background:var(--ps-card);color:var(--ps-t);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px var(--ps-sh)}',
        '.ps-form{gap:16px!important;padding-top:6px;padding-bottom:130px!important}',
        '[data-page="account-edit"]{background:transparent!important;color:var(--ps-t)!important}',
        '.ps-section{font-size:15px;font-weight:700;color:var(--ps-s);padding:2px 4px 0;text-align:right}',
        '.ps-form .account-edit-avatar-wrap,.ps-form .account-edit-avatar{width:132px;height:132px}',
        '.ps-form .account-edit-avatar{font-size:42px;color:var(--ps-t);background:var(--ps-av)!important;border:3px solid var(--ps-ring);box-shadow:0 12px 32px var(--ps-sh)}',
        '.ps-form .account-edit-avatar-badge{width:38px;height:38px;top:2px;right:2px;bottom:auto;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}',
        '.ps-card{background:var(--ps-card);border:1px solid var(--ps-line);border-radius:22px;box-shadow:0 10px 30px var(--ps-sh);overflow:hidden}',
        '.ps-row{position:relative;display:flex;flex-direction:column;gap:3px;padding:12px 18px 12px 46px;cursor:text;transition:background .15s}',
        '.ps-row+.ps-row::before{content:"";position:absolute;top:0;right:18px;left:18px;border-top:1px solid var(--ps-line)}',
        '.ps-row:focus-within{background:rgba(255,255,255,.04)}',
        '.ps-label{display:flex;align-items:center;gap:4px;font-size:11.5px!important;font-weight:500!important;color:var(--ps-s)!important}',
        '.ps-input{width:100%;background:transparent!important;border:0!important;border-radius:0!important;padding:0!important;outline:0!important;box-shadow:none!important;font-size:16px!important;font-weight:700;color:var(--ps-t)!important;text-align:right}',
        '.ps-input::placeholder{color:var(--ps-s)!important;font-weight:500}',
        '.ps-input[readonly]{color:var(--ps-s)!important;cursor:default}',
        '.ps-input[dir="ltr"],.ps-input[type="email"],.ps-input[type="tel"]{text-align:right}',
        '.ps-chev{position:absolute;left:14px;top:22px;color:var(--ps-s);pointer-events:none;display:flex}',
        '.ps-row.is-ro .ps-chev{display:none}',
        '.ps-hint{display:none;margin-top:4px;font-size:11px!important;font-weight:400!important;line-height:1.8;color:var(--ps-s)!important;text-align:right}',
        '.ps-row:focus-within .ps-hint{display:block}',
        '.ps-form button[type="submit"]{width:100%;background:var(--ps-btn)!important;background-image:none!important;color:var(--ps-btnt)!important;border-radius:18px!important;padding:15px!important;font-size:15px!important;font-weight:800!important}',
        '.ps-form button[type="submit"]:disabled{opacity:.6}',
        '.ps-form [data-action="logout"]{color:#ffffff!important}'
      ].join("\n");
      document.head.appendChild(css);
    }
  } catch (_) {}

  window.CARMA_PROFILE_SETUP = Object.freeze({ missing: missing, isIncomplete: isIncomplete, gate: gate, onSubmit: onSubmit, decorateEditPage: decorateEditPage, afterSaveRoute: afterSaveRoute });
})();
