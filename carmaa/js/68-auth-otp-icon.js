/* CM-OTP-ICON v1: آیکون قفل بالای پاپ‌آپ کد تایید */
(function () {
  if (window.__cmOtpIcon) return; window.__cmOtpIcon = true;
  var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>" +
    "<rect x='4.5' y='10.5' width='15' height='10.5' rx='3'/>" +
    "<path d='M8 10.5V7.5a4 4 0 0 1 8 0v3'/>" +
    "<circle cx='12' cy='15' r='1.3' fill='black'/>" +
    "<path d='M12 16.3v1.8'/></svg>";
  var u = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  var s = document.createElement("style");
  s.textContent =
    "html:root .auth-flow #authScreenOtp .auth-phone-title::before{-webkit-mask-image:" + u + ";mask-image:" + u + "}";
  document.head.appendChild(s);
})();
