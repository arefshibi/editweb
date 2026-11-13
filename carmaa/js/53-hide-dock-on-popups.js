"use strict";
/* Hide the bottom dock whenever ANY popup (sheet / modal / overlay / viewer) is open.
   One global rule instead of per-popup patches: toggles `body.has-popup`, which
   dock-unified.css uses to slide the dock away. To cover a new popup, add its
   "open" selector to OPEN below. */
(function () {
  // A popup counts as open while one of these matches.
  const OPEN = [
    "#genericModal:not([hidden])",          // generic modal (نردبان آگهی, manage ad, share poster, …)
    "#authFlow:not([hidden])",              // login / sign-up sheet
    "#authSuccessBackdrop:not([hidden])",
    "#loginModal:not([hidden])",
    "#searchOverlay:not([hidden])",
    "#filterOverlay:not([hidden])",         // filters sheet
    "#bodyConditionOverlay:not([hidden])",
    "#vehiclePhotoViewer:not([hidden])",
    ".sell-year-picker:not([hidden])",      // sell-flow pickers
    ".sell-brand-picker:not([hidden])",
    ".sell-color-picker:not([hidden])",
    ".sell-trim-picker:not([hidden])",
    ".sell-publishing-sheet:not([hidden])",
    ".brand-sheet.is-open",
    ".callsheet:not(.is-closing)",
    "#mrTrustDialog:not([hidden])",
    "#mrNotifPanel:not([hidden])",
    ".nw-sheet:not([hidden])",
    "#mrInstall.is-in",
    "#mrTour.is-in",
    ".cm-ai",
    ".mr-sv",                               // story viewer / composer
    "#mrAttachSheet.is-open"
  ].join(",");
  const html = document.documentElement;
  let raf = 0;

  function anyOpen() {
    if (html.classList.contains("menu-active") || html.classList.contains("auth-active")) return true;
    return !!document.querySelector(OPEN);
  }
  function sync() {
    raf = 0;
    const open = anyOpen();
    if (document.body) document.body.classList.toggle("has-popup", open);
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(sync); }

  function start() {
    new MutationObserver(schedule).observe(document.body, {
      subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "class"]
    });
    new MutationObserver(schedule).observe(html, { attributes: true, attributeFilter: ["class"] });
    sync();
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
