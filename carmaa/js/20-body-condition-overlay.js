"use strict";

/* ---------------------------------------------------------------
   "وضعیت جامع بدنه" (Comprehensive Body Status) — full-screen rating
   popup used inside the sell-flow's body/paint condition step.
   Same visual language as the reference RPE-style design: a big
   animated number, a rainbow gradient slider, a colored label +
   description that fade with the number, and a Save button whose
   color tracks the selected point on the scale.
--------------------------------------------------------------- */

  const BCOND_LEVELS = [
    { value: 1, color: "#14b8a6", label: "عالی", desc: "بدنه کاملاً سالم است؛ بدون خط و خش یا تعویض رنگ." },
    { value: 2, color: "#22c55e", label: "خیلی خوب", desc: "در حد قابل چشم‌پوشی، تقریباً بدون هیچ نقصی." },
    { value: 3, color: "#84cc16", label: "خوب", desc: "چند خط و خش بسیار جزئی روی بدنه دیده می‌شود." },
    { value: 4, color: "#eab308", label: "قابل قبول", desc: "خط و خش‌های معمول، متناسب با سن و کارکرد خودرو." },
    { value: 5, color: "#f59e0b", label: "متوسط", desc: "چند خط و خش قابل توجه یا رنگ‌شدگی جزئی روی بدنه دیده می‌شود." },
    { value: 6, color: "#f97316", label: "متوسط رو به ضعیف", desc: "چند پنل رنگ‌شده یا تعویض‌شده در بدنه وجود دارد." },
    { value: 7, color: "#9b1b30", label: "ضعیف", desc: "آسیب یا رنگ‌شدگی محسوس در چند قسمت بدنه." },
    { value: 8, color: "#9b1b30", label: "بد", desc: "چند پنل بزرگ بدنه تعویض یا رنگ شده‌اند." },
    { value: 9, color: "#c026d3", label: "خیلی بد", desc: "آثار تصادف یا آسیب ساختاری در بدنه مشهود است." },
    { value: 10, color: "#9333ea", label: "بحرانی", desc: "آسیب‌دیدگی شدید یا سابقه تصادف سنگین." },
  ];

  function bcondLevel(value) {
    const v = Math.max(1, Math.min(10, Math.round(value)));
    return BCOND_LEVELS[v - 1];
  }

  function bcondHexToRgba(hex, alpha) {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  let bcondPendingValue = 5;
  let bcondLastRenderedValue = null;
  let bcondDragging = false;

  // Fixed "usual range" band, expressed as a value span on the 1-10 scale.
  // Anything above this band is flagged as above the typical listing.
  const BCOND_USUAL_MIN = 3;
  const BCOND_USUAL_MAX = 4;

  function bcondEls() {
    return {
      overlay: document.getElementById("bodyConditionOverlay"),
      sheet: document.querySelector("#bodyConditionOverlay .bcond-sheet"),
      numeral: document.getElementById("bcondNumeral"),
      label: document.getElementById("bcondLabel"),
      desc: document.getElementById("bcondDesc"),
      track: document.getElementById("bcondTrack"),
      thumb: document.getElementById("bcondThumb"),
      usualBand: document.getElementById("bcondUsualBand"),
      saveBtn: document.getElementById("bcondSaveBtn"),
      saveSub: document.getElementById("bcondSaveSub"),
      rangeBadge: document.getElementById("bcondRangeBadge"),
    };
  }

  function bcondPositionUsualRange() {
    const { usualBand, rangeBadge } = bcondEls();
    const leftPct = ((BCOND_USUAL_MIN - 1) / 9) * 100;
    const widthPct = ((BCOND_USUAL_MAX - BCOND_USUAL_MIN) / 9) * 100;
    if (usualBand) {
      usualBand.style.left = leftPct + "%";
      usualBand.style.width = widthPct + "%";
    }
    if (rangeBadge) {
      rangeBadge.style.right = (100 - (leftPct + widthPct / 2)) + "%";
    }
  }

  function bcondRenderValue(value, opts) {
    const animateNumber = !opts || opts.animateNumber !== false;
    const level = bcondLevel(value);
    const { sheet, numeral, label, desc, thumb, saveBtn, saveSub, rangeBadge } = bcondEls();
    if (!sheet) return;

    sheet.style.setProperty("--bcond-color", level.color);
    sheet.style.setProperty("--bcond-glow", bcondHexToRgba(level.color, 0.45));

    const changed = bcondLastRenderedValue !== level.value;
    if (numeral) {
      numeral.textContent = String(level.value);
      if (changed && animateNumber) {
        numeral.classList.remove("is-pulsing");
        // Force reflow so the animation can be re-triggered on repeated
        // taps/drags to the same-looking value change.
        void numeral.offsetWidth;
        numeral.classList.add("is-pulsing");
      }
    }
    if (label) label.textContent = level.label;
    if (desc) desc.textContent = level.desc;

    const pct = ((level.value - 1) / 9) * 100;
    if (thumb) {
      thumb.style.left = pct + "%";
      thumb.setAttribute("aria-valuenow", String(level.value));
    }

    const isAboveUsual = level.value > BCOND_USUAL_MAX;
    if (rangeBadge) rangeBadge.hidden = !isAboveUsual;
    if (saveSub) saveSub.hidden = !isAboveUsual;
    if (saveBtn) saveBtn.classList.toggle("is-above-usual", isAboveUsual);

    bcondLastRenderedValue = level.value;
    bcondPendingValue = level.value;
  }

  function bcondValueFromClientX(clientX) {
    const { track } = bcondEls();
    if (!track) return bcondPendingValue;
    const rect = track.getBoundingClientRect();
    const fraction = rect.width ? (clientX - rect.left) / rect.width : 0;
    const clamped = Math.max(0, Math.min(1, fraction));
    return Math.round(clamped * 9) + 1;
  }

  function bcondOnPointerMove(e) {
    if (!bcondDragging) return;
    const value = bcondValueFromClientX(e.clientX);
    bcondRenderValue(value, { animateNumber: true });
  }

  function bcondOnPointerUp() {
    if (!bcondDragging) return;
    bcondDragging = false;
    document.removeEventListener("pointermove", bcondOnPointerMove);
    document.removeEventListener("pointerup", bcondOnPointerUp);
  }

  function bcondBindDragHandlers() {
    const { thumb, track } = bcondEls();
    if (!thumb || !track || thumb.dataset.bcondBound) return;
    thumb.dataset.bcondBound = "1";
    thumb.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      bcondDragging = true;
      document.addEventListener("pointermove", bcondOnPointerMove);
      document.addEventListener("pointerup", bcondOnPointerUp);
    });
    track.addEventListener("pointerdown", (e) => {
      if (e.target === thumb) return;
      const value = bcondValueFromClientX(e.clientX);
      bcondRenderValue(value, { animateNumber: true });
      bcondDragging = true;
      document.addEventListener("pointermove", bcondOnPointerMove);
      document.addEventListener("pointerup", bcondOnPointerUp);
    });
  }

  function openBodyConditionOverlay() {
    const { overlay } = bcondEls();
    if (!overlay) return;
    bcondBindDragHandlers();
    bcondPositionUsualRange();
    const current = Number.isFinite(state.sellForm.bodyConditionRating) ? state.sellForm.bodyConditionRating : 5;
    bcondLastRenderedValue = null;
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("bcond-overlay-open");
    bcondRenderValue(current, { animateNumber: false });
    requestAnimationFrame(() => overlay.classList.add("is-open"));
  }

  function closeBodyConditionOverlay() {
    const { overlay } = bcondEls();
    if (!overlay) return;
    overlay.classList.remove("is-open");
    document.documentElement.classList.remove("bcond-overlay-open");
    setTimeout(() => {
      overlay.hidden = true;
      overlay.setAttribute("aria-hidden", "true");
    }, 320);
  }

  function saveBodyConditionRating() {
    state = { ...state, sellForm: { ...state.sellForm, bodyConditionRating: bcondPendingValue } };
    closeBodyConditionOverlay();
    render();
  }

  function clearBodyConditionRating() {
    state = { ...state, sellForm: { ...state.sellForm, bodyConditionRating: null } };
    closeBodyConditionOverlay();
    render();
  }

  function bcondTriggerLabel(rating) {
    if (!Number.isFinite(rating)) return { hasRating: false, text: "هنوز ثبت نشده — برای ارزیابی ضربه بزنید" };
    const level = bcondLevel(rating);
    return { hasRating: true, text: `امتیاز ثبت‌شده: ${level.value} از ۱۰ · ${level.label}` };
  }
