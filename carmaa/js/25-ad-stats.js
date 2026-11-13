"use strict";

/* ---------------------------------------------------------------
   AD STATS — "آمار آگهی" popup opened from مدیریت آگهی (حساب من).
   Totals (بازدید / کلیک / نشان‌شده) + a per-day bar chart for the last
   7 or 30 days with Persian dates. Counts come from the daily history
   kept by js/02-helpers.js (mrStats).
   NOTE: history is stored in this browser only; visits from other
   devices are not counted until the counters live on a server.
--------------------------------------------------------------- */

const AD_STAT_METRICS = [
  { key: "views", label: "بازدید" },
  { key: "clicks", label: "کلیک" },
  { key: "likes", label: "نشان‌شده" },
];

function mrNiceTop(max) {
  if (max <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 4, 5, 8, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

function mrStatsSeries(id, metric, days) {
  const server = window.CARMA_AD_STATS_CACHE && window.CARMA_AD_STATS_CACHE[id];
  const hist = (mrStats[id] || {});
  const out = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const ts = now - i * LISTING_DAY_MS;
    const rec = hist[mrDayKey(ts)] || {};
    let value = rec[metric] || 0;
    if (server && Array.isArray(server.series)) {
      const dayKey = new Date(ts).toISOString().slice(0,10);
      const type = metric === 'views' ? 'view' : metric === 'clicks' ? 'contact_click' : 'favorite';
      value = server.series.filter((r) => String(r.day).slice(0,10) === dayKey && r.event_type === type).reduce((n,r)=>n+Number(r.count||0),0);
    }
    out.push({ ts, v: Math.max(0, value) });
  }
  return out;
}

function mrFaDate(ts, withYear) {
  try {
    return new Date(ts).toLocaleDateString("fa-IR", withYear ? { year: "numeric", month: "long", day: "numeric" } : { month: "short", day: "numeric" });
  } catch (_) { return mrDayKey(ts); }
}

function mrBuildAdStatsBody(m) {
  const entry = state.myListings.find((x) => x.id === m.id);
  const server = window.CARMA_AD_STATS_CACHE && window.CARMA_AD_STATS_CACHE[m.id];
  const stats = server ? { views:Number(server.views||0), clicks:Number(server.totals?.contact_click||0), likes:Number(server.totals?.favorite||0) } : (entry ? getListingStats(entry.listing.id) : { views: 0, clicks: 0, likes: 0 });
  const metric = AD_STAT_METRICS.some((x) => x.key === m.metric) ? m.metric : "views";
  const days = m.range === 30 ? 30 : 7;
  const series = mrStatsSeries(m.id, metric, days);
  const total = series.reduce((a, b) => a + b.v, 0);
  const mLabel = AD_STAT_METRICS.find((x) => x.key === metric).label;

  const wrap = document.createElement("div");
  wrap.className = "adStats";

  const tiles = document.createElement("div");
  tiles.className = "adStats-tiles";
  AD_STAT_METRICS.forEach((mt) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "adStats-tile" + (mt.key === metric ? " is-active" : "");
    b.dataset.action = "adStatsMetric";
    b.dataset.metric = mt.key;
    const n = document.createElement("strong"); n.textContent = faNum(stats[mt.key] || 0);
    const l = document.createElement("span"); l.textContent = mt.label;
    b.append(n, l);
    tiles.appendChild(b);
  });

  const range = document.createElement("div");
  range.className = "adStats-range";
  [[7, "۷ روز گذشته"], [30, "۳۰ روز گذشته"]].forEach(([d, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "adStats-range-btn" + (d === days ? " is-active" : "");
    b.dataset.action = "adStatsRange";
    b.dataset.range = String(d);
    b.textContent = label;
    range.appendChild(b);
  });

  // ---- chart (SVG bars) ----
  const W = 320, H = 170, padL = 28, padR = 6, padT = 10, padB = 24;
  const cw = W - padL - padR, ch = H - padT - padB;
  const top = mrNiceTop(Math.max(0, ...series.map((s) => s.v)));
  const step = cw / days, bw = Math.max(3, step * (days === 7 ? 0.56 : 0.62));
  let g = "";
  for (let i = 0; i <= 4; i++) {
    const y = padT + ch - (ch * i) / 4;
    g += `<line class="adStats-grid" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/>` +
         `<text class="adStats-ax" x="${padL - 5}" y="${y + 3.5}" text-anchor="end">${faNum(Math.round((top * i) / 4))}</text>`;
  }
  series.forEach((s, i) => {
    const x = padL + i * step + (step - bw) / 2;
    const h = s.v > 0 ? Math.max(2, (s.v / top) * ch) : 0;
    const y = padT + ch - h;
    const sel = m.sel === i;
    g += `<g data-action="adStatsSel" data-i="${i}" class="adStats-bar${sel ? " is-sel" : ""}">` +
         `<rect x="${padL + i * step}" y="${padT}" width="${step}" height="${ch + padB - 4}" fill="transparent"/>` +
         (h ? `<rect class="adStats-rect" x="${x}" y="${y}" width="${bw}" height="${h}" rx="${Math.min(4, bw / 2)}"/>` : `<rect class="adStats-zero" x="${x}" y="${padT + ch - 1.5}" width="${bw}" height="1.5" rx="0.75"/>`) +
         `<title>${mrFaDate(s.ts, true)}: ${faNum(s.v)} ${mLabel}</title></g>`;
    const showLabel = days === 7 || i % 5 === days % 5 || i === days - 1 && false;
    if (days === 7 ? true : (days - 1 - i) % 5 === 0) {
      g += `<text class="adStats-ax" x="${padL + i * step + step / 2}" y="${H - 7}" text-anchor="middle">${mrFaDate(s.ts, false)}</text>`;
    }
  });
  const chart = document.createElement("div");
  chart.className = "adStats-chart";
  setDynamicHTML(chart, `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="نمودار ${mLabel} به تفکیک روز" style="width:100%;display:block">${g}</svg>`);

  const readout = document.createElement("div");
  readout.className = "adStats-readout";
  if (m.sel != null && series[m.sel]) {
    readout.textContent = `${mrFaDate(series[m.sel].ts, true)}: ${faNum(series[m.sel].v)} ${mLabel}`;
  } else {
    readout.textContent = `مجموع ${faNum(days)} روز گذشته: ${faNum(total)} ${mLabel}`;
  }
  const hint = document.createElement("div");
  hint.className = "adStats-hint";
  hint.textContent = server ? "آمار از رویدادهای ثبت‌شده در سرور تهیه شده است؛ آمار بازدید کل شامل بازدیدهای ثبت‌شده از این آگهی است." : "برای دیدن عدد هر روز روی ستون آن ضربه بزنید.";

  const back = document.createElement("button");
  back.type = "button"; back.className = "manageAd-reject-btn"; back.dataset.action = "adStatsBack"; back.dataset.id = m.id; back.textContent = "بازگشت";
  back.style.width = "100%";

  wrap.append(tiles, range, chart, readout, hint, back);
  return wrap;
}
