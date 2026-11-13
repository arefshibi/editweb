"use strict";
/* No text selection / copy / long-press callout anywhere, except inside real form fields. */
(function () {
  var st = document.createElement("style");
  st.textContent =
    "html,body,body *{-webkit-user-select:none !important;user-select:none !important;-webkit-touch-callout:none !important}" +
    "input,textarea,[contenteditable=''],[contenteditable='true'],input *,textarea *{-webkit-user-select:text !important;user-select:text !important}" +
    "img,svg,a{-webkit-user-drag:none;-webkit-touch-callout:none !important}";
  document.head.appendChild(st);
  function editable(t) {
    return !!(t && t.closest && t.closest("input,textarea,[contenteditable='true'],[contenteditable='']"));
  }
  document.addEventListener("selectstart", function (e) { if (!editable(e.target)) e.preventDefault(); }, true);
  document.addEventListener("contextmenu", function (e) { if (!editable(e.target)) e.preventDefault(); }, true);
  document.addEventListener("copy", function (e) { if (!editable(e.target)) e.preventDefault(); }, true);
  document.addEventListener("cut", function (e) { if (!editable(e.target)) e.preventDefault(); }, true);
  document.addEventListener("dragstart", function (e) { if (!editable(e.target)) e.preventDefault(); }, true);
})();
