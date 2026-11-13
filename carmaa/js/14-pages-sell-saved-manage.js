"use strict";

/* ---------------------------------------------------------------
   PAGE RENDERERS — the multi-step "sell your car" form (incl. its map), the saved/liked listings screen, and the manage-my-listings screen.
// Edit the sell form or the saved/manage-listings pages here.
--------------------------------------------------------------- */

  const SELL_TOTAL_STEPS = 5;
  // Accounts that own a dealership get one extra, final step
  // ("ثبت آگهی در کدام پنل؟") when publishing a NEW ad. Editing an ad keeps
  // the panel it was published under, so it never shows this step.
  function sellHasPanelStep() { return !state.editingListingId && !!state.dealership && state.sellPanelLock !== "dealer"; }
  function sellTotalSteps() { return SELL_TOTAL_STEPS + (sellHasPanelStep() ? 1 : 0); }

  // Native-style year wheel used by the sell flow. Years are kept as plain
  // numeric values in state/forms, while the wheel uses the same centered,
  // scroll-snap interaction shown in the supplied reference image.
  let sellYearPickerOpen = false;
  let sellYearPickerValue = "";
  let sellYearWheelRaf = 0;
  let sellYearWheelLastSelected = "";
  // Cached once per render instead of re-querying the DOM on every scroll
  // frame, and the currently-selected element is tracked directly so only
  // the row that actually changes gets touched (see updateSellYearPickerSelection).
  let sellYearWheelItems = null;
  let sellYearWheelSelectedEl = null;
  let sellBrandPickerOpen = false;
  let sellModelPickerOpen = false;
  // Drill-down state for the model picker: "model" shows the brand's model
  // list; "submodel" shows the sub-model/trim list for sellModelPickerActiveModel
  // (only reached for models that have entries in SUBMODELS_BY_MODEL).
  let sellModelPickerLevel = "model";
  let sellModelPickerActiveModel = null;
  let sellTrimPickerOpen = false;
  const SELL_TRIMS = { full: { label: "فول", code: "F" }, half: { label: "نیمه‌فول", code: "S" }, basic: { label: "بیسیک", code: "B" } };
  let sellColorPickerOpen = false;
  let sellCityPickerOpen = false;
  const SELL_CITIES = KHUZESTAN_CITIES.slice();
  let partStatusPickerOpen = false;
  let partStatusPickerKey = null;

  function formatSellPrice(value) {
    const digits = String(value ?? "").replace(/[^0-9]/g, "");
    return digits ? Number(digits).toLocaleString("en-US") : "";
  }
  // Picks the spoken-unit label for a raw toman amount, matching how
  // people actually say car prices out loud as the number grows.
  function sellPriceUnitLabel(amount) {
    const n = Number(amount) || 0;
    if (n >= 1000000000) return "میلیارد تومان";
    if (n >= 1000000) return "میلیون تومان";
    if (n >= 1000) return "هزار تومان";
    return "تومان";
  }
  let sellPriceUnitLast = "";
  function updateSellPriceUnit() {
    const unitEl = document.getElementById("sellPriceUnit");
    if (!unitEl) return;
    const amount = parseInt(String(state.sellForm.price ?? "").replace(/[^0-9]/g, ""), 10) || 0;
    const label = sellPriceUnitLabel(amount);
    if (label === sellPriceUnitLast && unitEl.textContent === label) return;
    sellPriceUnitLast = label;
    unitEl.textContent = label;
    // Re-trigger the fade-up keyframe on every swap: drop the class, force
    // a reflow so the browser forgets it already played, then re-add it.
    unitEl.classList.remove("is-animating");
    void unitEl.offsetWidth;
    unitEl.classList.add("is-animating");
  }
  function sellColorByHex(hex) {
    return SELL_COLORS.find(c => c.hex === hex) || null;
  }
  function openSellColorPicker() {
    const picker = document.getElementById("sellColorPicker");
    const trigger = document.querySelector('[data-page="sell-step"] [data-action="openSellColorPicker"]');
    if (!picker || sellColorPickerOpen) return;
    sellColorPickerOpen = true; picker.hidden = false; picker.setAttribute("aria-hidden", "false");
    trigger?.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("sell-color-picker-open");
    renderSellColorPicker();
    requestAnimationFrame(() => picker.classList.add("is-open"));
  }
  function closeSellColorPicker() {
    const picker = document.getElementById("sellColorPicker");
    const trigger = document.querySelector('[data-page="sell-step"] [data-action="openSellColorPicker"]');
    if (!picker || !sellColorPickerOpen) return;
    sellColorPickerOpen = false; picker.classList.remove("is-open"); picker.classList.add("is-closing");
    trigger?.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("sell-color-picker-open");
    setTimeout(() => { if (sellColorPickerOpen) return; picker.hidden = true; picker.classList.remove("is-closing"); picker.setAttribute("aria-hidden", "true"); }, 280);
  }
  function renderSellColorPicker() {
    const grid = document.getElementById("sellColorPickerGrid");
    if (!grid) return;
    grid.replaceChildren(...SELL_COLORS.map(color => {
      const btn = document.createElement("button"); btn.type = "button"; btn.className = "sell-color-option"; btn.dataset.action = "chooseSellColor"; btn.dataset.color = color.hex; btn.setAttribute("role", "option"); btn.setAttribute("aria-selected", String(state.sellForm.color === color.hex));
      const sw = document.createElement("span"); sw.className = "sell-color-option-swatch"; sw.style.background = color.hex; sw.dataset.dark = ["#1D1D1F","#0e2454","#245c3b","#6b4226"].includes(color.hex) ? "true" : "false";
      const copy = document.createElement("span"); copy.className = "sell-color-option-copy"; copy.textContent = color.name;
      const tick = document.createElement("b"); tick.textContent = "✓"; tick.className = "sell-color-option-tick";
      btn.append(sw, copy, tick); return btn;
    }));
  }
  // "قیمت توافقی": when on, the price box is cleared + disabled (a disabled
  // field is also skipped by form validation); turning it off restores what
  // the seller had typed.
  function applySellNegotiableUI(scope, on) {
    const input = scope.querySelector('input[name="price"]');
    if (!input) return;
    if (on) {
      if (input.value) input.dataset.prevPrice = input.value;
      input.value = "";
      input.disabled = true;
      input.placeholder = "توافقی";
    } else {
      input.disabled = false;
      input.placeholder = "0";
      if (input.dataset.prevPrice) input.value = input.dataset.prevPrice;
      delete input.dataset.prevPrice;
    }
    input.closest('[data-slot="price-section"]')?.classList.toggle("is-negotiable", !!on);
  }
  // Reads an on/off toggle of the current step; when the current step does
  // not contain that checkbox (other steps), keep the value already in state
  // instead of silently resetting it to false.
  function readSellToggle(form, fd, name) {
    if (form && fd && form.querySelector('input[name="' + name + '"]')) return fd.get(name) === "on";
    return !!state.sellForm[name];
  }
  function syncSellFormFromDOM() {
    const root = document.querySelector('[data-page="sell-step"]');
    if (!root) return;
    const next = { ...state.sellForm };
    root.querySelectorAll('input[name], textarea[name], select[name]').forEach((field) => {
      const name = field.name;
      if (!name || name === 'phone') return;
      if (field.type === 'checkbox') next[name] = field.checked;
      else if (field.name === 'price') next.price = String(field.value || '').replace(/[^0-9]/g, '');
      else next[name] = field.value;
    });
    if (next.negotiable) next.price = '';
    state = { ...state, sellForm: next };
  }

  function chooseSellColor(hex) {
    const entry = sellColorByHex(hex); if (!entry) return;
    syncSellFormFromDOM();
    state = { ...state, sellForm: { ...state.sellForm, color: entry.hex }, sellError: null };
    closeSellColorPicker(); render();
  }
  function setSellPrice(value) {
    if (state.sellForm.negotiable) return;
    const input = document.querySelector('[data-page="sell-step"] input[name="price"]');
    const amount = Math.max(0, parseInt(String(value ?? "").replace(/[^0-9]/g, ""), 10) || 0);
    const formatted = formatSellPrice(amount);
    if (input) {
      input.value = formatted;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus({ preventScroll: true });
    }
    state = { ...state, sellForm: { ...state.sellForm, price: String(amount) }, sellError: null };
    updateSellPriceAdders();
    updateSellPriceUnit();
  }

  function addSellPrice(amount) {
    if (state.sellForm.negotiable) return;
    const current = parseInt(String(state.sellForm.price ?? "").replace(/[^0-9]/g, ""), 10) || 0;
    const next = current + Math.max(0, Number(amount) || 0);
    state = { ...state, sellForm: { ...state.sellForm, price: String(next) }, sellError: null };
    const input = document.querySelector('[data-page="sell-step"] input[name="price"]');
    if (input) { input.value = formatSellPrice(next); input.focus({ preventScroll: true }); }
    updateSellPriceAdders();
    updateSellPriceUnit();
  }

  function updateSellPriceAdders() {
    const wrap = document.querySelector('[data-page="sell-step"] .sell-price-adders');
    if (!wrap) return;
    const current = parseInt(String(state.sellForm.price ?? "").replace(/[^0-9]/g, ""), 10) || 0;
    wrap.querySelectorAll('[data-price-add]').forEach(btn => {
      const amount = Number(btn.dataset.priceAdd || 0);
      const preview = current + amount;
      btn.classList.toggle('is-ready', amount > 0);
      btn.setAttribute('aria-label', `افزودن ${formatSellPrice(amount)} تومان؛ قیمت جدید ${formatSellPrice(preview)} تومان`);
    });
  }

  function formatSellMiles(value) {
    const digits = String(value ?? "").replace(/[^0-9]/g, "");
    return digits ? Number(digits).toLocaleString('en-US') : "";
  }

  function openSellTrimPicker() {
    const picker = document.getElementById("sellTrimPicker");
    const trigger = document.querySelector('[data-page="sell-step"] [data-action="openSellTrimPicker"]');
    if (!picker || sellTrimPickerOpen) return;
    sellTrimPickerOpen = true; picker.hidden = false; picker.setAttribute("aria-hidden", "false");
    trigger?.setAttribute("aria-expanded", "true"); document.documentElement.classList.add("sell-trim-picker-open");
    const current = state.sellForm.trim || "full";
    picker.querySelectorAll(".sell-trim-option").forEach(btn => btn.classList.toggle("is-selected", btn.dataset.trim === current));
    requestAnimationFrame(() => picker.classList.add("is-open"));
  }
  function closeSellTrimPicker() {
    const picker = document.getElementById("sellTrimPicker");
    const trigger = document.querySelector('[data-page="sell-step"] [data-action="openSellTrimPicker"]');
    if (!picker || !sellTrimPickerOpen) return;
    sellTrimPickerOpen = false; picker.classList.remove("is-open"); picker.classList.add("is-closing");
    trigger?.setAttribute("aria-expanded", "false"); document.documentElement.classList.remove("sell-trim-picker-open");
    setTimeout(() => { if (sellTrimPickerOpen) return; picker.hidden=true; picker.classList.remove("is-closing"); picker.setAttribute("aria-hidden","true"); }, 280);
  }
  function chooseSellTrim(trim) {
    if (!SELL_TRIMS[trim]) return;
    syncSellFormFromDOM();
    state = { ...state, sellForm: { ...state.sellForm, trim }, sellError: null };
    closeSellTrimPicker(); render();
  }

  function openSellCityPicker() {
    const picker = document.getElementById("sellCityPicker");
    const trigger = document.querySelector('[data-page="sell-step"] [data-action="openSellCityPicker"]');
    if (!picker || sellCityPickerOpen) return;
    sellCityPickerOpen = true; picker.hidden = false; picker.setAttribute("aria-hidden", "false");
    trigger?.setAttribute("aria-expanded", "true"); document.documentElement.classList.add("sell-city-picker-open");
    const current = state.sellForm.city || "";
    picker.querySelectorAll(".sell-trim-option").forEach(btn => btn.classList.toggle("is-selected", btn.dataset.city === current));
    requestAnimationFrame(() => picker.classList.add("is-open"));
  }
  function closeSellCityPicker() {
    const picker = document.getElementById("sellCityPicker");
    const trigger = document.querySelector('[data-page="sell-step"] [data-action="openSellCityPicker"]');
    if (!picker || !sellCityPickerOpen) return;
    sellCityPickerOpen = false; picker.classList.remove("is-open"); picker.classList.add("is-closing");
    trigger?.setAttribute("aria-expanded", "false"); document.documentElement.classList.remove("sell-city-picker-open");
    setTimeout(() => { if (sellCityPickerOpen) return; picker.hidden = true; picker.classList.remove("is-closing"); picker.setAttribute("aria-hidden", "true"); }, 280);
  }
  function chooseSellCity(city) {
    if (!SELL_CITIES.includes(city)) return;
    syncSellFormFromDOM();
    const cc = cityCoords(city);
    state = { ...state, sellForm: { ...state.sellForm, city, mapPos: { lat: cc[0], lng: cc[1] }, region: "", locConfirmed: false }, sellError: null };
    closeSellCityPicker(); render();
  }

  function openPartStatusPicker(key) {
    const panel = CAR_PANELS.find((p) => p.key === key);
    if (!panel) return;
    const picker = document.getElementById("partStatusPicker");
    if (!picker || partStatusPickerOpen) return;
    partStatusPickerKey = key;
    partStatusPickerOpen = true; picker.hidden = false; picker.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("part-status-picker-open");
    const titleEl = document.getElementById("partStatusPickerTitle");
    if (titleEl) titleEl.textContent = panel.label;
    const current = (Array.isArray(state.sellForm.damagedParts) ? state.sellForm.damagedParts : []).find((d) => d.key === key);
    picker.querySelectorAll(".sell-trim-option[data-status]").forEach((btn) => {
      btn.classList.toggle("is-selected", !!current && btn.dataset.status === current.status);
    });
    const clearBtn = picker.querySelector('[data-action="clearPartStatus"]');
    if (clearBtn) clearBtn.hidden = !current;
    requestAnimationFrame(() => picker.classList.add("is-open"));
  }
  function closePartStatusPicker() {
    const picker = document.getElementById("partStatusPicker");
    if (!picker || !partStatusPickerOpen) return;
    partStatusPickerOpen = false; picker.classList.remove("is-open"); picker.classList.add("is-closing");
    document.documentElement.classList.remove("part-status-picker-open");
    setTimeout(() => { if (partStatusPickerOpen) return; picker.hidden = true; picker.classList.remove("is-closing"); picker.setAttribute("aria-hidden", "true"); partStatusPickerKey = null; }, 280);
  }
  function choosePartStatus(status) {
    const key = partStatusPickerKey;
    if (!key || !partStatusInfo(status)) return;
    const current = Array.isArray(state.sellForm.damagedParts) ? state.sellForm.damagedParts : [];
    const damagedParts = [...current.filter((d) => d.key !== key), { key, status }];
    state = { ...state, sellForm: { ...state.sellForm, damagedParts } };
    closePartStatusPicker(); render();
  }
  function clearPartStatus() {
    const key = partStatusPickerKey;
    if (!key) return;
    const current = Array.isArray(state.sellForm.damagedParts) ? state.sellForm.damagedParts : [];
    const damagedParts = current.filter((d) => d.key !== key);
    state = { ...state, sellForm: { ...state.sellForm, damagedParts } };
    closePartStatusPicker(); render();
  }


  function renderSellBrandPicker() {
    const grid = document.getElementById("sellBrandPickerGrid");
    if (!grid) return;
    grid.replaceChildren();
    BRANDS.filter(b => !b.all).forEach((b, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sell-brand-option";
      btn.dataset.brand = b.name;
      btn.dataset.action = "chooseSellBrand";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", String(state.sellForm.brand === b.name));
      const mark = document.createElement("span");
      mark.className = "sell-brand-option-mark";
      if (b.img) {
        const img = document.createElement("img");
        img.src = b.img; img.alt = b.name; img.loading = "lazy";
        mark.appendChild(img);
      } else if (b.initials) {
        const text = document.createElement("span");
        text.textContent = b.initials;
        mark.appendChild(text);
      } else {
        const text = document.createElement("span");
        text.textContent = b.generic ? "CH" : b.name.slice(0,1);
        mark.appendChild(text);
      }
      const copy = document.createElement("span");
      copy.className = "sell-brand-option-copy";
      const name = document.createElement("strong"); name.textContent = b.name;
      const meta = document.createElement("small"); meta.textContent = b.generic ? "انتخاب‌های بیشتر" : `${index + 1} برند`;
      copy.append(name, meta);
      const tick = document.createElement("span"); tick.className = "sell-brand-option-tick"; tick.textContent = "✓";
      btn.append(mark, copy, tick);
      grid.appendChild(btn);
    });
  }

  function openSellBrandPicker() {
    const picker = document.getElementById("sellBrandPicker");
    const trigger = document.querySelector('[data-page="sell-step"] [data-action="openSellBrandPicker"]');
    if (!picker || sellBrandPickerOpen) return;
    sellBrandPickerOpen = true;
    picker.hidden = false;
    picker.setAttribute("aria-hidden", "false");
    trigger?.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("sell-brand-picker-open");
    renderSellBrandPicker();
    requestAnimationFrame(() => picker.classList.add("is-open"));
  }

  function closeSellBrandPicker() {
    const picker = document.getElementById("sellBrandPicker");
    const trigger = document.querySelector('[data-page="sell-step"] [data-action="openSellBrandPicker"]');
    if (!picker || !sellBrandPickerOpen) return;
    sellBrandPickerOpen = false;
    picker.classList.remove("is-open");
    picker.classList.add("is-closing");
    trigger?.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("sell-brand-picker-open");
    setTimeout(() => {
      if (sellBrandPickerOpen) return;
      picker.hidden = true;
      picker.classList.remove("is-closing");
      picker.setAttribute("aria-hidden", "true");
    }, 280);
  }

  function chooseSellBrand(brand) {
    const entry = BRANDS.find(b => b.name === brand && !b.all);
    if (!entry) return;
    syncSellFormFromDOM();
    // Changing brand invalidates whatever model was picked for the old
    // brand, so clear it rather than leave a mismatched model behind.
    state = { ...state, sellForm: { ...state.sellForm, brand: entry.name, model: "" }, sellError: null };
    closeSellBrandPicker();
    render();
  }

  function renderSellModelPicker(filterText) {
    const list = document.getElementById("sellModelPickerList");
    const subtitle = document.getElementById("sellModelPickerSubtitle");
    const title = document.getElementById("sellModelPickerTitle");
    const backBtn = document.getElementById("sellModelPickerBack");
    const crumbs = document.getElementById("sellModelPickerCrumbs");
    const markEl = document.getElementById("sellModelPickerMark");
    const searchEl = document.getElementById("sellModelPickerSearch");
    const clearEl = document.getElementById("sellModelPickerClear");
    if (!list) return;
    const brand = state.sellForm.brand;
    const q = (filterText || "").trim();
    if (clearEl) clearEl.hidden = !q;

    const emptyState = (text) => {
      const empty = document.createElement("div");
      empty.className = "sell-model-picker-empty";
      const ic = document.createElement("span");
      ic.className = "smp-empty-ic"; ic.setAttribute("aria-hidden", "true");
      ic.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8.5 11h5"/></svg>';
      const t = document.createElement("div"); t.textContent = text;
      empty.append(ic, t);
      list.appendChild(empty);
    };

    // brand badge in header
    if (markEl) {
      markEl.replaceChildren();
      const entry = BRANDS.find((b) => b.name === brand && !b.all);
      if (entry && entry.img) { const img = document.createElement("img"); img.src = entry.img; img.alt = ""; markEl.appendChild(img); }
      else { markEl.textContent = entry ? (entry.initials || entry.name.slice(0, 1)) : "؟"; }
    }

    if (!brand) {
      sellModelPickerLevel = "model";
      sellModelPickerActiveModel = null;
      if (title) title.textContent = "انتخاب مدل";
      if (subtitle) subtitle.textContent = "ابتدا برند خودرو را انتخاب کنید";
      if (backBtn) backBtn.hidden = true;
      if (crumbs) crumbs.replaceChildren();
      list.replaceChildren();
      emptyState("برای دیدن لیست مدل‌ها، اول باید برند را از مرحله بالاتر انتخاب کنید.");
      return;
    }

    const inSub = sellModelPickerLevel === "submodel" && sellModelPickerActiveModel;
    list.replaceChildren();
    if (backBtn) backBtn.hidden = !inSub;
    if (searchEl) searchEl.placeholder = inSub ? "جستجوی زیرمدل…" : "جستجوی مدل…";
    list.setAttribute("aria-label", inSub ? "زیرمدل‌ها" : "مدل‌ها");

    // breadcrumb: برند › مدل › زیرمدل
    if (crumbs) {
      crumbs.replaceChildren();
      const addCrumb = (label, active, action) => {
        const el = document.createElement(action ? "button" : "span");
        if (action) { el.type = "button"; el.dataset.action = action; }
        el.className = "smp-crumb" + (active ? " is-active" : "");
        el.textContent = label;
        if (crumbs.childNodes.length) {
          const sep = document.createElement("i"); sep.className = "smp-crumb-sep"; sep.setAttribute("aria-hidden", "true"); sep.textContent = "›";
          crumbs.appendChild(sep);
        }
        crumbs.appendChild(el);
      };
      addCrumb(brand, false, null);
      addCrumb("مدل", !inSub, inSub ? "backSellModelPicker" : null);
      if (inSub) addCrumb(sellModelPickerActiveModel, true, null);
    }

    const current = state.sellForm.model;
    const row = (label, opts) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sell-model-option" + (opts.hasSub ? " has-submodels" : "");
      btn.dataset.model = label;
      btn.dataset.action = opts.action;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", String(!!opts.selected));
      const badge = document.createElement("span");
      badge.className = "sell-model-option-badge"; badge.setAttribute("aria-hidden", "true");
      badge.textContent = opts.badge;
      const copy = document.createElement("span"); copy.className = "sell-model-option-copy";
      const name = document.createElement("strong"); name.textContent = label; copy.appendChild(name);
      if (opts.meta) { const m = document.createElement("small"); m.textContent = opts.meta; copy.appendChild(m); }
      btn.append(badge, copy);
      if (opts.hasSub) {
        const chevron = document.createElement("span");
        chevron.className = "sell-model-option-chevron"; chevron.setAttribute("aria-hidden", "true");
        chevron.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
        btn.appendChild(chevron);
      } else {
        const tick = document.createElement("span");
        tick.className = "sell-model-option-tick";
        tick.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
        btn.appendChild(tick);
      }
      list.appendChild(btn);
      return btn;
    };

    if (inSub) {
      const parent = sellModelPickerActiveModel;
      const all = submodelsFor(brand, parent);
      if (title) title.textContent = parent;
      if (subtitle) subtitle.textContent = `${faNum(all.length)} زیرمدل برای انتخاب`;
      const subs = q ? all.filter((m) => m.toLowerCase().includes(q.toLowerCase())) : all;
      if (!subs.length) { emptyState("زیرمدلی با این نام پیدا نشد."); return; }
      subs.forEach((sm, idx) => row(sm, {
        action: "chooseSellModel", badge: faNum(idx + 1),
        selected: current === sm || current === `${parent} ${sm}`.trim(),
      }));
    } else {
      if (title) title.textContent = "انتخاب مدل";
      const all = MODELS_BY_BRAND[brand] || [];
      if (subtitle) subtitle.textContent = `${faNum(all.length)} مدل برای ${brand}`;
      const models = q ? all.filter((m) => m.includes(q)) : all;
      if (!models.length) { emptyState("مدلی با این نام پیدا نشد."); return; }
      models.forEach((m) => {
        const subs = submodelsFor(brand, m);
        const hasSub = subs.length > 0;
        row(m, {
          action: hasSub ? "openSellSubmodelPicker" : "chooseSellModel", hasSub,
          badge: String(m).trim().slice(0, 1).toUpperCase(),
          meta: hasSub ? `${faNum(subs.length)} زیرمدل` : "",
          selected: current === m || (hasSub && parentModelForSubmodel(brand, current) === m) || (hasSub && String(current || "").startsWith(m + " ")),
        });
      });
    }
    if (!q) {
      const sel = list.querySelector('[aria-selected="true"]');
      if (sel) requestAnimationFrame(() => { try { sel.scrollIntoView({ block: "center" }); } catch (_) {} });
    }
    list.scrollTop = q ? 0 : list.scrollTop;
  }

  function openSellSubmodelPicker(model) {
    if (!model) return;
    const brand = state.sellForm.brand;
    if (!submodelsFor(brand, model).length) { chooseSellModel(model); return; }
    sellModelPickerLevel = "submodel";
    sellModelPickerActiveModel = model;
    const search = document.getElementById("sellModelPickerSearch");
    if (search) search.value = "";
    renderSellModelPicker("");
  }

  function backSellModelPicker() {
    sellModelPickerLevel = "model";
    sellModelPickerActiveModel = null;
    const search = document.getElementById("sellModelPickerSearch");
    if (search) search.value = "";
    renderSellModelPicker("");
  }

  // Returns the model name a given sub-model value belongs to (e.g. "C200"
  // -> "کلاس C"), or null if the value isn't a known sub-model for this
  // brand (covers plain models with no sub-model breakdown, or free text).
  function parentModelForSubmodel(brand, value) {
    const table = brand && SUBMODELS_BY_MODEL[brand];
    if (!table || !value) return null;
    for (const modelName in table) {
      if (table[modelName].includes(value)) return modelName;
    }
    return null;
  }

  function openSellModelPicker() {
    const picker = document.getElementById("sellModelPicker");
    const trigger = document.querySelector('[data-page="sell-step"] [data-action="openSellModelPicker"]');
    if (!picker || sellModelPickerOpen) return;
    sellModelPickerOpen = true;
    const brand = state.sellForm.brand;
    const currentValue = state.sellForm.model;
    const parentModel = parentModelForSubmodel(brand, currentValue);
    if (parentModel) {
      sellModelPickerLevel = "submodel";
      sellModelPickerActiveModel = parentModel;
    } else {
      sellModelPickerLevel = "model";
      sellModelPickerActiveModel = null;
    }
    picker.hidden = false;
    picker.setAttribute("aria-hidden", "false");
    trigger?.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("sell-brand-picker-open");
    const search = document.getElementById("sellModelPickerSearch");
    if (search) search.value = "";
    renderSellModelPicker("");
    requestAnimationFrame(() => picker.classList.add("is-open"));
  }

  function closeSellModelPicker() {
    const picker = document.getElementById("sellModelPicker");
    const trigger = document.querySelector('[data-page="sell-step"] [data-action="openSellModelPicker"]');
    if (!picker || !sellModelPickerOpen) return;
    sellModelPickerOpen = false;
    picker.classList.remove("is-open");
    picker.classList.add("is-closing");
    trigger?.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("sell-brand-picker-open");
    setTimeout(() => {
      if (sellModelPickerOpen) return;
      picker.hidden = true;
      picker.classList.remove("is-closing");
      picker.setAttribute("aria-hidden", "true");
    }, 280);
  }

  // A picked sub-model ("EX") is stored alone in sellForm.model; the ad title
  // needs the parent model too ("اپتیما EX").
  // Ad titles show only the brand + the chosen (sub)model, e.g. "بنز E200",
  // not the parent class ("بنز کلاس E E200").
  function fullSellModelName(brand, model) {
    return model;
  }

  // Remember which values were suggested by the catalogue, so changing the
  // model replaces only our previous suggestions and never silently erases
  // values the seller entered manually.
  let sellAutoSpecValues = {};

  function inferSellModelSpecs(brand, model) {
    const raw = String(model || "").trim();
    const normalized = raw.toLowerCase().replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[‌\s_-]+/g, " ");
    const result = {};
    const put = (key, value) => { if (value) result[key] = value; };
    const electric = /(^| )(ev[0-9]|eq[abce s]?|eqs|eqe|taycan|taycan|i4|i5|i7|ix[123]?|bolt|mach e|ماخ ای|آیونیک [۵۶۹]|برقی|r z|rz|سیل|ej7)( |$)/i.test(normalized) || /فولگوره|فولگوره|فولگور|فولگوره|فولگوره/.test(raw);
    const hybrid = /hybrid|هیبرید|پریوس|300h|450h|500h|550h|e power|پلاگین|4xe|فولگوره/.test(normalized);
    const diesel = /دیزل|تونلند|auman|یوروکارگو|کشنده|کامیونت/.test(normalized);
    if (electric) {
      put("fuelType", "برقی");
      put("engineType", "موتور الکتریکی");
      put("transmission", "اتوماتیک");
      if (/ev6|ev9|تلوراید|اوروس|لندکروزر|پرادو|تاهو|رنج روور|دیفندر|توسان|سانتافه|x[357]|q[3578]|gle|glc|کاین|مکان|ری‌را|تیگو|فیدلیتی|دیگنیتی|هایما|suv/i.test(normalized)) put("driveTrain", "چهار چرخ محرک (AWD)");
      else put("driveTrain", "دو چرخ محرک عقب (RWD)");
      return result;
    }
    if (hybrid) put("fuelType", /پلاگین|4xe|plug in/.test(normalized) ? "پلاگین‌هیبرید" : "هیبریدی");
    if (diesel) {
      put("fuelType", "دیزلی");
      put("engineType", "موتور دیزل");
      put("transmission", "دنده‌ای");
      return result;
    }
    // Reliable, widely-known model defaults. Model-year/trim-specific values
    // are intentionally left blank where a name alone is not enough to know.
    const common = {
      "پژو ۲۰۶": {engineType:"۱.۴ یا ۱.۶ لیتری، ۴ سیلندر", fuelType:"بنزینی", transmission:"دنده‌ای", engineVolume:"۱۳۰۰ تا ۱۷۰۰", cylinders:"۴ سیلندر", driveTrain:"دو چرخ محرک جلو (FWD)"},
      "پژو ۲۰۷": {engineType:"۱.۶ لیتری، ۴ سیلندر", fuelType:"بنزینی", transmission:"دنده‌ای", engineVolume:"۱۳۰۰ تا ۱۷۰۰", cylinders:"۴ سیلندر", driveTrain:"دو چرخ محرک جلو (FWD)"},
      "پژو پارس": {engineType:"۱.۸ لیتری، ۴ سیلندر", fuelType:"بنزینی", transmission:"دنده‌ای", engineVolume:"۱۷۰۰ تا ۲۰۰۰", cylinders:"۴ سیلندر", driveTrain:"دو چرخ محرک جلو (FWD)"},
      "دنا": {engineType:"۱.۷ لیتری، ۴ سیلندر", fuelType:"بنزینی", transmission:"دنده‌ای", engineVolume:"۱۷۰۰ تا ۲۰۰۰", cylinders:"۴ سیلندر", driveTrain:"دو چرخ محرک جلو (FWD)"},
      "تارا": {engineType:"۱.۶ لیتری، ۴ سیلندر", fuelType:"بنزینی", transmission:"دنده‌ای", engineVolume:"۱۳۰۰ تا ۱۷۰۰", cylinders:"۴ سیلندر", driveTrain:"دو چرخ محرک جلو (FWD)"},
      "شاهین": {engineType:"۱.۵ لیتری توربو، ۴ سیلندر", fuelType:"بنزینی", transmission:"دنده‌ای", engineVolume:"۱۳۰۰ تا ۱۷۰۰", cylinders:"۴ سیلندر", driveTrain:"دو چرخ محرک جلو (FWD)"},
      "پراید": {engineType:"۱.۳ لیتری، ۴ سیلندر", fuelType:"بنزینی", transmission:"دنده‌ای", engineVolume:"کمتر از ۱۳۰۰", cylinders:"۴ سیلندر", driveTrain:"دو چرخ محرک جلو (FWD)"},
      "تیبا": {engineType:"۱.۵ لیتری، ۴ سیلندر", fuelType:"بنزینی", transmission:"دنده‌ای", engineVolume:"۱۳۰۰ تا ۱۷۰۰", cylinders:"۴ سیلندر", driveTrain:"دو چرخ محرک جلو (FWD)"},
      "کوییک": {engineType:"۱.۵ لیتری، ۴ سیلندر", fuelType:"بنزینی", transmission:"دنده‌ای", engineVolume:"۱۳۰۰ تا ۱۷۰۰", cylinders:"۴ سیلندر", driveTrain:"دو چرخ محرک جلو (FWD)"},
      "ساینا": {engineType:"۱.۵ لیتری، ۴ سیلندر", fuelType:"بنزینی", transmission:"دنده‌ای", engineVolume:"۱۳۰۰ تا ۱۷۰۰", cylinders:"۴ سیلندر", driveTrain:"دو چرخ محرک جلو (FWD)"},
      "سراتو": {fuelType:"بنزینی", driveTrain:"دو چرخ محرک جلو (FWD)"},
      "کرولا": {fuelType:"بنزینی", driveTrain:"دو چرخ محرک جلو (FWD)"},
      "کمری": {fuelType:"بنزینی", driveTrain:"دو چرخ محرک جلو (FWD)"},
      "پریوس": {engineType:"۱.۸ لیتری هیبرید", fuelType:"هیبریدی", transmission:"پیوسته (CVT)", engineVolume:"۱۷۰۰ تا ۲۰۰۰", cylinders:"۴ سیلندر", driveTrain:"دو چرخ محرک جلو (FWD)"},
      "موستانگ": {fuelType:"بنزینی", driveTrain:"دو چرخ محرک عقب (RWD)"},
      "چارجر": {fuelType:"بنزینی", driveTrain:"دو چرخ محرک عقب (RWD)"},
      "چلنجر": {fuelType:"بنزینی", driveTrain:"دو چرخ محرک عقب (RWD)"},
      "911": {fuelType:"بنزینی", driveTrain:"دو چرخ محرک عقب (RWD)"},
      "هوراکان": {fuelType:"بنزینی", driveTrain:"چهار چرخ محرک (AWD)"},
      "آونتادور": {fuelType:"بنزینی", driveTrain:"چهار چرخ محرک (AWD)"},
      "اوروس": {fuelType:"بنزینی", driveTrain:"چهار چرخ محرک (AWD)"},
    };
    const key = Object.keys(common).find(k => raw.includes(k));
    if (key) Object.assign(result, common[key]);
    if (!result.fuelType && hybrid) put("fuelType", "هیبریدی");
    if (!result.fuelType && !/برقی|ev[0-9]|e-tron|taycan|i4|i5|i7|ix[123]?/i.test(raw)) put("fuelType", "بنزینی");
    if (!result.transmission && /سری [1-8]|کلاس [aces]|cla|cls|gla|glb|glc|gle|gls|bmw|lexus|لکسوس|تویوتا|هیوندا|کیا|پورشه|آئودی/i.test(brand + " " + raw)) put("transmission", "اتوماتیک");
    if (!result.driveTrain && /سدان|هاچ|سراتو|اپتیما|النترا|سوناتا|کرولا|کمری|آریزو|دنا|تارا|پژو|تیبا|کوییک|ساینا|شاهین|ریو|پیکانتو/i.test(raw)) put("driveTrain", "دو چرخ محرک جلو (FWD)");
    return result;
  }

  // Splits a stored model value ("کلاس C C200") into parent + sub-model using
  // the catalogue, then looks up the real specs for brand + sub-model + year.
  function sellCatalogMatch(form) {
    const brand = form.brand, model = String(form.model || "").trim(), year = form.year;
    if (!brand || !model || !year || typeof carmaaVehicleSpecsFor !== "function") return null;
    // Models without sub-models are catalogued under the "*" key.
    const direct = carmaaVehicleSpecsFor(brand, model, "*", year);
    if (direct) return { hit: direct, sub: model };
    const parents = (typeof SUBMODELS_BY_MODEL !== "undefined" && SUBMODELS_BY_MODEL[brand]) || {};
    for (const parent of Object.keys(parents)) {
      if (!model.startsWith(parent + " ")) continue;
      const sub = model.slice(parent.length + 1).trim();
      const hit = carmaaVehicleSpecsFor(brand, parent, sub, year);
      if (hit) return { hit, sub };
    }
    return null;
  }
  function sellCatalogSpecs(form) { const m = sellCatalogMatch(form); return m ? m.hit : null; }

  // Shows the "AI is completing your car's info" popup once per brand+model+year.
  // The specs are written into the form when the popup finishes.
  let sellAiKey = "";
  function scheduleSellAiAutofill(form) {
    const m = sellCatalogMatch(form);
    if (!m || typeof window.showAiAutofillPopup !== "function") return false;
    const key = [form.brand, form.model, form.year].join("|");
    if (key === sellAiKey) return false;
    sellAiKey = key;
    window.showAiAutofillPopup({ car: `${form.brand} ${m.sub} · ${toFaDigits(form.year)}` }, () => {
      const cur = state.sellForm || {};
      if ([cur.brand, cur.model, cur.year].join("|") !== key) return;
      syncSellFormFromDOM();
      state = { ...state, sellForm: applySellCatalogSpecs({ ...state.sellForm }, { immediate: true }) };
      render();
    });
    return true;
  }

  // Fills the spec fields from the catalogue (falls back to the rough
  // model-name guess when the sub-model/year isn't catalogued). Replaces only
  // values this helper suggested earlier; the seller's manual edits always win.
  function applySellCatalogSpecs(form, opts) {
    Object.keys(sellAutoSpecValues).forEach((key) => {
      if (form[key] === sellAutoSpecValues[key]) form[key] = "";
    });
    sellAutoSpecValues = {};
    if (!(opts && opts.immediate) && scheduleSellAiAutofill(form)) return form;
    const suggestions = sellCatalogSpecs(form) || inferSellModelSpecs(form.brand, form.model);
    Object.entries(suggestions).forEach(([key, value]) => {
      if (!form[key]) { form[key] = value; sellAutoSpecValues[key] = value; }
    });
    return form;
  }

  function chooseSellModel(model) {
    if (!model) return;
    syncSellFormFromDOM();
    // When a submodel/trim is selected, keep its parent model in the saved
    // value too (e.g. parent "ریو" + submodel "S" => "ریو S"). Otherwise
    // the generated ad title loses the parent and becomes "کیا S".
    const selectedModel = sellModelPickerLevel === "submodel" && sellModelPickerActiveModel
      ? `${sellModelPickerActiveModel} ${model}`.trim()
      : model;
    const previousForm = state.sellForm || {};
    const nextForm = { ...previousForm, model: selectedModel };
    // Only replace blank fields or values previously auto-suggested by this
    // helper. User edits always win over catalogue defaults.
    applySellCatalogSpecs(nextForm);
    state = { ...state, sellForm: nextForm, sellError: null };
    sellModelPickerLevel = "model";
    sellModelPickerActiveModel = null;
    closeSellModelPicker();
    render();
  }


  function sellYearMax() {
    return new Date().getFullYear();
  }

  function toFaDigits(value) {
    return String(value).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
  }

  function getSellYearInput() {
    return document.querySelector('[data-page="sell-step"] input[name="year"]');
  }

  function getSellYearTrigger() {
    return document.querySelector('[data-page="sell-step"] [data-action="openSellYearPicker"]');
  }

  function updateSellYearPickerSelection() {
    const wheel = document.getElementById("sellYearWheel");
    const confirm = document.getElementById("sellYearPickerConfirm");
    if (!wheel) return;
    const items = sellYearWheelItems;
    if (!items || !items.length) return;
    // Every row (the 2 leading spacers + each year button) has the exact
    // same fixed CSS height, so the centered row can be found with plain
    // arithmetic on scrollTop instead of reading getBoundingClientRect()
    // on every item on every scroll frame. That per-frame read-loop was
    // forcing a synchronous layout recalculation on each tick — the main
    // cause of the picker feeling laggy/stuttery while spinning.
    const rowHeight = items[0].offsetHeight || 58;
    const leadingSpacers = 2;
    const rawIndex = Math.round((wheel.scrollTop + wheel.clientHeight / 2 - rowHeight / 2) / rowHeight) - leadingSpacers;
    const clampedIndex = Math.min(Math.max(rawIndex, 0), items.length - 1);
    const closest = items[clampedIndex];
    // The other big lag source: this used to loop every item and write
    // classList/aria-selected on all of them on every scroll frame, even
    // though at most one row's selected state ever actually changes. That
    // forced a style recalc across the whole list dozens of times a second.
    // Now only the previously-selected and newly-selected rows are touched,
    // and frames where the centered row hasn't changed do nothing at all.
    if (closest === sellYearWheelSelectedEl) return;

    const nextYear = closest.dataset.year || sellYearPickerValue;
    sellYearPickerValue = nextYear;

    if (sellYearWheelSelectedEl) {
      sellYearWheelSelectedEl.classList.remove("is-selected");
      sellYearWheelSelectedEl.setAttribute("aria-selected", "false");
    }
    closest.classList.add("is-selected");
    closest.setAttribute("aria-selected", "true");
    sellYearWheelSelectedEl = closest;

    if (confirm) confirm.textContent = `انتخاب ${toFaDigits(sellYearPickerValue)}`;

    if (sellYearWheelLastSelected) {
      try {
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
          navigator.vibrate(8);
        }
      } catch (_) {}
    }
    sellYearWheelLastSelected = sellYearPickerValue;
  }

  function renderSellYearWheel(selectedValue) {
    const wheel = document.getElementById("sellYearWheel");
    if (!wheel) return;
    const max = sellYearMax();
    let selected = parseInt(selectedValue, 10);
    if (!Number.isInteger(selected) || selected < 2000 || selected > max) selected = max;
    sellYearPickerValue = String(selected);
    sellYearWheelLastSelected = String(selected);

    const frag = document.createDocumentFragment();
    // Two empty rows keep the first/last year capable of landing in the
    // centered selection window instead of stopping against an edge.
    for (let i = 0; i < 2; i++) {
      const spacer = document.createElement("div");
      spacer.className = "sell-year-wheel-spacer";
      spacer.setAttribute("aria-hidden", "true");
      frag.appendChild(spacer);
    }
    for (let year = max; year >= 2000; year--) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "sell-year-wheel-item";
      item.dataset.year = String(year);
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(year === selected));
      item.textContent = String(year);
      item.addEventListener("click", () => {
        sellYearPickerValue = String(year);
        const items = Array.from(wheel.querySelectorAll('[data-year]'));
        const target = items.find(x => x.dataset.year === sellYearPickerValue);
        target?.scrollIntoView({ block: "center", behavior: "smooth" });
        updateSellYearPickerSelection();
      });
      frag.appendChild(item);
    }
    for (let i = 0; i < 2; i++) {
      const spacer = document.createElement("div");
      spacer.className = "sell-year-wheel-spacer";
      spacer.setAttribute("aria-hidden", "true");
      frag.appendChild(spacer);
    }
    wheel.replaceChildren(frag);
    sellYearWheelItems = Array.from(wheel.querySelectorAll('[data-year]'));
    sellYearWheelSelectedEl = null;

    const target = wheel.querySelector(`[data-year="${selected}"]`);
    if (target) target.scrollIntoView({ block: "center" });
    updateSellYearPickerSelection();
  }

  function openSellYearPicker() {
    const picker = document.getElementById("sellYearPicker");
    const input = getSellYearInput();
    const trigger = getSellYearTrigger();
    if (!picker || !input || sellYearPickerOpen) return;
    sellYearPickerOpen = true;
    const current = String(input.value || state.sellForm.year || "").trim();
    picker.hidden = false;
    picker.setAttribute("aria-hidden", "false");
    trigger?.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("sell-year-picker-open");
    renderSellYearWheel(current);
    bindSellYearWheel();
    requestAnimationFrame(() => {
      picker.classList.add("is-open");
      const target = document.querySelector(`#sellYearWheel [data-year="${sellYearPickerValue}"]`);
      target?.scrollIntoView({ block: "center" });
      updateSellYearPickerSelection();
    });
  }

  function closeSellYearPicker() {
    const picker = document.getElementById("sellYearPicker");
    const trigger = getSellYearTrigger();
    if (!picker || !sellYearPickerOpen) return;
    sellYearPickerOpen = false;
    picker.classList.remove("is-open");
    picker.classList.add("is-closing");
    trigger?.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("sell-year-picker-open");
    setTimeout(() => {
      if (sellYearPickerOpen) return;
      picker.hidden = true;
      picker.classList.remove("is-closing");
      picker.setAttribute("aria-hidden", "true");
    }, 280);
  }

  function confirmSellYear() {
    const input = getSellYearInput();
    if (!input || !sellYearPickerValue) return;
    const year = parseInt(sellYearPickerValue, 10);
    if (!Number.isInteger(year) || year < 2000 || year > sellYearMax()) return;
    input.value = String(year);
    const trigger = getSellYearTrigger();
    const label = trigger?.querySelector('[data-slot="year-label"]');
    if (label) label.textContent = toFaDigits(year);
    state = { ...state, sellForm: applySellCatalogSpecs({ ...state.sellForm, year: String(year) }), sellError: null };
    closeSellYearPicker();
  }

  function handleSellYearWheelScroll() {
    if (sellYearWheelRaf) cancelAnimationFrame(sellYearWheelRaf);
    sellYearWheelRaf = requestAnimationFrame(() => {
      sellYearWheelRaf = 0;
      updateSellYearPickerSelection();
    });
  }

  function bindSellYearWheel() {
    const wheel = document.getElementById("sellYearWheel");
    if (!wheel || wheel.dataset.bound === "true") return;
    wheel.dataset.bound = "true";
    wheel.addEventListener("scroll", handleSellYearWheelScroll, { passive: true });
  }

  if (typeof document !== "undefined") {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sellYearPickerOpen) closeSellYearPicker();
      if (e.key === "Escape" && sellColorPickerOpen) closeSellColorPicker();
    });
    const bindObserver = new MutationObserver(() => bindSellYearWheel());
    bindObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  const BLANK_SELL_FORM = { adTitle: "", brand: "", year: "", model: "", engineType: "", fuelType: "", transmission: "", interiorColor: "", driveTrain: "", cylinders: "", engineVolume: "", mileageType: "used", deliveryTime: "", video: null, documentType: "", powerOfAttorneyStatus: "", insuranceStatus: "", price: "", miles: "", color: "", trim: "full", city: "", region: "", mapPos: { lat: DEFAULT_MAP_CENTER[0], lng: DEFAULT_MAP_CENTER[1] }, phone: "", description: "", photos: [], damagedParts: [], bodyConditionRating: null, negotiable: false, tradeIn: false, acceptsOffers: false, minPrice: "" };

  // Reverse-map a saved listing (as stored on state.myListings) back into
  // sellForm-shaped fields so the multi-step form can be reopened
  // pre-filled for editing. Title is stored as "{year} {brand} {model}"
  // (see submitSell), so year/model are pulled back out of it; price/miles
  // are stored pre-formatted ("$12,345" / "12,345 مایل") so digits are
  // stripped back to plain numbers the form + parseInt expect.
  function sellFormFromListing(listing) {
    const yearMatch = (listing.title || "").match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : "";
    let rest = (listing.title || "").trim();
    if (year) rest = rest.replace(year, "").trim();
    if (listing.brand && rest.startsWith(listing.brand)) rest = rest.slice(listing.brand.length).trim();
    return {
      brand: listing.brand || "",
      year,
      model: rest,
      engineType: listing.engineType || listing.engine || (listing.specs && listing.specs.engine) || "",
      fuelType: listing.fuelType || "",
      transmission: listing.transmission || "",
      interiorColor: listing.interiorColor || "",
      driveTrain: listing.driveTrain || "",
      cylinders: listing.cylinders || "",
      engineVolume: listing.engineVolume || "",
      mileageType: listing.mileageType || (/^صفر/.test(String(listing.miles || "")) ? "zero" : /^حواله/.test(String(listing.miles || "")) ? "presale" : "used"),
      deliveryTime: listing.deliveryTime || "",
      video: listing.video && listing.video.poster ? { ...listing.video } : null,
      documentType: listing.documentType || listing.deedType || listing.ownershipDocumentType || listing.titleDocumentType || (listing.ownership && (listing.ownership.documentType || listing.ownership.deedType || listing.ownership.titleDocumentType)) || "",
      powerOfAttorneyStatus: (typeof listing.powerOfAttorneyStatus === "boolean" ? (listing.powerOfAttorneyStatus ? "دارد" : "ندارد") : (listing.powerOfAttorneyStatus || listing.agencyStatus || listing.wakalaStatus || listing.powerOfAttorney || listing.authorizationStatus || (listing.ownership && (listing.ownership.powerOfAttorneyStatus || listing.ownership.agencyStatus || listing.ownership.powerOfAttorney)) || "")),
      insuranceStatus: (typeof listing.insuranceStatus === "boolean" ? (listing.insuranceStatus ? "دارد" : "ندارد") : (listing.insuranceStatus || listing.insuranceType || listing.insurance || (typeof listing.hasInsurance === "boolean" ? (listing.hasInsurance ? "دارد" : "ندارد") : "") || (listing.ownership && (listing.ownership.insuranceStatus || listing.ownership.insurance)) || "")),
      // price/miles are stored with Persian digits ("۱٬۲۰۰٬۰۰۰ تومان"), so
      // they must be converted to Latin digits before stripping — otherwise
      // everything is removed and the edit form opens with empty fields.
      price: listing.negotiable ? "" : ((listing.priceAmount != null && Number(listing.priceAmount) > 0) ? String(Math.round(Number(listing.priceAmount))) : faToEnDigits(listing.price || "").replace(/[^0-9]/g, "")),
      miles: /^(صفر|حواله)/.test(String(listing.miles || "")) ? "" : faToEnDigits(listing.miles || "").replace(/[^0-9]/g, ""),
      color: listing.color || "",
      trim: listing.trim || "full",
      city: listing.city || "",
      region: listing.region || "",
      mapPos: listing.mapPos ? { ...listing.mapPos } : { lat: DEFAULT_MAP_CENTER[0], lng: DEFAULT_MAP_CENTER[1] },
      locConfirmed: !!(listing.mapPos && typeof listing.mapPos.lat === "number" && listing.region),
      // The contact number on an ad is always the logged-in account's
      // number, never whatever was previously stored on the listing —
      // so editing an old/seeded listing snaps its phone to state.account
      // instead of carrying over a stale or foreign number.
      phone: state.account || listing.phone || "",
      description: listing.description || "",
      photos: Array.isArray(listing.photos) ? [...listing.photos] : [],
      adTitle: String(listing.adTitle || ""),
      damagedParts: Array.isArray(listing.paintedParts) ? [...listing.paintedParts] : [],
      bodyConditionRating: Number.isFinite(listing.bodyConditionRating) ? listing.bodyConditionRating : null,
      negotiable: !!listing.negotiable,
      tradeIn: !!listing.tradeIn,
      acceptsOffers: listing.acceptsOffers === true,
      minPrice: window.MARQUE_TRUST && typeof window.MARQUE_TRUST.getSellerMinimumPrice === "function" ? String(window.MARQUE_TRUST.getSellerMinimumPrice(listing.id) || "") : "",
    };
  }

  // Real, interactive Leaflet/OpenStreetMap picker for the "sell" flow's
  // location step. The seller can drag/zoom the map and tap (or drag the
  // marker) to pick their spot; we never store or send that exact point
  // anywhere buyer-facing — only a coarse district label (computed relative
  // to where the map first opened) is kept on the listing, matching the
  // "region only" behavior the old fake grid map provided.
  function initSellLocationMap(box, skipLeafletLoad) {
    const el = box.querySelector('[data-slot="locationMapEl"]');
    if (!el) return;
    if (!skipLeafletLoad && !(typeof L !== "undefined" && L && typeof L.map === "function") && typeof window.CARMA_LOAD_LEAFLET === "function") {
      if (box.dataset.carmaLeafletLoading !== "1") {
        box.dataset.carmaLeafletLoading = "1";
        el.innerHTML = '<span class="sell-fallback-hint">در حال آماده‌سازی نقشه…</span>';
        window.CARMA_LOAD_LEAFLET().then((loaded) => {
          delete box.dataset.carmaLeafletLoading;
          if (!box.isConnected) return;
          el.innerHTML = "";
          if (el.classList) el.classList.remove("sell-map-loading");
          initSellLocationMap(box, !loaded);
        });
      }
      return;
    }
    const wrap = box.querySelector('[data-slot="locationMap"]') || el.parentElement;
    // Force a real, non-collapsible size with inline !important styles so no
    // stylesheet rule (or older WebView quirk) can squash the picker to 0px.
    const force = (n, h) => {
      n.style.setProperty("display", "block", "important");
      n.style.setProperty("width", "100%", "important");
      n.style.setProperty("height", h + "px", "important");
      n.style.setProperty("min-height", h + "px", "important");
      n.style.setProperty("flex", "0 0 auto", "important");
    };
    force(el, 260);
    if (wrap && wrap !== el) { wrap.style.setProperty("min-height", "262px", "important"); wrap.style.setProperty("flex", "0 0 auto", "important"); wrap.style.setProperty("display", "block", "important"); }
    const cityRef = cityCoords(state.sellForm.city);
    // Nothing chosen yet (no region) -> open centered on the selected city.
    const fresh = !state.sellForm.region || !state.sellForm.mapPos;
    const pos = fresh ? { lat: cityRef[0], lng: cityRef[1] } : state.sellForm.mapPos;
    const start = [pos.lat, pos.lng];
    const hasLeaflet = typeof L !== "undefined" && L && typeof L.map === "function";

    function applyPosition(latlng) {
      const region = regionLabelFromLatLng(cityRef, latlng.lat, latlng.lng);
      state = { ...state, sellForm: { ...state.sellForm, mapPos: { lat: latlng.lat, lng: latlng.lng }, region } };
      const labelEl = box.querySelector('[data-slot="locationLabel"]');
      if (labelEl) labelEl.textContent = region;
    }

    if (fresh) applyPosition({ lat: start[0], lng: start[1] });

    // ---- confirm button (iOS-style glass pill) ----
    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button"; confirmBtn.className = "sell-confirm-btn";
    const CHECK_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    const paintConfirm = () => {
      const ok = !!state.sellForm.locConfirmed;
      confirmBtn.classList.toggle("is-confirmed", ok);
      confirmBtn.innerHTML = ok ? CHECK_SVG + "<span>موقعیت تایید شد</span><i class=\"sell-confirm-sep\"></i><span class=\"sell-confirm-edit\">ویرایش</span>" : "<span>تایید موقعیت</span>";
      if (wrap) wrap.classList.toggle("is-locked", ok);
      const circ0 = wrap && wrap.querySelector(".sell-center-circle");
      if (circ0) circ0.classList.toggle("is-confirmed", ok);
      const hint = box.querySelector('[data-slot="locationHint"]');
      if (hint) hint.classList.toggle("is-confirmed", ok);
    };
    const markUnconfirmed = () => {
      if (!state.sellForm.locConfirmed) return;
      state = { ...state, sellForm: { ...state.sellForm, locConfirmed: false } };
      paintConfirm();
    };
    confirmBtn.addEventListener("click", (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      if (state.sellForm.locConfirmed) { markUnconfirmed(); return; }
      state = { ...state, sellForm: { ...state.sellForm, locConfirmed: true }, sellError: null };
      paintConfirm();
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {}
    });
    if (wrap) wrap.appendChild(confirmBtn);
    paintConfirm();

    let setPoint; // (lat, lng) -> moves the MAP so that point sits under the center pin

    // Fixed circular AREA in the middle of the box (no point/pin): the map
    // moves underneath it and the chosen area is whatever the circle covers.
    if (wrap && !wrap.querySelector(".sell-center-circle")) {
      const circ = document.createElement("div");
      circ.className = "sell-center-circle";
      circ.setAttribute("aria-hidden", "true");
      circ.innerHTML = '<span class="sell-circle-pin"><span class="sell-circle-pin-shadow"></span><div class="leaflet-app-pin">' + icon("map-pin", { width: "15", height: "15" }) + '</div></span>';
      wrap.appendChild(circ);
    }

    if (hasLeaflet) {
      // Zoom works normally; the circle is resized on every move/zoom so it
      // always covers the same real-world radius (~600 m) under the pin.
      const map = L.map(el, { zoomControl: true, scrollWheelZoom: false, doubleClickZoom: "center", touchZoom: "center", minZoom: 11, maxZoom: 19 }).setView(start, 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(map);
      const circEl = wrap && wrap.querySelector(".sell-center-circle");
      const AREA_RADIUS_M = 90;
      const sizeCircle = () => {
        if (!circEl) return;
        const c = map.getCenter();
        const mpp = 156543.03392 * Math.cos(c.lat * Math.PI / 180) / Math.pow(2, map.getZoom());
        const d = Math.max(36, Math.min(300, (2 * AREA_RADIUS_M) / mpp));
        circEl.style.width = d + "px"; circEl.style.height = d + "px";
        circEl.style.marginLeft = (-d / 2) + "px"; circEl.style.marginTop = (-d / 2) + "px";
      };
      map.on("dragstart zoomstart", markUnconfirmed);
      map.on("move", () => applyPosition(map.getCenter()));
      map.on("moveend", () => applyPosition(map.getCenter()));
      map.on("zoom zoomend move", sizeCircle);
      sizeCircle();
      setPoint = (lat, lng) => { map.setView([lat, lng], Math.max(map.getZoom(), 14)); };
      registerLeafletMap(map);
      requestAnimationFrame(() => map.invalidateSize());
    } else {
      // No map library / no internet: self-contained draggable map. Drag the
      // grid; the pin stays centered and the location follows the center.
      const SPAN = 0.075; // half of the initially visible width, in degrees
      el.classList.add("sell-fallback-map");
      el.innerHTML = '<span class="sell-fallback-grid"></span>' +
        '<span class="sell-fallback-hint">نقشه را بکشید تا دایره روی منطقهٔ شما قرار بگیرد</span>';
      const grid = el.querySelector(".sell-fallback-grid");
      let zk = 0; // zoom level for the plain map (scale = 2^zk)
      const dpp = () => (2 * SPAN) / Math.max(1, el.clientWidth) / Math.pow(2, zk); // degrees per pixel
      let px = 0, py = 0;
      const centerLatLng = () => ({ lat: start[0] + py * dpp(), lng: start[1] - px * dpp() });
      const paint = () => {
        const sc = Math.pow(2, zk), a = 44 * sc, b = 176 * sc;
        grid.style.setProperty("background-size", a + "px " + a + "px, " + a + "px " + a + "px, " + b + "px " + b + "px, " + b + "px " + b + "px", "important");
        grid.style.backgroundPosition = px + "px " + py + "px";
      };
      const zoomBy = (d) => {
        const nk = Math.max(-1, Math.min(2, zk + d));
        if (nk === zk) return;
        const c = centerLatLng(); zk = nk; setPoint(c.lat, c.lng); applyPosition(c); markUnconfirmed();
      };
      const zoomBox = document.createElement("div");
      zoomBox.className = "sell-fb-zoom";
      zoomBox.innerHTML = '<button type="button" aria-label="بزرگ‌نمایی">+</button><button type="button" aria-label="کوچک‌نمایی">−</button>';
      const [zin, zout] = zoomBox.querySelectorAll("button");
      zin.addEventListener("click", (e) => { e.stopPropagation(); zoomBy(1); });
      zout.addEventListener("click", (e) => { e.stopPropagation(); zoomBy(-1); });
      if (wrap) wrap.appendChild(zoomBox);
      const initial = { lat: start[0], lng: start[1] };
      let dragging = false, lastX = 0, lastY = 0;
      el.style.touchAction = "none";
      el.style.cursor = "grab";
      el.addEventListener("pointerdown", (ev) => {
        dragging = true; lastX = ev.clientX; lastY = ev.clientY;
        try { el.setPointerCapture(ev.pointerId); } catch (_) {}
        el.style.cursor = "grabbing";
      });
      el.addEventListener("pointermove", (ev) => {
        if (!dragging) return;
        px += ev.clientX - lastX; py += ev.clientY - lastY;
        lastX = ev.clientX; lastY = ev.clientY;
        paint(); applyPosition(centerLatLng()); markUnconfirmed();
      });
      const stop = () => { dragging = false; el.style.cursor = "grab"; };
      el.addEventListener("pointerup", stop); el.addEventListener("pointercancel", stop);
      setPoint = (lat, lng) => {
        px = -(lng - start[1]) / dpp(); py = (lat - start[0]) / dpp();
        paint();
      };
      paint();
    }

    // "My location" button (works in both modes, uses the device GPS).
    if (wrap && !wrap.querySelector(".sell-locate-btn")) {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "sell-locate-btn";
      btn.innerHTML = icon("map-pin", { width: "14", height: "14" }) + "<span>موقعیت من</span>";
      btn.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        if (!navigator.geolocation) { if (typeof showToast === "function") showToast("مرورگر شما از موقعیت‌یابی پشتیبانی نمی‌کند"); return; }
        btn.classList.add("is-loading");
        navigator.geolocation.getCurrentPosition((p) => {
          btn.classList.remove("is-loading");
          const lat = p.coords.latitude, lng = p.coords.longitude;
          if (setPoint) setPoint(lat, lng);
          applyPosition({ lat, lng }); markUnconfirmed();
        }, () => {
          btn.classList.remove("is-loading");
          if (typeof showToast === "function") showToast("دسترسی به موقعیت داده نشد؛ روی نقشه ضربه بزنید");
        }, { enableHighAccuracy: true, timeout: 12000 });
      });
      wrap.appendChild(btn);
    }
  }

  // Vehicle detail page fields that weren't previously collected during listing creation.
  // Engine type is a free-text technical field; ownership data is optional and collapsible
  // so it doesn't make the main listing flow feel longer than necessary.
  const SELL_ENGINE_VOLUMES = ["کمتر از ۱۳۰۰", "۱۳۰۰ تا ۱۷۰۰", "۱۷۰۰ تا ۲۰۰۰", "۲۰۰۰ تا ۲۵۰۰", "بیش از ۲۵۰۰"];
  const SELL_CYLINDERS = ["۳ سیلندر", "۴ سیلندر", "۵ سیلندر", "۶ سیلندر", "۸ سیلندر", "۱۰ یا بیشتر"];
  // Electric cars have no cylinders / engine volume, so those fields are hidden and skipped.
  function sellNeedsEngineSpecs(form) { return (form && form.fuelType) !== "برقی"; }
  const SELL_DELIVERY_OPTIONS = ["تحویل روز", "کمتر از ۳ ماه", "تحویل ۳ تا ۶ ماه", "تحویل ۶ تا ۹ ماه", "تحویل ۹ تا ۱۲ ماه"];
  const SELL_MAX_PHOTOS = 4;
  const SELL_MAX_PHOTO_BYTES = 20 * 1024 * 1024;
  const SELL_VIDEO_MIN_SEC = 30;
  const SELL_VIDEO_MAX_SEC = 180;
  const SELL_VIDEO_MAX_BYTES = 300 * 1024 * 1024;
  // Mileage: "zero" (صفر), "used" (کارکرده, needs km) or "presale" (حواله / پیش‌فروش, needs delivery time).
  function sellMilesNumber(form) { return (form.mileageType || "used") === "used" ? parseInt(form.miles, 10) : 0; }
  function sellMilesLabel(form, num) {
    const t = form.mileageType || "used";
    if (t === "zero") return "صفر کیلومتر";
    if (t === "presale") return "حواله / پیش‌فروش";
    return num.toLocaleString("fa-IR") + " کیلومتر";
  }
  function sellMilesHintText(digits) {
    const n = parseInt(String(digits || "").replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(n) || n <= 0) return "";
    const fa = (x) => x.toLocaleString("fa-IR");
    if (n < 1000) return fa(n) + " کیلومتر";
    const k = Math.floor(n / 1000), r = n % 1000;
    return fa(k) + " هزار" + (r ? " و " + fa(r) : "") + " کیلومتر";
  }
  function updateSellMilesHint(root) {
    const input = root && root.querySelector('input[name="miles"]');
    const hint = root && root.querySelector('[data-slot="miles-hint"]');
    if (input && hint) hint.textContent = sellMilesHintText(input.value);
  }
  function applySellMileageUI(root, type) {
    root.querySelectorAll(".sell-radio").forEach((b) => {
      const on = b.dataset.value === type;
      b.classList.toggle("is-selected", on);
      b.setAttribute("aria-checked", String(on));
    });
    const used = root.querySelector('[data-slot="mileage-used"]'); if (used) used.hidden = type !== "used";
    const presale = root.querySelector('[data-slot="mileage-presale"]'); if (presale) presale.hidden = type !== "presale";
    const hidden = root.querySelector('input[name="mileageType"]'); if (hidden) hidden.value = type;
  }
  function setSellMileage(type) {
    if (!["zero", "used", "presale"].includes(type)) return;
    syncSellFormFromDOM();
    state = { ...state, sellForm: { ...state.sellForm, mileageType: type }, sellError: null };
    const root = document.querySelector('[data-page="sell-step"]');
    if (root) applySellMileageUI(root, type);
  }
  function fmtSellDuration(sec) {
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return toFaDigits(String(m)) + ":" + toFaDigits(String(s).padStart(2, "0"));
  }
  // Photo / video step: counters, empty-state hints and the video preview card.
  function hydrateSellMedia(box, f) {
    const photos = Array.isArray(f.photos) ? f.photos : [];
    const video = f.video && f.video.poster ? f.video : null;
    const has = photos.length > 0 || !!video;
    const warn = box.querySelector('[data-slot="media-warn"]'); if (warn) warn.hidden = has;
    const illus = box.querySelector('[data-slot="media-illus"]'); if (illus) illus.hidden = has;
    const pc = box.querySelector('[data-slot="photo-count"]');
    if (pc) pc.textContent = photos.length ? toFaDigits(String(photos.length)) + " از " + toFaDigits(String(SELL_MAX_PHOTOS)) : "";
    const pt = box.querySelector('[data-slot="photo-tile"]');
    if (pt && photos.length >= SELL_MAX_PHOTOS) { pt.classList.add("is-full"); const i = pt.querySelector("input"); if (i) i.disabled = true; }
    const vt = box.querySelector('[data-slot="video-tile"]');
    const vc = box.querySelector('[data-slot="video-count"]');
    if (vt && video) { vt.classList.add("is-full"); const i = vt.querySelector("input"); if (i) i.disabled = true; if (vc) vc.textContent = "۱ از ۱"; }
    const vp = box.querySelector('[data-slot="video-preview"]');
    if (vp) {
      vp.hidden = !video;
      if (video) vp.innerHTML = `<div class="sell-media-video"><img src="${escHtml(video.poster)}" alt="پیش‌نمایش ویدیو"/><span class="sell-media-play" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span><span class="sell-media-dur">${fmtSellDuration(video.duration || 0)}</span><button type="button" data-action="removeSellVideo" class="sell-media-x" aria-label="حذف ویدیو"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>`;
    }
  }

  const SELL_EXTRA_SPECS = [
    { key: "engineType", label: "نوع موتور", hint: "مثلاً ۲.۰ لیتری توربو یا ۴ سیلندر", input: true },
    { key: "fuelType", label: "نوع سوخت", hint: "یک گزینه انتخاب کنید", options: ["بنزینی", "دیزلی", "هیبریدی", "پلاگین‌هیبرید", "برقی", "دوگانه‌سوز"] },
    { key: "transmission", label: "نوع گیربکس", hint: "یک گزینه انتخاب کنید", options: ["اتوماتیک", "دنده‌ای", "دوکلاچه (DCT)", "پیوسته (CVT)"] },
    { key: "engineVolume", label: "حجم موتور (سی‌سی)", hint: "یک گزینه انتخاب کنید", options: SELL_ENGINE_VOLUMES, engineOnly: true },
    { key: "cylinders", label: "تعداد سیلندر", hint: "یک گزینه انتخاب کنید", options: SELL_CYLINDERS, engineOnly: true },
    { key: "interiorColor", label: "رنگ تریم داخلی", hint: "رنگ کابین و صندلی‌ها", swatches: { "مشکی": "#1D1D1F", "کرم": "#e6d9bd", "خاکستری": "#8b8b90", "قهوه‌ای": "#6b4a2f", "قرمز": "#a3262a", "سفید": "#F5F5F7", "آبی": "#1f3b73" } },
    { key: "driveTrain", label: "سیستم انتقال قدرت", hint: "محرک چرخ‌ها", options: ["دو چرخ محرک جلو (FWD)", "دو چرخ محرک عقب (RWD)", "چهار چرخ محرک (AWD)", "چهار چرخ محرک (4WD)"] },
  ];
  const SELL_OWNERSHIP_SPECS = [
    { key: "documentType", label: "نوع سند", options: ["تک‌برگ", "دفترچه‌ای", "قولنامه‌ای", "وکالتی", "سایر", "نامشخص"] },
    { key: "powerOfAttorneyStatus", label: "وضعیت وکالت", options: ["دارد", "ندارد", "نامشخص"] },
    { key: "insuranceStatus", label: "وضعیت بیمه", options: ["دارد", "ندارد", "نامشخص"] },
  ];
  const SELL_OPTION_LABELS = {
    "دو چرخ محرک جلو (FWD)": "جلو‌محرک (FWD)",
    "دو چرخ محرک عقب (RWD)": "عقب‌محرک (RWD)",
    "چهار چرخ محرک (AWD)": "چهار‌محرک (AWD)",
    "چهار چرخ محرک (4WD)": "چهار‌محرک (4WD)",
  };
  const SELL_SPEC_COLS = { fuelType: 3, transmission: 2, driveTrain: 2, engineVolume: 3, cylinders: 3 };
  function appendSellExtraSpecs(box, f) {
    const wrap = document.createElement("div");
    wrap.className = "sell-sections";
    SELL_EXTRA_SPECS.forEach((spec) => {
      const section = document.createElement("div");
      section.className = "sell-section";
      section.dataset.specKey = spec.key;
      if (spec.engineOnly && !sellNeedsEngineSpecs(f)) section.hidden = true;
      if (spec.input) {
        section.innerHTML = `<div class="sell-section-head"><label class="sell-section-title" for="sellSpec-${spec.key}">${escHtml(spec.label)}</label><span class="sell-section-value">اختیاری</span></div><input id="sellSpec-${spec.key}" class="sell-spec-text-input" type="text" name="${spec.key}" maxlength="100" value="${escHtml(f[spec.key] || "")}" placeholder="${escHtml(spec.hint || "")}" autocomplete="off"/>`;
        wrap.appendChild(section);
        return;
      }
      const opts = spec.options || Object.keys(spec.swatches);
      const chips = opts.map((o) => {
        const on = f[spec.key] === o ? " is-selected" : "";
        const base = `data-action="setSellOption" data-field="${spec.key}" data-value="${escHtml(o)}"`;
        if (spec.swatches) {
          return `<button type="button" class="sell-chip sell-swatch${on}" ${base} aria-label="${escHtml(o)}" title="${escHtml(o)}"><i style="background:${spec.swatches[o]}"></i></button>`;
        }
        return `<button type="button" class="sell-chip${on}" ${base}>${escHtml(SELL_OPTION_LABELS[o] || o)}</button>`;
      }).join("");
      const shown = spec.swatches ? `<span class="sell-section-value" data-for="${spec.key}">${escHtml(f[spec.key] || "")}</span>` : "";
      const cls = spec.swatches ? "sell-swatch-row" : `sell-opt-grid sell-cols-${SELL_SPEC_COLS[spec.key] || 2}`;
      section.innerHTML = `<div class="sell-section-head"><span class="sell-section-title">${escHtml(spec.label)}</span>${shown}</div><input type="hidden" name="${spec.key}" value="${escHtml(f[spec.key] || "")}"/><div class="${cls}" role="group" aria-label="${escHtml(spec.label)}">${chips}</div>`;
      wrap.appendChild(section);
    });
    box.appendChild(wrap);
  }
  function appendSellOwnershipSpecs(box, f) {
    const details = document.createElement("details");
    details.className = "sell-more sell-ownership-more";
    if (SELL_OWNERSHIP_SPECS.some((spec) => !!f[spec.key])) details.open = true;
    const summary = document.createElement("summary");
    summary.innerHTML = `<span class="sell-ownership-summary-copy"><strong>اطلاعات سند و مدارک خودرو</strong><small>نوع سند، بیمه و وضعیت وکالت را انتخاب کنید</small></span><span class="sell-ownership-summary-cta">برای انتخاب لمس کنید <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
    details.appendChild(summary);
    const intro = document.createElement("p");
    intro.className = "sell-ownership-intro";
    intro.textContent = "اختیاری است؛ با انتخاب هر مورد، وضعیت سند، بیمه و وکالت در جزئیات آگهی نمایش داده می‌شود.";
    details.appendChild(intro);
    const wrap = document.createElement("div");
    wrap.className = "sell-sections sell-ownership-sections";
    SELL_OWNERSHIP_SPECS.forEach((spec) => {
      const section = document.createElement("div");
      section.className = "sell-section";
      const chips = spec.options.map((option) => {
        const selected = f[spec.key] === option ? " is-selected" : "";
        return `<button type="button" class="sell-chip${selected}" data-action="setSellOption" data-field="${spec.key}" data-value="${escHtml(option)}">${escHtml(option)}</button>`;
      }).join("");
      section.innerHTML = `<div class="sell-section-head"><span class="sell-section-title">${escHtml(spec.label)}</span><span class="sell-section-value" data-for="${spec.key}">${escHtml(f[spec.key] || "انتخاب نشده")}</span></div><input type="hidden" name="${spec.key}" value="${escHtml(f[spec.key] || "")}"/><div class="sell-chip-grid" role="group" aria-label="${escHtml(spec.label)}">${chips}</div>`;
      wrap.appendChild(section);
    });
    details.appendChild(wrap);
    box.appendChild(details);
  }
  function setSellOption(field, value) {
    const supported = [...SELL_EXTRA_SPECS, ...SELL_OWNERSHIP_SPECS].some((spec) => spec.key === field && (!spec.options || spec.options.includes(value)))
      || (field === "deliveryTime" && SELL_DELIVERY_OPTIONS.includes(value));
    if (!supported) return;
    syncSellFormFromDOM();
    state = { ...state, sellForm: { ...state.sellForm, [field]: value }, sellError: null };
    const root = document.querySelector('[data-page="sell-step"]');
    if (!root) return;
    const input = root.querySelector(`input[name="${field}"]`); if (input) input.value = value;
    root.querySelectorAll(`.sell-chip[data-field="${field}"]`).forEach((b) => b.classList.toggle("is-selected", b.dataset.value === value));
    const shownEl = root.querySelector(`.sell-section-value[data-for="${field}"]`); if (shownEl) shownEl.textContent = value;
    if (field === "fuelType") {
      const need = sellNeedsEngineSpecs(state.sellForm);
      root.querySelectorAll('.sell-section[data-spec-key="engineVolume"], .sell-section[data-spec-key="cylinders"]').forEach((sec) => { sec.hidden = !need; });
    }
  }

  // Regroup the sell flow so related fields sit together:
  //  1) photos + ad title + description   2) car identity + colour + all specs
  //  3) price + mileage                  4) body condition + documents/insurance   5) location + phone
  function composeSellStep(step, build) {
    if (step >= 5) return build(step);
    const q = (b, sel) => b.querySelector(sel);
    if (step === 1) {
      const b = build(1), s3 = build(3);
      const old = q(b, '[data-slot="note"]'); if (old) old.remove();
      const grid = q(b, ".sell-block-grid"), desc = grid && q(grid, ".sell-block-field");
      const t = q(s3, ".sell-adtitle");
      if (grid && desc && t) grid.insertBefore(t, desc);
      b.insertBefore(mountTemplate("tpl-sell-note-1"), b.firstChild);
      return b;
    }
    if (step === 2) {
      const b = build(2), s3 = build(3);
      const colorInput = q(s3, 'input[name="color"]');
      const list = colorInput && colorInput.closest(".sell-list");
      const firstList = q(b, ".sell-list");
      if (list && firstList) firstList.after(list);
      // interior trim colour right under the exterior colour; "وضعیت خودرو" row goes below it
      const ic = q(b, '.sell-section[data-spec-key="interiorColor"]');
      if (list && ic) {
        const rows = list.querySelectorAll(".sell-row-wrap");
        list.after(ic);
        if (rows[1]) { const rest = document.createElement("div"); rest.className = "sell-list"; rest.appendChild(rows[1]); ic.after(rest); }
      }
      return b;
    }
    if (step === 3) {
      const b = build(3);
      const t = q(b, ".sell-adtitle"); if (t) t.remove();
      const colorInput = q(b, 'input[name="color"]'); const list = colorInput && colorInput.closest(".sell-list"); if (list) list.remove();
      const own = q(b, ".sell-ownership-more"); if (own) own.remove();
      return b;
    }
    if (step === 4) {
      const b = build(4), s3 = build(3);
      const own = q(s3, ".sell-ownership-more");
      if (own) b.appendChild(own);
      return b;
    }
    return build(step);
  }

  function renderSellScreen() {
    const f=state.sellForm,step=state.sellStep||1;
    const editing=!!state.editingListingId;
    const total=sellTotalSteps();
    return hydratePageShell("tpl-sell-step",root=>{
      const titleEl=root.querySelector('[data-slot="title"]');
      if(titleEl)titleEl.textContent=editing?"ویرایش آگهی":"فروش خودرو";
      const progress=buildSellStepper(step,total);root.querySelector('[data-slot="progress"]').replaceWith(progress);
      const content=root.querySelector('[data-slot="step-content"]');
      const buildOld=(step)=>{ let box;
      // Step order: 1) photos & description, 2) vehicle specs, 3) price & condition,
      // 4) body/paint condition (diagram), 5) location & contact.
      if(step===1){box=mountTemplate("tpl-sell-step4");const noteEl=box.querySelector('[data-slot="note"]');if(noteEl)noteEl.remove();const photos=box.querySelector('[data-slot="photos"]');(Array.isArray(f.photos)?f.photos:[]).forEach((src,i)=>{const ph=mountTemplate("tpl-sell-photo");ph.dataset.index=i;ph.querySelector('[data-slot="img"]').src=src;ph.querySelector('[data-slot="img"]').alt=`عکس خودرو ${i+1}`;ph.querySelector('[data-slot="primary"]').hidden=i!==0;const makePrimaryBtn=ph.querySelector('[data-slot="makePrimary"]');makePrimaryBtn.hidden=i===0;makePrimaryBtn.dataset.index=i;photos.appendChild(ph);});box.querySelector('textarea[name="description"]').value=f.description||"";hydrateSellMedia(box,f);}
      else if(step===2){box=mountTemplate("tpl-sell-step1");const brandInput=box.querySelector('input[name="brand"]');const brandTrigger=box.querySelector('[data-action="openSellBrandPicker"]');const brand=BRANDS.find(b=>!b.all&&b.name===f.brand);if(brandInput)brandInput.value=f.brand||"";if(brandTrigger){brandTrigger.querySelector('[data-slot="brand-label"]').textContent=f.brand||"انتخاب برند";const mark=brandTrigger.querySelector('[data-slot="brand-mark"]');mark.replaceChildren();if(brand?.img){const img=document.createElement("img");img.src=brand.img;img.alt=brand.name;mark.appendChild(img);}else if(brand){const t=document.createElement("span");t.textContent=brand.initials||brand.name.slice(0,1);mark.appendChild(t);}}const yearInput=box.querySelector('input[name="year"]');if(yearInput)yearInput.value=f.year||"";const yearTrigger=box.querySelector('[data-action="openSellYearPicker"]');if(yearTrigger)yearTrigger.querySelector('[data-slot="year-label"]').textContent=f.year?toFaDigits(f.year):"انتخاب سال";const modelInput=box.querySelector('input[name="model"]');if(modelInput)modelInput.value=f.model||"";const modelTrigger=box.querySelector('[data-action="openSellModelPicker"]');if(modelTrigger)modelTrigger.querySelector('[data-slot="model-label"]').textContent=f.model||"انتخاب مدل";box.querySelector('[data-slot="note"]').replaceWith(mountTemplate("tpl-sell-note-2"));}
      else if(step===3){box=mountTemplate("tpl-sell-step2");const adTitleInput=box.querySelector('input[name="adTitle"]');if(adTitleInput){adTitleInput.value=f.adTitle||"";updateSellAdTitleCount(box);}const colorInput=box.querySelector('input[name="color"]');if(colorInput)colorInput.value=f.color||"";const colorEntry=sellColorByHex(f.color);const colorTrigger=box.querySelector('[data-action="openSellColorPicker"]');if(colorTrigger){colorTrigger.querySelector('[data-slot="color-label"]').textContent=colorEntry?.name||"انتخاب رنگ";const sw=colorTrigger.querySelector('[data-slot="color-swatch"]');if(sw){sw.style.background=colorEntry?.hex||"transparent";sw.classList.toggle("is-empty",!colorEntry);}}const priceInput=box.querySelector('input[name="price"]');if(priceInput)priceInput.value=formatSellPrice(f.price);
        const priceUnitEl=box.querySelector('#sellPriceUnit');if(priceUnitEl){const initialLabel=sellPriceUnitLabel(f.price);priceUnitEl.textContent=initialLabel;sellPriceUnitLast=initialLabel;}
        box.querySelector('input[name="miles"]').value=formatSellPrice(f.miles||"");
        applySellMileageUI(box,f.mileageType||"used");updateSellMilesHint(box);
        const dGrid=box.querySelector('[data-slot="delivery-grid"]');if(dGrid)dGrid.innerHTML=SELL_DELIVERY_OPTIONS.map(o=>`<button type="button" class="sell-chip${f.deliveryTime===o?" is-selected":""}" data-action="setSellOption" data-field="deliveryTime" data-value="${escHtml(o)}">${escHtml(o)}</button>`).join("");
        const dHidden=box.querySelector('input[name="deliveryTime"]');if(dHidden)dHidden.value=f.deliveryTime||"";
        const negotiableInput=box.querySelector('input[name="negotiable"]'); if(negotiableInput){negotiableInput.checked=!!f.negotiable; applySellNegotiableUI(box,!!f.negotiable);}
        const tradeInInput=box.querySelector('input[name="tradeIn"]'); if(tradeInInput) tradeInInput.checked=!!f.tradeIn;const trim=SELL_TRIMS[f.trim]||SELL_TRIMS.full;box.querySelector('input[name="trim"]').value=f.trim||"full";const trigger=box.querySelector('[data-action="openSellTrimPicker"]');if(trigger){trigger.querySelector('[data-slot="trim-label"]').textContent=trim.label;trigger.querySelector('[data-slot="trim-icon"]').textContent=trim.code;trigger.setAttribute("aria-expanded","false");}box.querySelector('[data-slot="note"]').replaceWith(mountTemplate("tpl-sell-note-3"));appendSellOwnershipSpecs(box,f);updateSellPriceAdders();}
      else if(step===4){box=buildDamageStepContent(f);}
      else if(step===5){box=mountTemplate("tpl-sell-step3");const cityInput=box.querySelector('input[name="city"]');if(cityInput)cityInput.value=f.city||"";const cityTrigger=box.querySelector('[data-action="openSellCityPicker"]');if(cityTrigger){cityTrigger.querySelector('[data-slot="city-label"]').textContent=f.city||"انتخاب شهر";cityTrigger.setAttribute("aria-expanded","false");}box.querySelector('input[name="phone"]').value=state.account||f.phone||"";box.querySelector('[data-slot="note"]').replaceWith(mountTemplate("tpl-sell-note-5"));
        const locLabel=box.querySelector('[data-slot="locationLabel"]');
        if(locLabel)locLabel.textContent=f.region||"مرکز شهر";
        requestAnimationFrame(()=>initSellLocationMap(box));
      }
      else {
        // Step 6 (dealership accounts only): which panel to publish the ad in.
        box=document.createElement("div");box.className="flex flex-col gap-4";
        const dOk=state.dealership.status==="approved";
        const sel=(dOk&&state.lastPublishAs==="dealer")?"dealer":"personal";
        const dn=escHtml(state.dealership.name);
        box.innerHTML=`<div class="sell-step-heading">ثبت آگهی در کدام پنل؟</div><div class="publish-as" style="margin-top:0"><div class="publish-as-hint">آگهی در پنل نمایشگاه با برچسب «نمایشگاه» و در صفحه‌ی ${dn} نمایش داده می‌شود.</div><div class="acct-type-list"><label class="acct-type-card"><input type="radio" name="publishAs" value="personal"${sel==="personal"?" checked":""}><span class="acct-type-body"><span class="acct-type-title">پنل کاربری عادی من</span><span class="acct-type-desc">به‌عنوان فروشنده‌ی شخصی</span></span></label><label class="acct-type-card"><input type="radio" name="publishAs" value="dealer"${sel==="dealer"?" checked":""}${dOk?"":" disabled"}><span class="acct-type-body"><span class="acct-type-title">پنل ${dn}</span><span class="acct-type-desc">${dOk?"به‌عنوان نمایشگاه":(state.dealership.status==="rejected"?"درخواست نمایشگاه رد شده است":"در انتظار تأیید مدیریت — هنوز فعال نیست")}</span></span></label></div></div>`;
      }
      if(step===2)appendSellExtraSpecs(box,f);return box;};
      const box=composeSellStep(step,buildOld);
      box.classList.add(state.sellDirection==="backward"?"sell-step-fade-back":"sell-step-fade-fwd");
      content.appendChild(box);
      root.querySelector('[data-slot="step-input"]').value=step;
      const errBox=root.querySelector('[data-slot="form-error"]');if(errBox){errBox.hidden=!state.sellError;if(state.sellError)errBox.textContent=state.sellError;}
      const actions=root.querySelector('[data-slot="actions"]');actions.replaceChildren();
      const prevOrCancel=mountTemplate(step>1?"tpl-sell-action-prev":"tpl-sell-action-cancel");
      if(editing&&step===1){prevOrCancel.dataset.action="cancelEditListing";}
      actions.appendChild(prevOrCancel);
      const nextOrSubmit=mountTemplate(step<total?"tpl-sell-action-next":"tpl-sell-action-submit");
      if(editing&&step===total){nextOrSubmit.textContent="ذخیره تغییرات";}
      actions.appendChild(nextOrSubmit);
      root.querySelector('[data-slot="terms"]').hidden=step!==total||editing;
    });
  }

  function renderSavedScreen() {
    const likedListings = LISTINGS.filter((l) => state.likedIds.includes(l.id));
    return hydratePageShell("tpl-saved", (root) => {
      mountBreadcrumbs(root, [{ label: "جستجو", action: "goHome" }, { label: "نشان‌شده‌ها" }]);
      root.querySelector('[data-slot="title"]').textContent = "خودروهای نشان‌شده";
      mountPageSearchOnly(root);
      const cards = root.querySelector('[data-slot="cards"]');
      if (likedListings.length) {
        setDynamicHTML(cards, likedListings.map(renderListingCard).join(""));
      } else {
        const empty = mountTemplate("tpl-list-empty");
        const msg = empty.querySelector('[data-slot="message"]');
        msg.append(document.createTextNode("هنوز خودرویی نشان نکرده‌اید."));
        msg.appendChild(document.createElement("br"));
        msg.append(document.createTextNode("برای ذخیره، روی آیکن نشان هر آگهی ضربه بزنید."));
        cards.appendChild(empty);
      }
      const footer = root.querySelector('[data-slot="footer"]');
      if (likedListings.length) footer.appendChild(mountTemplate("tpl-list-end"));
    });
  }

  function renderManageListingsScreen() {
    const myListings = state.myListings.slice().sort((a, b) => b.createdAt - a.createdAt);
    return hydratePageShell("tpl-manage-listings", (root) => {
      mountBreadcrumbs(root, [{ label: "جستجو", action: "goHome" }, { label: "حساب من", action: "openAccount" }, { label: "مدیریت آگهی‌های من" }]);
      root.querySelector('[data-slot="title"]').textContent = "مدیریت آگهی‌های من";
      const gate = root.querySelector('[data-slot="login-gate"]');
      const cards = root.querySelector('[data-slot="cards"]');
      if (!state.account) {
        gate.hidden = false;
        cards.replaceChildren();
        return;
      }
      gate.hidden = true;
      mountPageSearchOnly(root);
      if (myListings.length) {
        setDynamicHTML(cards, myListings.map(renderMyListingCard).join(""));
      } else {
        const empty = mountTemplate("tpl-account-empty");
        empty.textContent = "هنوز هیچ خودرویی ثبت نکرده‌اید.";
        cards.appendChild(empty);
      }
    });
  }



/* ---------------------------------------------------------------
   عنوان آگهی (اختیاری) + پیشنهاد عنوان
   adTitle جدا از listing.title ذخیره می‌شود؛ title ساختاریافته (سال + برند + مدل) برای کارت‌ها،
   جست‌وجو و استخراج سال لازم است و دست نمی‌خورد.
--------------------------------------------------------------- */
const SELL_AD_TITLE_MAX = 70;

function updateSellAdTitleCount(scope) {
  const root = scope || document;
  const input = root.querySelector('input[name="adTitle"]');
  const count = root.querySelector('[data-slot="adtitle-count"]');
  if (input && count) count.textContent = toFaDigits(String(input.value.length)) + "/" + toFaDigits(String(SELL_AD_TITLE_MAX));
}

// فقط از اطلاعاتی که فروشنده وارد کرده عنوان می‌سازد؛ ادعاهای تأییدنشده («سالم»، «بدون رنگ») نمی‌نویسد.
function buildSellTitleSuggestions(f) {
  const brand = String(f.brand || "").trim();
  const modelRaw = fullSellModelName(brand, String(f.model || "").trim());
  if (!brand || !modelRaw) return [];
  const brandModel = modelRaw.toLowerCase().startsWith(brand.toLowerCase()) ? modelRaw : `${brand} ${modelRaw}`;
  const year = f.year ? toFaDigits(String(f.year)) : "";
  const color = (sellColorByHex(f.color) || {}).name || "";
  const trim = (SELL_TRIMS[f.trim] || {}).label || "";
  const fuel = /هیبرید|برقی/.test(f.fuelType || "") ? f.fuelType : "";
  let km = "";
  if (f.mileageType === "zero") km = "صفر کیلومتر";
  else if (f.mileageType === "presale") km = "حواله";
  else if (f.miles) { const n = Number(String(f.miles).replace(/[^0-9]/g, "")); if (n) km = n.toLocaleString("fa-IR") + " کیلومتر"; }
  const join = (parts, sep) => parts.filter(Boolean).join(sep);
  const raw = [
    join([join([brandModel, year, color], " "), km], "، "),
    join([join([modelRaw, year, trim, fuel], " "), km], " - "),
    join([join([brandModel, year, trim], " "), join([fuel, color], " ")], "، "),
    join([brandModel, year], " "),
  ];
  const seen = new Set();
  return raw.map((t) => t.trim().slice(0, SELL_AD_TITLE_MAX)).filter((t) => t && !seen.has(t) && seen.add(t)).slice(0, 3);
}

function suggestSellTitle() {
  syncSellFormFromDOM();
  const f = state.sellForm || {};
  const chips = document.querySelector('[data-page="sell-step"] [data-slot="adtitle-chips"]');
  if (!f.brand || !f.model) {
    showToast("برای پیشنهاد عنوان، اول برند و مدل خودرو را در مرحلهٔ مشخصات انتخاب کنید.");
    return;
  }
  const list = buildSellTitleSuggestions(f);
  if (!chips || !list.length) return;
  chips.replaceChildren(...list.map((t) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "sell-adtitle-chip"; b.dataset.action = "useSellTitle"; b.dataset.value = t; b.textContent = t;
    return b;
  }));
  chips.hidden = false;
}

function useSellTitle(value) {
  const v = String(value || "").slice(0, SELL_AD_TITLE_MAX);
  const input = document.querySelector('[data-page="sell-step"] input[name="adTitle"]');
  if (input) { input.value = v; updateSellAdTitleCount(); input.focus({ preventScroll: true }); }
  state = { ...state, sellForm: { ...state.sellForm, adTitle: v }, sellError: null };
  const chips = document.querySelector('[data-page="sell-step"] [data-slot="adtitle-chips"]');
  if (chips) chips.hidden = true;
}

document.addEventListener("input", function (e) {
  const t = e.target;
  if (!t || t.name !== "adTitle" || !t.closest?.('[data-page="sell-step"]')) return;
  if (t.value.length > SELL_AD_TITLE_MAX) t.value = t.value.slice(0, SELL_AD_TITLE_MAX);
  state = { ...state, sellForm: { ...state.sellForm, adTitle: t.value }, sellError: null };
  updateSellAdTitleCount();
});
