"use strict";

/* ---------------------------------------------------------------
   Swipe-to-save on listing cards has been REMOVED (cards no longer
   have a .swipe-row wrapper and no document-level pointer listeners
   are attached). Saving is still available from the vehicle page.

   The four functions below are kept as no-ops because
   js/13-pages-home-listings-vehicle.js still calls them (pull-to-refresh
   axis lock + first-card hint).
--------------------------------------------------------------- */
  function swipeGestureTryLock() { return true; }
  function swipeGestureRelease() {}
  function swipeGestureLockedByOther() { return false; }
  function swipeShowFirstCardHint() {}
