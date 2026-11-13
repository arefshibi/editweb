"use strict";

/* Listings page: the title block (title, subtitle, search + add buttons) scrolls away while the user scrolls
   down and the filter pills stay pinned at the top (native sticky, see home-d.css). Scrolling up slides it back.

   Same for the showrooms page ("dealers") and the news list ("news"), where the pills sit inside the header: only the title row collapses. */
(function () {
  let lastY = window.scrollY || 0;
  let ticking = false;
  let H = 0;                 // height of the title block

  const JITTER = 6;

  function group() { return document.getElementById("stickyHeaderGroup"); }
  function slot() { return document.getElementById("pageHeaderSlot"); }
  function pageName() {
    const root = document.querySelector("#pageContent [data-page]");
    return root ? root.getAttribute("data-page") : "";
  }
  function menuOpen() {
    return !!document.querySelector('#toolbarSlot .toolbox-chip-dropdown, #toolbarSlot .toolbox-filter-panel:not([hidden]), #siteHeader input:focus, #pageHeaderSlot input:focus');
  }
  function measure() {
    const s = slot(), g = group();
    H = 0;
    if (s) {
      // Showrooms: the filter pills live inside the header, so only the title row above them collapses.
      const chips = (pageName() === "dealers" || pageName() === "news") ? s.querySelector(".sr-chips") : null;
      H = Math.round(chips ? chips.getBoundingClientRect().top - s.getBoundingClientRect().top
                           : s.getBoundingClientRect().height);
    }
    if (g) g.style.setProperty("--cm-h", Math.max(0, H) + "px");
  }

  /* ---------- listings ----------
     Hiding on scroll-down is native CSS (sticky top:-H), nothing runs per frame.
     JS only (1) publishes H as --cm-h and (2) toggles .cm-hdr-show when the scroll direction flips. */
  let shown = false;
  function setShown(v) {
    if (v === shown) return;
    shown = v;
    const g = group();
    if (g) g.classList.toggle("cm-hdr-show", v);
  }
  function updateListings() {
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const y = Math.min(Math.max(0, window.scrollY || 0), maxY);   // ignore iOS rubber-band overscroll
    const dy = y - lastY;
    if (y <= H) { setShown(false); lastY = y; return; }
    if (dy < -JITTER) setShown(true);
    else if (dy > JITTER) setShown(false);
    if (Math.abs(dy) > JITTER) lastY = y;
  }
  function resetListings() { setShown(false); }

  function update() {
    ticking = false;
    const page = pageName();
    if (page === "listings" || page === "dealers" || page === "news") { if (!H) measure(); updateListings(); }
    else { resetListings(); lastY = Math.max(0, window.scrollY || 0); }
  }

  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }, { passive: true });
  window.addEventListener("resize", measure);

  // Page changed / re-rendered: start fully open and re-measure the title block.
  function onPageChange() {
    resetListings();
    lastY = window.scrollY || 0;
    window.requestAnimationFrame(measure);
  }
  const content = document.getElementById("pageContent");
  if (content && "MutationObserver" in window) {
    new MutationObserver(onPageChange).observe(content, { childList: true });
  }
  const s0 = slot();
  if (s0 && "ResizeObserver" in window) new ResizeObserver(measure).observe(s0);
  measure();
})();
