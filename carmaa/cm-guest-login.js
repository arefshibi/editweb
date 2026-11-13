/* CM-GUEST-LOGIN v2: دکمه‌ی آبی مستطیلی «ورود» در هدر برای کاربر لاگین‌نشده */
(function () {
  if (window.__cmGuestLogin) return; window.__cmGuestLogin = true;
  var X = ":not(#cmg-a):not(#cmg-b):not(#cmg-c)";
  var st = document.createElement("style");
  st.textContent =
    "html body #siteHeader button.cm-login-btn" + X + "{display:none!important}" +
    "html.cm-guest body #siteHeader button.cm-login-btn" + X + "{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:auto!important;min-width:64px!important;height:36px!important;padding:0 22px!important;margin:0!important;border:0!important;border-radius:10px!important;background:#0071E3!important;background-image:none!important;color:#fff!important;font:inherit!important;font-size:14px!important;font-weight:700!important;line-height:1!important;box-shadow:0 6px 18px -8px rgba(0,113,227,.75)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;white-space:nowrap;cursor:pointer;flex:0 0 auto}" +
    "html.cm-guest body #siteHeader button.cm-login-btn" + X + ":active{background:#0070e0!important;transform:scale(.97)}" +
    'html.cm-guest #siteHeader [data-action="openNotifications"]' + X + ',html.cm-guest #siteHeader [data-action="openMessages"]' + X + ',html.cm-guest #siteHeader .mr-bell-btn' + X +
    "{display:none!important;visibility:hidden!important;width:0!important;min-width:0!important;height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important;pointer-events:none!important}";
  document.head.appendChild(st);
  function make() {
    var b = document.createElement("button");
    b.type = "button"; b.className = "cm-login-btn"; b.setAttribute("aria-label", "ورود"); b.textContent = "ورود";
    b.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      try {
        if (typeof resetOtpVerifiedAnimation === "function") resetOtpVerifiedAnimation();
        state = Object.assign({}, state, { modal: { type: "login", reason: "برای ادامه، وارد حساب خود شوید." }, modalClosing: false, loginStep: "phone", loginPhone: "", loginReturnTo: state.route });
        if (typeof updateOverlays === "function") updateOverlays();
      } catch (_) {
        var a = document.getElementById("headerAccountBtn"); if (a) a.click();
      }
    });
    return b;
  }
  function inject() {
    var home = document.querySelector("#siteHeader .header-home-row > div:first-child");
    if (home && !home.querySelector(".cm-login-btn")) home.insertBefore(make(), home.firstChild);
    var non = document.querySelector("#siteHeader .non-home-header-row");
    if (non && !non.querySelector(".cm-login-btn")) non.appendChild(make());
  }
  function sync() {
    var guest = false;
    try { guest = typeof state !== "undefined" && !state.account; } catch (_) {}
    var root = document.documentElement;
    if (root.classList.contains("cm-guest") !== guest) root.classList.toggle("cm-guest", guest);
    inject();
  }
  sync();
  var h = document.getElementById("siteHeader");
  if (h && "MutationObserver" in window) (function () { var gt = 0; new MutationObserver(function () { if (gt) return; gt = setTimeout(function () { gt = 0; sync(); }, 250); }).observe(h, { childList: true, subtree: true }); })();
  setInterval(sync, 3000);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("popstate", sync);
})();
