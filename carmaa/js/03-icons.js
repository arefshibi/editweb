"use strict";

/* ---------------------------------------------------------------
   ICONS — the self-contained inline SVG icon set and the icon() lookup helper.
// Add/edit an SVG icon here.
--------------------------------------------------------------- */

  /* ---------------------------------------------------------------
     ICONS (self-contained, no external icon library needed)
  --------------------------------------------------------------- */

  const ICONS = {
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.9a3.2 3.2 0 0 1 0 6.2"/><path d="M17 14a6 6 0 0 1 4.5 5.8"/>',
    home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"/><path d="M10 20v-5h4v5"/>',
    heart: '<path d="M12 21s-7-4.5-9.5-9C1 8.5 2.5 5 6 5c2 0 3.5 1.2 4.5 2.6C11.5 6.2 13 5 15 5c3.5 0 5 3.5 3.5 7-2.5 4.5-9.5 9-9.5 9z"/>',
    bookmark: '<path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4-6.5 4V4.5a1 1 0 0 1 1-1z"/>',
    "chevron-down": '<polyline points="6 9 12 15 18 9"/>',
    "chevron-up": '<polyline points="18 15 12 9 6 15"/>',
    "chevron-left": '<polyline points="15 18 9 12 15 6"/>',
    "chevron-right": '<polyline points="9 18 15 12 9 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none"/>',
    "arrow-up-left": '<path d="M17 17 7 7"/><path d="M7 17V7h10"/>',
    "share-2": '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><line x1="8.2" y1="10.7" x2="15.8" y2="6.3"/><line x1="8.2" y1="13.3" x2="15.8" y2="17.7"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    star: '<polygon points="12 2 15 9 22 9.5 16.5 14 18 21 12 17.5 6 21 7.5 14 2 9.5 9 9"/>',
    "star-half": '<path d="M12 2 L15 9 L22 9.5 L16.5 14 L18 21 L12 17.5 Z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>',
    tag: '<path d="M20 12.5 12.5 20a1.5 1.5 0 0 1-2.1 0L3 12.6V4a1 1 0 0 1 1-1h8.6a1.5 1.5 0 0 1 1.06.44l6.34 6.34a1.5 1.5 0 0 1 0 2.12z"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none"/>',
    hash: '<line x1="5" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="19" y2="15"/><line x1="10" y1="3" x2="7" y2="21"/><line x1="17" y1="3" x2="14" y2="21"/>',
    box: '<path d="M3 8l9-5 9 5-9 5-9-5z"/><path d="M3 8v9l9 5 9-5V8"/><line x1="12" y1="13" x2="12" y2="22"/>',
    cog: '<circle cx="12" cy="12" r="3.2"/><path d="M19 12a7 7 0 0 0-.14-1.4l2-1.5-2-3.4-2.3.8a7 7 0 0 0-2.4-1.4L14 3h-4l-.16 2.1a7 7 0 0 0-2.4 1.4l-2.3-.8-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .5.05.9.14 1.4l-2 1.5 2 3.4 2.3-.8a7 7 0 0 0 2.4 1.4L10 21h4l.14-2.1a7 7 0 0 0 2.4-1.4l2.3.8 2-3.4-2-1.5c.09-.5.14-.9.14-1.4z"/>',
    armchair: '<path d="M5 11V7a3 3 0 0 1 6 0v1h2V7a3 3 0 0 1 6 0v4"/><path d="M4 11h16v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><line x1="6" y1="18" x2="6" y2="21"/><line x1="18" y1="18" x2="18" y2="21"/>',
    paintbrush: '<path d="M14 4c3 0 6 3 6 6-3 1-4 3-4 5a3 3 0 0 1-6 0c0-2 1-3 1-5l3-6z"/><path d="M7 15c-2 1-3 3-3 5 2 0 4-1 5-3"/>',
    gauge: '<path d="M12 3a9 9 0 1 0 9 9"/><line x1="12" y1="12" x2="16" y2="8"/><line x1="12" y1="3" x2="12" y2="5"/>',
    "circle-dot": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>',
    car: '<path d="M4 16V11l2-5h12l2 5v5"/><rect x="2" y="16" width="20" height="3" rx="1"/><circle cx="7" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/>',
    radio: '<circle cx="12" cy="12" r="2.4"/><path d="M8 12a4 4 0 0 1 8 0"/><path d="M5.5 15.5A8 8 0 0 1 18.5 15.5"/><path d="M3 19a11 11 0 0 1 18 0"/>',
    x: '<line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/>',
    "arrow-right": '<line x1="4" y1="12" x2="20" y2="12"/><polyline points="13 5 20 12 13 19"/>',
    "shopping-bag": '<path d="M6 8h12l1 12H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    gavel: '<line x1="4" y1="20" x2="12" y2="20"/><rect x="9.5" y="2.5" width="4" height="9" rx="1" transform="rotate(45 11.5 7)"/><line x1="12.5" y1="10" x2="6" y2="16.5"/><line x1="15" y1="12.5" x2="8.5" y2="19"/>',
    "bar-chart": '<line x1="6" y1="20" x2="6" y2="11"/><line x1="12" y1="20" x2="12" y2="5"/><line x1="18" y1="20" x2="18" y2="14"/>',
    "zap": '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    "refresh-cw": '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
    "trending-up": '<polyline points="3 17 9 11 13 15 21 6"/><polyline points="15 6 21 6 21 12"/>',
    "clipboard-check": '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z"/><polyline points="9 13 11 15 15 11"/>',
    "calendar-days": '<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/>',
    "file-text": '<path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    "map-pin": '<path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    "life-buoy": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><line x1="5.3" y1="5.3" x2="9.4" y2="9.4"/><line x1="18.7" y1="5.3" x2="14.6" y2="9.4"/><line x1="5.3" y1="18.7" x2="9.4" y2="14.6"/><line x1="18.7" y1="18.7" x2="14.6" y2="14.6"/>',
    eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
    "mouse-pointer": '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.11 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    "message-circle": '<path d="M21 11.5a8.38 8.38 0 0 1-4.8 7.6 8.5 8.5 0 0 1-8.9-.9L3 21l1.9-4.3a8.38 8.38 0 0 1-.9-3.7 8.5 8.5 0 0 1 7.6-8.4 8.38 8.38 0 0 1 9.4 6.6c.13.56.2 1.14.2 1.7z"/>',
    "help-circle": '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.8"/><path d="M12 17h.01"/>',
    "gear-stick": '<circle cx="12" cy="4" r="1.6" fill="currentColor" stroke="none"/><path d="M12 5.6V14"/><path d="M6.5 20.5a6 6 0 0 1 11 0"/><line x1="4.5" y1="20.5" x2="19.5" y2="20.5"/>',
    "body-sedan": '<path d="M3.5 15.5V11l2.2-4.5h12.6l2.2 4.5v4.5"/><path d="M6.5 11h11"/><rect x="1.8" y="15.5" width="20.4" height="3" rx="1"/><circle cx="7" cy="19.3" r="1.6"/><circle cx="17" cy="19.3" r="1.6"/>',
    "body-suv": '<path d="M3 14.5V8.7l1.6-3.2h2.6V4h9.6v1.5h2.6L21 8.7v5.8"/><path d="M5.6 8.7h12.8"/><rect x="1.6" y="14.5" width="20.8" height="3.4" rx="1"/><circle cx="6.8" cy="19.8" r="1.7"/><circle cx="17.2" cy="19.8" r="1.7"/>',
    "body-coupe": '<path d="M3.5 15.5V12l3-4.3h2.8l2.7-2.7 4 2.7h1.7l2.3 4.3v3.5"/><path d="M7 12h10"/><rect x="1.8" y="15.5" width="20.4" height="3" rx="1"/><circle cx="7" cy="19.3" r="1.6"/><circle cx="17" cy="19.3" r="1.6"/>',
    "body-convertible": '<path d="M3.5 15.5V12.3l2.2-4h12.6l2.2 4v3.2"/><rect x="1.8" y="15.5" width="20.4" height="3" rx="1"/><circle cx="7" cy="19.3" r="1.6"/><circle cx="17" cy="19.3" r="1.6"/><line x1="12" y1="3.2" x2="12" y2="1.2"/><line x1="8.3" y1="4" x2="7.3" y2="2.2"/><line x1="15.7" y1="4" x2="16.7" y2="2.2"/>',
    "body-pickup": '<path d="M2.5 15.5V11l1.8-3.5h6.7v8"/><path d="M11 11.2h4.6l3.9 2.6v1.7"/><rect x="1" y="15.5" width="21" height="3" rx="1"/><circle cx="6.5" cy="19.3" r="1.6"/><circle cx="17" cy="19.3" r="1.6"/>',
    banknote: '<rect x="2" y="6" width="20" height="12" rx="2.2"/><circle cx="12" cy="12" r="3"/><line x1="5.5" y1="9.2" x2="5.5" y2="9.2"/><line x1="18.5" y1="14.8" x2="18.5" y2="14.8"/>',
    "alert-triangle": '<path d="M12 3.2 2.4 20h19.2L12 3.2z"/><line x1="12" y1="9.5" x2="12" y2="14.2"/><circle cx="12" cy="17" r="0.65" fill="currentColor" stroke="none"/>',
    "ship": '<path d="M4 15.5 2.5 11h19L20 15.5"/><path d="M5 15.5 6 21h12l1-5.5"/><path d="M12 11V4h3l2 3"/><line x1="8" y1="11" x2="8" y2="7"/>',
    "badge-check": '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" fill="#3897f0" stroke="none"/><path d="m9 12 2 2 4-4" stroke="#ffffff" stroke-width="2.4" fill="none"/>',
    camera: '<path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.6"/>',
    share: '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
  };

  function icon(name, attrs) {
    attrs = attrs || {};
    const width = attrs.width || 20;
    const height = attrs.height || 20;
    const strokeWidth = attrs.strokeWidth != null ? attrs.strokeWidth : 2;
    const fill = attrs.fill || "none";
    const stroke = attrs.stroke || "currentColor";
    const cls = attrs.class || "";
    const body = ICONS[name] || "";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle">${body}</svg>`;
  }

