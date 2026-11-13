"use strict";

/*
 * CarMaa Q&A — ASK FORM (stage 3)
 * Route { page: "qaAsk" }, rendered by render() through renderQaAskScreen().
 * - Draft lives in module memory (not in the DOM) so a re-render never loses it;
 *   the text fields are also mirrored to sessionStorage for page reloads.
 * - Typing never re-renders the page; only counters / error slots / suggestions change.
 * - Everything is saved through QA.store (no direct storage access here).
 * - Only data-qa-* attributes are used, so the app's global click/submit
 *   delegation (17-chip-dropdown.js) is not involved.
 */
(function () {
  const QA = window.MARQUE_QA;
  if (!QA || !QA.store) return;
  const { esc, fa } = QA;
  const L = QA.store.LIMITS;

  const DRAFT_KEY = "marque_qa_draft_v1";
  const MAX_FILE_BYTES = 10 * 1024 * 1024;       // raw file limit
  const MAX_STORED_CHARS = 1600 * 1024;          // compressed data-URL limit
  const TYPES = ["image/jpeg", "image/png", "image/webp"];
  const EMPTY = () => ({ title: "", body: "", category: "", brand: "", model: "", year: "", image: null });

  let draft = EMPTY();          // image: { dataUrl, name } | null
  let touched = {};             // fields that may show errors
  let submitted = false;        // after the first submit attempt every error is shown
  let saving = false;
  let imageBusy = false;
  let created = null;           // last created question -> success view
  let simTimer = null, simReq = 0;

  try {
    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    if (saved && typeof saved === "object") ["title", "body", "category", "brand", "model", "year"].forEach((k) => { if (typeof saved[k] === "string") draft[k] = saved[k]; });
  } catch (_) {}
  function saveDraft() {
    try {
      const { title, body, category, brand, model, year } = draft;
      if (title || body || category || brand || model || year) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ title, body, category, brand, model, year }));
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch (_) {}
  }
  const isDirty = () => !!(draft.title.trim() || draft.body.trim() || draft.category || draft.brand.trim() || draft.model.trim() || draft.year.trim() || draft.image);
  const root = () => document.querySelector('.qa-screen[data-page="qaAsk"]');

  /* ---------------- navigation ---------------- */
  function openAsk() {
    created = null;
    if (typeof navigateTo === "function") navigateTo({ page: "qaAsk" }, { menuOpen: false });
  }
  function backToList() {
    if (typeof navigateTo === "function") navigateTo({ page: "qa" }, { menuOpen: false });
  }
  QA.openAsk = openAsk;

  /* ---------------- markup ---------------- */
  const ICON_X = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_IMG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>';

  function field(name, label, control, opts) {
    const o = opts || {};
    return `
<div class="qa-field" data-field="${name}">
  <div class="qa-label-row"><label class="qa-label" for="qa-f-${name}">${label}${o.optional ? ' <span class="qa-opt">(اختیاری)</span>' : ' <span class="qa-req" aria-hidden="true">*</span>'}</label>${o.counter ? `<span class="qa-counter" data-counter="${name}"></span>` : ""}</div>
  ${control}
  ${o.hint ? `<p class="qa-hint">${o.hint}</p>` : ""}
  <p class="qa-error" data-err="${name}" role="alert" hidden></p>
</div>`;
  }

  function brandOptions() {
    try { return (typeof BRANDS !== "undefined" ? BRANDS : []).filter((b) => b && !b.all && b.name).map((b) => `<option value="${esc(b.name)}">`).join(""); }
    catch (_) { return ""; }
  }
  function modelOptions(brand) {
    try {
      const list = (typeof MODELS_BY_BRAND !== "undefined" && MODELS_BY_BRAND[String(brand || "").trim()]) || [];
      return list.map((m) => `<option value="${esc(m)}">`).join("");
    } catch (_) { return ""; }
  }

  function imageBlock() {
    if (draft.image) {
      return `<div class="qa-img-preview"><img src="${esc(draft.image.dataUrl)}" alt="پیش‌نمایش تصویر انتخاب‌شده"><button type="button" class="qa-img-remove" data-qa-action="remove-image" aria-label="حذف تصویر">${ICON_X}<span>حذف تصویر</span></button></div>`;
    }
    if (imageBusy) return `<div class="qa-img-drop is-busy" aria-live="polite">در حال آماده‌سازی تصویر…</div>`;
    return `<button type="button" class="qa-img-drop" data-qa-action="pick-image">${ICON_IMG}<span>افزودن تصویر</span><small>JPG، PNG یا WebP؛ تا ${fa(10)} مگابایت</small></button>`;
  }

  function formHTML() {
    const who = window.CARMA_AUTH_USER ? { name: window.CARMA_AUTH_USER.displayName || "کاربر واردشده" } : QA.identity.current();
    const catOptions = `<option value="">انتخاب دسته‌بندی…</option>` + QA.CATEGORIES.map((c) => `<option value="${esc(c.id)}"${draft.category === c.id ? " selected" : ""}>${esc(c.label)}</option>`).join("");
    return `
<form class="qa-form" data-qa-form novalidate autocomplete="off">
  ${field("title", "عنوان سؤال", `<input id="qa-f-title" class="qa-input" name="title" type="text" maxlength="${L.title.max + 40}" value="${esc(draft.title)}" placeholder="مثلاً: صدای تق‌تق از جلوی خودرو هنگام عبور از دست‌انداز" aria-describedby="qa-err-title">`, { counter: true })}
  <div class="qa-similar" data-slot="qa-similar" hidden></div>
  ${field("body", "متن کامل سؤال", `<textarea id="qa-f-body" class="qa-input qa-textarea" name="body" rows="7" maxlength="${L.body.max + 200}" placeholder="جزئیات را بنویسید: علائم، شرایط بروز مشکل، کارهایی که انجام داده‌اید…">${esc(draft.body)}</textarea>`, { counter: true })}
  ${field("category", "دسته‌بندی", `<select id="qa-f-category" class="qa-input qa-select" name="category">${catOptions}</select>`)}
  <div class="qa-row">
    ${field("brand", "برند خودرو", `<input id="qa-f-brand" class="qa-input" name="brand" type="text" list="qa-brands" maxlength="${L.brand.max + 10}" value="${esc(draft.brand)}" placeholder="مثلاً تویوتا"><datalist id="qa-brands">${brandOptions()}</datalist>`, { optional: true })}
    ${field("model", "مدل خودرو", `<input id="qa-f-model" class="qa-input" name="model" type="text" list="qa-models" maxlength="${L.model.max + 10}" value="${esc(draft.model)}" placeholder="مثلاً کرولا"><datalist id="qa-models">${modelOptions(draft.brand)}</datalist>`, { optional: true })}
    ${field("year", "سال تولید", `<input id="qa-f-year" class="qa-input" name="year" type="text" inputmode="numeric" maxlength="4" value="${esc(draft.year)}" placeholder="۱۴۰۰">`, { optional: true })}
  </div>
  <div class="qa-field" data-field="image">
    <div class="qa-label-row"><span class="qa-label">تصویر <span class="qa-opt">(اختیاری)</span></span></div>
    <div data-slot="qa-image">${imageBlock()}</div>
    <input type="file" class="qa-file" data-qa-role="image-input" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
    <p class="qa-error" data-err="image" role="alert" hidden></p>
  </div>
  <p class="qa-error qa-error-form" data-err="form" role="alert" hidden></p>
  <p class="qa-identity">${window.CARMA_API?.enabled ? "سؤال در حساب کاربری شما و روی سرور ثبت می‌شود." : `این سؤال با نام نمایشی «${esc(who.name)}» ثبت می‌شود و فقط در همین مرورگر می‌ماند.`}</p>
  <div class="qa-actions">
    <button type="submit" class="qa-btn qa-btn-primary" data-qa-role="submit">ثبت سؤال</button>
    <button type="button" class="qa-btn" data-qa-action="cancel-ask">لغو</button>
  </div>
</form>`;
  }

  function successHTML(q) {
    return `
<div class="qa-success" role="status">
  <div class="qa-success-icon">${QA.ICONS.check.replace('width="15" height="15"', 'width="28" height="28"')}</div>
  <h2>سؤال شما ثبت شد</h2>
  <p class="qa-success-title">${esc(q.title)}</p>
  <p class="qa-hint">سؤال در فهرست بالای همه نمایش داده می‌شود و از «مشاهده سؤال» می‌توانید صفحه اختصاصی آن را باز کنید.</p>
  <div class="qa-actions">
    <button type="button" class="qa-btn qa-btn-primary" data-qa-action="view-created" data-id="${esc(q.id)}">مشاهده سؤال</button>
    <button type="button" class="qa-btn" data-qa-action="ask-another">ثبت سؤال دیگر</button>
  </div>
</div>`;
  }

  function buildAskScreen() {
    const el = document.createElement("section");
    el.dataset.page = "qaAsk";
    el.className = "qa-screen";
    el.innerHTML = `
      <button type="button" class="qa-back" data-qa-action="cancel-ask"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>بازگشت به پرسش‌وپاسخ</button>
      <header class="qa-head">
        <h1 class="qa-title">پرسیدن سؤال جدید</h1>
        <p class="qa-sub">سؤال را روشن و دقیق بنویسید تا بقیه بتوانند بهتر کمک کنند.</p>
      </header>
      <div data-slot="qa-ask-body">${created ? successHTML(created) : formHTML()}</div>`;
    if (!created) queueMicrotask(() => { updateCounters(el); if (draft.title.trim().length) scheduleSimilar(el); });
    return el;
  }

  QA._renderAsk = buildAskScreen;

  function skeletonAskScreen() {
    const el = document.createElement("section");
    el.dataset.page = "qaAsk";
    el.className = "qa-screen cm-skeleton-screen";
    el.setAttribute("aria-busy", "true");
    const sk = (w, h=12, r=6) => `<i class="qa-sk" style="width:${w};height:${h}px;border-radius:${r}px"></i>`;
    const fieldSk = (labelWidth="30%", controlHeight=46, helper=false) => `<div class="qa-field"><div class="qa-label-row">${sk(labelWidth,11)}${sk("44px",10)}</div><div class="qa-sk-control" style="height:${controlHeight}px">${sk("58%",11)}</div>${helper?`<div class="qa-sk-helper">${sk("86%",10)}${sk("66%",10)}</div>`:""}</div>`;
    el.innerHTML = `
      <button type="button" class="qa-back" aria-hidden="true">‹ <span class="qa-sk" style="width:116px;height:10px"></span></button>
      <header class="qa-head"><h1 class="qa-title">پرسیدن سؤال جدید</h1><p class="qa-sub">سؤال را روشن و دقیق بنویسید تا بقیه بتوانند بهتر کمک کنند.</p></header>
      <div data-slot="qa-ask-body"><form class="qa-form" aria-hidden="true">
        ${fieldSk("28%",46,true)}
        ${fieldSk("34%",154,true)}
        ${fieldSk("22%",46,false)}
        <div class="qa-row">${fieldSk("36%",46)}${fieldSk("32%",46)}${fieldSk("28%",46)}</div>
        <div class="qa-field"><div class="qa-label-row">${sk("22%",11)}${sk("54px",10)}</div><div class="qa-img-drop cm-qa-sk-upload"><span class="qa-sk" style="width:34px;height:34px;border-radius:9px"></span>${sk("82px",12)}${sk("156px",10)}</div></div>
        <div class="qa-identity cm-qa-sk-identity">${sk("100%",10)}${sk("86%",10)}</div>
        <div class="qa-actions"><span class="qa-btn qa-btn-primary cm-qa-sk-submit">${sk("74px",11)}</span><span class="qa-btn cm-qa-sk-cancel">${sk("42px",11)}</span></div>
      </form></div>`;
    return el;
  }
  QA.skeletonAsk = skeletonAskScreen;

  /* ---------------- live UI helpers ---------------- */
  function updateCounters(el) {
    const t = el.querySelector('[data-counter="title"]'), b = el.querySelector('[data-counter="body"]');
    if (t) { const n = draft.title.length; t.textContent = fa(n) + " / " + fa(L.title.max); t.classList.toggle("is-over", n > L.title.max); }
    if (b) { const n = draft.body.length; b.textContent = fa(n) + " / " + fa(L.body.max); b.classList.toggle("is-over", n > L.body.max); }
  }

  function showError(el, name, msg) {
    const p = el.querySelector('[data-err="' + name + '"]');
    const input = el.querySelector('[name="' + name + '"]');
    if (p) { p.textContent = msg || ""; p.hidden = !msg; }
    if (input) { input.classList.toggle("is-invalid", !!msg); if (msg) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid"); }
  }

  function validateAndShow(el, onlyTouched) {
    const errors = QA.store.validateQuestion(draft);
    ["title", "body", "category", "brand", "model", "year"].forEach((f) => {
      showError(el, f, (!onlyTouched || touched[f] || submitted) ? errors[f] : "");
    });
    return errors;
  }

  function scheduleSimilar(el) {
    clearTimeout(simTimer);
    simTimer = setTimeout(() => {
      const id = ++simReq;
      QA.store.findSimilar(draft.title, 3).then((list) => {
        const slot = el.querySelector('[data-slot="qa-similar"]');
        if (id !== simReq || !slot || !el.isConnected) return;
        if (!list.length) { slot.hidden = true; slot.innerHTML = ""; return; }
        slot.hidden = false;
        slot.innerHTML = `<div class="qa-similar-head">سؤال‌های مشابه؛ شاید پاسخ شما قبلاً داده شده باشد</div>` +
          list.map((q) => `<button type="button" class="qa-similar-item" data-qa-action="open-similar" data-id="${esc(q.id)}"><span>${esc(q.title)}</span><em>${fa(q.answerCount)} پاسخ</em></button>`).join("");
      });
    }, 250);
  }

  function refreshImage(el) {
    const slot = el.querySelector('[data-slot="qa-image"]');
    if (slot) slot.innerHTML = imageBlock();
  }

  /* ---------------- image handling ---------------- */
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }
  async function handleImage(el, file) {
    showError(el, "image", "");
    const errEl = el.querySelector('[data-err="image"]');
    const fail = (m) => { if (errEl) { errEl.textContent = m; errEl.hidden = false; } };
    if (!file) return;
    if (TYPES.indexOf(file.type) === -1) return fail("فقط تصویر JPG، PNG، WebP یا GIF پذیرفته می‌شود.");
    if (file.size > MAX_FILE_BYTES) return fail("حجم تصویر بیشتر از ۱۰ مگابایت است.");
    imageBusy = true; refreshImage(el);
    try {
      let url = await readFile(file);
      if (typeof mrRecompressPhoto === "function") {
        url = await mrRecompressPhoto(url, 1280, 0.82);
        if (url.length > MAX_STORED_CHARS) url = await mrRecompressPhoto(url, 900, 0.7);
      }
      if (typeof url !== "string" || url.indexOf("data:image") !== 0 || url.length > MAX_STORED_CHARS * 2) throw new Error("bad-image");
      draft.image = { dataUrl: url, name: file.name || "" };
    } catch (_) {
      draft.image = null;
      fail("خواندن تصویر ممکن نشد؛ تصویر دیگری را امتحان کنید.");
    }
    imageBusy = false;
    const cur = root();
    if (cur) refreshImage(cur);
  }

  /* ---------------- submit ---------------- */
  async function submit(el) {
    if (saving || imageBusy) return;
    submitted = true;
    showError(el, "form", "");
    const errors = validateAndShow(el, false);
    const first = Object.keys(errors)[0];
    if (first) {
      const target = el.querySelector('[name="' + first + '"]');
      if (target) { try { target.focus({ preventScroll: false }); } catch (_) { target.focus(); } }
      return;
    }
    saving = true;
    const btn = el.querySelector('[data-qa-role="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = "در حال ثبت…"; }
    try {
      const q = await QA.store.createQuestion({ ...draft, imageDataUrl: draft.image ? draft.image.dataUrl : "" });
      created = q;
      draft = EMPTY(); touched = {}; submitted = false; saveDraft();
      if (typeof showToast === "function") showToast("سؤال شما ثبت شد");
      const cur = root();
      if (cur) {
        cur.querySelector('[data-slot="qa-ask-body"]').innerHTML = successHTML(q);
        try { window.scrollTo(0, 0); } catch (_) {}
      }
    } catch (e) {
      if (e && e.code === "validation" && e.errors) { Object.keys(e.errors).forEach((f) => showError(el, f, e.errors[f])); }
      else showError(el, "form", (e && e.message) || "ثبت سؤال انجام نشد. دوباره تلاش کنید.");
      if (btn) { btn.disabled = false; btn.textContent = "ثبت سؤال"; }
    }
    saving = false;
  }

  /* ---------------- events (delegated, scoped to the ask screen) ---------------- */
  document.addEventListener("input", function (event) {
    const t = event.target;
    const el = root();
    if (!el || !t || !t.name || !el.contains(t) || !t.closest("[data-qa-form]")) return;
    const f = t.name;
    if (!(f in draft) || f === "image") return;
    if (f === "year") { const v = QA.toFaDigits(QA.toEnDigits(t.value)).replace(/[^۰-۹]/g, ""); if (v !== t.value) t.value = v; }
    draft[f] = t.value;
    saveDraft();
    if (f === "title" || f === "body") updateCounters(el);
    if (f === "title") scheduleSimilar(el);
    if (f === "brand") { const dl = el.querySelector("#qa-models"); if (dl) dl.innerHTML = modelOptions(t.value); }
    if (touched[f] || submitted) validateAndShow(el, true);
  });
  document.addEventListener("change", function (event) {
    const t = event.target;
    const el = root();
    if (!el || !t || !el.contains(t)) return;
    if (t.matches('[data-qa-role="image-input"]')) {
      const file = t.files && t.files[0];
      t.value = "";
      handleImage(el, file);
      return;
    }
    if (t.name === "category" && t.closest("[data-qa-form]")) {
      draft.category = t.value; touched.category = true; saveDraft(); validateAndShow(el, true);
    }
  });
  document.addEventListener("focusout", function (event) {
    const t = event.target;
    const el = root();
    if (!el || !t || !t.name || !el.contains(t) || !t.closest("[data-qa-form]")) return;
    if (t.name in draft) { touched[t.name] = true; validateAndShow(el, true); }
  });
  document.addEventListener("submit", function (event) {
    const form = event.target.closest && event.target.closest("[data-qa-form]");
    if (!form) return;
    event.preventDefault();
    const el = root();
    if (el) submit(el);
  });
  document.addEventListener("click", function (event) {
    const btn = event.target.closest("[data-qa-action]");
    const el = root();
    if (!btn || !el || !el.contains(btn)) return;
    const action = btn.dataset.qaAction;
    if (action === "pick-image") {
      const input = el.querySelector('[data-qa-role="image-input"]');
      if (input) input.click();
    } else if (action === "remove-image") {
      draft.image = null; showError(el, "image", ""); refreshImage(el);
    } else if (action === "cancel-ask") {
      if (!created && isDirty() && !window.confirm("سؤال ذخیره‌نشده است. از آن صرف‌نظر می‌کنید؟")) return;
      if (!created) { draft = EMPTY(); touched = {}; submitted = false; saveDraft(); }
      created = null;
      backToList();
    } else if (action === "view-created") {
      const id = btn.dataset.id; created = null;
      if (QA.openQuestion) QA.openQuestion(id); else QA.showInList(id);
    } else if (action === "ask-another") {
      created = null;
      const body = el.querySelector('[data-slot="qa-ask-body"]');
      if (body) { body.innerHTML = formHTML(); updateCounters(el); }
    } else if (action === "open-similar") {
      // The draft stays in memory, so coming back to the form keeps what was typed.
      if (QA.openQuestion) QA.openQuestion(btn.dataset.id); else QA.showInList(btn.dataset.id);
    }
  });
})();

function renderQaAskScreen() {
  return window.MARQUE_QA && window.MARQUE_QA.openAsk ? window.MARQUE_QA._renderAsk() : document.createElement("section");
}
