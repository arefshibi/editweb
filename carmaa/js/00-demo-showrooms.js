"use strict";

/*
 * CarMaa — نمایشگاه‌های نمایشی (کاملاً فرضی)
 * نام، شهر، آدرس، توضیح، لوگو و بنر همه ساختگی‌اند و شبیه برند یا ماشین واقعی نیستند.
 * هر نمایشگاه به‌جای «نمایندگی مجاز برند» روی همان شناسه‌ی قبلی (brand:<برند>) سوار می‌شود،
 * پس لیست نمایشگاه‌ها، صفحه‌ی نمایشگاه، آگهی‌ها و استوری‌ها همه یک نام و یک پروفایل را نشان می‌دهند.
 * بنر: برای هر نمایشگاه (نمایشی یا ثبت‌شده) اگر بنر انتخابی نداشته باشد، یکی از طرح‌های ساخته‌شده
 * به‌صورت تصادفی انتخاب و برای همیشه (در همین مرورگر) نگه داشته می‌شود.
 */
const DEMO_BRAND_ORDER = ["بنز", "پورشه", "BMW", "آئودی", "مازراتی", "لند روور", "کیا", "فورد", "هیوندا", "تویوتا", "شورلت", "دودج", "کادیلاک", "جیپ", "خودروهای چینی"];

const DEMO_SHOWROOMS = [
  { username: "arya.gallery", name: "نمایشگاه آریا", short: "آریا", city: "دزفول", hue: 262, shape: 0,
    address: "دزفول، بلوار نمونه، نبش کوچه‌ی سوم، پلاک ۱۴", hours: "همه‌روزه ۹ تا ۲۰", since: "۱۳۹۳",
    tagline: "خرید مطمئن، قیمت شفاف",
    description: "بیش از یک دهه تجربه در خرید و فروش خودروهای صفر و کارکرده؛ کارشناسی رایگان قبل از معامله و تحویل در همان روز.",
    tags: ["کارشناسی_رایگان", "تحویل_فوری", "اقساطی"], caption: "تخفیف ویژه‌ی این هفته" },
  { username: "sepid.motors", name: "نمایشگاه سپید", short: "سپید", city: "اندیمشک", hue: 200, shape: 1,
    address: "اندیمشک، میدان نمونه، ابتدای بلوار گلشن‌نما، پلاک ۸", hours: "شنبه تا پنجشنبه ۹ تا ۱۹", since: "۱۳۹۷",
    tagline: "ماشین تمیز، معامله‌ی بی‌دغدغه",
    description: "فقط خودروهای تمیز و بدون رنگ‌شدگی؛ همه‌ی ماشین‌ها با گزارش کارشناسی مکتوب و ضمانت‌نامه‌ی اصالت کیلومتر عرضه می‌شوند.",
    tags: ["بدون_رنگ", "ضمانت_کیلومتر", "معاوضه"], caption: "رسیدن محموله‌ی جدید" },
  { username: "avang.cars", name: "نمایشگاه آوانگ", short: "آوانگ", city: "اهواز", hue: 24, shape: 2,
    address: "اهواز، بلوار نمونه، روبه‌روی پارک مرکزی، پلاک ۲۱", hours: "همه‌روزه ۱۰ تا ۲۱", since: "۱۳۹۰",
    tagline: "از اهواز تا سراسر کشور",
    description: "تخصص در خودروهای شاسی‌بلند و وانت؛ ارسال به سراسر کشور با حمل‌ونقل بیمه‌شده و پشتیبانی بعد از فروش.",
    tags: ["شاسی_بلند", "ارسال_به_شهرستان", "پشتیبانی"], caption: "آماده‌ی تحویل فوری" },
  { username: "mehrafarin.auto", name: "نمایشگاه مهرآفرین", short: "مهرآفرین", city: "آبادان", hue: 330, shape: 3,
    address: "آبادان، خیابان نمونه، کنار میدان اصلی، پلاک ۶", hours: "شنبه تا پنجشنبه ۹ تا ۲۰", since: "۱۳۹۸",
    tagline: "اقساط ساده، خرید راحت",
    description: "فروش نقد و اقساطی با شرایط منعطف و بدون سخت‌گیری؛ مشاوره‌ی خرید رایگان برای خانواده‌ها و خریداران اول.",
    tags: ["فروش_اقساطی", "مشاوره_رایگان", "خرید_اول"], caption: "فروش اقساطی با شرایط ویژه" },
  { username: "kaman.showroom", name: "نمایشگاه کمان", short: "کمان", city: "خرمشهر", hue: 150, shape: 1,
    address: "خرمشهر، بلوار نمونه، مجتمع تجاری شمالی، واحد ۱۲", hours: "همه‌روزه ۹ تا ۱۹", since: "۱۳۹۵",
    tagline: "بازدید حضوری، تصمیم مطمئن",
    description: "هر روز می‌توانید ماشین را از نزدیک ببینید و تست کنید؛ قیمت‌ها شفاف است و بدون هزینه‌ی پنهان.",
    tags: ["تست_حضوری", "قیمت_شفاف", "بدون_کارمزد"], caption: "بازدید حضوری هر روز" },
  { username: "niloofar.motors", name: "نمایشگاه نیلوفر", short: "نیلوفر", city: "سوسنگرد", hue: 48, shape: 0,
    address: "سوسنگرد، خیابان نمونه، پاساژ شمالی، طبقه‌ی همکف، پلاک ۳۳", hours: "همه‌روزه ۱۰ تا ۲۲", since: "۱۴۰۰",
    tagline: "انتخاب‌های خاص برای سلیقه‌های خاص",
    description: "مجموعه‌ای دست‌چین از خودروهای کم‌کارکرد و کلکسیونی؛ هر ماشین با عکس‌های کامل و سابقه‌ی نگهداری ثبت شده است.",
    tags: ["کم_کارکرد", "کلکسیونی", "دست_چین"], caption: "نمایشگاه ما را دنبال کنید" },
  { username: "hirad.cars", name: "نمایشگاه هیراد", short: "هیراد", city: "شوشتر", hue: 12, shape: 2,
    address: "شوشتر، بلوار نمونه، چهارراه دوم، پلاک ۱۹", hours: "شنبه تا پنجشنبه ۹ تا ۲۰", since: "۱۳۹۲",
    tagline: "اعتماد ساخته می‌شود",
    description: "خرید، فروش و معاوضه‌ی انواع سواری با کمترین دردسر؛ قرارداد رسمی و انتقال سند در همان روز معامله.",
    tags: ["معاوضه", "انتقال_سند", "قرارداد_رسمی"], caption: "معاوضه با بهترین قیمت" },
  { username: "kimia.motors", name: "نمایشگاه کیمیا", short: "کیمیا", city: "بهبهان", hue: 285, shape: 3,
    address: "بهبهان، بلوار نمونه، ضلع غربی میدان مرکزی، پلاک ۵۲", hours: "همه‌روزه ۹ تا ۲۱", since: "۱۳۹۶",
    tagline: "کیفیت را تجربه کنید",
    description: "ماشین‌های انتخاب‌شده با چک‌لیست ۸۰ مرحله‌ای کارشناسی؛ اگر موردی پیدا شود، همان‌جا شفاف به شما گفته می‌شود.",
    tags: ["چک_لیست", "کارشناسی", "شفافیت"], caption: "کارشناسی دقیق، قیمت منصفانه" },
  { username: "farno.auto", name: "نمایشگاه فرنو", short: "فرنو", city: "ماهشهر", hue: 175, shape: 1,
    address: "ماهشهر، بلوار نمونه، نرسیده به میدان اول، پلاک ۴۰", hours: "همه‌روزه ۹ تا ۲۱", since: "۱۳۹۹",
    tagline: "جدیدترین‌ها، اول از همه",
    description: "هر هفته ماشین‌های تازه‌وارد را اول از همه اینجا ببینید؛ امکان ثبت درخواست خرید برای مدل‌های دلخواه شما.",
    tags: ["تازه_وارد", "سفارش_خرید", "نو"], caption: "تازه‌ترین‌ها رسید" },
  { username: "arghavan.gallery", name: "نمایشگاه ارغوان", short: "ارغوان", city: "ایذه", hue: 318, shape: 0,
    address: "ایذه، خیابان نمونه، مجتمع تجاری مرکزی، طبقه‌ی اول، واحد ۹", hours: "شنبه تا پنجشنبه ۹ تا ۱۹", since: "۱۳۹۴",
    tagline: "خانوادگی انتخاب کنید",
    description: "تخصص در خودروهای خانوادگی و اقتصادی با مصرف مناسب؛ پیشنهاد دقیق بر اساس بودجه و نیاز شما.",
    tags: ["خانوادگی", "اقتصادی", "مشاوره_خرید"], caption: "پیشنهاد ویژه‌ی خانوادگی" },
  { username: "bamdad.motors", name: "نمایشگاه بامداد", short: "بامداد", city: "مسجدسلیمان", hue: 38, shape: 2,
    address: "مسجدسلیمان، بلوار نمونه، کنار پمپ بنزین، پلاک ۲۷", hours: "همه‌روزه ۸ تا ۲۰", since: "۱۳۹۱",
    tagline: "از صبح، در خدمت شما",
    description: "از صبح زود تا شب پذیرای شما هستیم؛ مشاوره‌ی تلفنی و ارسال عکس و فیلم برای خریداران شهرستانی.",
    tags: ["مشاوره_تلفنی", "ارسال_فیلم", "خرید_از_راه_دور"], caption: "ساعت کاری ما تمدید شد" },
  { username: "dorian.cars", name: "نمایشگاه دریان", short: "دریان", city: "رامهرمز", hue: 195, shape: 3,
    address: "رامهرمز، خیابان نمونه، بعد از میدان اول، پلاک ۱۵", hours: "شنبه تا پنجشنبه ۹ تا ۲۰", since: "۱۳۹۶",
    tagline: "شمال کشور، اعتماد کشور",
    description: "عرضه‌ی خودروهای تمیز مناطق معتدل و کم‌رطوبت‌نشده؛ ضمانت بازگشت پنج‌روزه در صورت عدم رضایت از کارشناسی.",
    tags: ["ضمانت_بازگشت", "تمیز", "کارشناسی"], caption: "ضمانت بازگشت پنج‌روزه" },
  { username: "zarrinrokh.auto", name: "نمایشگاه زرین‌رخ", short: "زرین‌رخ", city: "دزفول", hue: 52, shape: 0,
    address: "دزفول، بلوار نمونه، برج تجاری آسمان، طبقه‌ی دوم، واحد ۴", hours: "همه‌روزه ۱۰ تا ۲۲", since: "۱۴۰۱",
    tagline: "لوکس، اما شفاف",
    description: "مجموعه‌ای از خودروهای لوکس و پرمخاطب با قیمت‌گذاری شفاف؛ بازدید خصوصی فقط با هماهنگی قبلی.",
    tags: ["لوکس", "بازدید_خصوصی", "قیمت_شفاف"], caption: "بازدید خصوصی با هماهنگی" },
  { username: "abiraah.motors", name: "نمایشگاه آبی‌راه", short: "آبی‌راه", city: "بندر امام خمینی", hue: 215, shape: 1,
    address: "بندر امام خمینی، بلوار نمونه، ضلع شرقی میدان بزرگ، پلاک ۳۱", hours: "همه‌روزه ۱۰ تا ۲۰", since: "۱۳۹۹",
    tagline: "کنار دریا، کنار شما",
    description: "تخصص در خودروهای وارداتی و مناطق آزاد؛ همه‌ی مدارک گمرکی و سوابق ترخیص قبل از معامله نمایش داده می‌شود.",
    tags: ["وارداتی", "منطقه_آزاد", "مدارک_شفاف"], caption: "مدارک کامل، معامله‌ی مطمئن" },
  { username: "siavash.cars", name: "نمایشگاه سیاوش", short: "سیاوش", city: "شادگان", hue: 8, shape: 2,
    address: "شادگان، بلوار نمونه، چهارراه سوم، پلاک ۱۸", hours: "شنبه تا پنجشنبه ۹ تا ۱۹", since: "۱۳۹۴",
    tagline: "قدیمی، اما به‌روز",
    description: "بیش از ده سال سابقه‌ی درخشان در فروش خودرو؛ حالا با فروش آنلاین و ارسال سریع به سراسر کشور.",
    tags: ["ارسال_سریع", "فروش_آنلاین", "با_سابقه"], caption: "ارسال سریع به سراسر کشور" }
];

function demoHash(s) { let h = 0; const t = String(s == null ? "" : s); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; }
function demoRng(seed) { let a = demoHash(seed) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// نمایشگاه فرضیِ یک برند (برای برندهای خارج از فهرست، به‌صورت ثابت از روی نام انتخاب می‌شود)
function demoShowroomForBrand(brand) {
  const i = DEMO_BRAND_ORDER.indexOf(brand);
  return DEMO_SHOWROOMS[(i >= 0 ? i : demoHash(brand)) % DEMO_SHOWROOMS.length];
}
function dealerFor(brand) { const d = demoShowroomForBrand(brand); return { name: d.name, city: d.city }; }
function demoShowroomById(id) { const s = String(id || ""); return s.indexOf("brand:") === 0 ? demoShowroomForBrand(s.slice(6)) : null; }

// تعداد دنبال‌کننده و امتیاز نمایشی (ثابت برای هر نمایشگاه)
function demoFollowersBase(id) { return demoShowroomById(id) ? 120 + (demoHash("f" + id) % 2300) : 0; }
function demoRatingSeed(id) {
  if (!demoShowroomById(id)) return null;
  const h = demoHash("r" + id);
  return { count: 18 + (h % 140), average: 4.1 + ((h >>> 3) % 9) / 10 };
}

const _demoSvgCache = new Map();
function demoSvgUri(svg) { return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); }

// آواتار انتزاعی (لوگوی فرضی) — بدون حرف و بدون نماد برند واقعی
// عکس‌های پروفایل و بنر نمایشگاه‌ها (assets/showrooms): پروفایل = برش مربعی، بنر = عکس افقی
const DEMO_BANNER_FILES = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => "assets/showrooms/banner-" + n + ".webp");
const DEMO_AVATAR_FILES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => "assets/showrooms/avatar-" + n + ".webp");
function demoAvatarFor(d) {
  const idx = DEMO_SHOWROOMS.indexOf(d);
  if (idx >= 0) return DEMO_AVATAR_FILES[(idx + 5) % DEMO_AVATAR_FILES.length];
  const key = "a:" + d.username;
  if (_demoSvgCache.has(key)) return _demoSvgCache.get(key);
  const c1 = `hsl(${d.hue},70%,62%)`, c2 = `hsl(${(d.hue + 40) % 360},75%,42%)`;
  const shapes = [
    '<path d="M50 22 78 50 50 78 22 50Z" fill="#fff" fill-opacity=".92"/>',
    '<circle cx="50" cy="50" r="22" fill="none" stroke="#fff" stroke-width="9" stroke-opacity=".92"/>',
    '<path d="M26 66 50 28 74 66Z" fill="#fff" fill-opacity=".92"/>',
    '<path d="M50 24l24 14v24L50 76 26 62V38z" fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round" stroke-opacity=".92"/>'
  ];
  const uri = demoSvgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/>${shapes[d.shape % shapes.length]}</svg>`);
  _demoSvgCache.set(key, uri); return uri;
}
function demoAvatarForId(id) { const d = demoShowroomById(id); return d ? demoAvatarFor(d) : ""; }

/* ---------------- بنرهای ساخته‌شده (۸ طرح، ۱۶:۹) ---------------- */
const DEMO_BANNER_DESIGNS = 8;
function demoBannerUri(hue, design, seed) {
  const key = "b:" + hue + ":" + design + ":" + seed;
  if (_demoSvgCache.has(key)) return _demoSvgCache.get(key);
  const R = demoRng(key), W = 960, H = 540, f = (n) => Math.round(n * 10) / 10;
  const c1 = `hsl(${hue},62%,15%)`, c2 = `hsl(${(hue + 48) % 360},68%,32%)`;
  const acc = `hsl(${(hue + 20) % 360},85%,66%)`, acc2 = `hsl(${(hue + 320) % 360},80%,60%)`, dark = `hsl(${hue},45%,7%)`;
  let defs = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>` +
    `<radialGradient id="gl"><stop offset="0" stop-color="${acc}" stop-opacity=".75"/><stop offset="1" stop-color="${acc}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="g2"><stop offset="0" stop-color="${acc2}" stop-opacity=".6"/><stop offset="1" stop-color="${acc2}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="sp" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="${acc}" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity=".9"/></linearGradient>`;
  let body = "";
  switch (design % DEMO_BANNER_DESIGNS) {
    case 0: // aurora
      for (let i = 0; i < 4; i++) body += `<circle cx="${f(R() * W)}" cy="${f(R() * H)}" r="${f(160 + R() * 220)}" fill="url(#${i % 2 ? "g2" : "gl"})"/>`;
      break;
    case 1: { // skyline
      for (let i = 0; i < 40; i++) body += `<circle cx="${f(R() * W)}" cy="${f(R() * H * .55)}" r="${f(.8 + R() * 1.6)}" fill="#fff" fill-opacity="${f(.25 + R() * .6)}"/>`;
      body += `<circle cx="${f(180 + R() * 600)}" cy="150" r="70" fill="url(#gl)"/>`;
      for (let x = -10; x < W; ) { const w = 40 + R() * 60, h = 90 + R() * 230; body += `<rect x="${f(x)}" y="${f(H - h)}" width="${f(w)}" height="${f(h)}" fill="${dark}"/>`;
        for (let k = 0; k < 4; k++) if (R() > .5) body += `<rect x="${f(x + 6 + R() * (w - 16))}" y="${f(H - h + 10 + R() * (h - 30))}" width="5" height="7" fill="${acc}" fill-opacity=".55"/>`;
        x += w + 4; }
      break; }
    case 2: { // road
      body += `<circle cx="480" cy="300" r="190" fill="url(#gl)"/><circle cx="480" cy="300" r="64" fill="${acc}" fill-opacity=".85"/><rect y="300" width="${W}" height="${H - 300}" fill="${dark}"/><polygon points="420,300 540,300 ${W},${H} 0,${H}" fill="#1D1D1F"/>`;
      for (let i = 0; i < 6; i++) { const t0 = Math.pow(i / 6, 1.8), t1 = Math.pow((i + .55) / 6, 1.8), y0 = 300 + 240 * t0, y1 = 300 + 240 * t1, w0 = 1 + 9 * t0, w1 = 1 + 9 * t1; body += `<polygon points="${f(480 - w0)},${f(y0)} ${f(480 + w0)},${f(y0)} ${f(480 + w1)},${f(y1)} ${f(480 - w1)},${f(y1)}" fill="${acc}" fill-opacity=".85"/>`; }
      break; }
    case 3: // waves
      for (let i = 0; i < 6; i++) { const y = 200 + i * 55, a = 30 + R() * 40; body += `<path d="M0,${f(y)} C240,${f(y - a)} 480,${f(y + a)} 720,${f(y - a / 2)} S960,${f(y + a / 2)} ${W},${f(y)} L${W},${H} L0,${H}Z" fill="hsl(${(hue + i * 14) % 360},65%,${14 + i * 5}%)" fill-opacity=".72"/>`; }
      body += `<circle cx="${f(700 + R() * 160)}" cy="120" r="46" fill="${acc}" fill-opacity=".8"/>`;
      break;
    case 4: // stripes
      body += `<g transform="rotate(-22 480 270)">`;
      for (let i = -4; i < 20; i++) body += `<rect x="${i * 70}" y="-200" width="${f(18 + R() * 30)}" height="900" fill="#fff" fill-opacity="${f(.04 + R() * .08)}"/>`;
      body += `</g>`;
      for (let x = 0; x < 9; x++) for (let y = 0; y < 5; y++) body += `<circle cx="${620 + x * 36}" cy="${70 + y * 36}" r="2.4" fill="${acc}" fill-opacity=".7"/>`;
      body += `<circle cx="180" cy="420" r="150" fill="url(#g2)"/>`;
      break;
    case 5: { // hex
      const s = 64, hh = s * Math.sqrt(3);
      for (let r = 0; r < 6; r++) for (let c = 0; c < 10; c++) {
        const cx = c * s * 1.5, cy = r * hh + (c % 2 ? hh / 2 : 0), o = f(.05 + .3 * R() * R());
        const p = [0, 1, 2, 3, 4, 5].map((k) => f(cx + s * Math.cos(k * Math.PI / 3)) + "," + f(cy + s * Math.sin(k * Math.PI / 3))).join(" ");
        body += `<polygon points="${p}" fill="none" stroke="${acc}" stroke-opacity="${o}" stroke-width="1.5"/>`; }
      body += `<circle cx="${f(300 + R() * 360)}" cy="260" r="230" fill="url(#gl)" opacity=".5"/>`;
      break; }
    case 6: // speed
      for (let i = 0; i < 16; i++) { const y = 30 + R() * (H - 60), x = R() * 500, l = 220 + R() * 420; body += `<rect x="${f(x)}" y="${f(y)}" width="${f(l)}" height="${f(2 + R() * 5)}" rx="3" fill="url(#sp)" opacity="${f(.35 + R() * .6)}"/>`; }
      body += `<circle cx="820" cy="110" r="140" fill="url(#g2)"/>`;
      break;
    default: // rings
      for (let r = 40; r < 460; r += 44) body += `<circle cx="690" cy="270" r="${r}" fill="none" stroke="${acc}" stroke-opacity="${f(Math.max(.05, .55 - r / 900))}" stroke-width="${f(1 + (460 - r) / 160)}"/>`;
      body += `<circle cx="690" cy="270" r="26" fill="${acc}" fill-opacity=".9"/><circle cx="240" cy="400" r="190" fill="url(#g2)"/>`;
  }
  const uri = demoSvgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs><rect width="${W}" height="${H}" fill="url(#bg)"/>${body}</svg>`);
  _demoSvgCache.set(key, uri); return uri;
}

// بنر خودکار هر نمایشگاه: برای نمایشگاه‌های نمایشی ثابت و از روی ترتیب‌شان؛ برای بقیه از روی شناسه. «تغییر بنر» انتخاب را در همین مرورگر نگه می‌دارد.
const DEMO_AUTO_BANNER_KEY = "mr_auto_banner_v2";
function demoAutoBannerRead() { try { const o = JSON.parse(window.localStorage.getItem(DEMO_AUTO_BANNER_KEY) || "{}"); return o && typeof o === "object" ? o : {}; } catch (_) { return {}; } }
function demoAutoBannerIndex(id) {
  const n = DEMO_BANNER_FILES.length, d = demoShowroomById(id);
  return d ? DEMO_SHOWROOMS.indexOf(d) % n : demoHash(id) % n;
}
function demoAutoBanner(id, reroll) {
  id = String(id || ""); if (!id) return "";
  const all = demoAutoBannerRead(), n = DEMO_BANNER_FILES.length;
  let i = Number.isInteger(all[id]) ? all[id] % n : demoAutoBannerIndex(id);
  if (reroll) { i = (i + 1) % n; all[id] = i; try { window.localStorage.setItem(DEMO_AUTO_BANNER_KEY, JSON.stringify(all)); } catch (_) {} }
  return DEMO_BANNER_FILES[i];
}

// بنر تصادفی بدون ذخیره (برای دکمه‌ی «بنر تصادفی دیگر» در فرم؛ تا زدن «ذخیره» جایی نوشته نمی‌شود)
function demoRandomBanner(avoid) {
  const pool = DEMO_BANNER_FILES.filter((u) => u !== avoid);
  return pool[Math.floor(Math.random() * pool.length)] || DEMO_BANNER_FILES[0];
}

// khz-demo: demo showroom cities moved to Khuzestan
