/* CM-LOGIN-GATE v4: Bottom Sheet شناور + هم‌سبک‌سازی فرم شماره و OTP */
(function () {
  if (window.__cmLoginGate) return; window.__cmLoginGate = true;
  var passed = false, gated = false, built = false, ov, msgEl, goBtn, hideTimer, last = { at: 0, ex: false };
  var EX = '.cm-login-btn,#headerAccountBtn,[data-action="openAccount"]';
  var TXT = /^\s*(ورود|ثبت.?نام|ورود\s*[\/و]\s*ثبت.?نام|ورود به حساب( کاربری)?)\s*$/;
  var DEF = "برای استفاده از این بخش، باید وارد حساب کاربری خود شوید.";
  var DUR = 360;
  function flow() { return document.getElementById("authFlow"); }
  function ico(svg) { return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")'; }
  function authCss() {
    if (document.getElementById("cmAuthSkin")) return;
    var SV = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>";
    var phone = ico(SV + "<rect x='6' y='2' width='12' height='20' rx='3'/><path d='M11 18h2'/></svg>");
    var msg = ico(SV + "<path d='M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z'/><path d='M8.5 12h.01M12 12h.01M15.5 12h.01'/></svg>");
    var R = "html:root .auth-flow.auth-flow";
    var L = "html.theme-light:root .auth-flow.auth-flow";
    var s = document.createElement("style"); s.id = "cmAuthSkin";
    s.textContent =
      R + "{--auth-bg:#262628;--auth-shell-bg:#262628;--auth-sheet-bg:#262628;--auth-text:#F5F5F7;--auth-sheet-text:#F5F5F7;--auth-text-dim:rgba(245,245,247,.55);--auth-sheet-text-dim:rgba(245,245,247,.55);--auth-text-faint:rgba(245,245,247,.4);--auth-placeholder:rgba(245,245,247,.35);--auth-input-bg:#333336;--auth-input-border:#333336;--auth-input-border-filled:#636366;--auth-chip-bg:#333336;--auth-field-bg:#333336;--auth-keypad-bg:#333336;--auth-keypad-bg-active:#333336;--auth-btn-disabled-bg:#333336;--auth-btn-disabled-text:#636366;--auth-accent:#fff;--auth-accent-ink:#000;--auth-link:#F5F5F7;--auth-picker-bg:#333336;--auth-picker-hover:#333336;--auth-picker-border:rgba(255,255,255,.08);--auth-backdrop-tint:rgba(0,0,0,.35);--auth-handle:rgba(128,128,128,.4)}" +
      L + "{--auth-bg:#f7f7f8;--auth-shell-bg:#f7f7f8;--auth-sheet-bg:#f7f7f8;--auth-text:#262628;--auth-sheet-text:#262628;--auth-text-dim:rgba(38,38,40,.55);--auth-sheet-text-dim:rgba(38,38,40,.55);--auth-text-faint:rgba(38,38,40,.4);--auth-placeholder:rgba(38,38,40,.35);--auth-input-bg:#ececee;--auth-input-border:#dcdcdf;--auth-input-border-filled:#b0b0b5;--auth-chip-bg:#ececee;--auth-field-bg:#ececee;--auth-keypad-bg:#ececee;--auth-keypad-bg-active:#dedee1;--auth-btn-disabled-bg:#e6e6e9;--auth-btn-disabled-text:#a5a5aa;--auth-accent:#000;--auth-accent-ink:#fff;--auth-link:#262628;--auth-picker-bg:#fff;--auth-picker-hover:#ececee;--auth-picker-border:rgba(0,0,0,.08);--auth-backdrop-tint:rgba(0,0,0,.35);--auth-handle:rgba(128,128,128,.4)}" +
      "html:root .auth-flow .auth-app-shell{left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));width:auto;max-width:460px;margin:0 auto;padding-bottom:0;border-radius:32px;box-shadow:none;transform:translateY(calc(100% + 40px));transition:transform " + DUR + "ms cubic-bezier(.32,.72,0,1)}" +
      "html:root .auth-flow.is-open .auth-app-shell{transform:none}" +
      "html:root .auth-flow.is-closing .auth-app-shell{transform:translateY(calc(100% + 40px));transition-duration:.3s}" +
      "html:root .auth-flow .auth-sheet-handle{padding-top:12px}" +
      "html:root .auth-flow .auth-sheet-handle span{width:36px;height:4px}" +
      "html:root .auth-flow .auth-phone-title{font-size:18px;font-weight:700;letter-spacing:0}" +
      "html:root .auth-flow .auth-phone-title::before{content:'';display:block;width:52px;height:52px;margin:4px auto 18px;background:currentColor;opacity:.85;-webkit-mask:center/contain no-repeat;mask:center/contain no-repeat}" +
      "html:root .auth-flow #authScreenPhone .auth-phone-title::before{-webkit-mask-image:" + phone + ";mask-image:" + phone + "}" +
      "html:root .auth-flow #authScreenOtp .auth-phone-title::before{-webkit-mask-image:" + msg + ";mask-image:" + msg + "}" +
      "html:root .auth-flow .auth-otp-subtitle{font-size:14px;line-height:1.8}" +
      "html:root .auth-flow .auth-primary-button{height:56px;border-radius:28px;font-size:15px;font-weight:600}" +
      "html:root .auth-flow .auth-primary-button:not(:disabled){box-shadow:none}" +
      "html:root .auth-flow .auth-phone-input-wrap{border-radius:20px}" +
      "html:root .auth-flow .auth-keypad-btn{border-radius:18px}";
    document.head.appendChild(s);
  }
  function css() {
    var s = document.createElement("style");
    s.textContent =
      "html.cm-login-gate #authFlow{display:none!important}" +
      "#cmLgOv{position:fixed;inset:0;z-index:3000;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.35);direction:rtl;font-family:inherit;opacity:0;transition:opacity .3s ease}" +
      "#cmLgOv.on{display:flex}#cmLgOv.vis{opacity:1}" +
      "#cmLgCard{width:calc(100% - 16px);max-width:460px;margin:0 8px calc(8px + env(safe-area-inset-bottom,0px));border-radius:32px;padding:12px 20px 20px;text-align:center;transform:translateY(calc(100% + 40px));transition:transform " + DUR + "ms cubic-bezier(.32,.72,0,1);will-change:transform}" +
      "#cmLgOv.vis #cmLgCard{transform:none}" +
      "#cmLgOv.d #cmLgCard{background:#262628;color:#F5F5F7}#cmLgOv.l #cmLgCard{background:#f7f7f8;color:#262628}" +
      "#cmLgBar{width:36px;height:4px;border-radius:2px;margin:0 auto 34px;background:rgba(128,128,128,.4)}" +
      "#cmLgIc{width:64px;height:64px;margin:0 auto 22px;display:flex;align-items:center;justify-content:center;opacity:.85}" +
      "#cmLgT{font-size:18px;font-weight:700;margin:0 0 10px}" +
      "#cmLgM{font-size:14px;line-height:1.9;opacity:.55;margin:0 8px 30px}" +
      "#cmLgGo{width:100%;height:56px;border:0;border-radius:28px;font:inherit;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:none;transition:transform .15s,opacity .15s}" +
      "#cmLgOv.d #cmLgGo{background:#fff;color:#000}#cmLgOv.l #cmLgGo{background:#000;color:#fff}" +
      "#cmLgGo:active{transform:scale(.98);opacity:.85}";
    document.head.appendChild(s);
  }
  function el(tag, id, txt) { var e = document.createElement(tag); if (id) e.id = id; if (txt) e.textContent = txt; return e; }
  function build() {
    if (built) return; built = true; css();
    ov = el("div", "cmLgOv"); var card = el("div", "cmLgCard");
    var ic = el("div", "cmLgIc"); ic.innerHTML = '<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>';
    msgEl = el("p", "cmLgM", DEF);
    goBtn = el("button", "cmLgGo"); goBtn.type = "button";
    goBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg><span>ورود با شماره تماس</span>';
    card.appendChild(el("div", "cmLgBar")); card.appendChild(ic);
    card.appendChild(el("h3", "cmLgT", "نیاز به ورود به حساب"));
    card.appendChild(msgEl); card.appendChild(goBtn); ov.appendChild(card);
    document.body.appendChild(ov);
    goBtn.addEventListener("click", proceed);
    ov.addEventListener("click", function (e) { if (e.target === ov) dismiss(); });
    document.addEventListener("keydown", function (e) { if (gated && e.key === "Escape") dismiss(); });
  }
  function dark() {
    try {
      return !document.documentElement.classList.contains("theme-light");
    } catch (_) {}
    return true;
  }
  function show(reason) {
    build(); clearTimeout(hideTimer);
    msgEl.textContent = reason || DEF;
    ov.className = "on " + (dark() ? "d" : "l");
    void ov.offsetWidth;
    ov.classList.add("vis");
    document.documentElement.classList.add("cm-login-gate"); gated = true;
  }
  function hide() {
    gated = false;
    document.documentElement.classList.remove("cm-login-gate");
    if (!ov) return;
    ov.classList.remove("vis");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { if (ov && !gated) ov.classList.remove("on"); }, DUR + 30);
  }
  function proceed() {
    passed = true; hide();
    var f = flow(); if (!f) return;
    f.classList.remove("is-open");
    setTimeout(function () {
      f.classList.add("is-open");
      var i = document.getElementById("authPhoneInput"); if (i) { try { i.focus({ preventScroll: true }); } catch (_) {} }
    }, 140);
  }
  function dismiss() {
    hide(); passed = false;
    try {
      state = Object.assign({}, state, { modal: null, modalClosing: false, loginReturnTo: null, loginStep: "phone", loginPhone: "" });
      if (typeof updateOverlays === "function") updateOverlays();
    } catch (_) {}
  }
  function needLogin() {
    try { return !!(state.modal && state.modal.type === "login") && !state.account && !state.authSuccess && state.loginStep !== "code"; }
    catch (_) { return false; }
  }
  function check() {
    var f = flow(); if (!f) return;
    var open = !f.hidden && !f.classList.contains("is-closing");
    if (!open) { passed = false; if (gated) hide(); return; }
    if (passed || gated || !needLogin()) return;
    if (last.ex && Date.now() - last.at < 1500) { passed = true; return; }
    var r = null; try { r = state.modal.reason; } catch (_) {}
    show(r);
  }
  document.addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.closest || t.closest("#cmLgOv")) return;
    var ex = !!t.closest(EX);
    if (!ex) { var b = t.closest('button,a,[role="button"]'); if (b && TXT.test((b.textContent || "").trim())) ex = true; }
    last = { at: Date.now(), ex: ex };
  }, true);
  function init() {
    var f = flow(); if (!f) return false;
    new MutationObserver(check).observe(f, { attributes: true, attributeFilter: ["hidden", "class"] });
    check(); return true;
  }
  authCss();
  if (!init()) { var n = 0, iv = setInterval(function () { if (init() || ++n > 40) clearInterval(iv); }, 250); }
})();
