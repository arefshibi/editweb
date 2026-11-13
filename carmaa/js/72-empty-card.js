/* CM-EMPTY-CARD v1: ارتفاع باکس «هنوز آگهی‌ای نیست» = ارتفاع یک کارت آگهی */
(function () {
  if (window.__cmEmptyCard) return; window.__cmEmptyCard = true;
  var s = document.createElement("style");
  s.textContent =
    '[data-page="account"] .mx-4.border-dashed{' +
      "display:flex;align-items:center;justify-content:center;box-sizing:border-box;" +
      "min-height:calc((min(100vw,520px) - 68px) * 2 / 3 + 120px);" +
      "padding:24px 28px;line-height:1.9}";
  document.head.appendChild(s);
})();
