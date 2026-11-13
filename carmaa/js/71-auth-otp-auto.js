/* CM-OTP-AUTO v1: تأیید خودکار کد ۶ رقمی؛ بعد از کد غلط فقط با دکمه ادامه */
(function () {
  if (window.__cmOtpAuto) return; window.__cmOtpAuto = true;
  var manual = false, lastTry = "";
  var s = document.createElement("style");
  s.textContent = ".cm-otp-gone{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transition:opacity .2s ease,visibility 0s .2s!important}";
  document.head.appendChild(s);

  function cells() { return document.querySelectorAll("#authOtpInputs [data-otp-index]"); }
  function full() {
    var c = cells(); if (c.length !== 6) return false;
    for (var i = 0; i < c.length; i++) if (!String(c[i].value || "").length) return false;
    return true;
  }
  function code() {
    var v = "", c = cells();
    for (var i = 0; i < c.length; i++) v += c[i].value || "";
    return v;
  }
  function btn() { return document.getElementById("authOtpContinue"); }
  function bar() { var b = btn(); return b && (b.closest(".auth-bottom-bar") || b); }
  function reset() {
    manual = false; lastTry = "";
    var t = bar(); if (t) t.classList.remove("cm-otp-gone");
  }

  function check() {
    if (manual) return;
    var form = document.getElementById("authOtpForm"), b = btn();
    if (!form || !b || b.classList.contains("cm-loading") || b.disabled) return;
    if (!full()) return;
    var v = code();
    if (v === lastTry) return;
    lastTry = v;
    if (form.requestSubmit) form.requestSubmit();
    else form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }

  document.addEventListener("input", function (e) {
    if (e.target && e.target.closest && e.target.closest("#authOtpInputs")) setTimeout(check, 0);
  });
  document.addEventListener("paste", function (e) {
    if (e.target && e.target.closest && e.target.closest("#authOtpInputs")) setTimeout(check, 30);
  });
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('[data-action="resendOtp"]')) setTimeout(reset, 0);
  }, true);

  function watch() {
    var wrap = document.getElementById("authOtpInputs");
    var screen = document.getElementById("authScreenOtp");
    if (!wrap || !screen) return false;
    new MutationObserver(function () {
      if (wrap.querySelector(".is-error")) manual = true;
      var ok = wrap.classList.contains("is-igniting") || wrap.classList.contains("is-verified");
      var t = bar(); if (t) t.classList.toggle("cm-otp-gone", ok);
    }).observe(wrap, { attributes: true, attributeFilter: ["class"], subtree: true });
    new MutationObserver(reset).observe(screen, { attributes: true, attributeFilter: ["hidden"] });
    return true;
  }
  if (!watch()) { var n = 0, iv = setInterval(function () { if (watch() || ++n > 40) clearInterval(iv); }, 250); }
})();
