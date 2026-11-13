"use strict";

/*
 * CarMaa Q&A — UI COMPONENTS
 * Pure markup builders (string in, string out). No data access here.
 * All user-provided text goes through esc() before it reaches innerHTML.
 * Styles live in qa.css (every class is prefixed qa-).
 */
(function () {
  const QA = window.MARQUE_QA = window.MARQUE_QA || {};

  const esc = (v) => String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const fa = (n) => new Intl.NumberFormat("fa-IR").format(Number(n) || 0);

  function timeAgo(ts) {
    const diff = Date.now() - Number(ts || 0);
    if (!isFinite(diff) || diff < 0) return "اکنون";
    const m = Math.floor(diff / 60000);
    if (m < 1) return "لحظاتی پیش";
    if (m < 60) return fa(m) + " دقیقه پیش";
    const h = Math.floor(m / 60);
    if (h < 24) return fa(h) + " ساعت پیش";
    const d = Math.floor(h / 24);
    if (d < 30) return fa(d) + " روز پیش";
    try { return new Date(ts).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" }); }
    catch (_) { return ""; }
  }

  const SVG = (inner) => `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICONS = {
    answers: SVG('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12z"/>'),
    views: SVG('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>'),
    helpful: SVG('<path d="M7 11v9H4v-9h3zM7 11l4-7c1.4 0 2.2 1 2 2.4L12.6 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7"/>'),
    check: SVG('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    car: SVG('<path d="M5 16V11l1.8-4.6A2 2 0 0 1 8.7 5h6.6a2 2 0 0 1 1.9 1.4L19 11v5M3 16h18v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2z"/>'),
    help: SVG('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.8M12 17h.01"/>'),
  };
  QA.ICONS = ICONS;

  function statusBadge(q) {
    if (q.isAccepted) return `<span class="qa-status qa-status-accepted">${ICONS.check}پاسخ پذیرفته‌شده</span>`;
    if (q.answerCount > 0) return `<span class="qa-status qa-status-answered">پاسخ داده شده</span>`;
    return `<span class="qa-status qa-status-open">بدون پاسخ</span>`;
  }

  function carInfo(q) {
    const parts = [q.brand, q.model, q.year].filter(Boolean);
    return parts.length ? `<span class="qa-car">${ICONS.car}${esc(parts.join(" "))}</span>` : "";
  }

  function stat(icon, value, label) {
    return `<span class="qa-stat" title="${esc(label)}" aria-label="${esc(label)}: ${fa(value)}">${icon}<b>${fa(value)}</b></span>`;
  }

  /* Escape `text` and wrap every search-token match in <mark>. Positions are
   * found in the length-preserving normalised text (QA.normalizeText), then
   * applied to the original text. Falls back to plain escaping on any doubt. */
  function highlight(text, tokens) {
    const src = String(text == null ? "" : text);
    if (!tokens || !tokens.length) return esc(src);
    const norm = QA.normalizeText(src);
    if (norm.length !== src.length) return esc(src);
    const ranges = [];
    tokens.forEach((t) => {
      if (!t) return;
      let i = norm.indexOf(t);
      while (i !== -1) { ranges.push([i, i + t.length]); i = norm.indexOf(t, i + t.length); }
    });
    if (!ranges.length) return esc(src);
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [ranges[0].slice()];
    for (let k = 1; k < ranges.length; k++) {
      const last = merged[merged.length - 1];
      if (ranges[k][0] <= last[1]) last[1] = Math.max(last[1], ranges[k][1]);
      else merged.push(ranges[k].slice());
    }
    let out = "", pos = 0;
    merged.forEach(([a, b]) => { out += esc(src.slice(pos, a)) + "<mark>" + esc(src.slice(a, b)) + "</mark>"; pos = b; });
    return out + esc(src.slice(pos));
  }

  /* Excerpt for the card: the start of the body, or — when searching and the
   * first match is far down the text — a window around that match. */
  function excerpt(body, tokens) {
    const src = String(body == null ? "" : body).replace(/\s+/g, " ").trim();
    const LIMIT = 200;
    if (src.length <= LIMIT) return highlight(src, tokens);
    let start = 0;
    if (tokens && tokens.length) {
      const norm = QA.normalizeText(src);
      if (norm.length === src.length) {
        const idx = tokens.map((t) => norm.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
        if (idx !== undefined && idx > 100) start = Math.max(0, idx - 50);
      }
    }
    const piece = src.slice(start, start + LIMIT);
    return (start > 0 ? "… " : "") + highlight(piece, tokens) + (start + LIMIT < src.length ? " …" : "");
  }

  // One question card. `q` is a decorated question from QA.store.
  // `tokens` (optional): normalised search words to highlight in title/body.
  function questionCard(q, tokens) {
    // Images live in IndexedDB; the page fills src after painting (QA.hydrateImages in 30-qa-pages.js).
    const img = q.imageId ? `<div class="qa-card-media"><img data-qa-img="${esc(q.imageId)}" alt="" decoding="async"></div>` : "";
    return `
<article class="qa-card qa-card-clickable${q.imageId ? " has-media" : ""}" data-qa-id="${esc(q.id)}">
  <div class="qa-card-main">
    <div class="qa-card-top">
      <span class="qa-cat">${esc(QA.categoryLabel(q.category))}</span>
      ${q.isSample ? `<span class="qa-sample" title="داده نمونه برای نمایش رابط">نمونه</span>` : ""}
      ${statusBadge(q)}
    </div>
    <h2 class="qa-card-title"><a class="qa-card-link" href="#/qa/q/${esc(encodeURIComponent(q.id))}" data-qa-action="open-question" data-id="${esc(q.id)}">${highlight(q.title, tokens)}</a></h2>
    <p class="qa-card-excerpt">${excerpt(q.body, tokens)}</p>
    ${carInfo(q)}
    <div class="qa-card-foot">
      <span class="qa-author"><span class="qa-avatar" aria-hidden="true">${esc((q.authorName || "؟").trim().charAt(0))}</span>${esc(q.authorName || "کاربر")}<i>·</i>${esc(timeAgo(q.createdAt))}</span>
      <span class="qa-stats">
        ${stat(ICONS.answers, q.answerCount, "تعداد پاسخ‌ها")}
        ${stat(ICONS.helpful, q.helpfulCount, "رأی‌های مفید")}
        ${stat(ICONS.views, q.views, "بازدید")}
      </span>
    </div>
  </div>
  ${img}
</article>`;
  }

  /* Skeleton placeholders are shown only the first time the Q&A section is opened (per page load).
     After that every Q&A screen renders straight to its content, with no skeleton anywhere. */
  let skeletonSeen = false;
  const isSkeletonSeen = () => skeletonSeen;
  const markSkeletonSeen = () => { skeletonSeen = true; };

  function skeletonCards(n) {
    let out = "";
    if (skeletonSeen) return out;
    for (let i = 0; i < n; i++) {
      out += `<div class="qa-card qa-skel" aria-hidden="true"><div class="qa-card-main"><i class="qa-sk w40"></i><i class="qa-sk w90 h18"></i><i class="qa-sk w80"></i><i class="qa-sk w60"></i></div></div>`;
    }
    return out;
  }

  // `actionsHtml` is trusted markup built by the caller (buttons with data-qa-action).
  function emptyState(title, text, actionsHtml) {
    return `<div class="qa-empty">${ICONS.help.replace('width="15" height="15"', 'width="34" height="34"')}<h3>${esc(title)}</h3><p>${esc(text)}</p>${actionsHtml ? `<div class="qa-empty-actions">${actionsHtml}</div>` : ""}</div>`;
  }

  /* ---------------- toolbar pieces (search / categories / sort) ---------------- */
  const SEARCH_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>';
  const CLEAR_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function searchBox(value) {
    return `
<div class="qa-search" role="search">
  <span class="qa-search-icon">${SEARCH_ICON}</span>
  <input type="search" class="qa-search-input" data-qa-role="search" value="${esc(value)}" placeholder="جست‌وجو در عنوان و متن سؤال‌ها" aria-label="جست‌وجو در سؤال‌ها" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" maxlength="120">
  <button type="button" class="qa-search-clear" data-qa-action="clear-search" aria-label="پاک کردن جست‌وجو"${value ? "" : " hidden"}>${CLEAR_ICON}</button>
</div>`;
  }

  // counts: { total, byCategory } from QA.store.getStats() (null while loading)
  function categoryChips(active, counts) {
    const chip = (id, label, n) => {
      const on = id === active;
      return `<button type="button" class="qa-chip${on ? " is-active" : ""}" data-qa-action="category" data-value="${esc(id)}" aria-pressed="${on}">${esc(label)}${n == null ? "" : `<em>${fa(n)}</em>`}</button>`;
    };
    let out = chip("all", "همه", counts ? counts.total : null);
    QA.CATEGORIES.forEach((c) => { out += chip(c.id, c.label, counts ? (counts.byCategory[c.id] || 0) : null); });
    return out;
  }

  function sortControl(active) {
    return QA.SORTS.map((s) => {
      const on = s.id === active;
      return `<button type="button" class="qa-sort-btn${on ? " is-active" : ""}" data-qa-action="sort" data-value="${esc(s.id)}" aria-pressed="${on}">${esc(s.label)}</button>`;
    }).join("");
  }

  Object.assign(QA, { esc, fa, timeAgo, highlight, statusBadge, questionCard, skeletonCards, skeletonSeen: isSkeletonSeen, markSkeletonSeen, emptyState, searchBox, categoryChips, sortControl });
})();
