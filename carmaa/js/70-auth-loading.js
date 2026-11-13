/* CM-AUTH-LOADING v1: اسپینر روی دکمه ادامه پاپ‌آپ ورود */
(function () {
  if (window.__cmAuthLoad) return; window.__cmAuthLoad = true;
  var s = document.createElement("style");
  s.textContent =
    ".auth-primary-button{position:relative}" +
    ".auth-primary-button.cm-loading{background:var(--auth-accent)!important;color:var(--auth-accent-ink)!important;pointer-events:none}" +
    ".auth-primary-button.cm-loading>*{visibility:hidden}" +
    '.auth-primary-button.cm-loading::after{content:"";position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;border:2.5px solid currentColor;border-top-color:transparent;animation:cmSpin .7s linear infinite}' +
    "@keyframes cmSpin{to{transform:rotate(360deg)}}";
  document.head.appendChild(s);
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (!f || !f.matches || !f.matches("#authPhoneForm,#authOtpForm")) return;
    var b = f.querySelector('[type="submit"]');
    if (!b || b.disabled || b.classList.contains("cm-loading")) return;
    b.classList.add("cm-loading");
    var t0 = Date.now();
    var iv = setInterval(function () {
      var el = Date.now() - t0;
      if ((!b.disabled && el > 450) || el > 20000 || !b.isConnected) {
        clearInterval(iv);
        b.classList.remove("cm-loading");
      }
    }, 100);
  }, true);
})();
