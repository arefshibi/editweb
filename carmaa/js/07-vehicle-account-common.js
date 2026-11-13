"use strict";

/* ---------------------------------------------------------------
   VEHICLE DETAIL / ACCOUNT SCREEN (shared bit) — star rating renderer used across the vehicle detail and account screens.
// Edit the star-rating widget here.
--------------------------------------------------------------- */

  /* ---------------------------------------------------------------
     VEHICLE DETAIL SCREEN
  --------------------------------------------------------------- */

  function renderStarRating(rating, size) {
    rating = rating || 4.5;
    size = size || 15;
    const full = Math.floor(rating);
    const hasHalf = rating - full >= 0.5;
    const empty = 5 - full - (hasHalf ? 1 : 0);
    let html = '<span class="flex gap-0.5">';
    for (let i = 0; i < full; i++) html += `${icon("star", {width:size, height:size, fill:"#c3c7cb", stroke:"none"})}`;
    if (hasHalf) html += `${icon("star-half", {width:size, height:size, fill:"#c3c7cb", stroke:"none"})}`;
    for (let i = 0; i < empty; i++) html += `${icon("star", {width:size, height:size, fill:"#333336", stroke:"none"})}`;
    html += "</span>";
    return html;
  }

  /* ---------------------------------------------------------------
     ACCOUNT SCREEN
  --------------------------------------------------------------- */


