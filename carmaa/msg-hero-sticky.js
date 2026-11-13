(function () {
  var RED = "#17171C", saved = null, on = false, raf = 0;
  function sync() {
    raf = 0; RED = document.documentElement.classList.contains("theme-light") ? "#ffffff" : "#17171C"; /*MSGC*/
    var m = document.querySelector('meta[name="theme-color"]'); if (!m) return;
    var want = !!document.querySelector(".mr-msg-screen .mr-msg-hero");
    if (want && !on) { saved = m.getAttribute("content"); m.setAttribute("content", RED); on = true; }
    else if (!want && on) { m.setAttribute("content", saved || "#1D1D1F"); on = false; saved = null; }
    else if (want && on && m.getAttribute("content") !== RED) { saved = m.getAttribute("content"); m.setAttribute("content", RED); }
  }
  function sched() { if (!raf) raf = requestAnimationFrame(sync); }
  function start() { new MutationObserver(sched).observe(document.body, { childList: true, subtree: true }); window.addEventListener("popstate", sched); sync(); }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
