"use strict";
/* CarMaa — پر کردن خودکار آگهی از روی عکس (کاملاً رایگان، روی دستگاه کاربر).
   بعد از افزودن عکس در مرحلهٔ اول ثبت آگهی، مدل CLIP (js/ai-vision-worker.js) برند، مدل و رنگ را حدس می‌زند
   و فقط فیلدهای خالی فرم را — پس از تأیید کاربر — پر می‌کند. عکس‌ها هیچ‌جا ارسال نمی‌شوند.
   Entry point: carmaaPhotoAutofill.run(photoDataUrls) ; تنظیمات: window.CARMAA_AI_VISION */
(function () {
  const CFG = Object.assign({
    enabled: true,
    maxPhotos: 3,            // photos analysed per run
    localModelPath: "",      // e.g. "models/" to self-host Xenova/clip-vit-base-patch32 (see PHOTO_AUTOFILL_FA.md)
    allowRemote: true,       // download the model from huggingface.co / jsdelivr
    remoteHost: "",          // optional huggingface.co mirror
    minBrand: 0.5, minModel: 0.35, minColor: 0.4, minExterior: 0.35,
  }, window.CARMAA_AI_VISION || {});

  const BRAND_EN = {
    "کیا": "Kia", "فورد": "Ford", "بنز": "Mercedes-Benz", "مازراتی": "Maserati", "فراری": "Ferrari",
    "لامبورگینی": "Lamborghini", "هیوندا": "Hyundai", "تویوتا": "Toyota", "لکسوس": "Lexus", "BMW": "BMW",
    "پورشه": "Porsche", "شورلت": "Chevrolet", "آئودی": "Audi", "لند روور": "Land Rover", "جگوار": "Jaguar",
    "دودج": "Dodge", "کادیلاک": "Cadillac", "جیپ": "Jeep",
  };
  const CN_MAKER_EN = { Great: "Great Wall", Li: "Li Auto" };
  const CN_GROUP = "خودروهای چینی";
  const COLOR_EN = { "مشکی": "black", "سفید": "white", "نقره‌ای": "silver", "طوسی": "dark gray", "قرمز": "red", "آبی": "blue", "سبز": "green", "طلایی": "gold", "زرد": "yellow", "قهوه‌ای": "brown" };

  // English names for models that are written only in Persian in MODELS_BY_BRAND. Latin-named models are used as-is.
  const MODEL_EN = {
    "کیا": { "سراتو": "Cerato", "اپتیما": "Optima", "کی 5": "K5", "سورنتو": "Sorento", "اسپورتیج": "Sportage", "تلوراید": "Telluride", "ریو": "Rio", "پیکانتو": "Picanto", "کارنیوال": "Carnival", "نیرو": "Niro", "سول": "Soul", "استینگر": "Stinger", "موهاوی": "Mohave", "سلتوس": "Seltos", "کادنزا": "Cadenza", "فورته": "Forte", "کوریس": "Quoris", "ریو هاچ‌بک": "Rio hatchback", "کارنز": "Carens", "سید": "Ceed", "پروسید": "ProCeed" },
    "فورد": { "فوکوس": "Focus", "فیوژن": "Fusion", "موستانگ": "Mustang", "اکسپلورر": "Explorer", "اج": "Edge", "اسکیپ": "Escape", "اف-150": "F-150", "رنجر": "Ranger", "برانکو": "Bronco", "اکسپدیشن": "Expedition", "فیستا": "Fiesta", "تاروس": "Taurus", "موستانگ ماخ-ای": "Mustang Mach-E", "اکوسپورت": "EcoSport", "اِوِرست": "Everest", "اِج اِس‌تی": "Edge ST", "ترانزیت": "Transit", "ترانزیت کانکت": "Transit Connect", "ماوریک": "Maverick", "برونکو اسپرت": "Bronco Sport", "فِلیکس": "Flex", "فِرِاستار": "Freestar" },
    "بنز": { "ویتو": "Vito", "اسپرینتر": "Sprinter", "سیتان": "Citan" },
    "مازراتی": { "گیبلی": "Ghibli", "کواتروپورته": "Quattroporte", "لوانته": "Levante", "گرن‌توریسمو": "GranTurismo", "گرن‌کابریو": "GranCabrio", "گریکاله": "Grecale", "شمال": "Shamal", "بیتوربو": "Biturbo", "کوبه": "Coupe", "اسپایدر": "Spyder", "گرن‌توریسمو فولگوره": "GranTurismo Folgore", "گریکاله فولگوره": "Grecale Folgore" },
    "فراری": { "308": "308", "328": "328", "348": "348", "360 مودنا": "360 Modena", "458 ایتالیا": "458 Italia", "488": "488", "روما": "Roma", "روما اسپایدر": "Roma Spider", "پورتوفینو": "Portofino", "812 سوپرفست": "812 Superfast", "پوروسانگوئه": "Purosangue" },
    "لامبورگینی": { "هوراکان": "Huracan", "اوروس": "Urus", "اوروس پرفورمانته": "Urus Performante", "آونتادور": "Aventador", "رِوِلتو": "Revuelto", "گالاردو": "Gallardo", "مورسیه‌لاگو": "Murcielago", "دیابلو": "Diablo", "کانتاچ": "Countach", "سیان": "Sian", "وننو": "Veneno", "سنته‌ناریو": "Centenario", "هوراکان تکنیکا": "Huracan Tecnica", "هوراکان اسپایدر": "Huracan Spyder" },
    "هیوندا": { "النترا": "Elantra", "سوناتا": "Sonata", "توسان": "Tucson", "سانتافه": "Santa Fe", "کونا": "Kona", "آیونیک 5": "Ioniq 5", "آیونیک 6": "Ioniq 6", "آیونیک 9": "Ioniq 9", "پالیسید": "Palisade", "آکسنت": "Accent", "ولاستر": "Veloster", "گرنجور": "Grandeur", "آزرا": "Azera", "بایون": "Bayon", "وِنِیو": "Venue", "کریتا": "Creta", "استاریا": "Staria", "ورنا": "Verna", "تراکَن": "Terracan", "تریجت": "Trajet", "کلیک": "Click", "جنسیس کوپه": "Genesis Coupe", "نکسو": "Nexo", "سانتاکروز": "Santa Cruz", "کاسپر": "Casper", "اکسنت هاچ‌بک": "Accent hatchback" },
    "تویوتا": { "کرولا": "Corolla", "کمری": "Camry", "راو4": "RAV4", "هایلندر": "Highlander", "لندکروزر": "Land Cruiser", "پرادو": "Land Cruiser Prado", "یاریس": "Yaris", "پریوس": "Prius", "تاکوما": "Tacoma", "توندرا": "Tundra", "اینوا": "Innova", "سوپرا": "Supra", "سکویا": "Sequoia", "آوالون": "Avalon", "آریون": "Aurion", "یاریس کراس": "Yaris Cross", "فورتونر": "Fortuner", "هایلوکس": "Hilux", "ونزا": "Venza", "گرند هایلندر": "Grand Highlander", "کرولا کراس": "Corolla Cross", "میرای": "Mirai", "سی‌اچ‌آر": "C-HR", "آیگو": "Aygo", "اوربان کروزر": "Urban Cruiser", "راش": "Rush", "ویوس": "Vios", "لوین": "Levin" },
    "BMW": { "سری 2 اکتیو تورر": "2 Series Active Tourer", "سری 5 تورینگ": "5 Series Touring", "سری 3 تورینگ": "3 Series Touring" },
    "پورشه": { "911": "911", "718 کیمن": "718 Cayman", "718 باکستر": "718 Boxster", "پانامرا": "Panamera", "مکان": "Macan", "کاین": "Cayenne", "تایکان": "Taycan", "ماکان الکتریکی": "Macan Electric", "کاین کوپه": "Cayenne Coupe", "تایکان کراس توریسمو": "Taycan Cross Turismo", "911 تارگا": "911 Targa", "911 توربو": "911 Turbo", "911 داکار": "911 Dakar", "918 اسپایدر": "918 Spyder", "باکستر اسپایدر": "Boxster Spyder", "پانامرا اسپرت توریسمو": "Panamera Sport Turismo" },
    "شورلت": { "کروز": "Cruze", "مالیبو": "Malibu", "کامارو": "Camaro", "کوروت": "Corvette", "ایکوینوکس": "Equinox", "تراورس": "Traverse", "تاهو": "Tahoe", "سابوربن": "Suburban", "سیلورادو": "Silverado", "بولت": "Bolt", "اسپارک": "Spark", "سونیک": "Sonic", "ایمپالا": "Impala", "کپتیوا": "Captiva", "تریل‌بلیزر": "Trailblazer", "بِلِیزر": "Blazer", "کلرادو": "Colorado", "آوئو": "Aveo", "ولتا": "Volt", "مونت کارلو": "Monte Carlo", "کوبالت": "Cobalt", "اپترا": "Optra" },
    "لند روور": { "رنج روور": "Range Rover", "رنج روور اسپرت": "Range Rover Sport", "رنج روور ولار": "Range Rover Velar", "رنج روور ایوک": "Range Rover Evoque", "دیفندر": "Defender", "دیسکاوری": "Discovery", "دیسکاوری اسپرت": "Discovery Sport", "فریلندر": "Freelander", "رنج روور کلاسیک": "Range Rover Classic", "دیفندر 90": "Defender 90", "دیفندر 110": "Defender 110", "دیفندر 130": "Defender 130", "دیسکاوری 5": "Discovery 5", "رنج روور هیبرید": "Range Rover Hybrid" },
    "جگوار": { "مارک 2": "Mark 2" },
    "دودج": { "چارجر": "Charger", "چلنجر": "Challenger", "دورانگو": "Durango", "جورنی": "Journey", "دارت": "Dart", "رم 1500": "Ram 1500", "رم 2500": "Ram 2500", "رم 3500": "Ram 3500", "نیترو": "Nitro", "کالیبر": "Caliber", "وایپر": "Viper", "کاروان": "Caravan", "گرند کاروان": "Grand Caravan", "هورنت": "Hornet", "مگنوم": "Magnum", "اونجر": "Avenger", "استلث": "Stealth" },
    "کادیلاک": { "اسکالید": "Escalade", "لیریک": "Lyriq", "اپتیق": "Optiq" },
    "جیپ": { "رنگلر": "Wrangler", "چروکی": "Cherokee", "گرند چروکی": "Grand Cherokee", "کامپس": "Compass", "رنگید": "Renegade", "گلادیاتور": "Gladiator", "واگونیر": "Wagoneer", "گرند واگونیر": "Grand Wagoneer", "لیبرتی": "Liberty", "پاتریوت": "Patriot", "کماندر": "Commander", "ویلیز": "Willys", "آوِنجر": "Avenger" },
  };
  const FA = /[\u0600-\u06FF]/;

  function modelEnglish(brand, model) {
    const mapped = MODEL_EN[brand] && MODEL_EN[brand][model];
    let en = mapped || model;
    en = en.replace(/^کلاس ([A-Z])$/, "$1-Class").replace(/^([A-Z]) کلاس$/, "$1-Class").replace(/^G-کلاس$/, "G-Class")
           .replace(/^سری (\d)$/, "$1 Series");
    return FA.test(en) ? null : en;           // still Persian → unknown, leave it out of the candidates
  }

  // maker → candidate models (Persian name kept for the form, English name for CLIP)
  function buildCatalog() {
    const makers = [];
    const all = (typeof MODELS_BY_BRAND !== "undefined") ? MODELS_BY_BRAND : {};
    Object.keys(BRAND_EN).forEach((brand) => {
      const en = BRAND_EN[brand];
      const models = (all[brand] || []).map((name) => {
        const me = modelEnglish(brand, name);
        return me ? { name, en: (me.toLowerCase().startsWith(en.toLowerCase()) ? me : en + " " + me) } : null;
      }).filter(Boolean);
      makers.push({ key: brand, brand, en, models });
    });
    const groups = {};
    (all[CN_GROUP] || []).forEach((name) => {
      const tok = name.split(" ")[0];
      (groups[tok] = groups[tok] || []).push({ name, en: name.replace(/^Great /, "Great Wall ").replace(/^Li /, "Li Auto ") });
    });
    Object.keys(groups).forEach((tok) => {
      if (groups[tok].length < 2) return;
      makers.push({ key: CN_GROUP + ":" + tok, brand: CN_GROUP, en: CN_MAKER_EN[tok] || tok, models: groups[tok] });
    });
    const colors = (typeof SELL_COLORS !== "undefined" ? SELL_COLORS : []).filter(c => COLOR_EN[c.name]).map(c => ({ key: c.hex, en: COLOR_EN[c.name], name: c.name }));
    return { makers, colors };
  }

  /* ---------- worker bridge ---------- */
  let worker = null, seq = 0;
  const pending = new Map();
  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker("js/ai-vision-worker.js?v=1", { type: "module" });
    worker.postMessage({ type: "init", cfg: { localModelPath: CFG.localModelPath, allowRemote: CFG.allowRemote, remoteHost: CFG.remoteHost } });
    worker.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === "progress") { pending.forEach(p => p.onProgress && p.onProgress(m.pct)); return; }
      const p = pending.get(m.id); if (!p) return;
      if (m.type === "phase") p.onPhase && p.onPhase(m.phase);
      else if (m.type === "result") { pending.delete(m.id); p.resolve(m.result); }
      else if (m.type === "error") { pending.delete(m.id); p.reject(new Error(m.message)); }
    };
    worker.onerror = (ev) => { const err = new Error((ev && ev.message) || "worker failed"); pending.forEach(p => p.reject(err)); pending.clear(); try { worker.terminate(); } catch (_) {} worker = null; };
    return worker;
  }
  function analyze(urls, handlers) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, Object.assign({ resolve, reject }, handlers));
      ensureWorker().postMessage({ id, type: "analyze", images: urls, catalog: buildCatalog() });
    });
  }

  // Square, gray-padded copy (CLIP centre-crops to a square, so a wide car photo would lose its front/rear).
  function prepare(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const S = 336, c = document.createElement("canvas"); c.width = c.height = S;
        const g = c.getContext("2d"); g.fillStyle = "#808080"; g.fillRect(0, 0, S, S);
        const k = Math.min(S / img.width, S / img.height), w = img.width * k, h = img.height * k;
        g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
        c.toBlob((b) => resolve(b ? URL.createObjectURL(b) : null), "image/jpeg", 0.9);
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  /* ---------- popup (reuses the ai-autofill.css glass card) ---------- */
  const SPARKLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l1.9 5.6a3 3 0 0 0 1.9 1.9l5.6 1.9-5.6 1.9a3 3 0 0 0-1.9 1.9L12 21.3l-1.9-5.6a3 3 0 0 0-1.9-1.9l-5.6-1.9 5.6-1.9a3 3 0 0 0 1.9-1.9L12 2.5z"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.8l4.2 4.2 8.8-9.4"/></svg>';
  const STEPS = [["load", "آماده‌سازی هوش مصنوعی"], ["images", "بررسی عکس‌ها"], ["brand", "برند و مدل"], ["color", "رنگ خودرو"]];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function openPopup(onCancel) {
    const root = document.createElement("div");
    root.className = "cm-ai"; root.setAttribute("role", "alertdialog"); root.setAttribute("aria-live", "polite");
    root.innerHTML =
      '<div class="cm-ai-card">' +
        '<div class="cm-ai-orb"><span class="cm-ai-glow"></span><span class="cm-ai-ring"></span><span class="cm-ai-core">' + SPARKLE + '</span><span class="cm-ai-check">' + CHECK + '</span></div>' +
        '<h3 class="cm-ai-title">هوش مصنوعی</h3>' +
        '<p class="cm-ai-sub">در حال بررسی عکس خودروی شماست</p>' +
        '<div class="cm-ai-car" hidden></div>' +
        '<ul class="cm-ai-steps">' + STEPS.map(s => '<li data-step="' + s[0] + '"><span class="cm-ai-dot"></span>' + s[1] + '</li>').join("") + '</ul>' +
        '<div class="cm-ai-bar"><i></i></div>' +
        '<p class="cm-ai-note"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.2"/></svg><span>تحلیل روی گوشی شما انجام می‌شود و عکس‌ها جایی ارسال نمی‌شوند. بار اول دانلود مدل (حدود ۱۵۰ مگابایت) ممکن است کمی طول بکشد. نتیجه ممکن است اشتباه باشد.</span></p>' +
        '<div class="cm-ai-actions"><button type="button" class="cm-ai-btn is-ghost" data-ai="cancel">بستن</button></div>' +
      '</div>';
    document.body.appendChild(root);
    requestAnimationFrame(() => root.classList.add("is-in"));
    const $ = (q) => root.querySelector(q);
    const li = (k) => root.querySelector('[data-step="' + k + '"]');
    const bar = $(".cm-ai-bar i");
    const api = {
      root,
      phase(k) {
        let reached = false;
        STEPS.forEach(([key]) => { const el = li(key); if (key === k) { reached = true; el.classList.add("is-active"); el.classList.remove("is-done"); } else if (!reached) { el.classList.remove("is-active"); el.classList.add("is-done"); } });
        const idx = STEPS.findIndex(s => s[0] === k); bar.style.width = Math.round(((idx + .5) / STEPS.length) * 100) + "%";
      },
      download(pct) { if (pct > 0 && pct < 100) { $(".cm-ai-sub").textContent = "دانلود مدل هوش مصنوعی… " + (typeof toFaDigits === "function" ? toFaDigits(String(pct)) : pct) + "٪"; } },
      done(title, sub) {
        root.classList.add("is-done"); STEPS.forEach(([k]) => { li(k).classList.remove("is-active"); li(k).classList.add("is-done"); });
        bar.style.width = "100%"; $(".cm-ai-title").textContent = title; $(".cm-ai-sub").textContent = sub;
      },
      summary(text) { const el = $(".cm-ai-car"); el.hidden = false; el.textContent = text; },
      actions(html) { $(".cm-ai-actions").innerHTML = html; },
      close() { root.classList.add("is-out"); setTimeout(() => root.remove(), 280); },
    };
    root.addEventListener("click", (e) => { if (e.target.closest('[data-ai="cancel"]')) { onCancel && onCancel(); } });
    return api;
  }

  /* ---------- decide + apply ---------- */
  function decide(r) {
    const out = { brand: "", model: "", colorHex: "", colorName: "" };
    if (!r || r.pExterior < CFG.minExterior || !r.maker) return out;
    const brandOk = r.maker.p >= CFG.minBrand && r.maker.p >= r.maker.second * 1.5;
    if (!brandOk) return out;
    out.brand = r.maker.brand;
    if (r.model && r.model.p >= CFG.minModel && r.model.p >= r.model.second * 1.3) out.model = r.model.name;
    if (r.color && r.color.p >= CFG.minColor) {
      const c = (typeof SELL_COLORS !== "undefined" ? SELL_COLORS : []).find(x => x.hex === r.color.key);
      if (c) { out.colorHex = c.hex; out.colorName = c.name; }
    }
    return out;
  }
  function applyGuess(g) {
    try { syncSellFormFromDOM(); } catch (_) {}
    const f = Object.assign({}, state.sellForm);
    let changed = 0;
    if (g.brand && !f.brand) { f.brand = g.brand; f.model = ""; changed++; }
    if (g.model && f.brand === g.brand && !f.model) { f.model = g.model; changed++; }
    if (g.colorHex && !f.color) { f.color = g.colorHex; changed++; }
    if (changed) { state = Object.assign({}, state, { sellForm: f, sellError: null }); render(); }
    return changed;
  }

  let running = false;
  async function run(photos) {
    if (!CFG.enabled || running) return;
    const list = (Array.isArray(photos) ? photos : []).filter(Boolean).slice(0, CFG.maxPhotos);
    if (!list.length || typeof Worker === "undefined") return;
    const f = (state && state.sellForm) || {};
    if (f.brand && f.model && f.color) return;                             // nothing left to suggest
    const conn = navigator.connection;
    if (conn && conn.saveData && !(window.CARMAA_AI_VISION && window.CARMAA_AI_VISION.force)) return;   // respect Data Saver

    running = true;
    let cancelled = false, urls = [];
    const ui = openPopup(() => { cancelled = true; ui.close(); });
    ui.phase("load");
    try {
      urls = (await Promise.all(list.map(prepare))).filter(Boolean);
      if (!urls.length) throw new Error("no images");
      const result = await analyze(urls, { onPhase: (p) => !cancelled && ui.phase(p), onProgress: (p) => !cancelled && ui.download(p) });
      if (cancelled) return;
      const g = decide(result);
      if (!g.brand && !g.colorHex) {
        ui.done("چیزی تشخیص داده نشد", result && result.pExterior < CFG.minExterior ? "عکس بیرونی خودرو پیدا نشد؛ یک عکس واضح از نمای بیرون اضافه کنید." : "اطمینان کافی برای حدس زدن نبود؛ اطلاعات را دستی وارد کنید.");
        ui.actions('<button type="button" class="cm-ai-btn" data-ai="cancel">متوجه شدم</button>');
        return;
      }
      const parts = [g.brand && g.brand !== CN_GROUP ? g.brand : "", g.model, g.colorName].filter(Boolean);
      ui.done("تشخیص انجام شد", "اگر درست است، در فرم ثبت می‌شود.");
      ui.summary(parts.join(" · ") || g.brand);
      ui.actions('<button type="button" class="cm-ai-btn" data-ai="apply">ثبت در فرم</button><button type="button" class="cm-ai-btn is-ghost" data-ai="cancel">نه، خودم وارد می‌کنم</button>');
      ui.root.addEventListener("click", (e) => {
        if (!e.target.closest('[data-ai="apply"]')) return;
        const n = applyGuess(g); ui.close();
        if (n && typeof showToast === "function") showToast("اطلاعات پیشنهادی ثبت شد؛ لطفاً بررسی کنید.");
      });
    } catch (err) {
      if (!cancelled) {
        ui.done("تشخیص خودکار در دسترس نیست", "اطلاعات خودرو را دستی وارد کنید.");
        ui.actions('<button type="button" class="cm-ai-btn" data-ai="cancel">باشه</button>');
        try { console.warn("[photo-autofill]", err); } catch (_) {}
      }
    } finally {
      running = false;
      urls.forEach(u => { try { URL.revokeObjectURL(u); } catch (_) {} });
    }
  }

  window.carmaaPhotoAutofill = { run, buildCatalog, decide, _cfg: CFG };
})();
