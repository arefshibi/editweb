"use strict";
/* Admin-only visual tools are not part of the visitor's first-load payload. */
(function () {
  function get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function remove(key) { try { localStorage.removeItem(key); } catch (_) {} }
  var qs;
  try { qs = new URLSearchParams(location.search); } catch (_) { qs = null; }
  var layoutMode = qs ? qs.get("layout") : null;
  var colorMode = qs ? qs.get("colors") : null;
  if (layoutMode === "0" || layoutMode === "reset") remove("cm_le_admin");
  if (layoutMode === "reset") { remove("cm_le_draft"); remove("cm_le_pub"); remove("cm_le_ui"); }
  if (colorMode === "0") remove("cmColorTool");
  var wantsLayout = layoutMode === "1" || get("cm_le_admin") === "1";
  var wantsColors = colorMode === "1" || (colorMode !== "0" && get("cmColorTool") === "1");
  function load(src) {
    var s = document.createElement("script");
    s.src = src;
    s.async = false;
    (document.head || document.body).appendChild(s);
  }
  /* Keep the original order when both developer tools are enabled. */
  if (wantsColors) load("color-tool.js?v=cm-hex-20261103234605");
  if (wantsLayout) load("layout-editor.js?v=cm-hex-20261103234605");
})();
