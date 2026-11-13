"use strict";

/*
 * CarMaa — نوار بازگردانی آگهی حذف‌شده
 * حباب تمام‌عرض (پایین صفحه، بالای ناوبری) با یک خط دور آن که از نقطه‌ی بالا-وسط شروع می‌شود،
 * در ۷ ثانیه دور نوار می‌چرخد و به خودش می‌رسد. عدد ثانیه‌شمار هرچه کمتر شود قرمزتر می‌شود.
 * API: window.CM_UNDO_DELETE.show({ text, onUndo }) / .hide()
 */
(function () {
  const TOTAL_MS = 7000;
  const NS = "http://www.w3.org/2000/svg";
  const FA = (n) => new Intl.NumberFormat("fa-IR").format(n);
  const UNDO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
  let host = null, bar, progress, track, countEl, textEl, btn;
  let raf = 0, startAt = 0, current = null, outTimer = 0;

  // سفید → قرمز بر اساس پیشرفت (۰..۱)
  function mix(t) {
    const a = [244, 244, 245], b = [255, 36, 36];
    return "rgb(" + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",") + ")";
  }

  function build() {
    if (host) return;
    host = document.createElement("div");
    host.className = "cm-undo"; host.hidden = true;
    host.innerHTML = '<div class="cm-undo-bar" role="status" aria-live="polite">' +
      '<svg class="cm-undo-ring" aria-hidden="true"><path class="cm-undo-track"></path><path class="cm-undo-progress"></path></svg>' +
      '<span class="cm-undo-start"><b class="cm-undo-count"></b><span class="cm-undo-text"></span></span>' +
      '<button type="button" class="cm-undo-btn">' + UNDO_ICON + '<span>بازگردانی</span></button></div>';
    document.body.appendChild(host);
    bar = host.querySelector(".cm-undo-bar");
    track = host.querySelector(".cm-undo-track");
    progress = host.querySelector(".cm-undo-progress");
    countEl = host.querySelector(".cm-undo-count");
    textEl = host.querySelector(".cm-undo-text");
    btn = host.querySelector(".cm-undo-btn");
    btn.addEventListener("click", onUndoClick);
    window.addEventListener("resize", layout);
  }

  // مسیر دور حباب: شروع از بالا-وسط، ساعت‌گرد، تا رسیدن دوباره به همان نقطه
  function layout() {
    if (!host || host.hidden) return;
    const w = bar.offsetWidth, h = bar.offsetHeight, i = 1.25, r = (h - 2 * i) / 2;
    const cx = w / 2, x0 = i, x1 = w - i, y0 = i, y1 = h - i;
    const d = "M" + cx + "," + y0 + " H" + (x1 - r) + " A" + r + "," + r + " 0 0 1 " + (x1 - r) + "," + y1 +
      " H" + (x0 + r) + " A" + r + "," + r + " 0 0 1 " + (x0 + r) + "," + y0 + " Z";
    [track, progress].forEach((p) => { p.setAttribute("d", d); p.setAttribute("pathLength", "100"); });
    progress.style.strokeDasharray = "100 100";
  }

  function paint(p, remainingMs) {
    const col = mix(p);
    progress.style.strokeDashoffset = String(100 * (1 - p));
    progress.style.stroke = col;
    countEl.textContent = FA(Math.max(1, Math.ceil(remainingMs / 1000)));
    countEl.style.color = col;
  }

  function tick() {
    const el = Date.now() - startAt;
    const p = Math.min(1, el / TOTAL_MS);
    paint(p, TOTAL_MS - el);
    if (p >= 1) { const c = current; hide(); fire(c); return; }
    raf = requestAnimationFrame(tick);
  }

  // Sit right under the sticky header (its height differs per page / auto-hide state).
  function placeUnderHeader() {
    const hdr = document.getElementById("stickyHeaderGroup");
    const b = hdr ? Math.max(0, Math.round(hdr.getBoundingClientRect().bottom)) : 0;
    host.style.setProperty("--cm-undo-top", b + "px");
  }

  // onExpire runs exactly once when the bar runs out (or is replaced by a newer one) without Undo.
  function fire(c) {
    if (!c || c.done) return;
    c.done = true;
    if (typeof c.onExpire === "function") { try { c.onExpire(); } catch (e) { console.error(e); } }
  }

  function show(opts) {
    build();
    fire(current);
    placeUnderHeader();
    cancelAnimationFrame(raf); clearTimeout(outTimer);
    current = opts || {};
    const mine = current;
    setTimeout(() => fire(mine), TOTAL_MS + 400); // backup: background tabs may pause animation frames
    textEl.textContent = current.text || "آگهی حذف شد";
    host.classList.remove("is-out"); host.hidden = false;
    layout();
    startAt = Date.now(); paint(0, TOTAL_MS);
    requestAnimationFrame(() => host.classList.add("is-in"));
    raf = requestAnimationFrame(tick);
  }

  function hide() {
    if (!host || host.hidden) return;
    cancelAnimationFrame(raf); current = null;
    host.classList.remove("is-in"); host.classList.add("is-out");
    clearTimeout(outTimer);
    outTimer = setTimeout(() => { host.hidden = true; host.classList.remove("is-out"); }, 300);
  }

  function onUndoClick() {
    const cb = current && current.onUndo;
    if (current) current.done = true; // undone: onExpire must not run
    hide();
    if (typeof cb === "function") { try { cb(); } catch (e) { console.error(e); } }
  }

  window.CM_UNDO_DELETE = { show, hide };
})();
