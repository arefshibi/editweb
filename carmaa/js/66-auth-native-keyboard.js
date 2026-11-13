/* CM-AUTH-KB v2: کیبورد گوشی، روان و بدون لگ */
(function () {
  if (window.__cmAuthKb2) return; window.__cmAuthKb2 = true;
  var E = "cubic-bezier(.32,.72,0,1)";
  var P = "html:root .auth-flow #authScreenOtp .auth-phone-title";
  var s = document.createElement("style");
  s.textContent =
    ".auth-flow .auth-keypad{display:none!important}" +
    "html:root .auth-flow{padding-bottom:0!important}" +
    "html:root .auth-flow .auth-app-shell{bottom:calc(8px + env(safe-area-inset-bottom,0px));max-height:min(90vh,660px,var(--cm-maxh,100vh));" +
      "translate:0 calc(var(--cm-kb,0px) * -1);" +
      "transition:transform .44s " + E + ",translate .26s " + E + ";contain:layout paint}" +
    "html:root .auth-flow .auth-bottom-bar{margin-top:22px}" +
    "html:root .auth-flow .auth-otp-inputs{margin-bottom:6px}" +
    P + "{--cm-hero:150px}";
  document.head.appendChild(s);

  function fix() {
    var p = document.getElementById("authPhoneInput");
    if (p && (p.hasAttribute("readonly") || p.getAttribute("inputmode") !== "tel")) {
      p.removeAttribute("readonly"); p.setAttribute("inputmode", "tel"); p.setAttribute("autocomplete", "tel"); p.setAttribute("enterkeyhint", "go");
    }
    var cells = document.querySelectorAll("#authOtpInputs [data-otp-index]");
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (!c.hasAttribute("readonly") && c.getAttribute("inputmode") === "numeric") continue;
      c.removeAttribute("readonly"); c.setAttribute("inputmode", "numeric"); c.setAttribute("pattern", "[0-9]*");
      c.setAttribute("autocomplete", i === 0 ? "one-time-code" : "off");
      c.setAttribute("enterkeyhint", i === 5 ? "done" : "next");
    }
  }

  /* فوکوس فیلدها را تا پایان انیمیشن کارت عقب می‌اندازد */
  var nf = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (o) {
    var el = this;
    try {
      if (el.tagName === "INPUT" && el.closest) {
        var flow = el.closest("#authFlow");
        if (flow && !flow.hidden) {
          var shell = flow.querySelector(".auth-app-shell");
          if (shell && shell.getAnimations) {
            void shell.offsetWidth;
            var an = shell.getAnimations().filter(function (a) { return a.transitionProperty === "transform"; });
            if (an.length) {
              Promise.all(an.map(function (a) { return a.finished.catch(function () {}); })).then(function () {
                if (!flow.hidden && flow.classList.contains("is-open")) nf.call(el, o);
              });
              return;
            }
          }
        }
      }
    } catch (_) {}
    return nf.call(el, o);
  };

  /* بالا بردن کارت با کیبورد: فقط translate، بدون لِی‌اوت، یک بار در هر فریم */
  var raf = 0, lastKb = -1;
  function apply() {
    raf = 0;
    var f = document.getElementById("authFlow"), vv = window.visualViewport;
    if (!f || !vv) return;
    var kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    if (kb < 80) kb = 0;
    if (kb === lastKb) return;
    lastKb = kb;
    if (kb) {
      f.style.setProperty("--cm-kb", kb + "px");
      f.style.setProperty("--cm-maxh", Math.max(260, vv.height - 24) + "px");
    } else {
      f.style.removeProperty("--cm-kb");
      f.style.removeProperty("--cm-maxh");
    }
  }
  function sched() { if (!raf) raf = requestAnimationFrame(apply); }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", sched);
    window.visualViewport.addEventListener("scroll", sched);
  }

  function init() {
    var f = document.getElementById("authFlow"); if (!f) return false;
    fix();
    new MutationObserver(fix).observe(f, { attributes: true, attributeFilter: ["hidden", "class"], subtree: true });
    return true;
  }
  if (!init()) { var n = 0, iv = setInterval(function () { if (init() || ++n > 40) clearInterval(iv); }, 250); }
})();
