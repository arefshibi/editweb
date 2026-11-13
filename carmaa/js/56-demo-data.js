"use strict";
/*
 * CarMaa — داده‌ی نمایشی (فرضی)
 * آگهی‌ها و نمایشگاه‌های ساختگی برای دیدن ظاهر سایت وقتی هنوز داده‌ی واقعی کم است.
 * - اگر تعداد آگهی‌های واقعی کمتر از ۱۲ باشد، آگهی‌های نمایشی اضافه می‌شوند؛ از ۱۲ به بالا خودکار حذف می‌شوند.
 * - اگر نمایشگاه‌های واقعی کمتر از ۶ باشد، نمایشگاه‌های نمایشی اضافه می‌شوند.
 * - برای خاموش‌کردن کامل: قبل از بارگذاری این فایل بنویس  window.CARMA_DEMO_DATA = false
 */
(function () {
  if (window.CARMA_DEMO_DATA === false) return;
  const ORIGIN = (typeof location !== "undefined" && location.origin && location.origin !== "null") ? location.origin : "";
  const SR = [
    { u: "arya.gallery", n: "نمایشگاه آریا", c: "دزفول", f: 1840, d: "بیش از یک دهه تجربه در خرید و فروش خودروهای صفر و کارکرده؛ کارشناسی رایگان و تحویل همان روز." },
    { u: "sepid.motors", n: "نمایشگاه سپید", c: "اندیمشک", f: 1260, d: "فقط خودروهای تمیز و بدون رنگ‌شدگی، با گزارش کارشناسی مکتوب." },
    { u: "avang.cars", n: "نمایشگاه آوانگ", c: "اهواز", f: 2410, d: "بزرگ‌ترین مجموعه‌ی خودروهای شاسی‌بلند و کراس‌اوور در اهواز." },
    { u: "mehrafarin.auto", n: "نمایشگاه مهرآفرین", c: "آبادان", f: 980, d: "خرید و فروش اقساطی، تعویض با قیمت روز و مشاوره‌ی رایگان." },
    { u: "kaman.showroom", n: "نمایشگاه کمان", c: "خرمشهر", f: 730, d: "خودروهای کم‌کارکرد و بی‌خط‌وخش با ضمانت اصالت کیلومتر." },
    { u: "niloofar.motors", n: "نمایشگاه نیلوفر", c: "سوسنگرد", f: 540, d: "مجموعه‌ای از اقتصادی‌ترین و پرفروش‌ترین خودروهای بازار." },
    { u: "hirad.cars", n: "نمایشگاه هیراد", c: "شوشتر", f: 1120, d: "تخصصی خودروهای چینی و کراس‌اوور، با خدمات پس از فروش." },
    { u: "kimia.motors", n: "نمایشگاه کیمیا", c: "بهبهان", f: 860, d: "خودروهای برقی و هیبریدی و صفر کیلومتر با تحویل فوری." },
  ].map((s, i) => ({ id: "demo-sr-" + (i + 1), username: s.u, name: s.n, city: s.c, followers: s.f, description: s.d, avatar: ORIGIN + "/assets/showrooms/avatar-" + (i + 1) + ".webp", banner: ORIGIN + "/assets/showrooms/banner-" + (i + 1) + ".webp" }));

  // [عکس, برند, عنوان لاتین (با سال), عنوان آگهی, سال, کیلومتر (0 = صفر), قیمت (تومان), شهر, گیربکس, سوخت, رنگ, نمایشگاه (۰ = شخصی), ویژه, اقساطی, بازدید, چند دقیقه پیش]
  const L = [
    [1, "سیتروئن", "2023 Citroen C3 Aircross", "سیتروئن C3 ایرکراس ۲۰۲۳ فول", 2023, 14000, 1950000000, "", "اتوماتیک", "بنزینی", "سفید", 1, 1, 1, 1480, 8],
    [5, "کی ام سی", "2023 KMC T8", "کی ام سی T8 دوکابین ۱۴۰۲", 2023, 22000, 2350000000, "", "اتوماتیک", "دیزلی", "مشکی", 2, 1, 0, 1320, 25],
    [6, "سیتروئن", "2022 Citroen C3", "سیتروئن C3 ۲۰۲۲ تمیز", 2022, 31000, 1250000000, "", "اتوماتیک", "بنزینی", "سفید", 3, 0, 1, 640, 70],
    [7, "خودروهای چینی", "2023 Jetour X70", "جتور X70 ۲۰۲۳ صفر کیلومتر", 2023, 0, 2750000000, "", "اتوماتیک", "بنزینی", "سفید", 3, 0, 1, 910, 130],
    [8, "هیوندا", "2016 Hyundai Elantra", "هیوندا النترا ۲۰۱۶ بدون رنگ", 2016, 96000, 1650000000, "شوشتر", "اتوماتیک", "بنزینی", "سفید", 0, 0, 0, 420, 210],
    [9, "خودروهای چینی", "2022 Changan CS75", "چانگان CS75 ۲۰۲۲ فول", 2022, 38000, 2480000000, "", "اتوماتیک", "بنزینی", "مشکی", 4, 0, 1, 780, 340],
    [10, "هیوندا", "2015 Hyundai Santa Fe", "هیوندا سانتافه ۲۰۱۵ شاسی‌بلند", 2015, 112000, 2150000000, "بهبهان", "اتوماتیک", "بنزینی", "سفید", 0, 0, 0, 380, 480],
    [11, "ام جی", "2023 MG GT", "ام‌جی GT ۲۰۲۳ کم‌کارکرد", 2023, 9000, 2050000000, "", "اتوماتیک", "بنزینی", "سفید", 5, 1, 0, 1050, 620],
    [13, "سیتروئن", "2021 Citroen C5 Aircross", "سیتروئن C5 ایرکراس ۲۰۲۱ سانروف", 2021, 47000, 2900000000, "", "اتوماتیک", "بنزینی", "سفید", 1, 0, 0, 560, 900],
    [14, "تویوتا", "2020 Toyota Corolla", "تویوتا کرولا ۲۰۲۰ تک‌صاحب", 2020, 54000, 2300000000, "", "اتوماتیک", "بنزینی", "سفید", 2, 0, 1, 870, 1300],
    [15, "هیوندا", "2021 Hyundai Accent", "هیوندا اکسنت ۲۰۲۱ فول", 2021, 36000, 1350000000, "", "اتوماتیک", "بنزینی", "سفید", 6, 0, 1, 520, 1900],
    [16, "هیوندا", "2024 Hyundai Elantra", "هیوندا النترا ۲۰۲۴ صفر کیلومتر", 2024, 0, 3150000000, "", "اتوماتیک", "بنزینی", "سبز سیرابی", 3, 1, 0, 1710, 2600],
    [17, "میتسوبیشی", "2023 Mitsubishi Eclipse Cross", "میتسوبیشی اکلیپس کراس ۲۰۲۳", 2023, 15000, 3400000000, "", "اتوماتیک", "بنزینی", "مشکی", 2, 0, 0, 690, 3500],
    [19, "رنو", "2012 Renault Koleos", "رنو کولئوس ۲۰۱۲ اقتصادی", 2012, 148000, 920000000, "آبادان", "اتوماتیک", "بنزینی", "سفید", 0, 0, 0, 260, 4800],
    [20, "خودروهای چینی", "2023 Chery Tiggo 8", "چری تیگو ۸ ۲۰۲۳ هفت‌نفره", 2023, 21000, 2950000000, "", "اتوماتیک", "بنزینی", "نقره‌ای", 7, 1, 1, 1240, 6500],
    [2, "خودروهای چینی", "2023 BYD Seal", "بی‌وای‌دی سیل ۲۰۲۳ برقی", 2023, 8000, 3850000000, "", "اتوماتیک", "برقی", "مشکی", 8, 0, 0, 990, 8200],
  ];

  const fa = (n) => Number(n).toLocaleString("fa-IR");
  const listings = L.map((r, i) => {
    const sr = r[11] ? SR[r[11] - 1] : null;
    const zero = !r[5];
    return {
      id: "demo-" + (i + 1), brand: r[1], title: r[2], adTitle: r[3], year: r[4],
      price: fa(r[6]) + " تومان", priceAmount: r[6], negotiable: false,
      miles: zero ? "صفر کیلومتر" : fa(r[5]) + " کیلومتر", mileageKm: r[5], mileageType: zero ? "zero" : "used",
      phone: "", color: r[10], trim: "full", engineType: "", fuelType: r[9], transmission: r[8],
      interiorColor: "", driveTrain: "", cylinders: "", engineVolume: "", deliveryTime: "",
      documentType: "سند تک‌برگ", powerOfAttorneyStatus: "", insuranceStatus: "", privateSeller: !sr,
      city: sr ? sr.city : r[7], region: "", mapPos: null,
      description: "آگهی نمایشی — این آگهی فرضی است و فقط برای نمایش ظاهر سایت ساخته شده.",
      photos: [ORIGIN + "/images/listings/car-" + String(r[0]).padStart(2, "0") + ".webp"], paintedParts: [], bodyConditionRating: 8,
      tradeIn: false, acceptsOffers: false, minimumOfferToman: null, status: "listed",
      showroomId: sr ? sr.id : null, sellerType: sr ? "dealer" : "personal", sellerId: sr ? sr.id : "demo-user-" + (i + 1), sellerUserId: null,
      showroomName: sr ? sr.name : "", showroomSlug: sr ? sr.username : "",
      createdAt: Date.now() - r[15] * 60000, updatedAt: Date.now() - r[15] * 60000,
      viewCount: r[14], promoted: !!r[12], installment: !!r[13], _source: "demo",
    };
  });
  const showrooms = SR.map((s) => ({
    id: s.id, name: s.name, slug: s.username, city: s.city, status: "approved", description: s.description,
    logo_url: s.avatar, banner_url: s.banner, follower_count: s.followers,
    published_listing_count: listings.filter((l) => l.showroomId === s.id).length, tags: [], _source: "demo",
  }));

  function apply() {
    try {
      if (typeof LISTINGS !== "undefined" && Array.isArray(LISTINGS)) {
        const real = LISTINGS.filter((l) => l && l._source !== "demo").length;
        const hasDemo = LISTINGS.some((l) => l && l._source === "demo");
        if (real >= 12) { if (hasDemo) { for (let i = LISTINGS.length - 1; i >= 0; i--) if (LISTINGS[i]._source === "demo") LISTINGS.splice(i, 1); } }
        else if (!hasDemo) LISTINGS.push(...listings.map((l) => ({ ...l })));
      }
      const cur = Array.isArray(window.CARMA_SERVER_SHOWROOMS) ? window.CARMA_SERVER_SHOWROOMS : [];
      const realSr = cur.filter((s) => s && s._source !== "demo");
      if (realSr.length >= 6) { if (cur.length !== realSr.length) window.CARMA_SERVER_SHOWROOMS = realSr; }
      else if (!cur.some((s) => s && s._source === "demo")) window.CARMA_SERVER_SHOWROOMS = [...realSr, ...showrooms.map((s) => ({ ...s }))];
    } catch (e) { console.warn("demo data skipped", e); }
  }
  window.CARMA_DEMO = { apply, listings, showrooms };
  apply();
})();
