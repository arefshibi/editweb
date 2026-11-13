"use strict";

/*
 * C♻️RMA Q&A — DATA LAYER (frontend only)
 * ---------------------------------------------------------------
 * The one place that reads/writes Q&A data. The UI (29/30) only talks to
 * window.MARQUE_QA.store, never to localStorage directly. Every method
 * returns a Promise, so a real backend can replace the bodies of
 * read()/write() (or the methods themselves) without touching the UI.
 *
 * Storage: localStorage key "marque_qa_v1" (versioned, see SCHEMA_VERSION).
 * Data only exists in THIS browser. Nothing is shared between users.
 * Sample records carry isSample:true and are labelled in the UI.
 */
(function () {
  const STORE_KEY = "marque_qa_v1";
  const BACKUP_KEY = "marque_qa_v1_backup";
  const SCHEMA_VERSION = 1;

  /* ---------------- categories ---------------- */
  const CATEGORIES = [
    { id: "technical", label: "فنی و مکانیکی" },
    { id: "diagnosis", label: "عیب‌یابی خودرو" },
    { id: "compare", label: "مقایسه خودروها" },
    { id: "buy-sell", label: "خرید و فروش" },
    { id: "service", label: "نگهداری و سرویس" },
    { id: "parts", label: "قطعات و لوازم" },
    { id: "driving", label: "تجربه رانندگی" },
    { id: "other", label: "سایر موضوعات" },
  ];
  const categoryLabel = (id) => (CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1]).label;

  const SORTS = [
    { id: "newest", label: "جدیدترین" },
    { id: "answers", label: "بیشترین پاسخ" },
    { id: "views", label: "بیشترین بازدید" },
  ];
  const DEFAULT_SORT = "newest";

  /* ---------------- search text normalisation ----------------
   * LENGTH-PRESERVING on purpose (1 char in -> 1 char out) so the UI can map
   * match positions in the normalised text back onto the original text for
   * highlighting. Unifies Arabic/Persian letter variants, Persian/Arabic
   * digits and the half-space (ZWNJ), and ignores case. */
  const NORM_MAP = { "ي": "ی", "ى": "ی", "ك": "ک", "ۀ": "ه", "ة": "ه", "\u200c": " ", "\u200f": " ", "\u200e": " ", "ـ": " " };
  function normalizeText(v) {
    const src = String(v == null ? "" : v);
    let out = "";
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      const code = ch.charCodeAt(0);
      if (code >= 0x06F0 && code <= 0x06F9) out += String(code - 0x06F0);       // ۰-۹
      else if (code >= 0x0660 && code <= 0x0669) out += String(code - 0x0660);  // ٠-٩
      else if (NORM_MAP[ch] !== undefined) out += NORM_MAP[ch];
      else if (code >= 0x064B && code <= 0x065F) out += " ";                    // harakat -> neutral
      else out += ch;
    }
    const lower = out.toLowerCase();
    return lower.length === out.length ? lower : out;
  }
  function searchTokens(query) {
    return normalizeText(query).split(/\s+/).filter(Boolean);
  }

  /* ---------------- limits + validation (shared by the form and createQuestion) ---------------- */
  const LIMITS = {
    title: { min: 8, max: 120 },
    body: { min: 20, max: 3000 },
    brand: { max: 40 },
    model: { max: 40 },
    answer: { min: 10, max: 3000 },
  };
  const toFaDigits = (v) => String(v == null ? "" : v).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  const toEnDigits = (v) => String(v == null ? "" : v).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const clean = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  // Keeps line breaks in the body but trims and limits blank lines.
  const cleanBody = (v) => String(v == null ? "" : v).replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  // Returns { field: "message" } — empty object means valid. Does not touch storage.
  function validateQuestion(input) {
    const i = input || {};
    const errors = {};
    const title = clean(i.title), body = cleanBody(i.body);
    if (!title) errors.title = "عنوان سؤال را وارد کنید.";
    else if (title.length < LIMITS.title.min) errors.title = "عنوان خیلی کوتاه است؛ دست‌کم " + toFaDigits(LIMITS.title.min) + " حرف بنویسید.";
    else if (title.length > LIMITS.title.max) errors.title = "عنوان حداکثر " + toFaDigits(LIMITS.title.max) + " حرف می‌تواند باشد.";
    if (!body) errors.body = "متن سؤال را وارد کنید.";
    else if (body.length < LIMITS.body.min) errors.body = "متن سؤال خیلی کوتاه است؛ دست‌کم " + toFaDigits(LIMITS.body.min) + " حرف بنویسید.";
    else if (body.length > LIMITS.body.max) errors.body = "متن سؤال حداکثر " + toFaDigits(LIMITS.body.max) + " حرف می‌تواند باشد.";
    if (!i.category) errors.category = "یک دسته‌بندی انتخاب کنید.";
    else if (!CATEGORIES.some((c) => c.id === i.category)) errors.category = "دسته‌بندی نامعتبر است.";
    if (clean(i.brand).length > LIMITS.brand.max) errors.brand = "نام برند حداکثر " + toFaDigits(LIMITS.brand.max) + " حرف می‌تواند باشد.";
    if (clean(i.model).length > LIMITS.model.max) errors.model = "نام مدل حداکثر " + toFaDigits(LIMITS.model.max) + " حرف می‌تواند باشد.";
    const year = toEnDigits(clean(i.year));
    if (year) {
      const n = Number(year);
      const okShape = /^\d{4}$/.test(year);
      if (!okShape || !((n >= 1300 && n <= 1450) || (n >= 1900 && n <= 2100))) errors.year = "سال تولید را به‌صورت چهار رقمی وارد کنید، مثلاً ۱۴۰۰ یا ۲۰۲۰.";
    }
    return errors;
  }

  // Returns { body: "message" } — empty object means valid. Does not touch storage.
  function validateAnswer(input) {
    const errors = {};
    const body = cleanBody(input && input.body);
    if (!body) errors.body = "متن پاسخ را وارد کنید.";
    else if (body.length < LIMITS.answer.min) errors.body = "پاسخ خیلی کوتاه است؛ دست‌کم " + toFaDigits(LIMITS.answer.min) + " حرف بنویسید.";
    else if (body.length > LIMITS.answer.max) errors.body = "پاسخ حداکثر " + toFaDigits(LIMITS.answer.max) + " حرف می‌تواند باشد.";
    return errors;
  }

  const STOP = new Set(["و", "در", "از", "به", "که", "را", "با", "برای", "این", "آن", "چه", "چند", "هر", "یا", "یک", "است", "هست", "می", "من", "ما", "تا", "هم", "بعد", "قبل"]);
  const simTokens = (text) => searchTokens(text).map((t) => t.replace(/[^0-9a-z\u0600-\u06FF]/g, "")).filter((t) => t.length >= 2 && !STOP.has(t));
  const tokenHit = (a, b) => a === b || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)));

  /* ---------------- helpers ---------------- */
  function uid(prefix) {
    let r;
    try { r = (crypto && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g, "").slice(0, 16) : null; } catch (_) { r = null; }
    if (!r) r = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    return prefix + "_" + r;
  }
  const hoursAgo = (h) => Date.now() - Math.round(h * 3600 * 1000);
  // Question ids look like "q_sample_3" or "q_<hex/base36>". Anything else (from a hand-edited URL) is invalid.
  const isValidQuestionId = (id) => typeof id === "string" && /^q_[A-Za-z0-9_]{1,48}$/.test(id);

  /* ---------------- demo identity ----------------
   * No real authentication exists. This returns a *display* identity only:
   * the logged-in demo account when there is one, otherwise a fixed demo
   * user. Replace this function when real auth is connected. */
  const IDENTITY = {
    current() {
      try {
        if (typeof state !== "undefined" && state && state.account) {
          const p = state.accountProfile || {};
          const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
          const id = typeof sellerIdForPhone === "function" ? sellerIdForPhone(state.account) : "acct";
          return { id: "u_" + id, name: name || "کاربر C♻️RMA", isDemo: false };
        }
      } catch (_) {}
      return { id: "u_demo", name: "کاربر نمایشی", isDemo: true };
    },
    /* "Owner" only means: this question was saved under the current DISPLAY identity in this browser.
     * It is not real ownership or security. Replace with a real check when auth is connected. */
    isOwner(q) {
      return !!(q && q.authorId && q.authorId === IDENTITY.current().id);
    },
  };

  /* ---------------- sample data ---------------- */
  function buildSeed() {
    const Q = (n, o) => Object.assign({ id: "q_sample_" + n, v: 1, authorId: "u_sample_" + n, isSample: true, views: 0, updatedAt: o.createdAt }, o);
    const A = (q, n, o) => Object.assign({ id: "a_sample_" + q + "_" + n, questionId: "q_sample_" + q, authorId: "u_sample_a" + n, isSample: true, helpful: 0 }, o);

    const questions = [
      Q(1, { title: "صدای تق‌تق از جلوی خودرو هنگام عبور از دست‌انداز", body: "هنگام عبور از دست‌انداز و چاله، از سمت جلوی خودرو صدای تق‌تق می‌آید. این صدا در سرعت کم بیشتر شنیده می‌شود. معمولاً کدام قطعه‌ها مقصرند و از کجا باید بررسی را شروع کنم؟", category: "diagnosis", brand: "پژو", model: "۲۰۶", year: "۱۳۹۸", authorName: "محسن ر.", createdAt: hoursAgo(5), views: 214, acceptedAnswerId: "a_sample_1_1" }),
      Q(2, { title: "تفاوت واقعی موتور توربو و بدون توربو در مصرف بنزین", body: "برای رانندگی روزانه در شهر، آیا موتور توربو واقعاً مصرف بیشتری دارد؟ تجربه شما در شرایط ترافیک سنگین چه بوده؟", category: "technical", authorName: "سارا ک.", createdAt: hoursAgo(21), views: 482 }),
      Q(3, { title: "تعویض روغن گیربکس اتوماتیک هر چند کیلومتر انجام شود؟", body: "خودروی من اتوماتیک است و کارکردش ۸۰ هزار کیلومتر شده. سازنده می‌گوید روغن گیربکس عمر کامل دارد، اما بعضی تعمیرکارها تعویض را توصیه می‌کنند. نظر شما چیست؟", category: "service", brand: "تویوتا", model: "کرولا", year: "۱۴۰۰", authorName: "امیرحسین ن.", createdAt: hoursAgo(30), views: 931, acceptedAnswerId: "a_sample_3_1" }),
      Q(4, { title: "هنگام خرید خودروی دست‌دوم، بدنه رنگ‌شده را از کجا تشخیص بدهم؟", body: "چه نشانه‌هایی در درزها، لاستیک درها و ضخامت رنگ وجود دارد که بتوان رنگ و تعویض قطعه را فهمید؟ بدون دستگاه ضخامت‌سنج چه کارهایی از دست من برمی‌آید؟", category: "buy-sell", authorName: "علی ش.", createdAt: hoursAgo(52), views: 1260 }),
      Q(5, { title: "مقایسه کیا سراتو و هیوندای النترا برای استفاده خانوادگی", body: "بودجه ما ثابت است و هر دو مدل مشابه‌اند. از نظر فضای عقب، هزینه نگهداری و قیمت فروش مجدد کدام انتخاب بهتری است؟", category: "compare", brand: "کیا", model: "سراتو", authorName: "نگار م.", createdAt: hoursAgo(80), views: 705 }),
      Q(6, { title: "لنت ترمز جلو چند هزار کیلومتر بعد از تعویض دوباره صدا می‌دهد؟", body: "لنت جدید نصب کردم و بعد از حدود دو هزار کیلومتر صدای جیرجیر ترمز برگشته است. لنت اصلی بهتر از بازار آزاد است یا مشکل از دیسک‌هاست؟", category: "parts", authorName: "حمید ا.", createdAt: hoursAgo(110), views: 389 }),
      Q(7, { title: "تجربه رانندگی با خودروی هیبریدی در جاده‌های کوهستانی", body: "کسی هست که با هیبرید مسیرهای طولانی و سربالایی را رفته باشد؟ افت قدرت یا ضعیف شدن ترمز در سراشیبی‌ها را حس کرده‌اید؟", category: "driving", authorName: "پویا ج.", createdAt: hoursAgo(150), views: 258 }),
      Q(8, { title: "چراغ چک موتور روشن شد؛ قبل از رفتن به تعمیرگاه چه چیزهایی را بررسی کنم؟", body: "چراغ چک موتور در حین رانندگی روشن شد ولی رفتار خودرو عوض نشده است. قبل از مراجعه به تعمیرگاه، چه بررسی‌های ساده‌ای را خودم می‌توانم انجام بدهم؟", category: "diagnosis", brand: "هیوندای", model: "النترا", year: "۱۳۹۶", authorName: "ندا ف.", createdAt: hoursAgo(190), views: 1544 }),
      Q(9, { title: "بهترین زمان تعویض تسمه تایمینگ و چه قطعاتی همراهش عوض شود؟", body: "برای تسمه تایمینگ فاصله کیلومتر مشخص است ولی چیزی درباره تعویض همزمان واترپمپ و بلبرینگ‌ها نمی‌دانم. پیشنهاد شما چیست؟", category: "service", authorName: "کامران ز.", createdAt: hoursAgo(240), views: 612 }),
      Q(10, { title: "پیشنهاد روغن موتور برای خودرو در هوای گرم تابستان", body: "درجه ویسکوزیته روغن را در تابستان تغییر بدهم یا همان توصیه کارخانه کافی است؟", category: "other", authorName: "سمیرا ت.", createdAt: hoursAgo(300), views: 97 }),
    ];

    const answers = [
      A(1, 1, { body: "اغلب علت، بوش‌ها یا rack end و لینک تعادل (میل موج‌گیر) است. چرخ را بالا ببرید و لقی هر کدام را با دست امتحان کنید؛ اگر لقی دارند، تعویض‌شان هزینه کمی دارد.", authorName: "مهندس کیانی", createdAt: hoursAgo(4), helpful: 12 }),
      A(1, 2, { body: "من هم همین مشکل را داشتم و علتش خرابی توپی کمک فنر بود. بهتر است ابتدا کمک‌ها بازدید شوند.", authorName: "فرهاد ب.", createdAt: hoursAgo(3), helpful: 4 }),
      A(3, 1, { body: "برای گیربکس‌های اتوماتیک کلاسیک، بیشتر تعمیرکارها تعویض هر ۶۰ تا ۸۰ هزار کیلومتر را توصیه می‌کنند. عمر کامل در بیشتر موارد یعنی طول عمر گارانتی.", authorName: "استاد رحیمی", createdAt: hoursAgo(28), helpful: 21 }),
      A(3, 2, { body: "حتماً از روغن مطابق مشخصات سازنده استفاده کنید و تعویض به روش دستگاه انجام شود.", authorName: "بهنام ع.", createdAt: hoursAgo(26), helpful: 6 }),
      A(5, 1, { body: "از نظر فضای عقب تفاوت کمی هست. هزینه قطعات و در دسترس بودن خدمات پس از فروش را حتماً در شهر خودتان بررسی کنید.", authorName: "مریم س.", createdAt: hoursAgo(70), helpful: 3 }),
      A(8, 1, { body: "اول درب باک را بررسی کنید که کامل بسته شده باشد؛ شل بودن درب باک یکی از دلایل رایج روشن شدن چراغ است.", authorName: "سینا د.", createdAt: hoursAgo(180), helpful: 9 }),
      A(8, 2, { body: "اگر رفتار خودرو عوض نشده، با دیاگ می‌توان کد خطا را خواند. معمولاً اتوپارت‌ها این کار را رایگان انجام می‌دهند.", authorName: "پرهام ق.", createdAt: hoursAgo(176), helpful: 5 }),
      A(8, 3, { body: "کیفیت بنزین هم در برخی موارد باعث همین خطا می‌شود.", authorName: "لیلا ر.", createdAt: hoursAgo(170), helpful: 1 }),
    ];

    return { v: SCHEMA_VERSION, seeded: true, questions, answers, votes: {}, views: {}, notifications: [] };
  }

  /* ---------------- persistence ---------------- */
  let mem = null; // in-memory copy, source of truth after first read
  let lastError = "";

  function isValid(d) {
    return d && typeof d === "object" && d.v === SCHEMA_VERSION && Array.isArray(d.questions) && Array.isArray(d.answers);
  }
  function normalize(d) {
    d.votes = d.votes && typeof d.votes === "object" ? d.votes : {};
    d.views = d.views && typeof d.views === "object" ? d.views : {};
    d.notifications = Array.isArray(d.notifications) ? d.notifications : []; // added in stage 6, no schema bump needed
    return d;
  }

  function read() {
    if (mem) return mem;
    let raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) { lastError = "storage-unavailable"; }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (isValid(parsed)) { mem = normalize(parsed); return mem; }
      } catch (_) {}
      // Corrupt or unknown version: keep a copy so nothing is silently lost, then start clean.
      try { localStorage.setItem(BACKUP_KEY, raw); } catch (_) {}
    }
    mem = buildSeed();
    write();
    return mem;
  }

  // silent: skip the toast (used for low-value writes such as view counters).
  function write(silent) {
    if (!mem) return false;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(mem)); lastError = ""; try { window.dispatchEvent(new Event("marque-qa-changed")); } catch (_) {} return true; }
    catch (e) {
      lastError = "quota-or-unavailable";
      if (!silent && typeof showToast === "function") showToast("فضای ذخیره‌سازی مرورگر پر یا در دسترس نیست.");
      return false;
    }
  }

  /* ---------------- queries (Promise based) ---------------- */
  function decorate(q, d) {
    const answers = d.answers.filter((a) => a.questionId === q.id);
    const helpful = answers.reduce((s, a) => s + (a.helpful || 0), 0);
    return Object.assign({}, q, {
      views: (q.views || 0) + (d.views[q.id] || 0),
      answerCount: answers.length,
      helpfulCount: helpful,
      isAccepted: !!(q.acceptedAnswerId && answers.some((a) => a.id === q.acceptedAnswerId)),
      isOwner: IDENTITY.isOwner(q),
    });
  }
  // `voted`: this browser already marked the answer helpful. `isMine`: written under the current display identity.
  function decorateAnswer(a, d) {
    return Object.assign({}, a, { helpful: a.helpful || 0, voted: !!d.votes[a.id], isMine: !!(a.authorId && a.authorId === IDENTITY.current().id) });
  }


  /* ---------------- local notifications (stage 6) ----------------
   * Browser-only. A note belongs to a DISPLAY identity (userId) saved in this browser; nobody
   * is really notified. Notes are written in the same save as the event, so a failed save leaves none behind. */
  const NOTE_CAP = 100;
  function mkNote(userId, type, q, extra) {
    return Object.assign({ id: uid("n"), userId, type, questionId: q.id, title: q.title, createdAt: Date.now(), read: false }, extra || {});
  }
  function pushNotes(d, notes) {
    const removed = [];
    notes.forEach((n) => d.notifications.push(n));
    while (d.notifications.length > NOTE_CAP) removed.push(d.notifications.shift());
    return removed;
  }
  function undoNotes(d, notes, removed) {
    d.notifications = d.notifications.filter((n) => notes.indexOf(n) === -1);
    for (let i = removed.length - 1; i >= 0; i--) d.notifications.unshift(removed[i]);
  }

  /* ---------------- images (IndexedDB "marque_qa_media") ----------------
   * Images are kept out of localStorage (shared ~5 MB quota with listing photos).
   * A question only stores `imageId`. */
  const MEDIA_DB = "marque_qa_media", MEDIA_STORE = "images";
  let dbPromise = null;
  function openMedia() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      try {
        if (typeof indexedDB === "undefined") return reject(new Error("no-indexeddb"));
        const req = indexedDB.open(MEDIA_DB, 1);
        req.onupgradeneeded = () => { try { req.result.createObjectStore(MEDIA_STORE, { keyPath: "id" }); } catch (_) {} };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error("idb-open"));
        req.onblocked = () => reject(new Error("idb-blocked"));
      } catch (e) { reject(e); }
    }).catch((e) => { dbPromise = null; throw e; });
    return dbPromise;
  }
  function putImage(dataUrl) {
    return openMedia().then((db) => new Promise((resolve, reject) => {
      const id = uid("img");
      const tx = db.transaction(MEDIA_STORE, "readwrite");
      tx.objectStore(MEDIA_STORE).put({ id, dataUrl, createdAt: Date.now() });
      tx.oncomplete = () => resolve(id);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("idb-write"));
    }));
  }
  function getImage(id) {
    if (!id) return Promise.resolve(null);
    return openMedia().then((db) => new Promise((resolve) => {
      try {
        const rq = db.transaction(MEDIA_STORE, "readonly").objectStore(MEDIA_STORE).get(id);
        rq.onsuccess = () => resolve(rq.result ? rq.result.dataUrl : null);
        rq.onerror = () => resolve(null);
      } catch (_) { resolve(null); }
    })).catch(() => null);
  }
  function deleteImage(id) {
    return openMedia().then((db) => new Promise((resolve) => {
      try { const tx = db.transaction(MEDIA_STORE, "readwrite"); tx.objectStore(MEDIA_STORE).delete(id); tx.oncomplete = tx.onerror = tx.onabort = () => resolve(); }
      catch (_) { resolve(); }
    })).catch(() => {});
  }

  const store = {
    SCHEMA_VERSION,
    STORE_KEY,
    /* opts (all optional): { q: "search text", category: "<id>|all", sort: "newest|answers|views" }
     * Search looks in title, body and car brand/model; every word must match. */
    listQuestions(opts) {
      return Promise.resolve().then(() => {
        const o = opts || {};
        const d = read();
        const tokens = searchTokens(o.q);
        const cat = o.category && o.category !== "all" ? o.category : null;
        const sort = SORTS.some((x) => x.id === o.sort) ? o.sort : DEFAULT_SORT;

        let list = d.questions.map((q) => decorate(q, d));
        if (cat) list = list.filter((q) => q.category === cat);
        if (tokens.length) {
          list = list.filter((q) => {
            const hay = normalizeText([q.title, q.body, q.brand, q.model].filter(Boolean).join(" \n "));
            return tokens.every((t) => hay.indexOf(t) !== -1);
          });
        }
        const byNewest = (a, b) => b.createdAt - a.createdAt;
        const cmp = sort === "answers" ? (a, b) => (b.answerCount - a.answerCount) || byNewest(a, b)
          : sort === "views" ? (a, b) => (b.views - a.views) || byNewest(a, b)
          : byNewest;
        return list.sort(cmp);
      });
    },
    /* { total, byCategory: { [categoryId]: n } } over ALL questions (ignores filters). */
    getStats() {
      return Promise.resolve().then(() => {
        const d = read();
        const byCategory = {};
        d.questions.forEach((q) => { byCategory[q.category] = (byCategory[q.category] || 0) + 1; });
        return { total: d.questions.length, byCategory };
      });
    },
    getQuestion(id) {
      return Promise.resolve().then(() => {
        const d = read();
        const q = d.questions.find((x) => x.id === id);
        return q ? decorate(q, d) : null;
      });
    },
    listAnswers(questionId) {
      return Promise.resolve().then(() => {
        const d = read();
        return d.answers.filter((a) => a.questionId === questionId).sort((a, b) => a.createdAt - b.createdAt).map((a) => decorateAnswer(a, d));
      });
    },
    LIMITS,
    validateQuestion,
    /* input: { title, body, category, brand?, model?, year?, imageDataUrl? }
     * Resolves with the saved question; rejects with { code, errors?, message }. */
    createQuestion(input) {
      return Promise.resolve().then(async () => {
        const errors = validateQuestion(input);
        if (Object.keys(errors).length) throw { code: "validation", errors, message: "لطفاً خطاهای فرم را برطرف کنید." };
        let imageId;
        if (input.imageDataUrl) {
          try { imageId = await putImage(input.imageDataUrl); }
          catch (_) { throw { code: "image-storage", message: "ذخیره تصویر در این مرورگر ممکن نشد. تصویر را حذف کنید یا دوباره تلاش کنید." }; }
        }
        const d = read();
        const who = IDENTITY.current();
        const now = Date.now();
        const q = {
          id: uid("q"), v: 1,
          title: clean(input.title), body: cleanBody(input.body), category: input.category,
          authorId: who.id, authorName: who.name,
          createdAt: now, updatedAt: now, views: 0, isSample: false,
        };
        const brand = clean(input.brand), model = clean(input.model), year = toFaDigits(toEnDigits(clean(input.year)));
        if (brand) q.brand = brand;
        if (model) q.model = model;
        if (year) q.year = year;
        if (imageId) q.imageId = imageId;
        d.questions.unshift(q);
        const notes = [mkNote(who.id, "question_created", q)];
        const removed = pushNotes(d, notes);
        if (!write()) {
          d.questions.shift();
          undoNotes(d, notes, removed);
          if (imageId) deleteImage(imageId);
          throw { code: "storage", message: "ذخیره سؤال ممکن نشد؛ فضای ذخیره‌سازی مرورگر پر یا در دسترس نیست." };
        }
        return decorate(q, d);
      });
    },
    validateAnswer,
    /* input: { questionId, body }. Resolves with the saved answer; rejects with { code, errors?, message }.
     * The author is the current DISPLAY identity (no real auth). */
    addAnswer(input) {
      return Promise.resolve().then(() => {
        const i = input || {};
        const d = read();
        const q = d.questions.find((x) => x.id === i.questionId);
        if (!q) throw { code: "not-found", message: "این سؤال دیگر وجود ندارد." };
        const errors = validateAnswer(i);
        if (errors.body) throw { code: "validation", errors, message: errors.body };
        const who = IDENTITY.current();
        const now = Date.now();
        const a = { id: uid("a"), questionId: q.id, body: cleanBody(i.body), authorId: who.id, authorName: who.name, createdAt: now, helpful: 0, isSample: false };
        const prevUpdated = q.updatedAt;
        d.answers.push(a);
        q.updatedAt = now;
        const notes = [mkNote(who.id, "answer_posted", q, { answerId: a.id })];
        // Someone else's (display) identity in this browser answered a question saved by another identity here.
        if (!q.isSample && q.authorId && q.authorId !== who.id) notes.push(mkNote(q.authorId, "answer_received", q, { answerId: a.id }));
        const removed = pushNotes(d, notes);
        if (!write()) {
          d.answers.pop();
          undoNotes(d, notes, removed);
          q.updatedAt = prevUpdated;
          throw { code: "storage", message: "ذخیره پاسخ ممکن نشد؛ فضای ذخیره‌سازی مرورگر پر یا در دسترس نیست." };
        }
        return decorateAnswer(a, d);
      });
    },
    /* One "helpful" vote per answer per BROWSER (d.votes[answerId] = true). Voting again does nothing.
     * Resolves with { changed, answer }. Browser-level only: not fraud protection. */
    voteHelpful(answerId) {
      return Promise.resolve().then(() => {
        const d = read();
        const a = d.answers.find((x) => x.id === answerId);
        if (!a) throw { code: "not-found", message: "این پاسخ دیگر وجود ندارد." };
        if (d.votes[answerId]) return { changed: false, answer: decorateAnswer(a, d) };
        const prev = a.helpful || 0;
        d.votes[answerId] = true;
        a.helpful = prev + 1;
        if (!write()) {
          delete d.votes[answerId];
          a.helpful = prev;
          throw { code: "storage", message: "ثبت رأی ممکن نشد؛ فضای ذخیره‌سازی مرورگر پر یا در دسترس نیست." };
        }
        return { changed: true, answer: decorateAnswer(a, d) };
      });
    },
    /* Marks one answer of the question as accepted (replaces the previous choice).
     * Only allowed for the question's display-identity owner. Resolves with the decorated question. */
    acceptAnswer(questionId, answerId) {
      return Promise.resolve().then(() => {
        const d = read();
        const q = d.questions.find((x) => x.id === questionId);
        if (!q) throw { code: "not-found", message: "این سؤال دیگر وجود ندارد." };
        const a = d.answers.find((x) => x.id === answerId && x.questionId === questionId);
        if (!a) throw { code: "not-found", message: "این پاسخ دیگر وجود ندارد." };
        if (!IDENTITY.isOwner(q)) throw { code: "forbidden", message: "فقط پرسنده سؤال می‌تواند پاسخ پذیرفته‌شده را انتخاب کند." };
        const prevAccepted = q.acceptedAnswerId, prevUpdated = q.updatedAt;
        q.acceptedAnswerId = answerId;
        q.updatedAt = Date.now();
        const notes = [mkNote(q.authorId, "answer_accepted", q, { answerId })];
        if (!a.isSample && a.authorId && a.authorId !== q.authorId) notes.push(mkNote(a.authorId, "answer_accepted_yours", q, { answerId }));
        const removed = pushNotes(d, notes);
        if (!write()) {
          undoNotes(d, notes, removed);
          if (prevAccepted) q.acceptedAnswerId = prevAccepted; else delete q.acceptedAnswerId;
          q.updatedAt = prevUpdated;
          throw { code: "storage", message: "ذخیره انتخاب ممکن نشد؛ فضای ذخیره‌سازی مرورگر پر یا در دسترس نیست." };
        }
        return decorate(q, d);
      });
    },
    /* Questions saved under the current DISPLAY identity in this browser, newest first (decorated). */
    listMine() {
      return Promise.resolve().then(() => {
        const d = read();
        return d.questions.filter((q) => IDENTITY.isOwner(q)).map((q) => decorate(q, d)).sort((a, b) => b.createdAt - a.createdAt);
      });
    },
    /* Notifications of the current display identity, newest first. */
    listNotifications() {
      return Promise.resolve().then(() => {
        const me = IDENTITY.current().id;
        return read().notifications.filter((n) => n.userId === me).sort((a, b) => b.createdAt - a.createdAt).map((n) => Object.assign({}, n));
      });
    },
    unreadCount() {
      return Promise.resolve().then(() => {
        const me = IDENTITY.current().id;
        return read().notifications.filter((n) => n.userId === me && !n.read).length;
      });
    },
    /* ids: array of notification ids, or "all". Resolves with the new unread count. */
    markNotificationsRead(ids) {
      return Promise.resolve().then(() => {
        const d = read();
        const me = IDENTITY.current().id;
        const all = ids === "all";
        const set = new Set(Array.isArray(ids) ? ids : []);
        let changed = false;
        d.notifications.forEach((n) => { if (n.userId === me && !n.read && (all || set.has(n.id))) { n.read = true; changed = true; } });
        if (changed) write(true);
        return d.notifications.filter((n) => n.userId === me && !n.read).length;
      });
    },
    clearNotifications() {
      return Promise.resolve().then(() => {
        const d = read();
        const me = IDENTITY.current().id;
        const before = d.notifications;
        d.notifications = before.filter((n) => n.userId !== me);
        if (d.notifications.length !== before.length && !write()) {
          d.notifications = before;
          throw { code: "storage", message: "پاک کردن اعلان‌ها ممکن نشد؛ فضای ذخیره‌سازی مرورگر در دسترس نیست." };
        }
        return 0;
      });
    },
    /* Simple word-overlap similarity (no AI, no network). Returns up to `limit` decorated questions. */
    findSimilar(title, limit) {
      return Promise.resolve().then(() => {
        const words = simTokens(title);
        if (words.length < 2 && !(words.length === 1 && words[0].length >= 4)) return [];
        const d = read();
        const scored = [];
        d.questions.forEach((q) => {
          const hayTitle = simTokens(q.title), hayBody = simTokens(q.body + " " + (q.brand || "") + " " + (q.model || ""));
          let score = 0, hits = 0;
          words.forEach((w) => {
            if (hayTitle.some((h) => tokenHit(w, h))) { score += 2; hits++; }
            else if (hayBody.some((h) => tokenHit(w, h))) { score += 1; hits++; }
          });
          const need = Math.min(2, words.length);
          if (hits >= need && score / (words.length * 2) >= 0.3) scored.push({ q, score });
        });
        scored.sort((a, b) => (b.score - a.score) || (b.q.createdAt - a.q.createdAt));
        return scored.slice(0, limit || 3).map((x) => decorate(x.q, d));
      });
    },
    isValidQuestionId,
    /* Counts one visit for this browser. The page calls it once per question per tab session
     * (it guards with sessionStorage), so reloading does not inflate the number. Resolves with the new total. */
    recordView(id) {
      return Promise.resolve().then(() => {
        const d = read();
        const q = d.questions.find((x) => x.id === id);
        if (!q) return null;
        d.views[id] = (d.views[id] || 0) + 1;
        write(true);
        return (q.views || 0) + d.views[id];
      });
    },
    /* Related questions: same brand/model/category and shared title words (no AI, no network). */
    findRelated(id, limit) {
      return Promise.resolve().then(() => {
        const d = read();
        const base = d.questions.find((x) => x.id === id);
        if (!base) return [];
        const words = simTokens(base.title);
        const scored = [];
        d.questions.forEach((q) => {
          if (q.id === id) return;
          let score = 0;
          if (base.brand && q.brand && normalizeText(base.brand) === normalizeText(q.brand)) score += 3;
          if (base.model && q.model && normalizeText(base.model) === normalizeText(q.model)) score += 2;
          if (q.category === base.category) score += 1;
          const hay = simTokens(q.title);
          words.forEach((w) => { if (hay.some((h) => tokenHit(w, h))) score += 2; });
          if (score > 0) scored.push({ q, score });
        });
        scored.sort((a, b) => (b.score - a.score) || (b.q.createdAt - a.q.createdAt));
        return scored.slice(0, limit || 4).map((x) => decorate(x.q, d));
      });
    },
    getImageUrl(imageId) { return getImage(imageId); },
    lastError() { return lastError; },
  };

  window.MARQUE_QA = Object.assign(window.MARQUE_QA || {}, {
    CATEGORIES,
    categoryLabel,
    SORTS,
    DEFAULT_SORT,
    normalizeText,
    searchTokens,
    store,
    identity: IDENTITY,
    _uid: uid,
    toFaDigits,
    toEnDigits,
  });
})();
