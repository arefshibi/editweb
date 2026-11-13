"use strict";

/* ---------------------------------------------------------------
   FULL-SCREEN FILTERS OVERLAY — builds and updates the filter sheet (sort, price range slider, body style, transmission, etc.).
// Edit the filters screen here.
--------------------------------------------------------------- */

  /* ---------------------------------------------------------------
     FULL-SCREEN FILTERS OVERLAY
     Opened from the "فیلترها" button in the listing toolbar. Unlike
     the old inline accordion (brand/model/year/city only), this
     covers every dimension a listing can actually be filtered or
     sorted by: sort order, condition, model, year, city, color and
     price range. Selections apply live (state.filters/state.sort
     update immediately); the footer button just closes the sheet.
  --------------------------------------------------------------- */

  function getFilterOverlayContext() {
    const routeBrand = state.route.page === "brand"
      ? state.route.brand
      : (state.route.page === "listings" && state.route.brand !== "all" ? state.route.brand : null);
    const selectedBrand = routeBrand || state.selectedBrand || null;
    const scopeBrand = selectedBrand && selectedBrand !== "همه برندها" ? selectedBrand : null;
    const scopedListings = LISTINGS.filter((l) => !scopeBrand || l.brand === scopeBrand);
    return { selectedBrand, scopedListings };
  }

  function getFilterOverlayResultCount() {
    const { scopedListings } = getFilterOverlayContext();
    const q = (state.search || "").trim().toLowerCase();
    const searchable = q
      ? scopedListings.filter((l) => `${l.title} ${l.brand} ${vehicleModelName(l)} ${DEALERS[l.brand] ? DEALERS[l.brand].city : ""}`.toLowerCase().includes(q))
      : scopedListings;
    return applyListingFilters(searchable).length;
  }

  function formatPriceShort(n) {
    return "$" + Math.round(n).toLocaleString("en-US");
  }

  // Which "نمایش همه …" lists are expanded (kept while the sheet re-renders).
  const filterUi = { brands: false, cities: false, countries: false, bodies: false, colors: false };

  const FILTER_BRAND_PREVIEW = 8;
  const FILTER_BODY_ITEMS = [
    { value: "سدان", img: "assets/filter/sedan.webp" },
    { value: "هاچ‌بک", img: "assets/filter/hatchback.webp" },
    { value: "وانت", img: "assets/filter/pickup.webp" },
    { value: "کوپه", img: "assets/filter/coupe.webp" },
    { value: "کروک", img: "assets/filter/convertible.webp" },
    { value: "شاسی‌بلند", img: "assets/filter/suv.webp" },
    { value: "مینی‌ون", icon: "car" },
    { value: "استیشن", icon: "car" },
  ];
  const FILTER_SPECIAL_ITEMS = [
    { value: "classic", label: "کلاسیک", img: "assets/filter/classic.webp" },
    { value: "offroad", label: "آفرود", img: "assets/filter/offroad.webp" },
    { value: "freezone", label: "منطقه آزاد", img: "assets/filter/freezone.webp" },
  ];
  const FILTER_COLOR_ITEMS = [
    { name: "سفید", hex: "#ffffff" }, { name: "مشکی", hex: "#1D1D1F" }, { name: "نقره‌ای", hex: "#c9c9c9" }, { name: "نوک مدادی", hex: "#4a4b4d" },
    { name: "آبی", hex: "#0a45dc" }, { name: "قهوه‌ای", hex: "#6e100c" }, { name: "قرمز", hex: "#ff1208" }, { name: "یشمی", hex: "#3f8a67" },
    { name: "سرمه‌ای", hex: "#14213d" }, { name: "زرد", hex: "#e8c21a" }, { name: "نارنجی", hex: "#e8780f" }, { name: "بژ", hex: "#cdb89a" },
    { name: "طلایی", hex: "#b8924a" }, { name: "بنفش", hex: "#5b3a8c" }, { name: "صورتی", hex: "#e48fb0" }, { name: "خاکستری", hex: "#8a8a86" },
  ];

  const flagSvg = (inner) => `<svg viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${inner}</svg>`;
  const FILTER_COUNTRIES = [
    { value: "ایرانی", flag: flagSvg('<rect width="30" height="7" fill="#239f40"/><rect y="7" width="30" height="6" fill="#fff"/><rect y="13" width="30" height="7" fill="#da0000"/><circle cx="15" cy="10" r="2" fill="none" stroke="#da0000" stroke-width="1"/>') },
    { value: "ژاپنی", flag: flagSvg('<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>') },
    { value: "کره‌ای", flag: flagSvg('<rect width="30" height="20" fill="#fff"/><path d="M10.5 10a4.5 4.5 0 0 1 9 0z" fill="#cd2e3a"/><path d="M10.5 10a4.5 4.5 0 0 0 9 0z" fill="#0047a0"/><g stroke="#262628" stroke-width="1"><path d="M3 4l3-2M4 5.2l3-2M2 2.8l3-2"/><path d="M27 4l-3-2M26 5.2l-3-2M28 2.8l-3-2"/><path d="M3 16l3 2M4 14.8l3 2M2 17.2l3 2"/><path d="M27 16l-3 2M26 14.8l-3 2M28 17.2l-3 2"/></g>') },
    { value: "چینی", flag: flagSvg('<rect width="30" height="20" fill="#de2910"/><path d="M6 3l1.2 3.6H11L8 8.8l1.1 3.6L6 10.2 2.9 12.4 4 8.8 1 6.6h3.8z" fill="#ffde00"/><circle cx="12.5" cy="3.5" r=".9" fill="#ffde00"/><circle cx="14.5" cy="6" r=".9" fill="#ffde00"/><circle cx="14.5" cy="9" r=".9" fill="#ffde00"/><circle cx="12.5" cy="11.5" r=".9" fill="#ffde00"/>') },
    { value: "آمریکایی", flag: flagSvg('<rect width="30" height="20" fill="#fff"/><g fill="#b22234"><rect width="30" height="1.54"/><rect y="3.08" width="30" height="1.54"/><rect y="6.15" width="30" height="1.54"/><rect y="9.23" width="30" height="1.54"/><rect y="12.3" width="30" height="1.54"/><rect y="15.4" width="30" height="1.54"/><rect y="18.46" width="30" height="1.54"/></g><rect width="12" height="10.8" fill="#3c3b6e"/><g fill="#fff"><circle cx="2.5" cy="2.5" r=".6"/><circle cx="6" cy="2.5" r=".6"/><circle cx="9.5" cy="2.5" r=".6"/><circle cx="4.2" cy="5.4" r=".6"/><circle cx="7.8" cy="5.4" r=".6"/><circle cx="2.5" cy="8.3" r=".6"/><circle cx="6" cy="8.3" r=".6"/><circle cx="9.5" cy="8.3" r=".6"/></g>') },
    { value: "آلمانی", flag: flagSvg('<rect width="30" height="7" fill="#000"/><rect y="7" width="30" height="6" fill="#d00"/><rect y="13" width="30" height="7" fill="#ffce00"/>') },
    { value: "ایتالیایی", flag: flagSvg('<rect width="10" height="20" fill="#009246"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ce2b37"/>') },
    { value: "فرانسوی", flag: flagSvg('<rect width="10" height="20" fill="#002395"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ed2939"/>') },
    { value: "انگلیسی", flag: flagSvg('<rect width="30" height="20" fill="#012169"/><path d="M0 0l30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0l30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.6"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.4"/>') },
    { value: "اسپانیایی", flag: flagSvg('<rect width="30" height="20" fill="#c60b1e"/><rect y="5" width="30" height="10" fill="#ffc400"/>') },
    { value: "سوئدی", flag: flagSvg('<rect width="30" height="20" fill="#006aa7"/><rect x="9" width="4" height="20" fill="#fecc00"/><rect y="8" width="30" height="4" fill="#fecc00"/>') },
    { value: "روسی", flag: flagSvg('<rect width="30" height="7" fill="#fff"/><rect y="7" width="30" height="6" fill="#0039a6"/><rect y="13" width="30" height="7" fill="#d52b1e"/>') },
    { value: "ترکیه‌ای", flag: flagSvg('<rect width="30" height="20" fill="#e30a17"/><circle cx="11.5" cy="10" r="5" fill="#fff"/><circle cx="13" cy="10" r="4" fill="#e30a17"/><circle cx="18" cy="10" r="1.3" fill="#fff"/>') },
  ];

  function filterBrandLogo(b) {
    const logo = b.img || (b.name === "کیا" ? "logos/kia.webp" : "");
    if (logo) return `<img src="${escHtml(logo)}" alt="" loading="lazy" decoding="async">`;
    const txt = b.generic ? "CN" : (b.initials || b.name.slice(0, 1));
    return `<span class="filter-brand-fallback" aria-hidden="true">${escHtml(txt)}</span>`;
  }

  function niceStep(span, parts) {
    const raw = span / parts;
    const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const f = raw / pow;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  }

  function buildFilterOverlayBody() {
    const wrap = document.createElement("div");
    wrap.className = "filter-overlay-sections";
    const { selectedBrand, scopedListings } = getFilterOverlayContext();
    const tomanText = (n) => { const f = formatTomanPrice(String(Math.round(n))); return `${f.amount} ${f.unit}`.trim(); };

    // Section = plain title on the right; on the left a "حذف" link when the
    // section has a selection (or an extra control, e.g. the installment box).
    const addSection = (key, title, contentEl, hasSelection, opts) => {
      opts = opts || {};
      const sec = document.createElement("div");
      sec.className = "filter-section";
      const h = document.createElement("div");
      h.className = "filter-section-head";
      const titleEl = document.createElement("span");
      titleEl.className = "filter-section-title-text";
      titleEl.textContent = title;
      if (opts.titleNote) {
        const note = document.createElement("small");
        note.className = "filter-section-title-note";
        note.textContent = opts.titleNote;
        titleEl.appendChild(note);
      }
      h.appendChild(titleEl);
      if (opts.headExtra) {
        h.appendChild(opts.headExtra);
      } else if (hasSelection) {
        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.className = "filter-section-clear";
        clearBtn.dataset.action = "clearOverlayFilterKey";
        clearBtn.dataset.filter = key;
        clearBtn.setAttribute("aria-label", "پاک کردن " + title);
        const label = document.createElement("span");
        label.textContent = "حذف";
        const xIcon = document.createElement("span");
        xIcon.className = "filter-section-clear-icon";
        setDynamicHTML(xIcon, icon("trash", { width: 16, height: 16 }));
        clearBtn.append(label, xIcon);
        h.appendChild(clearBtn);
      }
      sec.append(h, contentEl);
      wrap.appendChild(sec);
    };

    const makePillGrid = (items, isActive, action, filterKey, labelOf, cols) => {
      const grid = document.createElement("div");
      grid.className = "filter-pill-grid";
      if (cols) grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      items.forEach((value) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "filter-pill" + (isActive(value) ? " is-active" : "");
        const span = document.createElement("span");
        span.textContent = labelOf ? labelOf(value) : value;
        b.appendChild(span);
        b.dataset.action = action;
        if (action === "setOverlaySort") b.dataset.sort = value;
        else { b.dataset.filter = filterKey; b.dataset.value = value; }
        grid.appendChild(b);
      });
      return grid;
    };

    const makeRadioRow = (items, isActive, action, filterKey) => {
      const row = document.createElement("div");
      row.className = "filter-radio-row";
      items.forEach((value) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "filter-radio" + (isActive(value) ? " is-active" : "");
        b.dataset.action = action;
        b.dataset.filter = filterKey;
        b.dataset.value = value;
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", isActive(value) ? "true" : "false");
        b.innerHTML = `<span class="filter-radio-dot"></span><span class="filter-radio-label"></span>`;
        b.querySelector(".filter-radio-label").textContent = value;
        row.appendChild(b);
      });
      return row;
    };

    // "همه | a | b" segmented control (single choice, «همه» clears).
    const makeSegmented = (filterKey, items, current) => {
      const seg = document.createElement("div");
      seg.className = "filter-seg";
      seg.setAttribute("role", "radiogroup");
      const all = [{ value: null, label: "همه" }].concat(items);
      all.forEach((it) => {
        const on = (it.value == null && !current) || (it.value != null && current === it.value);
        const b = document.createElement("button");
        b.type = "button";
        b.className = "filter-seg-btn" + (on ? " is-active" : "");
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", on ? "true" : "false");
        b.textContent = it.label;
        if (it.value == null) { b.dataset.action = "clearOverlayFilterKey"; b.dataset.filter = filterKey; }
        else { b.dataset.action = "setOverlayFilterValue"; b.dataset.filter = filterKey; b.dataset.value = it.value; }
        seg.appendChild(b);
      });
      return seg;
    };

    // Visual cards (image on a light tile + label): body types, special cases.
    const makeVisualGrid = (items, isActive, action, filterKey) => {
      const grid = document.createElement("div");
      grid.className = "filter-vgrid";
      items.forEach((it) => {
        const b = document.createElement("button");
        b.type = "button";
        const on = isActive(it.value);
        b.className = "filter-vitem" + (on ? " is-active" : "");
        b.dataset.action = action;
        b.dataset.filter = filterKey;
        b.dataset.value = it.value;
        b.setAttribute("aria-pressed", on ? "true" : "false");
        const pic = it.img
          ? `<img src="${escHtml(it.img)}" alt="" loading="lazy" decoding="async">`
          : icon(it.icon || "car", { width: 30, height: 30 });
        b.innerHTML = `<span class="filter-vitem-pic">${pic}</span><span class="filter-vitem-label"></span>`;
        b.querySelector(".filter-vitem-label").textContent = it.label || it.value;
        grid.appendChild(b);
      });
      return grid;
    };

    const makeMoreButton = (key, label, lessLabel) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "filter-more-btn";
      b.dataset.action = "toggleOverlayMore";
      b.dataset.key = key;
      b.setAttribute("aria-expanded", filterUi[key] ? "true" : "false");
      const plus = document.createElement("span");
      plus.className = "filter-more-plus";
      plus.textContent = filterUi[key] ? "−" : "+";
      const t = document.createElement("span");
      t.textContent = filterUi[key] ? lessLabel : label;
      b.append(plus, t);
      return b;
    };

    // مرتب‌سازی (sort)
    const sortKeys = ["newest", "price-asc", "price-desc", "miles-asc", "year-desc"];
    addSection("sort", "مرتب‌سازی", makePillGrid(sortKeys, (v) => state.sort === v, "setOverlaySort", null, (k) => SORT_LABELS[k] || k, 3));

    // برند (logo grid, 4 per row, rest behind «نمایش همه برندها»)
    {
      const brandList = BRANDS.filter((b) => !b.all);
      const shown = filterUi.brands ? brandList : brandList.slice(0, FILTER_BRAND_PREVIEW);
      const box = document.createElement("div");
      const grid = document.createElement("div");
      grid.className = "filter-brand-grid";
      shown.forEach((b) => {
        const on = selectedBrand === b.name;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "filter-brand-item" + (on ? " is-active" : "");
        btn.dataset.action = "setOverlayBrand";
        btn.dataset.value = b.name;
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.innerHTML = `<span class="filter-brand-logo">${filterBrandLogo(b)}</span><span class="filter-brand-name"></span>`;
        btn.querySelector(".filter-brand-name").textContent = b.name;
        grid.appendChild(btn);
      });
      box.append(grid);
      if (brandList.length > FILTER_BRAND_PREVIEW) box.append(makeMoreButton("brands", "نمایش همه برندها", "نمایش برندهای کمتر"));
      addSection("brand", "برند", box, !!selectedBrand);
    }

    // مدل ماشین — only once a brand is in scope
    if (selectedBrand) {
      const models = Array.from(new Set(scopedListings.map(vehicleModelName))).filter(Boolean);
      if (models.length) {
        addSection("model", "مدل ماشین", makePillGrid(models, (v) => state.filters.model === v, "setOverlayFilterValue", "model", null, 3), !!state.filters.model);
      }
    }

    // شهر فروشنده — chosen city as a removable chip, full list behind a button
    {
      const cityList = Array.from(new Set(
        KHUZESTAN_CITIES.slice()
      )).filter(Boolean);
      const box = document.createElement("div");
      box.className = "filter-city-box";
      if (state.filters.city) {
        const chip = document.createElement("div");
        chip.className = "filter-chip-selected";
        const label = document.createElement("span");
        label.textContent = state.filters.city;
        const x = document.createElement("button");
        x.type = "button";
        x.dataset.action = "clearOverlayFilterKey";
        x.dataset.filter = "city";
        x.setAttribute("aria-label", "حذف شهر");
        setDynamicHTML(x, icon("x", { width: 18, height: 18 }));
        chip.append(label, x);
        box.append(chip);
      }
      if (filterUi.cities) box.append(makePillGrid(cityList, (v) => state.filters.city === v, "setOverlayFilterValue", "city", null, 2));
      box.append(makeMoreButton("cities", "نمایش همه شهرها", "نمایش شهرهای کمتر"));
      addSection("city", "شهر فروشنده", box, !!state.filters.city);
    }

    // قیمت (تومان) — from / to dropdowns + installment checkbox
    {
      const prices = scopedListings.map((l) => parsePrice(l.price)).filter((n) => n > 0);
      const box = document.createElement("div");
      box.className = "filter-price-fields";
      let steps = [];
      if (prices.length) {
        const lo = Math.min(...prices), hi = Math.max(...prices);
        const step = niceStep(Math.max(hi - lo, hi * 0.2), 10);
        const start = Math.max(0, Math.floor(lo / step) * step);
        for (let v = start; v <= Math.ceil(hi / step) * step + 0.0001 && steps.length < 40; v += step) steps.push(Math.round(v));
        steps = steps.filter((v) => v > 0);
      }
      [state.filters.priceMin, state.filters.priceMax].forEach((v) => { if (v != null && !steps.includes(v)) steps.push(v); });
      steps.sort((a, b) => a - b);
      const mk = (id, placeholder, cur, aria) => {
        const wrapSel = document.createElement("label");
        wrapSel.className = "filter-select";
        const sel = document.createElement("select");
        sel.id = id;
        sel.setAttribute("aria-label", aria);
        const o0 = document.createElement("option");
        o0.value = ""; o0.textContent = placeholder;
        sel.appendChild(o0);
        steps.forEach((v) => {
          const o = document.createElement("option");
          o.value = String(v); o.textContent = tomanText(v);
          if (cur != null && Number(cur) === v) o.selected = true;
          sel.appendChild(o);
        });
        wrapSel.append(sel);
        const chev = document.createElement("span");
        chev.className = "filter-select-chev";
        setDynamicHTML(chev, icon("chevron-down", { width: 16, height: 16 }));
        wrapSel.append(chev);
        return wrapSel;
      };
      box.append(mk("filterPriceMin", "از قیمت", state.filters.priceMin, "حداقل قیمت"), mk("filterPriceMax", "تا قیمت", state.filters.priceMax, "حداکثر قیمت"));

      const check = document.createElement("button");
      check.type = "button";
      const on = !!state.filters.installment;
      check.className = "filter-check" + (on ? " is-active" : "");
      check.dataset.action = "setOverlayFilterValue";
      check.dataset.filter = "installment";
      check.dataset.value = "1";
      check.setAttribute("role", "checkbox");
      check.setAttribute("aria-checked", on ? "true" : "false");
      check.innerHTML = `<span class="filter-check-box">${on ? icon("check", { width: 14, height: 14 }) : ""}</span><span>اقساطی</span>`;
      addSection("price", "قیمت", box, false, { titleNote: "(تومان)", headExtra: check });
    }

    // سال ساخت (year)
    const years = Array.from(new Set(scopedListings.map((l) => (l.title.match(/\b(19|20)\d{2}\b/) || [""])[0]))).filter(Boolean).sort().reverse();
    if (years.length) addSection("year", "سال ساخت", makePillGrid(years, (v) => state.filters.year === v, "setOverlayFilterValue", "year", null, 3), !!state.filters.year);

    // کشور سازنده (flags)
    {
      const shown = filterUi.countries ? FILTER_COUNTRIES : FILTER_COUNTRIES.slice(0, 8);
      const box = document.createElement("div");
      const grid = document.createElement("div");
      grid.className = "filter-flag-grid";
      shown.forEach((c) => {
        const on = state.filters.country === c.value;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "filter-flag-item" + (on ? " is-active" : "");
        b.dataset.action = "setOverlayFilterValue";
        b.dataset.filter = "country";
        b.dataset.value = c.value;
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.innerHTML = `<span class="filter-flag">${c.flag}</span><span class="filter-flag-name"></span>`;
        b.querySelector(".filter-flag-name").textContent = c.value;
        grid.appendChild(b);
      });
      box.append(grid, makeMoreButton("countries", "نمایش همه کشورهای سازنده", "نمایش کشورهای کمتر"));
      addSection("country", "کشور سازنده", box, !!state.filters.country);
    }

    // گیربکس (segmented)
    {
      const present = new Set(scopedListings.map(vehicleTransmission));
      const order = ["اتوماتیک", "دنده‌ای"].concat(["دوکلاچه (DCT)", "پیوسته (CVT)"].filter((t) => present.has(t)));
      addSection("transmission", "گیربکس", makeSegmented("transmission", order.map((v) => ({ value: v, label: v })), state.filters.transmission), false);
    }

    // فروشنده (segmented)
    addSection("sellerType", "فروشنده", makeSegmented("sellerType", [{ value: "personal", label: "شخصی" }, { value: "dealer", label: "نمایشگاه" }], state.filters.sellerType), false);

    // وضعیت (condition)
    addSection(
      "condition", "وضعیت",
      makeRadioRow(["نو", "کارکرده"], (v) => state.filters.condition === v, "setOverlayFilterValue", "condition"),
      !!state.filters.condition
    );

    // فوری‌ها
    addSection(
      "urgent", "فوری‌ها",
      makeRadioRow(["فقط آگهی‌های فوری"], () => !!state.filters.urgent, "setOverlayFilterValue", "urgent"),
      !!state.filters.urgent
    );

    // نوع بدنه (images, 3 per row, rest behind «نمایش همه بدنه‌ها»)
    {
      const items = filterUi.bodies ? FILTER_BODY_ITEMS : FILTER_BODY_ITEMS.slice(0, 6);
      const box = document.createElement("div");
      box.append(makeVisualGrid(items, (v) => state.filters.bodyStyle === v, "setOverlayFilterValue", "bodyStyle"));
      box.append(makeMoreButton("bodies", "نمایش همه بدنه‌ها", "نمایش بدنه‌های کمتر"));
      addSection("bodyStyle", "نوع بدنه", box, !!state.filters.bodyStyle);
    }

    // رنگ بدنه (swatches, 4 per row)
    {
      const items = filterUi.colors ? FILTER_COLOR_ITEMS : FILTER_COLOR_ITEMS.slice(0, 8);
      const box = document.createElement("div");
      const grid = document.createElement("div");
      grid.className = "filter-swatch-grid";
      items.forEach(({ name, hex }) => {
        const isActive = state.filters.color === name;
        const item = document.createElement("button");
        item.type = "button";
        item.className = "filter-swatch-item" + (isActive ? " is-active" : "");
        item.dataset.action = "setOverlayFilterValue";
        item.dataset.filter = "color";
        item.dataset.value = name;
        item.setAttribute("aria-label", name);
        item.setAttribute("aria-pressed", isActive ? "true" : "false");
        const swatch = document.createElement("span");
        swatch.className = "filter-swatch";
        swatch.style.background = hex;
        if (isActive) {
          const isLight = /^#(f|e|c)/i.test(hex);
          setDynamicHTML(swatch, icon("check", { width: 14, height: 14, stroke: isLight ? "#333336" : "#e7eaed" }));
        }
        const label = document.createElement("span");
        label.className = "filter-swatch-name";
        label.textContent = name;
        item.append(swatch, label);
        grid.appendChild(item);
      });
      box.append(grid, makeMoreButton("colors", "نمایش همه رنگ‌ها", "نمایش رنگ‌های کمتر"));
      addSection("color", "رنگ بدنه", box, !!state.filters.color);
    }

    // موارد خاص (multi-select)
    {
      const cur = Array.isArray(state.filters.specials) ? state.filters.specials : [];
      addSection("specials", "موارد خاص", makeVisualGrid(FILTER_SPECIAL_ITEMS, (v) => cur.includes(v), "toggleOverlaySpecial", "specials"), cur.length > 0);
    }

    return wrap;
  }

  function updateFilterOverlayFooter() {
    const btn = document.getElementById("filterOverlayApplyBtn");
    if (!btn) return;
    const count = getFilterOverlayResultCount();
    btn.textContent = count > 0 ? `نمایش ${count.toLocaleString()} خودرو` : "خودرویی یافت نشد";
    btn.disabled = count === 0;
    btn.classList.toggle("is-disabled", count === 0);
  }

  function setupPriceSelects() {
    const minSel = document.getElementById("filterPriceMin");
    const maxSel = document.getElementById("filterPriceMax");
    if (!minSel || !maxSel) return;
    const commit = (changed) => {
      let min = minSel.value === "" ? null : Number(minSel.value);
      let max = maxSel.value === "" ? null : Number(maxSel.value);
      if (min != null && max != null && min > max) { if (changed === "min") max = null; else min = null; }
      state = { ...state, filters: { ...state.filters, priceMin: min, priceMax: max }, visibleCount: 12, listingsLoadingMore: false };
      renderFilterOverlayBody();
      refreshLiveToolbar();
    };
    minSel.onchange = () => commit("min");
    maxSel.onchange = () => commit("max");
  }

  function renderFilterOverlayBody() {
    const body = document.getElementById("filterOverlayBody");
    if (!body) return;
    const prevScroll = body.scrollTop;
    body.replaceChildren(buildFilterOverlayBody());
    body.scrollTop = prevScroll;
    setupPriceSelects();
    updateFilterOverlayFooter();
  }

  let filterOverlayHideTimer = null;
  function updateFilterOverlay() {
    const overlay = document.getElementById("filterOverlay");
    if (!overlay) return;
    const open = state.filterOverlayOpen;
    if (open) {
      setupFilterOverlayDrag(overlay);
      clearTimeout(filterOverlayHideTimer);
      document.documentElement.classList.add("filter-overlay-active");
      document.body.classList.add("filter-overlay-active");
      overlay.hidden = false;
      renderFilterOverlayBody();
      requestAnimationFrame(() => overlay.classList.add("is-open"));
    } else {
      overlay.classList.remove("is-open");
      clearTimeout(filterOverlayHideTimer);
      filterOverlayHideTimer = setTimeout(() => {
        if (state.filterOverlayOpen) return;
        overlay.hidden = true;
        document.documentElement.classList.remove("filter-overlay-active");
        document.body.classList.remove("filter-overlay-active");
      }, 280);
      // Closing the sheet is when we finally touch the page behind it,
      // so the listing grid reflects whatever was picked while it was open.
      render();
    }
  }

  // Drag the handle / header down to dismiss. Transform-only, so it stays smooth.
  let filterOverlayDragReady = false;
  function setupFilterOverlayDrag(overlay) {
    if (filterOverlayDragReady) return;
    filterOverlayDragReady = true;
    const panel = overlay.querySelector(".filter-overlay-panel");
    let startY = null, dy = 0, vel = 0, lastY = 0, lastT = 0, raf = 0;
    const paint = () => { raf = 0; panel.style.transform = `translate3d(0,${dy}px,0)`; };
    overlay.querySelectorAll("[data-sheet-handle]").forEach((h) => {
      h.addEventListener("touchstart", (e) => {
        if (e.target.closest("[data-action]")) return;
        startY = lastY = e.touches[0].clientY; lastT = e.timeStamp; dy = 0; vel = 0;
        panel.style.transition = "none";
      }, { passive: true });
      h.addEventListener("touchmove", (e) => {
        if (startY === null) return;
        const y = e.touches[0].clientY;
        const dt = e.timeStamp - lastT;
        if (dt > 0) vel = 0.8 * (y - lastY) / dt + 0.2 * vel;
        lastY = y; lastT = e.timeStamp;
        dy = Math.max(0, y - startY);
        if (!raf) raf = requestAnimationFrame(paint);
      }, { passive: true });
      const end = () => {
        if (startY === null) return;
        startY = null;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        panel.style.transition = "";
        const close = dy > 110 || (dy > 20 && vel > 0.7);
        panel.style.transform = dy ? `translate3d(0,${dy}px,0)` : "";
        void panel.offsetHeight;
        panel.style.transform = "";
        if (close) {
          state = { ...state, filterOverlayOpen: false };
          updateFilterOverlay();
        }
      };
      h.addEventListener("touchend", end);
      h.addEventListener("touchcancel", end);
    });
  }

