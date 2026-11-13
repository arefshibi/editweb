"use strict";
/* Carma PWA: when the installed app opens in standalone (status bar visible), go fullscreen on the first touch. */
(function () {
  var standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  var de = document.documentElement;
  if (!standalone || !de.requestFullscreen) return;
  function isFs() { return !!document.fullscreenElement; }
  function go() {
    if (isFs()) return;
    try {
      var p = de.requestFullscreen({ navigationUI: "hide" });
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  function arm() { document.addEventListener("pointerup", go, { once: true, passive: true, capture: true }); }
  arm();
  document.addEventListener("fullscreenchange", function () { if (!isFs()) arm(); });
})();
