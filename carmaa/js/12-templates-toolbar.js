"use strict";

/* ---------------------------------------------------------------
   HTML-FIRST PAGE SHELLS (templates + toolbar) — mounts <template> tags, breadcrumbs, the floating toolbox/toolbar widget, and shared page-shell mounting helpers (search bar, brand scroller).
// Edit the toolbox widget, breadcrumbs, or shared page-shell wiring here.
--------------------------------------------------------------- */

  /* ---------------------------------------------------------------
     HTML-FIRST PAGE SHELLS
     Static structure lives in index.html. JS only hydrates dynamic slots.
  --------------------------------------------------------------- */

  function mountTemplate(id) {
    const tpl = document.getElementById(id);
    if (!tpl || !tpl.content) return document.createElement("div");
    return tpl.content.firstElementChild.cloneNode(true);
  }

  function setDynamicHTML(el, html) {
    if (!el) return;
    el.innerHTML = html || "";
  }

  // FIX: the "جستجو / حساب من" style breadcrumb trail (rendered above the
  // title on every non-home page: account, account-edit, vehicle, brand,
  // dealers, sell, saved, manageListings...) was removed site-wide per
  // request. Rather than touching all 17 call sites individually, this
  // just drops the placeholder slot — mountBreadcrumbs() is still called
  // everywhere exactly as before, it just no longer builds/inserts the
  // trail, so nothing renders and no leftover empty spacing is left
  // behind either.
  function mountBreadcrumbs(root, items) {
    const slot = root.querySelector('[data-slot="breadcrumbs"]');
    if (slot) slot.remove();
  }

  // FIX (perf/bug): buildToolbox used to be the only way to get a toolbar
  // node, and it required a placeholder element (`[data-slot="toolbar"]`)
  // inside a freshly-built page root to replace. That meant every toolbox
  // interaction that only changes toolbar-local UI state — opening a chip
  // dropdown, expanding the filter accordion, toggling the filter panel —
  // had to go through the full render() pipeline (rebuild the whole page,
  // including the listing-card grid) just to get a new placeholder to hand
  // to buildToolbox. That's what caused clicking a toolbox chip to also
  // refresh the cards and made the chips themselves visibly "jump" (they
  // were being torn down and recreated as part of the full-page rebuild,
  // not just updated in place). buildToolboxNode() now builds the toolbar
  // element standalone, so it can also be refreshed on its own via
  // refreshLiveToolbar() below, without touching pageContent/the cards.
  function buildToolboxNode() {
    const toolbar = mountTemplate("tpl-toolbox");
    const chips = toolbar.querySelector('[data-slot="filter-chips"]');
    const filterPanel = toolbar.querySelector('[data-slot="filter-panel"]');
    const countEl = toolbar.querySelector('[data-slot="filter-count"]');

    const routeBrand = state.route.page === "brand"
      ? state.route.brand
      : (state.route.page === "listings" && state.route.brand !== "all" ? state.route.brand : null);
    const selectedBrand = routeBrand || state.selectedBrand || null;

    // The toolbox intentionally contains ONLY the four controls requested:
    // 1) car brand, 2) model of the selected brand, 3) model year, 4) city.
    const brandValue = selectedBrand || "برند ماشین";
    const modelValue = state.filters.model || "مدل ماشین";
    const yearValue = state.filters.year || "سال ساخت ماشین";
    const cityValue = state.filters.city || "شهر";

    const activeCount = [
      selectedBrand, state.filters.model, state.filters.year, state.filters.city,
      state.filters.color, state.filters.condition,
      state.filters.transmission, state.filters.bodyStyle,
      state.filters.priceMin != null ? "priceMin" : null,
      state.filters.priceMax != null ? "priceMax" : null,
      state.filters.country, state.filters.sellerType, state.filters.installment, state.filters.electric,
      Array.isArray(state.filters.specials) && state.filters.specials.length ? "specials" : null,
    ].filter(Boolean).length;
    countEl.textContent = String(activeCount);

    const scopeBrand = selectedBrand && selectedBrand !== "همه برندها" ? selectedBrand : null;
    const scopedListings = LISTINGS.filter(l => !scopeBrand || l.brand === scopeBrand);
    const defs = [
      {
        key: "brand",
        label: "برند ماشین",
        options: BRANDS.filter(b => !b.all).map(b => b.name)
      },
      {
        key: "model",
        label: "مدل ماشین",
        options: Array.from(new Set(scopedListings.map(vehicleModelName))).filter(Boolean)
      },
      {
        key: "year",
        label: "سال ساخت ماشین",
        options: Array.from(new Set(scopedListings.map(l => ((l.title.match(/\b(19|20)\d{2}\b/) || [""])[0]))))
          .filter(Boolean).sort().reverse()
      },
      {
        key: "city",
        label: "شهر",
        options: KHUZESTAN_CITIES.slice()
      }
    ];

    const makeControl = (key, text, extra = "") => {
      const wrap = document.createElement("div");
      wrap.className = "toolbox-chip-wrap";
      wrap.dataset.chipWrap = key;
      const b = document.createElement("button");
      b.type = "button";
      b.className = `toolbox-chip ${extra}`.trim();
      const _def = defs.find(d => d.key === key);
      if (_def && text !== _def.label) b.classList.add("is-set");
      b.dataset.action = "openToolFilter";
      b.dataset.filter = key;
      const label = document.createElement("span");
      label.textContent = text;
      const arrow = document.createElement("span");
      arrow.className = "toolbox-chip-arrow";
      setDynamicHTML(arrow, icon("chevron-down", { width: "16", height: "16", class: "text-neutral-400" }));
      b.append(label, arrow);
      wrap.appendChild(b);
      return wrap;
    };

    chips.appendChild(makeControl("brand", brandValue));
    chips.appendChild(makeControl("model", modelValue, !selectedBrand ? "toolbox-chip-disabled" : ""));
    chips.appendChild(makeControl("year", yearValue));
    chips.appendChild(makeControl("city", cityValue));

    if (state.chipDropdownKey) {
      const def = defs.find(d => d.key === state.chipDropdownKey);
      const dropdownLayer = toolbar.querySelector('[data-slot="chip-dropdown-layer"]');
      if (def && dropdownLayer) {
        const dropdown = document.createElement("div");
        dropdown.className = "toolbox-chip-dropdown";
        dropdown.dataset.chipDropdown = def.key;
        if (def.key === "model" && !selectedBrand) {
          const empty = document.createElement("div");
          empty.className = "toolbox-filter-empty";
          empty.textContent = "ابتدا برند ماشین را انتخاب کنید";
          dropdown.appendChild(empty);
        } else if (!def.options.length) {
          const empty = document.createElement("div");
          empty.className = "toolbox-filter-empty";
          empty.textContent = "گزینه‌ای موجود نیست";
          dropdown.appendChild(empty);
        } else {
          def.options.forEach(value => {
            const o = document.createElement("button");
            o.type = "button";
            o.dataset.action = "setChipFilterValue";
            o.dataset.filter = def.key;
            o.dataset.value = value;
            const current = def.key === "brand" ? selectedBrand : state.filters[def.key];
            o.className = "toolbox-chip-option" + (current === value ? " is-active" : "");
            o.textContent = value;
            dropdown.appendChild(o);
          });
        }
        dropdownLayer.appendChild(dropdown);
      }
    }

    defs.forEach(({ key, label, options }) => {
      const group = document.createElement("div");
      group.className = "toolbox-filter-group";
      const head = document.createElement("button");
      head.type = "button";
      head.className = "toolbox-filter-group-head";
      head.dataset.action = "toggleFilter";
      head.dataset.filter = key;
      const title = document.createElement("span");
      title.textContent = key === "brand"
        ? (selectedBrand || label)
        : (state.filters[key] ? `${label}: ${state.filters[key]}` : label);
      const chev = document.createElement("span");
      setDynamicHTML(chev, icon(state.filterOpenKey === key ? "chevron-down" : "chevron-left", {
        width: "14", height: "14", class: "text-neutral-500"
      }));
      head.append(title, chev);
      group.appendChild(head);

      if (state.filterOpenKey === key) {
        const opts = document.createElement("div");
        opts.className = "toolbox-filter-options";
        options.forEach(value => {
          const o = document.createElement("button");
          o.type = "button";
          o.dataset.action = "setFilterValue";
          o.dataset.filter = key;
          o.dataset.value = value;
          o.className = "toolbox-option" + ((key === "brand" ? selectedBrand : state.filters[key]) === value ? " is-active" : "");
          o.textContent = value;
          opts.appendChild(o);
        });
        if (key === "model" && !selectedBrand) {
          const empty = document.createElement("div");
          empty.className = "toolbox-filter-empty";
          empty.textContent = "ابتدا برند ماشین را انتخاب کنید";
          opts.appendChild(empty);
        }
        if (options.length) group.appendChild(opts);
      }
      filterPanel.appendChild(group);
    });

    filterPanel.hidden = !state.toolFiltersOpen;
    return toolbar;
  }

  function buildToolbox(root) {
    const slot = root.querySelector('[data-slot="toolbar"]');
    if (!slot) return;
    slot.replaceWith(buildToolboxNode());
  }

  // Rebuilds ONLY the live toolbar node (chips + dropdown + filter panel)
  // in place, inside its persistent #toolbarSlot, and repositions any open
  // chip dropdown. Used for toolbox-local interactions that don't change
  // which listings are shown, so the page/card grid underneath is never
  // touched. Falls back to a full render() if the toolbar isn't mounted
  // yet for some reason, so it's always safe to call.
  //
  // FIX (bug): the chip row (`[data-slot="filter-chips"]`) scrolls
  // horizontally on its own (see `.toolbox-filter-chips { overflow-x:auto }`
  // in styles.css). Since buildToolboxNode() creates a brand-new element
  // every time, that new chip row always starts at scrollLeft 0 — so
  // tapping a chip you'd scrolled to (e.g. "شهر") rebuilt the row and
  // snapped it straight back to the first chip ("برند ماشین"), even though
  // the tap itself worked. We now read the old row's scroll position
  // before swapping it out and re-apply it to the new one.
  function refreshLiveToolbar() {
    const toolbarSlot = document.getElementById("toolbarSlot");
    const current = toolbarSlot ? toolbarSlot.querySelector(".toolbar-sticky") : null;
    if (!toolbarSlot || !current) { render(); return; }
    const prevChips = current.querySelector('[data-slot="filter-chips"]');
    const prevScrollLeft = prevChips ? prevChips.scrollLeft : 0;
    const next = buildToolboxNode();
    current.replaceWith(next);
    const nextChips = next.querySelector('[data-slot="filter-chips"]');
    if (nextChips) nextChips.scrollLeft = prevScrollLeft;
    positionChipDropdown();
  }

  function mountToolbar(root) { buildToolbox(root); }

  function clonePageTemplate(id) {
    const root = mountTemplate(id);
    return root;
  }

  function hydratePageShell(id, setup) {
    const root = clonePageTemplate(id);
    if (root && setup) setup(root);
    return root;
  }

  function orderedBrands(list) {
    if (!state.selectedBrand) return list;
    const idx = list.findIndex((b) => !b.all && b.name === state.selectedBrand);
    if (idx <= 0) return list;
    const copy = list.slice();
    const [selected] = copy.splice(idx, 1);
    let insertAt = 0;
    while (insertAt < copy.length && copy[insertAt].all) insertAt++;
    copy.splice(insertAt, 0, selected);
    return copy;
  }

  function fillBrandScroll(scroll) {
    if (!scroll) return;
    orderedBrands(BRANDS.filter((b) => !b.all)).forEach((b) => {
      const chip = mountTemplate("tpl-home-brand-chip");
      chip.dataset.brand = b.name;
      const selected = b.name === state.selectedBrand;
      chip.classList.toggle("brand-chip-selected", selected);
      const mark = chip.querySelector('[data-slot="mark"]');
      if (b.img) {
        const img = document.createElement("img");
        img.src = b.img; img.alt = b.name; img.className = "max-h-full max-w-full object-contain";
        mark.appendChild(img);
      } else {
        setDynamicHTML(mark, renderBrandMark(b));
      }
      chip.querySelector('[data-slot="name"]').textContent = b.name;
      scroll.appendChild(chip);
    });
  }

  function mountPageToolbar(root) { buildToolbox(root); }

  function mountPageSearchOnly(root) {
    // Search now lives in the persistent internal-page header. Do not remove
    // page toolbars here; callers that still use the legacy hook keep their
    // original filter/sort controls intact.
    return root;
  }

  function mountHomeSearch(root) {
    const slot = root.querySelector('[data-slot="quickpick"]');
    if (!slot) return;
    slot.remove();
  }

