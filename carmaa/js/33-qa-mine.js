"use strict";

/*
 * CarMaa Q&A — MY QUESTIONS + LOCAL NOTIFICATIONS (stage 6)
 * Route { page: "qaMine" }  ->  address  #/qa/mine
 * Two tabs: "سؤال‌های من" (questions saved under the current DISPLAY identity in this
 * browser) and "اعلان‌ها" (local, in-site notifications for events in this browser).
 * Nothing here reaches real users: data lives only in this browser (see QA.store).
 */
(function () {
  const QA = window.MARQUE_QA;
  if (!QA || !QA.store) return;
  const { esc, fa } = QA;

  const UI_KEY = "marque_qa_mine_ui_v1"; // sessionStorage: last tab + filter in this tab
  const ui = { tab: "questions", filter: "all" };
  try {
    const saved = JSON.parse(sessionStorage.getItem(UI_KEY) || "null");
    if (saved && typeof saved === "object") {
      if (saved.tab === "questions" || saved.tab === "notifications") ui.tab = saved.tab;
      if (["all", "accepted", "answered", "open"].indexOf(saved.filter) !== -1) ui.filter = saved.filter;
    }
  } catch (_) {}
  const saveUi = () => { try { sessionStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (_) {} };

  const FILTERS = [
    { id: "all", label: "همه" },
    { id: "accepted", label: "پاسخ پذیرفته‌شده" },
    { id: "answered", label: "پاسخ داده شده" },
    { id: "open", label: "بدون پاسخ" },
  ];
  const statusOf = (q) => (q.isAccepted ? "accepted" : q.answerCount > 0 ? "answered" : "open");

  let reqId = 0;
  const root = () => document.querySelector('.qa-screen[data-page="qaMine"]');

  /* ---------------- navigation ---------------- */
  function openMine(tab) {
    if (tab === "questions" || tab === "notifications") { ui.tab = tab; saveUi(); }
    if (typeof navigateTo === "function") navigateTo({ page: "qaMine" }, { menuOpen: false });
  }
  QA.openMine = openMine;

  /* ---------------- notification text ---------------- */
  const BELL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>';
  const NOTE_TEXT = {
    question_created: "سؤال شما ثبت شد",
    answer_posted: "پاسخ شما ثبت شد",
    answer_received: "پاسخ جدیدی برای سؤال شما ثبت شد",
    answer_accepted: "یک پاسخ به‌عنوان پاسخ پذیرفته‌شده انتخاب شد",
    answer_accepted_yours: "پاسخ شما به‌عنوان پاسخ پذیرفته‌شده انتخاب شد",
  };
  function noteHTML(n) {
    return `
<a class="qa-note-item${n.read ? "" : " is-unread"}" href="#/qa/q/${esc(encodeURIComponent(n.questionId))}" data-qa-action="open-notification" data-id="${esc(n.id)}" data-q="${esc(n.questionId)}">
  <span class="qa-note-icon" aria-hidden="true">${n.type === "question_created" || n.type === "answer_posted" ? QA.ICONS.answers : QA.ICONS.check}</span>
  <span class="qa-note-main">
    <span class="qa-note-text">${esc(NOTE_TEXT[n.type] || "رویداد جدید")}${n.read ? "" : '<span class="qa-visually-hidden"> (خوانده‌نشده)</span>'}</span>
    <span class="qa-note-title">${esc(n.title)}</span>
    <span class="qa-note-time">${esc(QA.timeAgo(n.createdAt))}</span>
  </span>
  ${n.read ? "" : '<i class="qa-note-dot" aria-hidden="true"></i>'}
</a>`;
  }

  /* ---------------- painting ---------------- */
  function tabsHTML(unread) {
    const tab = (id, label, extra) => `<button type="button" role="tab" class="qa-tab${ui.tab === id ? " is-active" : ""}" data-qa-action="mine-tab" data-value="${id}" aria-selected="${ui.tab === id}">${label}${extra || ""}</button>`;
    const badge = `<em class="qa-badge" data-slot="qa-unread"${unread ? "" : " hidden"}>${fa(unread || 0)}</em>`;
    return tab("questions", "سؤال‌های من") + tab("notifications", "اعلان‌ها", badge);
  }
  function setBadge(r, n) {
    const b = r.querySelector('[data-slot="qa-unread"]');
    if (b) { b.textContent = fa(n); b.hidden = !n; }
  }

  function paintQuestions(r, list) {
    const body = r.querySelector('[data-slot="qa-mine-body"]');
    const counts = { all: list.length, accepted: 0, answered: 0, open: 0 };
    list.forEach((q) => { counts[statusOf(q)]++; });
    if (!list.length) {
      body.innerHTML = QA.emptyState("هنوز سؤالی ثبت نکرده‌اید", "سؤال‌هایی که در این مرورگر با نام نمایشی فعلی ثبت کنید، اینجا نمایش داده می‌شوند.",
        '<button type="button" class="qa-btn qa-btn-primary" data-qa-action="ask">پرسیدن سؤال جدید</button>');
      body.removeAttribute("aria-busy");
      return;
    }
    const shown = ui.filter === "all" ? list : list.filter((q) => statusOf(q) === ui.filter);
    const chips = FILTERS.map((f) => `<button type="button" class="qa-chip${ui.filter === f.id ? " is-active" : ""}" data-qa-action="mine-filter" data-value="${f.id}" aria-pressed="${ui.filter === f.id}">${esc(f.label)}<em>${fa(counts[f.id])}</em></button>`).join("");
    body.innerHTML = `
<div class="qa-chips" role="group" aria-label="وضعیت پاسخ‌گویی">${chips}</div>
<div class="qa-meta"><span class="qa-count" aria-live="polite">${fa(shown.length)} سؤال</span></div>
<div class="qa-list">${shown.length ? shown.map((q) => QA.questionCard(q, null)).join("") : QA.emptyState("سؤالی با این وضعیت ندارید", "وضعیت دیگری را انتخاب کنید.", '<button type="button" class="qa-btn" data-qa-action="mine-filter" data-value="all">نمایش همه</button>')}</div>`;
    body.removeAttribute("aria-busy");
    if (QA.hydrateImages) QA.hydrateImages(body);
  }

  function paintNotifications(r, list) {
    const body = r.querySelector('[data-slot="qa-mine-body"]');
    const unread = list.filter((n) => !n.read).length;
    setBadge(r, unread);
    const info = '<p class="qa-owner-note">اعلان‌ها فقط برای رویدادهای همین مرورگر ساخته می‌شوند و هیچ کاربر واقعی‌ای از پاسخ‌های یکدیگر مطلع نمی‌شود.</p>';
    if (!list.length) {
      body.innerHTML = info + QA.emptyState("اعلانی ندارید", "ثبت سؤال، ثبت پاسخ و انتخاب پاسخ پذیرفته‌شده در همین مرورگر اینجا ثبت می‌شود.");
      body.removeAttribute("aria-busy");
      return;
    }
    body.innerHTML = `${info}
<div class="qa-meta"><span class="qa-count" aria-live="polite">${unread ? fa(unread) + " اعلان خوانده‌نشده" : "همه اعلان‌ها خوانده شده‌اند"}</span>
  <span class="qa-note-tools"><button type="button" class="qa-btn" data-qa-action="notes-read-all"${unread ? "" : " disabled"}>خواندن همه</button><button type="button" class="qa-btn" data-qa-action="notes-clear">پاک کردن همه</button></span></div>
<div class="qa-note-list">${list.map(noteHTML).join("")}</div>`;
    body.removeAttribute("aria-busy");
  }

  function load(r) {
    const my = ++reqId;
    const body = r.querySelector('[data-slot="qa-mine-body"]');
    const tabs = r.querySelector('[data-slot="qa-tabs"]');
    const work = ui.tab === "questions"
      ? Promise.all([QA.store.listMine(), QA.store.unreadCount()]).then(([list, n]) => { if (my === reqId && r.isConnected) { setBadge(r, n); paintQuestions(r, list); } })
      : QA.store.listNotifications().then((list) => { if (my === reqId && r.isConnected) paintNotifications(r, list); });
    work.catch(() => {
      if (my !== reqId || !r.isConnected) return;
      body.innerHTML = QA.emptyState("بارگذاری ممکن نشد", "صفحه را دوباره باز کنید.");
      body.removeAttribute("aria-busy");
    });
    if (tabs) tabs.querySelectorAll(".qa-tab").forEach((t) => { const on = t.dataset.value === ui.tab; t.classList.toggle("is-active", on); t.setAttribute("aria-selected", String(on)); });
  }

  function renderQaMineScreen() {
    setTimeout(QA.markSkeletonSeen, 0);
    const r = document.createElement("section");
    r.className = "qa-screen";
    r.dataset.page = "qaMine";
    r.innerHTML = `
<button type="button" class="qa-back" data-qa-action="back-to-list"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>بازگشت به پرسش‌وپاسخ</button>
<header class="qa-head">
  <h1 class="qa-title">سؤال‌ها و اعلان‌های من</h1>
  <p class="qa-sub">سؤال‌هایی که با نام نمایشی فعلی در همین مرورگر ثبت کرده‌اید و رویدادهای مربوط به آن‌ها.</p>
</header>
<div class="qa-tabs" data-slot="qa-tabs" role="tablist" aria-label="بخش‌ها">${tabsHTML(0)}</div>
<div data-slot="qa-mine-body" aria-busy="true"><div class="qa-list">${QA.skeletonCards(2)}</div></div>
<p class="qa-note">نسخه نمایشی: این اطلاعات فقط در همین مرورگر ذخیره می‌شود و بین کاربران به اشتراک گذاشته نمی‌شود.</p>`;
    load(r);
    return r;
  }

  function skeletonMineScreen() {
    const r = document.createElement("section");
    r.className = "qa-screen cm-skeleton-screen";
    r.dataset.page = "qaMine";
    r.setAttribute("aria-busy", "true");
    const sk = (w, h=12, radius=6) => `<i class="qa-sk" style="width:${w};height:${h}px;border-radius:${radius}px"></i>`;
    r.innerHTML = `
      <button type="button" class="qa-back" aria-hidden="true">‹ <span class="qa-sk" style="width:116px;height:10px"></span></button>
      <header class="qa-head"><h1 class="qa-title">سؤال‌ها و اعلان‌های من</h1><p class="qa-sub">سؤال‌هایی که با نام نمایشی فعلی در همین مرورگر ثبت کرده‌اید و رویدادهای مربوط به آن‌ها.</p></header>
      <div class="qa-tabs cm-qa-sk-tabs" role="tablist" aria-hidden="true"><span class="qa-tab is-active">سؤال‌های من</span><span class="qa-tab">اعلان‌ها</span></div>
      <div data-slot="qa-mine-body" aria-busy="true"><div class="qa-chips cm-qa-sk-chips">${[70,94,81,67].map((w)=>`<span class="qa-chip">${sk(w+"px",10)}</span>`).join("")}</div><div class="qa-meta"><span class="qa-count">${sk("62px",11)}</span></div><div class="qa-list" aria-hidden="true">${QA.skeletonCards(2) || [0,1].map(()=>`<div class="qa-card qa-skel"><div class="qa-card-main">${sk("40%",11)}${sk("90%",18)}${sk("80%",12)}${sk("60%",12)}</div></div>`).join("")}</div></div>
      <p class="qa-note">نسخه نمایشی: این اطلاعات فقط در همین مرورگر ذخیره می‌شود و بین کاربران به اشتراک گذاشته نمی‌شود.</p>`;
    return r;
  }

  /* ---------------- interactions ---------------- */
  document.addEventListener("click", function (event) {
    const r = root();
    if (!r) return;
    let el = event.target.closest("[data-qa-action]");
    // clicking a question card (outside links/buttons) opens it
    if (!el && !event.target.closest("a, button, input")) {
      const card = event.target.closest(".qa-card[data-qa-id]");
      if (card && r.contains(card)) el = card.querySelector('[data-qa-action="open-question"]');
    }
    if (!el || !r.contains(el)) return;
    const action = el.dataset.qaAction;
    if (action === "back-to-list") { if (QA.open) QA.open(); }
    else if (action === "ask") { if (QA.openAsk) QA.openAsk(); }
    else if (action === "open-question") { event.preventDefault(); if (QA.openQuestion) QA.openQuestion(el.dataset.id); }
    else if (action === "mine-tab") {
      const v = el.dataset.value;
      if (v !== "questions" && v !== "notifications") return;
      ui.tab = v; saveUi(); load(r);
    } else if (action === "mine-filter") {
      if (!FILTERS.some((f) => f.id === el.dataset.value)) return;
      ui.filter = el.dataset.value; saveUi(); load(r);
    } else if (action === "open-notification") {
      event.preventDefault();
      const qid = el.dataset.q;
      QA.store.markNotificationsRead([el.dataset.id]).catch(() => {}).then(() => { if (QA.openQuestion) QA.openQuestion(qid); });
    } else if (action === "notes-read-all") {
      QA.store.markNotificationsRead("all").then(() => load(r));
    } else if (action === "notes-clear") {
      QA.store.clearNotifications().then(() => load(r)).catch((e) => { if (typeof showToast === "function") showToast((e && e.message) || "انجام نشد."); });
    }
  });

  Object.assign(QA, { renderMinePage: renderQaMineScreen, skeletonMine: skeletonMineScreen });
})();

function renderQaMineScreen() {
  return window.MARQUE_QA && window.MARQUE_QA.renderMinePage ? window.MARQUE_QA.renderMinePage() : document.createElement("section");
}
