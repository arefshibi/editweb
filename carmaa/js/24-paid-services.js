"use strict";

/* ---------------------------------------------------------------
   PAID AD SERVICES — نردبان / برچسب فوری / تمدید آگهی.
   The owner opens one of their ads (حساب من ← آگهی‌ها ← click) and buys
   a service from the "مدیریت آگهی" sheet.

   Payments are created and verified by the backend. No client-side state
   changes can grant paid features. Service prices here are display-only;
   the server catalog is the billing source of truth.
--------------------------------------------------------------- */

const PAID_SERVICES = {
  ladder: {
    title: "نردبان آگهی",
    price: 50000,
    icon: "trending-up",
    short: "بالا آمدن در صدر آگهی‌ها",
    desc: "با استفاده از ویژگی «نردبان»، آگهی شما تا زمان ثبت آگهی تازه‌تر یا نردبان از سوی کاربران دیگر، در صدر آگهی‌های همان شهر و دسته‌بندی نمایش داده می‌شود و می‌تواند منجر به افزایش بازدید آگهی شود.",
  },
  urgent: {
    title: "برچسب فوری آگهی",
    price: 150000,
    icon: "zap",
    short: "نشان «فوری» به مدت ۳ روز",
    desc: "با فوری کردن آگهی، آگهی شما به مدت ۳ روز با برچسب فوری نشان داده می‌شود و از نظر ظاهری نسبت به سایر آگهی‌های متمایز شده و توجه بیشتری به خود جلب می‌کند. علاوه بر این آگهی در فیلتر «فوری‌ها» هم قرار می‌گیرد.",
  },
  renew: {
    title: "تمدید آگهی",
    price: 100000,
    icon: "refresh-cw",
    short: "۳۰ روز نمایش بیشتر",
    desc: "هر آگهی پس از انتشار ۱ ماه روی دیوار نمایش داده می‌شود و پس از این زمان منقضی و حذف می‌شود. با تمدید آگهی پیش از منقضی شدن، آگهی شما به مدت ۳۰ روز دیگر روی دیوار نمایش داده می‌شود.",
  },
};
const URGENT_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

function mrFormatToman(n) { return faNum(Number(n).toLocaleString("en-US")) + " تومان"; }

// Server-authoritative checkout. The server activates a service only after bank verification.
async function mrPay(serviceKey, listingId) {
  try {
    if (!window.CARMA_API?.enabled) return { ok: false };
    const keyName = `carmaa_checkout:${listingId}:${serviceKey}`;
    let key = "";
    try { key = sessionStorage.getItem(keyName) || ""; } catch (_) {}
    if (!key) {
      key = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      try { sessionStorage.setItem(keyName, key); } catch (_) {}
    }
    const result = await window.CARMA_API.payments.checkout(listingId, serviceKey, key);
    return { ok: result?.status === "paid", status: result?.status || "pending", orderId: result?.orderId, redirectUrl: result?.redirectUrl, keyName };
  } catch (error) {
    showToast(error?.message || "پرداخت از سمت سرور در دسترس نیست.");
    return { ok: false, error: true };
  }
}

// One-line status shown under a service row in the manage sheet.
function mrServiceHint(serviceKey, listing) {
  const s = PAID_SERVICES[serviceKey];
  if (serviceKey === "urgent" && isListingUrgent(listing)) {
    const days = Math.max(1, Math.ceil((listing.urgentUntil - Date.now()) / 86400000));
    return `فعال — ${faNum(days)} روز مانده`;
  }
  if (serviceKey === "renew") {
    return "آگهی منقضی شده — ۳۰ روز دیگر تمدید کنید";
  }
  return s.short;
}
