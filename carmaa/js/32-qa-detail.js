"use strict";

/*
 * CarMaa Q&A — QUESTION DETAIL PAGE (stage 4)
 * Route { page: "qaQuestion", questionId }  ->  address  #/qa/q/<id>
 * Shows the question, its image, car info, author, date, answers (accepted
 * one first), related questions and the not-found / invalid-id states.
 * Stage 5 adds: posting an answer, "helpful" votes (one per answer per
 * browser) and choosing the accepted answer (display-identity owner only).
 * Data comes only from MARQUE_QA.store (never localStorage directly).
 * Browser-level only: nothing here is real ownership, security or anti-fraud.
 */
(function () {
  const QA = window.MARQUE_QA;
  if (!QA || !QA.store) return;
  const { esc, fa } = QA;
  const AL = QA.store.LIMITS.answer;

  const VIEWED_KEY = "marque_qa_viewed_v1"; // sessionStorage: ids already counted in this tab session
  const ADRAFT_KEY = "marque_qa_adraft_v1"; // sessionStorage: unsent answer text per question (survives a reload)
  let reqId = 0;
  let posting = false;        // an answer is being saved
  let acting = false;         // a vote / accept is being saved
  let answerSubmitted = false; // after the first submit attempt the error follows typing

  const root = () => document.querySelector('.qa-screen[data-page="qaQuestion"]');

  /* ---------------- navigation ---------------- */
  function openQuestion(id) {
    if (typeof navigateTo === "function") navigateTo({ page: "qaQuestion", questionId: String(id == null ? "" : id) }, { menuOpen: false });
  }
  QA.openQuestion = openQuestion;

  /* ---------------- helpers ---------------- */
  function fullDate(ts) {
    try { return new Date(ts).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" }); }
    catch (_) { return ""; }
  }
  function markViewed(id) {
    try {
      const seen = JSON.parse(sessionStorage.getItem(VIEWED_KEY) || "[]");
      if (Array.isArray(seen) && seen.indexOf(id) !== -1) return false;
      seen.push(id);
      sessionStorage.setItem(VIEWED_KEY, JSON.stringify(seen.slice(-200)));
    } catch (_) { /* no sessionStorage: count every visit, harmless */ }
    return true;
  }
  const initial = (name) => esc((name || "؟").trim().charAt(0));
  function readDrafts() {
    try { const o = JSON.parse(sessionStorage.getItem(ADRAFT_KEY) || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; }
    catch (_) { return {}; }
  }
  const getDraft = (qid) => { const v = readDrafts()[qid]; return typeof v === "string" ? v : ""; };
  function setDraft(qid, text) {
    try {
      const o = readDrafts();
      delete o[qid];
      if (text && text.trim()) o[qid] = text;
      const keys = Object.keys(o);
      while (keys.length > 20) delete o[keys.shift()];
      if (keys.length) sessionStorage.setItem(ADRAFT_KEY, JSON.stringify(o)); else sessionStorage.removeItem(ADRAFT_KEY);
    } catch (_) { /* no sessionStorage: the draft just lives in the textarea */ }
  }
  const toast = (m) => { if (typeof showToast === "function") showToast(m); };

  /* ---------------- markup ---------------- */
  const BACK_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const backButton = () => `<button type="button" class="qa-back" data-qa-action="back-to-list">${BACK_ICON}بازگشت به فهرست سؤال‌ها</button>`;

  function stateScreen(title, text) {
    return `${backButton()}${QA.emptyState(title, text, '<button type="button" class="qa-btn qa-btn-primary" data-qa-action="back-to-list">مشاهده همه سؤال‌ها</button>')}`;
  }

  function answerHTML(a, accepted, q) {
    const label = a.voted ? "رأی شما ثبت شد" : "مفید بود";
    const vote = `<button type="button" class="qa-vote${a.voted ? " is-voted" : ""}" data-qa-action="vote" data-id="${esc(a.id)}" aria-pressed="${a.voted ? "true" : "false"}"${a.voted ? ' aria-disabled="true"' : ""}>${QA.ICONS.helpful}<span>${label}</span><b>${fa(a.helpful)}</b></button>`;
    const accept = q.isOwner && !accepted
      ? `<button type="button" class="qa-accept-btn" data-qa-action="accept" data-id="${esc(a.id)}">${QA.ICONS.check}${q.isAccepted ? "جایگزین پاسخ پذیرفته‌شده" : "پذیرفتن این پاسخ"}</button>`
      : "";
    return `
<article class="qa-answer${accepted ? " is-accepted" : ""}" data-answer-id="${esc(a.id)}">
  ${accepted ? `<div class="qa-answer-flag">${QA.ICONS.check}پاسخ پذیرفته‌شده</div>` : ""}
  <div class="qa-answer-head">
    <span class="qa-author"><span class="qa-avatar" aria-hidden="true">${initial(a.authorName)}</span>${esc(a.authorName || "کاربر")}<i>·</i>${esc(QA.timeAgo(a.createdAt))}</span>
    <span class="qa-tags">${a.isMine ? '<span class="qa-mine" title="در همین حساب ثبت شده">پاسخ شما</span>' : ""}${a.isSample ? '<span class="qa-sample" title="داده نمونه برای نمایش رابط">نمونه</span>' : ""}</span>
  </div>
  <p class="qa-answer-body">${esc(a.body)}</p>
  <div class="qa-answer-foot">${vote}${accept}</div>
</article>`;
  }

  function answersHTML(q, answers) {
    const head = `<h2 class="qa-section-title">${answers.length ? fa(answers.length) + " پاسخ" : "پاسخ‌ها"}</h2>`;
    if (!answers.length) {
      return head + QA.emptyState("هنوز پاسخی ثبت نشده است", "اولین نفری باشید که به این سؤال پاسخ می‌دهد.");
    }
    // accepted answer first, the rest oldest-first (already sorted by the store)
    const accepted = answers.find((a) => a.id === q.acceptedAnswerId);
    const rest = answers.filter((a) => a !== accepted);
    const note = q.isOwner ? `<p class="qa-owner-note">این سؤال با نام نمایشی شما در همین مرورگر ثبت شده است؛ می‌توانید یکی از پاسخ‌ها را به‌عنوان پاسخ پذیرفته‌شده انتخاب کنید و بعداً تغییر دهید.</p>` : "";
    return head + note + `<div class="qa-answers">${accepted ? answerHTML(accepted, true, q) : ""}${rest.map((a) => answerHTML(a, false, q)).join("")}</div>`;
  }

  function answerFormHTML() {
    const who = window.CARMA_AUTH_USER ? { name: window.CARMA_AUTH_USER.displayName || "کاربر واردشده" } : QA.identity.current();
    return `
<h2 class="qa-section-title">پاسخ شما</h2>
<form class="qa-form qa-answer-form" data-qa-answer-form novalidate autocomplete="off">
  <div class="qa-field">
    <div class="qa-label-row"><label class="qa-label" for="qa-a-body">متن پاسخ</label><span class="qa-counter" data-counter="answer"></span></div>
    <textarea id="qa-a-body" class="qa-input qa-textarea" name="answerBody" rows="5" maxlength="${AL.max + 200}" placeholder="تجربه یا پاسخ فنی خود را بنویسید…" aria-describedby="qa-err-answer"></textarea>
    <p class="qa-error" id="qa-err-answer" data-err="answer" role="alert" hidden></p>
  </div>
  <p class="qa-error qa-error-form" data-err="answer-form" role="alert" hidden></p>
  <p class="qa-identity">${window.CARMA_API?.enabled ? "پاسخ در حساب کاربری شما و روی سرور ثبت می‌شود." : `پاسخ با نام نمایشی «${esc(who.name)}» ثبت می‌شود و فقط در همین مرورگر ذخیره می‌شود.`}</p>
  <div class="qa-actions"><button type="submit" class="qa-btn qa-btn-primary" data-qa-role="answer-submit">ثبت پاسخ</button></div>
</form>`;
  }

  function relatedHTML(list) {
    if (!list.length) return "";
    return `<h2 class="qa-section-title">سؤال‌های مرتبط</h2>
<div class="qa-related">${list.map((r) => `
  <a class="qa-related-item" href="#/qa/q/${esc(encodeURIComponent(r.id))}" data-qa-action="open-question" data-id="${esc(r.id)}">
    <span class="qa-related-title">${esc(r.title)}</span>
    <span class="qa-related-meta">${esc(QA.categoryLabel(r.category))}<i>·</i>${fa(r.answerCount)} پاسخ</span>
  </a>`).join("")}</div>`;
  }

  function questionHTML(q) {
    const cars = [q.brand, q.model, q.year].filter(Boolean);
    return `
${backButton()}
<article class="qa-detail-card">
  <div class="qa-card-top">
    <span class="qa-cat">${esc(QA.categoryLabel(q.category))}</span>
    ${q.isSample ? '<span class="qa-sample" title="داده نمونه برای نمایش رابط">نمونه</span>' : ""}
    ${q.isOwner ? '<span class="qa-mine" title="در همین حساب ثبت شده">سؤال شما</span>' : ""}
    ${QA.statusBadge(q)}
  </div>
  <h1 class="qa-detail-title">${esc(q.title)}</h1>
  <div class="qa-detail-meta">
    <span class="qa-author"><span class="qa-avatar" aria-hidden="true">${initial(q.authorName)}</span>${esc(q.authorName || "کاربر")}</span>
    <time datetime="${esc(new Date(q.createdAt).toISOString())}" title="${esc(fullDate(q.createdAt))}">${esc(QA.timeAgo(q.createdAt))}</time>
  </div>
  ${cars.length ? `<dl class="qa-carinfo">${[["برند", q.brand], ["مدل", q.model], ["سال تولید", q.year]].filter((x) => x[1]).map((x) => `<div><dt>${x[0]}</dt><dd>${esc(x[1])}</dd></div>`).join("")}</dl>` : ""}
  <p class="qa-detail-body">${esc(q.body)}</p>
  ${q.imageId ? `<figure class="qa-detail-media"><img data-qa-img="${esc(q.imageId)}" alt="تصویر پیوست‌شده به سؤال" decoding="async"></figure>` : ""}
  <div class="qa-detail-stats">
    <span class="qa-stat" aria-label="تعداد پاسخ‌ها: ${fa(q.answerCount)}">${QA.ICONS.answers}<b data-slot="qa-d-answers">${fa(q.answerCount)}</b>پاسخ</span>
    <span class="qa-stat" aria-label="رأی‌های مفید: ${fa(q.helpfulCount)}">${QA.ICONS.helpful}<b data-slot="qa-d-helpful">${fa(q.helpfulCount)}</b>رأی مفید</span>
    <span class="qa-stat" aria-label="بازدید: ${fa(q.views)}">${QA.ICONS.views}<b data-slot="qa-d-views">${fa(q.views)}</b>بازدید</span>
  </div>
</article>
<section class="qa-block" data-slot="qa-answers" aria-label="پاسخ‌ها"></section>
<section class="qa-block" data-slot="qa-answer-form" aria-label="ثبت پاسخ"></section>
<section class="qa-block" data-slot="qa-related" aria-label="سؤال‌های مرتبط"></section>
<p class="qa-note">نسخه نمایشی: سؤال‌ها، پاسخ‌ها و رأی‌ها فقط در همین مرورگر ذخیره و شمرده می‌شوند.</p>`;
  }

  /* ---------------- screen ---------------- */
  function renderQaQuestionScreen(questionId) {
    setTimeout(QA.markSkeletonSeen, 0);
    const el = document.createElement("section");
    el.className = "qa-screen";
    el.dataset.page = "qaQuestion";

    if (!QA.store.isValidQuestionId(questionId)) {
      el.innerHTML = stateScreen("شناسه سؤال نامعتبر است", "آدرس واردشده درست نیست. از فهرست سؤال‌ها یکی را انتخاب کنید.");
      return el;
    }
    el.dataset.qid = questionId;
    answerSubmitted = false;
    el.innerHTML = `${backButton()}${QA.skeletonSeen() ? "" : `<div class="qa-detail-card qa-skel" aria-hidden="true"><i class="qa-sk w40"></i><i class="qa-sk w90 h24"></i><i class="qa-sk w60"></i><i class="qa-sk w90"></i><i class="qa-sk w80"></i></div>`}`;

    const my = ++reqId;
    Promise.all([QA.store.getQuestion(questionId), QA.store.listAnswers(questionId), QA.store.findRelated(questionId, 4)])
      .then(([q, answers, related]) => {
        if (my !== reqId || !el.isConnected) return;
        if (!q) { el.innerHTML = stateScreen("سؤال پیدا نشد", "این سؤال وجود ندارد یا در این مرورگر ذخیره نشده است."); return; }
        el.innerHTML = questionHTML(q);
        el.querySelector('[data-slot="qa-answers"]').innerHTML = answersHTML(q, answers);
        el.querySelector('[data-slot="qa-answer-form"]').innerHTML = answerFormHTML();
        const ta = el.querySelector('[name="answerBody"]');
        if (ta) { ta.value = getDraft(questionId); updateAnswerCounter(el); }
        el.querySelector('[data-slot="qa-related"]').innerHTML = relatedHTML(related);
        if (QA.hydrateImages) QA.hydrateImages(el);
        // Count the visit once per tab session, then refresh the number on screen.
        if (markViewed(questionId)) {
          QA.store.recordView(questionId).then((total) => {
            const v = el.isConnected && el.querySelector('[data-slot="qa-d-views"]');
            if (v && total != null) v.textContent = fa(total);
          });
        }
      })
      .catch(() => {
        if (my !== reqId || !el.isConnected) return;
        el.innerHTML = stateScreen("بارگذاری سؤال ممکن نشد", "صفحه را دوباره باز کنید.");
      });
    return el;
  }

  /* ---------------- answers: counter, errors, refresh ---------------- */
  function updateAnswerCounter(el) {
    const ta = el.querySelector('[name="answerBody"]'), c = el.querySelector('[data-counter="answer"]');
    if (!ta || !c) return;
    const n = ta.value.length;
    c.textContent = fa(n) + " / " + fa(AL.max);
    c.classList.toggle("is-over", n > AL.max);
  }
  function showAnswerError(el, msg, slot) {
    const p = el.querySelector('[data-err="' + (slot || "answer") + '"]');
    if (p) { p.textContent = msg || ""; p.hidden = !msg; }
    if (!slot || slot === "answer") {
      const ta = el.querySelector('[name="answerBody"]');
      if (ta) { ta.classList.toggle("is-invalid", !!msg); if (msg) ta.setAttribute("aria-invalid", "true"); else ta.removeAttribute("aria-invalid"); }
    }
  }

  // Updates the question summary (status badge + answer / helpful counters) without re-rendering the whole page.
  function updateSummary(el, q) {
    const badge = el.querySelector(".qa-detail-card .qa-status");
    if (badge) badge.outerHTML = QA.statusBadge(q);
    [["qa-d-answers", q.answerCount, "تعداد پاسخ‌ها"], ["qa-d-helpful", q.helpfulCount, "رأی‌های مفید"]].forEach(([slot, n, label]) => {
      const b = el.querySelector('[data-slot="' + slot + '"]');
      if (!b) return;
      b.textContent = fa(n);
      const wrap = b.closest(".qa-stat");
      if (wrap) wrap.setAttribute("aria-label", label + ": " + fa(n));
    });
  }

  // Re-reads the question + answers and redraws only the answer list and the summary.
  // The answer form is not touched, so typing is never lost. opts: { highlightId, focusFrom }
  function refresh(el, opts) {
    const o = opts || {};
    const qid = el.dataset.qid;
    let focusSel = null;
    const act = document.activeElement;
    if (act && el.contains(act) && act.dataset && act.dataset.qaAction && act.dataset.id) {
      focusSel = '[data-qa-action="' + act.dataset.qaAction + '"][data-id="' + act.dataset.id + '"]';
    }
    return Promise.all([QA.store.getQuestion(qid), QA.store.listAnswers(qid)]).then(([q, answers]) => {
      if (!el.isConnected || el.dataset.qid !== qid) return;
      if (!q) { el.innerHTML = stateScreen("سؤال پیدا نشد", "این سؤال وجود ندارد یا در این مرورگر ذخیره نشده است."); return; }
      el.querySelector('[data-slot="qa-answers"]').innerHTML = answersHTML(q, answers);
      updateSummary(el, q);
      if (focusSel) { const f = el.querySelector(focusSel); if (f) { try { f.focus({ preventScroll: true }); } catch (_) {} } }
      if (o.highlightId) {
        const card = el.querySelector('[data-answer-id="' + o.highlightId + '"]');
        if (card) {
          card.classList.add("is-new");
          const calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          try { card.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" }); } catch (_) {}
          setTimeout(() => card.classList.remove("is-new"), 2400);
        }
      }
    });
  }

  /* ---------------- answers: submit / vote / accept ---------------- */
  function submitAnswer(el) {
    if (posting) return;
    const qid = el.dataset.qid;
    const ta = el.querySelector('[name="answerBody"]');
    const btn = el.querySelector('[data-qa-role="answer-submit"]');
    if (!ta) return;
    answerSubmitted = true;
    showAnswerError(el, "", "answer-form");
    const errors = QA.store.validateAnswer({ body: ta.value });
    if (errors.body) { showAnswerError(el, errors.body); try { ta.focus(); } catch (_) {} return; }
    showAnswerError(el, "");
    posting = true;
    if (btn) { btn.disabled = true; btn.textContent = "در حال ثبت…"; }
    QA.store.addAnswer({ questionId: qid, body: ta.value })
      .then((a) => {
        ta.value = ""; setDraft(qid, ""); answerSubmitted = false; updateAnswerCounter(el);
        toast("پاسخ شما ثبت شد");
        return refresh(el, { highlightId: a.id });
      })
      .catch((e) => {
        if (e && e.code === "validation" && e.errors && e.errors.body) showAnswerError(el, e.errors.body);
        else showAnswerError(el, (e && e.message) || "ثبت پاسخ انجام نشد. دوباره تلاش کنید.", "answer-form");
      })
      .then(() => { posting = false; if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = "ثبت پاسخ"; } });
  }

  function runAction(el, work, okMessage, refreshOpts) {
    if (acting) return;
    acting = true;
    work()
      .then((r) => { if (okMessage && (!r || r.changed !== false)) toast(okMessage); return refresh(el, refreshOpts); })
      .catch((e) => toast((e && e.message) || "انجام نشد. دوباره تلاش کنید."))
      .then(() => { acting = false; });
  }

  // Shown by the navigation skeleton stage (see 05-small-render-pieces.js).
  function skeletonQuestionScreen() {
    const el = document.createElement("section");
    el.className = "qa-screen cm-skeleton-screen";
    el.dataset.page = "qaQuestion";
    el.setAttribute("aria-busy", "true");
    const sk = (w, h=12, r=6) => `<i class="qa-sk" style="width:${w};height:${h}px;border-radius:${r}px"></i>`;
    const detailLines = (widths, height=12) => widths.map((w)=>sk(w+"%",height)).join("");
    el.innerHTML = `
      ${backButton()}
      <article class="qa-detail-card qa-skel cm-qa-sk-detail" aria-hidden="true">
        <div class="qa-card-top"><span class="qa-cat">${sk("64px",10,5)}</span><span class="qa-status">${sk("58px",10,5)}</span></div>
        <div class="cm-qa-sk-detail-title">${sk("94%",22)}${sk("76%",22)}</div>
        <div class="qa-detail-meta"><span class="qa-author"><span class="qa-avatar">${sk("22px",22,999)}</span>${sk("92px",11)}</span>${sk("58px",10)}</div>
        <dl class="qa-carinfo"><div><dt>برند</dt><dd>${sk("52px",11)}</dd></div><div><dt>مدل</dt><dd>${sk("48px",11)}</dd></div><div><dt>سال</dt><dd>${sk("38px",11)}</dd></div></dl>
        <div class="qa-detail-body cm-qa-sk-paragraph">${detailLines([100,96,87,100,69])}</div>
        <figure class="qa-detail-media cm-qa-sk-media">${sk("100%",190,12)}</figure>
        <div class="qa-detail-stats">${["44px","54px","48px"].map((w)=>`<span class="qa-stat">${sk(w,11)}</span>`).join("")}</div>
      </article>
      <section class="qa-block"><h2 class="qa-section-title">پاسخ‌ها</h2><div class="qa-answers" aria-hidden="true">${[0,1].map(()=>`<article class="qa-answer"><div class="qa-answer-head"><span class="qa-author"><span class="qa-avatar">${sk("22px",22,999)}</span>${sk("86px",11)}</span>${sk("54px",10)}</div><div class="cm-qa-sk-paragraph">${detailLines([100,92,83])}</div><div class="qa-answer-foot">${sk("74px",10)}</div></article>`).join("")}</div></section>
      <section class="qa-block"><h2 class="qa-section-title">پاسخ شما</h2><div class="qa-form qa-answer-form" aria-hidden="true"><div class="qa-field"><div class="qa-label-row">${sk("22%",11)}${sk("44px",10)}</div><div class="qa-sk-control" style="height:120px">${sk("72%",11)}</div></div><div class="qa-identity">${sk("100%",10)}${sk("78%",10)}</div><div class="qa-actions"><span class="qa-btn qa-btn-primary">${sk("72px",11)}</span></div></div></section>
      <section class="qa-block"><h2 class="qa-section-title">سؤال‌های مرتبط</h2><div class="qa-related" aria-hidden="true">${[0,1,2].map(()=>`<div class="qa-related-item"><span class="qa-related-title">${sk("82%",12)}</span><span class="qa-related-meta">${sk("66px",10)}</span></div>`).join("")}</div></section>
      <p class="qa-note">نسخه نمایشی: سؤال‌ها، پاسخ‌ها و رأی‌ها فقط در همین مرورگر ذخیره و شمرده می‌شوند.</p>`;
    return el;
  }

  /* ---------------- interactions ---------------- */
  document.addEventListener("click", function (event) {
    const el = event.target.closest("[data-qa-action]");
    const screen = root();
    if (!el || !screen || !screen.contains(el)) return;
    const action = el.dataset.qaAction;
    if (action === "back-to-list") {
      if (QA.open) QA.open();
    } else if (action === "open-question") {
      event.preventDefault();
      openQuestion(el.dataset.id);
    } else if (action === "vote") {
      if (el.classList.contains("is-voted")) return; // already voted in this browser
      runAction(screen, () => QA.store.voteHelpful(el.dataset.id), "");
    } else if (action === "accept") {
      const id = el.dataset.id;
      runAction(screen, () => QA.store.acceptAnswer(screen.dataset.qid, id), "پاسخ پذیرفته‌شده انتخاب شد", { highlightId: id });
    }
  });
  document.addEventListener("input", function (event) {
    const t = event.target, screen = root();
    if (!screen || !t || t.name !== "answerBody" || !screen.contains(t)) return;
    setDraft(screen.dataset.qid, t.value);
    updateAnswerCounter(screen);
    if (answerSubmitted) showAnswerError(screen, QA.store.validateAnswer({ body: t.value }).body || "");
  });
  document.addEventListener("submit", function (event) {
    const form = event.target.closest && event.target.closest("[data-qa-answer-form]");
    if (!form) return;
    event.preventDefault();
    const screen = root();
    if (screen && screen.contains(form)) submitAnswer(screen);
  });

  Object.assign(QA, { renderQuestionPage: renderQaQuestionScreen, skeletonQuestion: skeletonQuestionScreen });
})();

function renderQaQuestionScreen(questionId) {
  return window.MARQUE_QA && window.MARQUE_QA.renderQuestionPage ? window.MARQUE_QA.renderQuestionPage(questionId) : document.createElement("section");
}
