"use strict";

/*
 * CarMaa Q&A — PAGES + ROUTER GLUE
 * Stage 1+2: the question list page (route { page: "qa" }) with search,
 * category filter and sorting.
 * Hooks into the app the same way 26-messaging.js does:
 *   - render() in 16-app-render-router.js calls renderQaListScreen()
 *   - its own delegated click listener handles data-action="openQa"
 */
(function () {
  const QA = window.MARQUE_QA;
  if (!QA || !QA.store) return;

  /* ---------------- list filters (kept while the app is open, and per tab across reloads) ---------------- */
  const UI_KEY = "marque_qa_ui_v1";
  const filters = { q: "", category: "all", sort: QA.DEFAULT_SORT };
  try {
    const saved = JSON.parse(sessionStorage.getItem(UI_KEY) || "null");
    if (saved && typeof saved === "object") {
      if (typeof saved.q === "string") filters.q = saved.q.slice(0, 120);
      if (saved.category === "all" || QA.CATEGORIES.some((c) => c.id === saved.category)) filters.category = saved.category;
      if (QA.SORTS.some((x) => x.id === saved.sort)) filters.sort = saved.sort;
    }
  } catch (_) {}
  function saveFilters() { try { sessionStorage.setItem(UI_KEY, JSON.stringify(filters)); } catch (_) {} }

  let cache = null;   // { list, stats } from the last successful load (avoids a skeleton flash on re-render)
  let reqId = 0;      // guards against out-of-order async results while typing

  const isFiltered = () => !!(filters.q.trim() || filters.category !== "all");
  const currentRoot = () => document.querySelector('.qa-screen[data-page="qa"]');

  function openQa() {
    if (typeof navigateTo === "function") navigateTo({ page: "qa" }, { menuOpen: false });
    else if (typeof state !== "undefined") { state = { ...state, route: { page: "qa" } }; render(); }
  }

  function emptyFor(total) {
    if (!total) return QA.emptyState("هنوز سؤالی ثبت نشده است", "وقتی سؤالی ثبت شود، اینجا نمایش داده می‌شود.");
    const q = filters.q.trim();
    const actions = [];
    if (q) actions.push('<button type="button" class="qa-btn" data-qa-action="clear-search">پاک کردن جست‌وجو</button>');
    if (filters.category !== "all") actions.push('<button type="button" class="qa-btn" data-qa-action="category" data-value="all">نمایش همه دسته‌ها</button>');
    if (q) {
      const shown = q.length > 40 ? q.slice(0, 40) + "…" : q;
      return QA.emptyState("نتیجه‌ای برای «" + shown + "» پیدا نشد",
        filters.category !== "all" ? "عبارت دیگری را امتحان کنید یا دسته‌بندی را روی «همه» بگذارید." : "املای عبارت را بررسی کنید یا کلمه‌های کمتر و کلی‌تری جست‌وجو کنید.",
        actions.join(""));
    }
    return QA.emptyState("در این دسته هنوز سؤالی ثبت نشده است", "دسته‌بندی دیگری را انتخاب کنید.", actions.join(""));
  }

  function paint(root, data) {
    const { list, stats } = data;
    const tokens = QA.searchTokens(filters.q);
    const count = root.querySelector('[data-slot="qa-count"]');
    const slot = root.querySelector('[data-slot="qa-list"]');
    if (count) {
      count.textContent = isFiltered()
        ? QA.fa(list.length) + " نتیجه از " + QA.fa(stats.total) + " سؤال"
        : QA.fa(stats.total) + " سؤال";
    }
    const chips = root.querySelector('[data-slot="qa-chips"]');
    if (chips) { const x = chips.scrollLeft; chips.innerHTML = QA.categoryChips(filters.category, stats); chips.scrollLeft = x; }
    if (slot) {
      slot.innerHTML = list.length ? list.map((q) => QA.questionCard(q, tokens)).join("") : emptyFor(stats.total);
      slot.removeAttribute("aria-busy");
      hydrateImages(slot);
      if (highlightId) {
        const card = slot.querySelector('[data-qa-id="' + highlightId + '"]');
        highlightId = null;
        if (card) { card.classList.add("qa-card-new"); try { card.scrollIntoView({ block: "center" }); } catch (_) {} }
      }
    }
  }

  // Fill <img data-qa-img="id"> from IndexedDB; hide the thumbnail if the image is gone.
  function hydrateImages(scope) {
    scope.querySelectorAll("img[data-qa-img]").forEach((img) => {
      const id = img.getAttribute("data-qa-img");
      QA.store.getImageUrl(id).then((url) => {
        if (!img.isConnected) return;
        if (url) img.src = url; else if (img.parentElement) img.parentElement.remove();
      });
    });
  }
  QA.hydrateImages = hydrateImages;

  function refresh(root) {
    const id = ++reqId;
    Promise.all([QA.store.listQuestions(filters), QA.store.getStats()]).then(([list, stats]) => {
      if (id !== reqId || !root.isConnected) return;
      cache = { list, stats };
      paint(root, cache);
    }).catch(() => {
      if (id !== reqId) return;
      const slot = root.querySelector('[data-slot="qa-list"]');
      if (slot) { slot.innerHTML = QA.emptyState("بارگذاری سؤال‌ها ممکن نشد", "صفحه را دوباره باز کنید."); slot.removeAttribute("aria-busy"); }
    });
  }

  // Called by the ask form after a successful submit: make sure the new question is visible.
  function resetFiltersAndFocus(questionId) {
    filters.q = ""; filters.category = "all"; filters.sort = "newest"; saveFilters();
    cache = null;
    highlightId = questionId || null;
  }
  let highlightId = null;
  QA.showInList = function (questionId) { resetFiltersAndFocus(questionId); openQa(); };

  function renderQaListScreen() {
    setTimeout(QA.markSkeletonSeen, 0); // first real render of any Q&A screen = the one-time skeleton has been used
    const root = document.createElement("section");
    root.dataset.page = "qa";
    root.className = "qa-screen";
    root.innerHTML = `
      <header class="qa-head">
        <h1 class="qa-title">پرسش‌وپاسخ خودرو</h1>
        <p class="qa-sub">سؤال‌های فنی و تخصصی خودرو را بخوانید، تجربه‌ها را ببینید و پاسخ‌ها را دنبال کنید.</p>
        <div class="qa-head-actions">
          <button type="button" class="qa-btn qa-btn-primary" data-qa-action="ask">پرسیدن سؤال جدید</button>
          <button type="button" class="qa-btn" data-qa-action="open-mine" data-tab="questions">سؤال‌های من</button>
          <button type="button" class="qa-btn" data-qa-action="open-mine" data-tab="notifications">اعلان‌ها<em class="qa-badge" data-slot="qa-unread" hidden></em></button>
        </div>
      </header>
      <div class="qa-tools">
        ${QA.searchBox(filters.q)}
        <div class="qa-chips" data-slot="qa-chips" role="group" aria-label="دسته‌بندی">${QA.categoryChips(filters.category, cache ? cache.stats : null)}</div>
        <div class="qa-bar">
          <span class="qa-count" data-slot="qa-count" aria-live="polite">&nbsp;</span>
          <div class="qa-sort" role="group" aria-label="مرتب‌سازی">${QA.sortControl(filters.sort)}</div>
        </div>
      </div>
      <div class="qa-list" data-slot="qa-list" aria-busy="true">${QA.skeletonCards(4)}</div>
      <p class="qa-note">نسخه نمایشی: سؤال‌ها فقط در همین مرورگر ذخیره می‌شوند و بین کاربران مختلف به اشتراک گذاشته نمی‌شوند.</p>`;

    if (cache) paint(root, cache);
    refresh(root);
    QA.store.unreadCount().then((n) => {
      const b = root.querySelector('[data-slot="qa-unread"]');
      if (b) { b.textContent = QA.fa(n); b.hidden = !n; }
    }).catch(() => {});
    return root;
  }

  /* ---------------- interactions (own delegated listeners; data-qa-* only) ---------------- */
  function syncSearchUi(root) {
    const input = root.querySelector('[data-qa-role="search"]');
    const clear = root.querySelector('[data-qa-action="clear-search"]');
    if (input && input.value !== filters.q) input.value = filters.q;
    if (clear) clear.hidden = !filters.q;
  }
  function syncSortUi(root) {
    root.querySelectorAll('[data-qa-action="sort"]').forEach((b) => {
      const on = b.dataset.value === filters.sort;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  document.addEventListener("input", function (event) {
    const input = event.target.closest && event.target.closest('[data-qa-role="search"]');
    if (!input) return;
    const root = currentRoot();
    if (!root) return;
    filters.q = input.value;
    saveFilters();
    syncSearchUi(root);
    refresh(root);
  });

  document.addEventListener("keydown", function (event) {
    const input = event.target.closest && event.target.closest('[data-qa-role="search"]');
    if (!input) return;
    const root = currentRoot();
    if (event.key === "Enter") { event.preventDefault(); input.blur(); }
    else if (event.key === "Escape" && filters.q) {
      event.preventDefault();
      filters.q = ""; saveFilters();
      if (root) { syncSearchUi(root); refresh(root); }
    }
  });

  document.addEventListener("click", function (event) {
    let el = event.target.closest("[data-qa-action]");
    const root = currentRoot();
    // Clicking anywhere on a card (outside links/buttons) opens the question.
    if (!el && root && !event.target.closest("a, button, input")) {
      const card = event.target.closest(".qa-card[data-qa-id]");
      if (card && root.contains(card)) el = card.querySelector('[data-qa-action="open-question"]');
    }
    if (!el) return;
    if (!root || !root.contains(el)) return;
    const action = el.dataset.qaAction;
    if (action === "open-question") {
      event.preventDefault();
      if (QA.openQuestion) QA.openQuestion(el.dataset.id);
    } else if (action === "clear-search") {
      filters.q = ""; saveFilters(); syncSearchUi(root); refresh(root);
      const input = root.querySelector('[data-qa-role="search"]');
      if (input) input.focus();
    } else if (action === "ask") {
      if (QA.openAsk) QA.openAsk();
    } else if (action === "open-mine") {
      if (QA.openMine) QA.openMine(el.dataset.tab);
    } else if (action === "category") {
      const v = el.dataset.value;
      if (v !== "all" && !QA.CATEGORIES.some((c) => c.id === v)) return;
      filters.category = v; saveFilters(); refresh(root);
    } else if (action === "sort") {
      if (!QA.SORTS.some((x) => x.id === el.dataset.value)) return;
      filters.sort = el.dataset.value; saveFilters(); syncSortUi(root); refresh(root);
    }
  });

  // Shown by the app's navigation skeleton stage (see 05-small-render-pieces.js).
  function skeletonQaScreen() {
    const root = document.createElement("section");
    root.className = "qa-screen cm-skeleton-screen";
    root.dataset.page = "qa";
    root.setAttribute("aria-busy", "true");
    const sk = (w, h=12, r=6) => `<i class="qa-sk" style="width:${w};height:${h}px;border-radius:${r}px"></i>`;
    root.innerHTML = `
      <header class="qa-head">
        <h1 class="qa-title">پرسش‌وپاسخ خودرو</h1>
        <p class="qa-sub">سؤال‌های فنی و تخصصی خودرو را بخوانید، تجربه‌ها را ببینید و پاسخ‌ها را دنبال کنید.</p>
        <div class="qa-head-actions cm-qa-sk-actions" aria-hidden="true"><span class="qa-btn qa-btn-primary">${sk("92px",12)}</span><span class="qa-btn">${sk("62px",12)}</span><span class="qa-btn">${sk("52px",12)}</span></div>
      </header>
      <div class="qa-tools">
        <div class="qa-search" role="search" aria-hidden="true"><span class="qa-search-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg></span>${sk("100%",14,8)}</div>
        <div class="qa-chips cm-qa-sk-chips" aria-hidden="true">${[82,72,82,70,76,64].map((w)=>`<span class="qa-chip">${sk(w+"px",10,6)}</span>`).join("")}</div>
        <div class="qa-bar"><span class="qa-count">${sk("78px",11)}</span><div class="qa-sort cm-qa-sk-sort" aria-hidden="true">${[54,66,54].map((w)=>`<span class="qa-sort-btn">${sk(w+"px",10)}</span>`).join("")}</div></div>
      </div>
      <div class="qa-list" data-slot="qa-list" aria-hidden="true">${QA.skeletonCards(4) || Array.from({length:4},()=>`<div class="qa-card qa-skel"><div class="qa-card-main">${sk("38%",11)}${sk("90%",18)}${sk("82%",12)}${sk("58%",12)}</div><div class="qa-card-media">${sk("100%",84,12)}</div></div>`).join("")}</div>
      <p class="qa-note">نسخه نمایشی: سؤال‌ها فقط در همین مرورگر ذخیره می‌شوند و بین کاربران مختلف به اشتراک گذاشته نمی‌شوند.</p>`;
    return root;
  }

  document.addEventListener("click", function (event) {
    const el = event.target.closest("[data-action='openQa']");
    if (!el) return;
    event.preventDefault();
    openQa();
  });

  /* Unread-notification badge on the bottom-dock Q&A item (same look as the messages badge).
     Counts only this browser's local notifications for the current display identity. */
  let badgeBusy = false, badgeAgain = false;
  function refreshDockBadge() {
    const badge = document.querySelector('#bottomDock [data-slot="qa-dock-unread"]');
    if (!badge || !QA.store || !QA.store.unreadCount) return;
    if (badgeBusy) { badgeAgain = true; return; }
    badgeBusy = true;
    QA.store.unreadCount().then((n) => {
      n = Number(n) || 0;
      badge.hidden = n < 1;
      badge.textContent = n > 9 ? "۹+" : new Intl.NumberFormat("fa-IR").format(n);
      const btn = badge.closest(".dock-item");
      if (btn) btn.setAttribute("aria-label", n > 0 ? "پرسش‌وپاسخ، " + new Intl.NumberFormat("fa-IR").format(n) + " اعلان خوانده‌نشده" : "پرسش‌وپاسخ");
    }).catch(() => {}).then(() => { badgeBusy = false; if (badgeAgain) { badgeAgain = false; refreshDockBadge(); } });
  }
  window.addEventListener("marque-qa-changed", refreshDockBadge);
  window.addEventListener("storage", (e) => { if (!e.key || e.key === "marque_qa_v1") refreshDockBadge(); });
  const prevAfterRender = window.afterMarqueRender;
  window.afterMarqueRender = function () { if (typeof prevAfterRender === "function") prevAfterRender.apply(this, arguments); refreshDockBadge(); };
  refreshDockBadge();

  Object.assign(QA, { refreshDockBadge, open: openQa, renderListPage: renderQaListScreen, skeletonScreen: skeletonQaScreen });
})();

function renderQaListScreen() {
  return window.MARQUE_QA && window.MARQUE_QA.renderListPage ? window.MARQUE_QA.renderListPage() : document.createElement("section");
}
