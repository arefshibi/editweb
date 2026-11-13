/* CM-OTP-COLORS v1: آبی هنگام وارد کردن، قرمز برای کد اشتباه، سبز برای کد درست */
(function () {
  if (window.__cmOtpColors) return; window.__cmOtpColors = true;
  var BLUE = "#0071E3", RED = "#ff453a", GREEN = "#30d158";
  var P = "html:root .auth-flow ";
  var s = document.createElement("style");
  s.textContent =
    P + ".otp-cell input{caret-color:" + BLUE + "}" +
    P + ".otp-cell input:focus{border-color:" + BLUE + ";box-shadow:none;transform:none}" +
    P + ".otp-cell input.has-value{border-color:" + BLUE + ";background:rgba(0,113,227,.10)}" +
    P + ".otp-cell input.is-error{border-color:" + RED + ";background:rgba(255,69,58,.12);color:" + RED + "}" +
    P + ".auth-otp-inputs.is-igniting .otp-cell input," +
    P + ".auth-otp-inputs.is-verified .otp-cell input{border-color:" + GREEN + ";background:rgba(48,209,88,.12)}" +
    P + ".otp-cell-trace rect," +
    P + ".auth-otp-inputs.is-verified .otp-cell-trace rect{stroke:" + GREEN + ";filter:none}" +
    P + ".auth-otp-success-icon{box-shadow:none}";
  document.head.appendChild(s);
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (!t || !t.closest || !t.closest("#authOtpInputs")) return;
    var cells = document.querySelectorAll("#authOtpInputs [data-otp-index]");
    for (var i = 0; i < cells.length; i++) cells[i].classList.remove("is-error");
  });
})();
