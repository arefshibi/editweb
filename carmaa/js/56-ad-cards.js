/* CarMaa — admin-managed ad cards shown between listing cards.
   Cards come from GET /api/v1/ad-cards and are inserted into the listings page
   after every N listing cards. All ad text is set via textContent (never innerHTML). */
(function () {
  'use strict';
  const API = window.CARMA_API_BASE || '/api/v1';
  let ads = [];
  let loadedAt = 0;
  let loading = null;
  let scheduled = false;
  const viewed = new Set();

  const safeUrl = (u) => (typeof u === 'string' && (/^https:\/\/[^\s]+$/i.test(u) || /^\/(?!\/)[^\s]*$/.test(u))) ? u : '';

  function load() {
    if (loading) return loading;
    if (loadedAt && Date.now() - loadedAt < 60000) return Promise.resolve();
    loading = fetch(API + '/ad-cards', { credentials: 'include', headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { ads = Array.isArray(d.items) ? d.items : []; loadedAt = Date.now(); })
      .catch(() => { ads = []; })
      .finally(() => { loading = null; schedule(); });
    return loading;
  }

  function track(id, type) {
    try {
      fetch(API + '/ad-cards/' + encodeURIComponent(id) + '/event', {
        method: 'POST', credentials: 'include', keepalive: true,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }),
      }).catch(() => {});
    } catch (_) {}
  }

  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const id = e.target.dataset.adId;
      io.unobserve(e.target);
      if (id && !viewed.has(id)) { viewed.add(id); track(id, 'view'); }
    });
  }, { threshold: 0.5 }) : null;

  function build(ad, key) {
    const href = safeUrl(ad.linkUrl);
    const root = document.createElement(href ? 'a' : 'div');
    root.className = 'adc';
    root.dataset.adCard = '1';
    root.dataset.adKey = key;
    root.dataset.adId = ad.id;
    if (href) {
      root.href = href;
      if (/^https:/i.test(href)) { root.target = '_blank'; root.rel = 'noopener noreferrer sponsored'; }
      root.addEventListener('click', () => track(ad.id, 'click'));
    }
    const img = safeUrl(ad.imageUrl);
    if (img) {
      const ph = document.createElement('div'); ph.className = 'adc-photo';
      const i = document.createElement('img');
      i.src = img; i.alt = ''; i.loading = 'lazy'; i.decoding = 'async'; i.referrerPolicy = 'no-referrer';
      ph.append(i); root.append(ph);
    }
    if (ad.badgeText) { const b = document.createElement('span'); b.className = 'adc-badge'; b.textContent = ad.badgeText; root.append(b); }
    const body = document.createElement('div'); body.className = 'adc-body';
    const h = document.createElement('h3'); h.className = 'adc-title'; h.dir = 'auto'; h.textContent = ad.title || '';
    body.append(h);
    if (ad.description) { const p = document.createElement('p'); p.className = 'adc-desc'; p.dir = 'auto'; p.textContent = ad.description; body.append(p); }
    if (href && ad.ctaText) { const c = document.createElement('span'); c.className = 'adc-cta'; c.textContent = ad.ctaText; body.append(c); }
    root.append(body);
    if (io) io.observe(root);
    return root;
  }

  // slots: map "after the Nth listing card" -> [{ad, key}]
  function slotsFor(count) {
    const map = new Map();
    ads.forEach((ad) => {
      const pos = Number(ad.position) || 4;
      const rep = Number(ad.repeatEvery) || 0;
      for (let n = pos, k = 0; n <= count && k < 40; k++, n = rep ? n + rep : count + 1) {
        if (!map.has(n)) map.set(n, []);
        map.get(n).push({ ad, key: ad.id + ':' + k });
      }
    });
    return map;
  }

  function reconcile(container) {
    const cards = Array.from(container.children).filter((c) => c.classList && c.classList.contains('xcd-wrap'));
    const slots = slotsFor(cards.length);
    const wanted = new Set();
    slots.forEach((list) => list.forEach((s) => wanted.add(s.key)));
    container.querySelectorAll(':scope > [data-ad-card]').forEach((n) => { if (!wanted.has(n.dataset.adKey)) n.remove(); });
    cards.forEach((card, idx) => {
      const list = slots.get(idx + 1);
      if (!list) return;
      let anchor = card;
      let sib = card.nextElementSibling;
      const have = new Set();
      while (sib && sib.dataset && sib.dataset.adCard) { have.add(sib.dataset.adKey); anchor = sib; sib = sib.nextElementSibling; }
      list.forEach((s) => {
        if (have.has(s.key)) return;
        const existing = container.querySelector(':scope > [data-ad-key="' + s.key + '"]');
        const node = existing || build(s.ad, s.key);
        anchor.after(node); anchor = node;
      });
    });
  }

  function scan() {
    scheduled = false;
    const containers = document.querySelectorAll('[data-page="listings"] [data-slot="cards"].explore-list');
    if (!containers.length) return;
    if (!ads.length) { if (!loadedAt) load(); else containers.forEach((c) => c.querySelectorAll(':scope > [data-ad-card]').forEach((n) => n.remove())); return; }
    containers.forEach(reconcile);
    if (Date.now() - loadedAt > 60000) load();
  }

  function schedule() { if (scheduled) return; scheduled = true; requestAnimationFrame(scan); }

  const root = document.getElementById('app') || document.body;
  new MutationObserver((muts) => {
    for (const m of muts) {
      const t = m.target;
      if (t.nodeType === 1 && (t.matches('.explore-list') || (t.closest && t.closest('[data-page="listings"]')))) { schedule(); return; }
      for (const n of m.addedNodes) {
        if (n.nodeType === 1 && (n.matches('[data-page="listings"]') || n.querySelector('[data-page="listings"]'))) { schedule(); return; }
      }
    }
  }).observe(root, { childList: true, subtree: true });
  schedule();
})();
