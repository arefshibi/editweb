/* CM-FIRE-TITLE v7 (سبک): شیشه‌ی ثابت + یک برق کوتاه هر چند ثانیه */
(function () {
  if (window.__cmFire) return; window.__cmFire = true;
  var L = "linear-gradient(180deg,rgba(255,255,255,.95) 0%,rgba(255,255,255,0) 52%),radial-gradient(60% 160% at 20% 100%,rgba(0,113,227,.95),transparent 72%),radial-gradient(55% 150% at 80% 100%,rgba(90,200,250,.95),transparent 72%),radial-gradient(45% 120% at 50% 100%,rgba(48,110,255,.8),transparent 72%),linear-gradient(105deg,transparent 42%,rgba(255,255,255,.95) 50%,transparent 58%),linear-gradient(180deg,rgba(238,246,255,.94),rgba(170,210,255,.8))";
  var LL = "linear-gradient(180deg,rgba(255,255,255,.85) 0%,rgba(255,255,255,0) 50%),radial-gradient(60% 160% at 20% 100%,rgba(0,96,223,.95),transparent 72%),radial-gradient(55% 150% at 80% 100%,rgba(52,170,235,.95),transparent 72%),radial-gradient(45% 120% at 50% 100%,rgba(30,90,235,.85),transparent 72%),linear-gradient(105deg,transparent 42%,rgba(255,255,255,.95) 50%,transparent 58%),linear-gradient(180deg,rgba(130,190,255,.95),rgba(0,113,227,.88))";
  var css = [
    ".cm-fire{position:relative;display:inline-block;white-space:nowrap}",
    ".cm-fire-t{display:inline-block;background-image:" + L + ";background-size:100% 100%,200% 150%,200% 150%,200% 150%,250% 100%,100% 100%;background-repeat:no-repeat,repeat-x,repeat-x,repeat-x,no-repeat,no-repeat;background-position:0 0,0% 0,100% 0,50% 0,0% 0,0 0;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent!important;color:transparent!important}",
    "html.theme-light .cm-fire-t{background-image:" + LL + "}",
    ".cm-fire-t.is-sweep{animation:cmSweep 1.1s ease-in-out 1}",
    "@keyframes cmSweep{from{background-position-x:0,0%,100%,50%,0%,0}to{background-position-x:0,0%,100%,50%,100%,0}}",
    "@media (prefers-reduced-motion:reduce){.cm-fire-t.is-sweep{animation:none}}"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var WORD = "جدیدترین";
  function wrap(h) {
    var n = h.firstChild;
    if (!n || n.nodeType !== 3) return;
    var t = n.nodeValue;
    if (t.trim().indexOf(WORD) !== 0) return;
    h.setAttribute("data-fire", "1"); h.setAttribute("aria-label", t.trim());
    var span = document.createElement("span"); span.className = "cm-fire"; span.setAttribute("aria-hidden", "true");
    var inner = document.createElement("span"); inner.className = "cm-fire-t"; inner.textContent = WORD;
    inner.addEventListener("animationend", function () { inner.classList.remove("is-sweep"); });
    span.appendChild(inner);
    n.nodeValue = t.slice(t.indexOf(WORD) + WORD.length);
    h.insertBefore(span, n);
  }
  function scan() {
    if (!document.querySelector(".cm-lt-head h2:not([data-fire])")) return;
    var hs = document.querySelectorAll(".cm-lt-head h2:not([data-fire])");
    for (var i = 0; i < hs.length; i++) wrap(hs[i]);
  }
  var q = 0;
  function queue() { if (q) return; q = setTimeout(function () { q = 0; scan(); }, 300); }
  scan();
  if ("MutationObserver" in window) new MutationObserver(queue).observe(document.getElementById("pageContent") || document.body, { childList: true, subtree: true });
  setInterval(function () {
    if (document.visibilityState !== "visible") return;
    var els = document.querySelectorAll(".cm-fire-t");
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) { els[i].classList.remove("is-sweep"); void els[i].offsetWidth; els[i].classList.add("is-sweep"); }
    }
  }, 7000);
})();
