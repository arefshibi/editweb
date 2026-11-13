"use strict";
/* پاپ‌آپ «هوش مصنوعی در حال تکمیل اطلاعات خودرو» — پس از انتخاب مدل و سال نمایش داده می‌شود.
   window.showAiAutofillPopup({ car }, onDone) : پس از پایان انیمیشن onDone صدا زده می‌شود. */
(function () {
  const STEPS = ["نوع موتور", "نوع سوخت", "نوع گیربکس", "حجم موتور", "تعداد سیلندر", "انتقال قدرت"];
  const SPARKLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l1.9 5.6a3 3 0 0 0 1.9 1.9l5.6 1.9-5.6 1.9a3 3 0 0 0-1.9 1.9L12 21.3l-1.9-5.6a3 3 0 0 0-1.9-1.9l-5.6-1.9 5.6-1.9a3 3 0 0 0 1.9-1.9L12 2.5z"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.8l4.2 4.2 8.8-9.4"/></svg>';
  let active = null;

  function esc(s) { return String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function show(opts, onDone) {
    if (active) { active.cancel(); }
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stepMs = reduce ? 300 : 750;
    const root = document.createElement("div");
    root.className = "cm-ai";
    root.setAttribute("role", "alertdialog");
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-label", "هوش مصنوعی در حال تکمیل اطلاعات خودروی شماست");
    root.innerHTML =
      '<div class="cm-ai-card">' +
        '<div class="cm-ai-orb"><span class="cm-ai-glow"></span><span class="cm-ai-ring"></span>' +
          '<span class="cm-ai-core">' + SPARKLE + '</span><span class="cm-ai-check">' + CHECK + '</span></div>' +
        '<h3 class="cm-ai-title">هوش مصنوعی</h3>' +
        '<p class="cm-ai-sub">در حال تکمیل اطلاعات خودروی شماست</p>' +
        '<div class="cm-ai-car">' + esc(opts && opts.car) + '</div>' +
        '<ul class="cm-ai-steps">' + STEPS.map(s => '<li><span class="cm-ai-dot"></span>' + s + '</li>').join("") + '</ul>' +
        '<div class="cm-ai-bar"><i></i></div>' +
        '<p class="cm-ai-note"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.2"/></svg><span>ممکن است اطلاعات دقیق نباشند و هوش مصنوعی دچار اشتباه شود. لطفاً حتماً خودتان آن‌ها را بررسی و در صورت نیاز اصلاح کنید.</span></p>' +
      '</div>';
    document.body.appendChild(root);
    const items = Array.from(root.querySelectorAll(".cm-ai-steps li"));
    const bar = root.querySelector(".cm-ai-bar i");
    const title = root.querySelector(".cm-ai-title");
    const sub = root.querySelector(".cm-ai-sub");
    const timers = [];
    const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
    let finished = false;

    function cleanup() { timers.forEach(clearTimeout); root.remove(); if (active && active.root === root) active = null; }
    function finish() {
      if (finished) return; finished = true;
      cleanup();
      if (typeof onDone === "function") onDone();
    }

    requestAnimationFrame(() => root.classList.add("is-in"));
    items.forEach((li, i) => {
      later(() => { li.classList.add("is-active"); bar.style.width = Math.round(((i + .5) / items.length) * 100) + "%"; }, 700 + i * stepMs);
      later(() => { li.classList.remove("is-active"); li.classList.add("is-done"); bar.style.width = Math.round(((i + 1) / items.length) * 100) + "%"; }, 700 + i * stepMs + stepMs - 40);
    });
    const end = 700 + items.length * stepMs;
    later(() => { root.classList.add("is-done"); title.textContent = "اطلاعات تکمیل شد"; sub.textContent = "مشخصات فنی خودرو در فرم ثبت شد"; }, end);
    later(() => { root.classList.add("is-out"); }, end + 2600);
    later(finish, end + 2600 + 280);

    active = { root, cancel: () => { finished = true; cleanup(); } };
  }

  window.showAiAutofillPopup = show;
})();
