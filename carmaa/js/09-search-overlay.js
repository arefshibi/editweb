"use strict";

/* ---------------------------------------------------------------
   SEARCH OVERLAY — the rotating placeholder word/rail cycling shown before the user types in the full-screen search overlay.
// Edit the search overlay's idle animation here.
--------------------------------------------------------------- */

  /* ---------------------------------------------------------------
     SEARCH OVERLAY
     Full-screen search mechanism triggered by tapping the header search
     box: rotating "search by" placeholder (brand/model/year/city), a
     realistic loading skeleton while the query is "processed", and a
     horizontally auto-scrolling rail of matching vehicles sorted by
     views — mirrors the supplied auto-search-demo mechanism, wired to
     the site's real LISTINGS data instead of demo data.
  --------------------------------------------------------------- */
  const SEARCH_OVERLAY_TERMS = ["برند", "مدل", "سال", "شهر"];

  function stopSearchOverlayRotator() {
    if (searchOverlayRotatorTimer) { clearInterval(searchOverlayRotatorTimer); searchOverlayRotatorTimer = null; }
  }

  function advanceSearchOverlayWord() {
    const rotator = document.getElementById("searchOverlayRotator");
    if (!rotator) return;
    const words = [...rotator.children];
    if (!words.length) return;
    const current = words[searchOverlayRotatorIndex];
    searchOverlayRotatorIndex = (searchOverlayRotatorIndex + 1) % words.length;
    const next = words[searchOverlayRotatorIndex];
    current.classList.remove("active");
    current.classList.add("exit");
    next.classList.remove("exit");
    next.classList.add("active");
    setTimeout(() => current.classList.remove("exit"), 480);
  }

  function getCurrentRailIndex(rail, cards) {
    // The user may have manually swiped several cards ahead (or back)
    // since the last auto-advance, so searchOverlayRailIndex on its own
    // can be stale. Instead, find whichever card is actually sitting at
    // the rail's aligned edge right now and treat that as "current" —
    // this is what lets auto-scroll resume from wherever the user left
    // off instead of snapping back to the old stored index.
    const railRect = rail.getBoundingClientRect();
    const padRight = parseFloat(getComputedStyle(rail).paddingRight) || 0;
    const edge = railRect.right - padRight;
    let closestIndex = 0;
    let closestDist = Infinity;
    cards.forEach((card, i) => {
      const dist = Math.abs(card.getBoundingClientRect().right - edge);
      if (dist < closestDist) { closestDist = dist; closestIndex = i; }
    });
    return closestIndex;
  }

  function advanceSearchOverlayRail() {
    if (Date.now() < searchOverlayPauseUntil) return;
    const rail = document.getElementById("searchOverlayRail");
    if (!rail) return;
    const cards = [...rail.querySelectorAll(".card-fade-in")];
    if (cards.length < 2) return;
    searchOverlayRailIndex = (getCurrentRailIndex(rail, cards) + 1) % cards.length;
    scrollCardIntoRail(rail, cards[searchOverlayRailIndex], true);
  }

  // SYNC: the rotating "search by" word and the auto-scrolling rail of
  // cards used to run on two independent timers (a 3s setInterval for the
  // word vs. a self-rescheduling setTimeout chain for the rail, kicked off
  // with a different initial delay) so they drifted out of phase and never
  // visibly moved together. They now share a single interval so every word
  // change and every card advance happen on the same tick.
  function startSearchOverlayCycle() {
    stopSearchOverlayRotator();
    searchOverlayRotatorTimer = setInterval(() => {
      // PERF: nothing to animate while the user is typing or the tab is hidden
      if (document.hidden || state.searchOverlayQuery.trim().length > 0) return;
      advanceSearchOverlayWord();
      advanceSearchOverlayRail();
    }, 3000);
  }

  function startSearchOverlayRotator() {
    const rotator = document.getElementById("searchOverlayRotator");
    if (!rotator) return;
    rotator.innerHTML = "";
    SEARCH_OVERLAY_TERMS.forEach((term, index) => {
      const node = document.createElement("span");
      node.className = `word${index === 0 ? " active" : ""}`;
      node.textContent = term;
      rotator.appendChild(node);
    });
    searchOverlayRotatorIndex = 0;
    searchOverlayRailIndex = 0;
    startSearchOverlayCycle();
  }

