// توابع خالص «بازار همکاران» (بدون وابستگی به دیتابیس) تا قابل تست باشند.
export const DEAL_TYPES = ['cash', 'exchange', 'installment', 'consignment'];
export const REVIEW_TAGS = ['fast', 'honest', 'fair_price', 'good_docs', 'professional', 'late', 'unresponsive'];
export const REPORT_REASONS = ['fake', 'sold', 'spam', 'abuse', 'other'];
export const SORTS = {
  new: 'p.created_at DESC',
  urgent: 'p.urgent DESC, p.created_at DESC',
  price_asc: 'p.price_toman ASC NULLS LAST, p.created_at DESC',
  price_desc: 'p.price_toman DESC NULLS LAST, p.created_at DESC',
  expiring: 'p.expires_at ASC',
};

export const escapeLike = (s) => String(s).replace(/[\\%_]/g, (c) => `\\${c}`);

// سطح اعتبار: بر پایهٔ تعداد همکارِ «متفاوت» در معاملات تأییدشدهٔ دو طرف + میانگین امتیاز (جلوگیری از معاملهٔ صوری با یک شریک).
export function tierFor({ partners = 0, ratingAvg = 0, ratingCount = 0 } = {}) {
  const good = (min) => ratingCount < 3 || ratingAvg >= min;
  if (partners >= 15 && ratingCount >= 5 && ratingAvg >= 4.6) return { key: 'elite', label: 'همکار برتر', level: 4 };
  if (partners >= 5 && good(4.2)) return { key: 'pro', label: 'همکار حرفه‌ای', level: 3 };
  if (partners >= 1 && good(3.5)) return { key: 'active', label: 'همکار فعال', level: 2 };
  return { key: 'new', label: 'تازه‌وارد', level: 1 };
}

export function mapReputation(r) {
  const deals = Number(r.deals || 0), partners = Number(r.partners || 0);
  const ratingCount = Number(r.rating_count || 0);
  const ratingAvg = r.rating_avg == null ? null : Number(r.rating_avg);
  const received = Number(r.offers_received || 0), answered = Number(r.offers_answered || 0);
  const responseRate = received >= 3 ? Math.round((answered / received) * 100) : null;
  return {
    deals, partners, ratingAvg, ratingCount,
    responseRate,
    avgResponseHours: r.avg_response_hours == null ? null : Number(r.avg_response_hours),
    responsive: responseRate != null && responseRate >= 80,
    tier: tierFor({ partners, ratingAvg: ratingAvg || 0, ratingCount }),
  };
}

const eq = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
// امتیاز هم‌خوانی ۰ تا ۱۰۰ بین دو آگهی (یک «دارم» و یک «مشتری دارم»)
export function matchScore(a, b) {
  if (!a || !b || a.kind === b.kind || !eq(a.make, b.make)) return 0;
  let s = 50;
  if (a.model && b.model) { if (eq(a.model, b.model)) s += 20; else return 0; } else s += 5;
  const af = a.yearFrom ?? 0, at = a.yearTo ?? 9999, bf = b.yearFrom ?? 0, bt = b.yearTo ?? 9999;
  if (af > bt || bf > at) return 0;
  if ((a.yearFrom || a.yearTo) && (b.yearFrom || b.yearTo)) s += 10;
  if (a.city && b.city) s += eq(a.city, b.city) ? 10 : 0;
  const have = a.kind === 'have' ? a : b, want = a.kind === 'have' ? b : a;
  if (have.priceToman != null && want.priceToman != null) {
    if (have.priceToman <= want.priceToman) s += 10;
    else if (have.priceToman <= want.priceToman * 1.05 || have.priceNegotiable) s += 4;
    else s -= 15;
  }
  return Math.max(1, Math.min(100, s));
}

export function normalizeDeals(list) {
  const out = [];
  for (const v of Array.isArray(list) ? list : []) if (DEAL_TYPES.includes(v) && !out.includes(v)) out.push(v);
  return out;
}

// سال‌های شمسی (زیر ۱۷۰۰) به میلادی تبدیل می‌شوند تا همهٔ آگهی‌ها و موجودی سایت (میلادی) قابل مقایسه باشند.
export const toGregorian = (y) => (y == null ? null : y < 1700 ? y + 621 : y);

export const cleanText = (v, n) => { const s = typeof v === 'string' ? v.trim().slice(0, n) : ''; return s || null; };
export const cleanInt = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : null; };
