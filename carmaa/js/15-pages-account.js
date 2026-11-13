"use strict";

/* ---------------------------------------------------------------
   PAGE RENDERERS — the account screen (tabs, pinned listing cards) and the account-edit screen.
// Edit the account page here.
--------------------------------------------------------------- */

  const ACCOUNT_TABS = [
    { key: "listings", label: "آگهی‌ها", icon: "tag" },
    { key: "saved", label: "نشان‌شده‌ها", icon: "bookmark" },
    { key: "inbox", label: "صندوق پیام", icon: "message-circle" },
    { key: "feed", label: "فید", icon: "radio", disabled: true },
  ];

  function dealershipStatusBanner(d) {
    if (d.status === "pending") return `<div class="dealership-status is-pending">در انتظار تأیید مدیریت — تا زمان تأیید نمی‌توانید در پنل نمایشگاه آگهی ثبت کنید.</div>`;
    if (d.status === "rejected") return `<div class="dealership-status is-rejected">درخواست نمایشگاه رد شد${d.why ? ": " + escHtml(d.why) : ""}. اطلاعات را اصلاح کنید تا دوباره بررسی شود.</div>`;
    return "";
  }

  function renderAccountTabs(active) {
    return `<div class="account-tabs" role="tablist">${ACCOUNT_TABS.map((t) => {
      const isActive = t.key === active;
      const classes = ["account-tab"];
      if (isActive) classes.push("is-active");
      if (t.disabled) classes.push("is-disabled");
      const attrs = t.disabled
        ? `disabled aria-disabled="true"`
        : (t.key === "inbox" ? `data-action="openMessages" aria-selected="${isActive}"` : `data-action="setAccountTab" data-tab="${t.key}" aria-selected="${isActive}"`);
      return `<button type="button" role="tab" aria-label="${t.label}" class="${classes.join(" ")}" ${attrs}>
        ${icon(t.icon, { width: "22", height: "22", strokeWidth: isActive ? "2" : "1.6", fill: isActive && t.key === "saved" ? "currentColor" : "none" })}
        ${t.disabled ? `<span class="account-tab-soon-badge">زودی</span>` : ""}
      </button>`;
    }).join("")}</div>`;
  }

  function renderMiniBrandBadge(brandName) {
    const b = BRANDS.find((x) => x.name === brandName);
    if (b && b.img) return `<img src="${b.img}" alt="${b.name}" class="w-full h-full object-contain p-1"/>`;
    const initials = (b && (b.initials || b.name.trim().charAt(0))) || (brandName || "?").trim().charAt(0);
    return `<span class="font-bold text-neutral-100" style="font-size:10px">${initials}</span>`;
  }

  // `footerButtons`, when provided, renders an edit/view action row under
  // the card instead of making the whole card one big tap target — used
  // for the account owner's own listings (pending or published). Saved/
  // liked cards (not the owner's) keep the old whole-card-is-a-link style.
  function renderAccountPinCard(listing, index, ownerLabel, action, actionId, footerButtons, rejected, pending) {
    const delay = Math.min(index || 0, 10) * 55;
    const cardAttrs = footerButtons ? "" : ` data-action="${action}" data-id="${actionId}"`;
    const cardClass = (footerButtons ? "account-pin-card account-pin-card-static card-fade-in" : "account-pin-card card-fade-in") + (rejected ? " is-rejected" : "") + (pending ? " is-pending" : "");
    const footer = footerButtons
      ? `<div class="account-pin-actions">${footerButtons.map((b) =>
          `<button type="button" data-action="${b.action}" data-id="${b.id}" class="account-pin-action-btn${b.emphasis ? " account-pin-action-btn-emphasis" : ""}">${b.label}</button>`
        ).join("")}</div>`
      : "";
    return `
    <div class="${cardClass}" style="animation-delay:${delay}ms"${cardAttrs}>
      <div class="account-pin-image">
        ${vehiclePhotoMarkup(listing, 0, "w-full h-full block")}
        <span class="account-pin-avatar">${renderMiniBrandBadge(listing.brand)}</span>
        ${rejected ? `<span class="account-pin-rejected-badge">${rejected}</span>` : ""}
      </div>
      <div class="account-pin-caption">
        <div class="account-pin-owner">${ownerLabel}</div>
        <div class="account-pin-title">${escHtml(listingDisplayTitle(listing))}</div>
      </div>
      ${footer}
    </div>`;
  }

  function renderAccountTabContent(tab, likedListings, myListings) {
    if (tab === "saved") {
      if (!likedListings.length) {
        const e = mountTemplate("tpl-account-empty");
        e.classList.add("mx-4");
        e.textContent = "هنوز خودرویی نشان نشده. برای ذخیره، روی آیکن نشان هر آگهی ضربه بزنید.";
        return e;
      }
      const grid = document.createElement("div");
      grid.className = "account-pin-grid";
      setDynamicHTML(grid, likedListings.map((l, i) => renderAccountPinCard(l, i, l.brand || "", "goVehicle", l.id)).join(""));
      return grid;
    }
    if (tab === "listings") {
      if (!myListings.length) {
        const e = mountTemplate("tpl-account-empty");
        e.classList.add("mx-4");
        e.textContent = "هنوز هیچ آگهی‌ای ثبت نکرده‌اید.";
        return e;
      }
      const grid = document.createElement("div");
      grid.className = "account-pin-grid";
      // Tapping one of the owner's own listing cards opens the "مدیریت
      // آگهی" sheet (پیش‌نمایش/ویرایش/حذف/پشتیبانی — see updateModalUI's
      // "manageAd" branch) instead of separate per-button footer actions.
      setDynamicHTML(grid, myListings.map((item, i) => {
        const pending = item.status === "pending";
        return renderAccountPinCard(item.listing, i, pending ? "در انتظار انتشار" : (item.status === "removed" ? "حذف‌شده توسط مدیریت" : item.status === "rejected" ? "رد شده" : item.status === "expired" ? "منقضی شده" : "منتشر شده"), "openManageAd", item.id, null, item.status === "removed" ? "حذف شده" : item.status === "rejected" ? "رد شده" : "", pending);
      }).join(""));
      return grid;
    }
    if (tab === "inbox") {
      const e = document.createElement("div");
      e.className = "mr-account-inbox-shortcut";
      e.innerHTML = `<p>پیام‌های مربوط به خرید و فروش خودرو را در یک صندوق یکپارچه ببینید.</p><button type="button" data-action="openMessages">باز کردن صندوق گفتگوها</button>`;
      return e;
    }
    const e = mountTemplate("tpl-account-empty");
    e.classList.add("mx-4");
    e.textContent = "این بخش هنوز فعال نشده است.";
    return e;
  }

  function renderAccountScreen() {
    const likedListings=LISTINGS.filter((l)=>state.likedIds.includes(l.id));
    const myListings=state.myListings.slice().sort((a,b)=>b.createdAt-a.createdAt);
    const activeTab = ACCOUNT_TABS.some((t) => t.key === state.accountTab && !t.disabled) ? state.accountTab : "listings";
    return hydratePageShell("tpl-account",(root)=>{
      mountBreadcrumbs(root,[{label:"جستجو",action:"goHome"},{label:"حساب من"}]);
      const profileSlot=root.querySelector('[data-slot="profile"]'); const profile=mountTemplate("tpl-account-profile"); const logged=!!state.account;
      // The cover is a page-level background layer: it starts behind the global header
      // and extends to the bottom of the showroom card, while a spacer preserves the
      // avatar's original vertical placement within the profile block.
      const oldCover=document.querySelector('#pageBlurWrap > .account-cover-banner-layer'); if(oldCover) oldCover.remove();
      const savedAccountBanner = "";
      const p={...(state.accountProfile||{}), banner:savedAccountBanner || ""};
      const bannerEl=profile.querySelector('[data-slot="profile-banner"]');
      if(bannerEl && p.banner){bannerEl.style.backgroundImage=`url("${p.banner}")`;bannerEl.classList.add("has-banner");}
      if(profile) profile.classList.toggle("account-has-banner", !!p.banner);
      // Display-only here: avatar and banner changes are restricted to account-edit.
      if(bannerEl){const spacer=document.createElement("div");spacer.className="account-profile-banner-spacer";spacer.setAttribute("aria-hidden","true");bannerEl.replaceWith(spacer);}
      const fullName=[p.firstName,p.lastName].filter(Boolean).join(" ").trim();
      const avatarEl=profile.querySelector('[data-slot="avatar"]');
      if(p.avatar){avatarEl.innerHTML=`<img src="${p.avatar}" alt="عکس پروفایل" class="w-full h-full object-cover"/>`;}
      else{avatarEl.textContent=logged?(fullName||state.account).trim()[0].toUpperCase():"G";}
      const nameEl = profile.querySelector('[data-slot="name"]');
      if (logged) {
        nameEl.classList.remove("account-name-empty");
        nameEl.classList.add("account-phone-row", "account-identity-stack");
        const nickname = String(p.nickname || "").trim();
        const displayName = nickname || String(state.account || "");
        let handle = "";
        try {
          const accountId = window.MR_PROFILE?.myId ? window.MR_PROFILE.myId() : (window.CARMA_AUTH_USER?.id || sellerIdForPhone(state.account));
          handle = window.MR_PROFILE?.getUsername ? String(window.MR_PROFILE.getUsername(accountId, "") || "") : String(window.CARMA_AUTH_USER?.username || "");
        } catch (_) { handle = String(window.CARMA_AUTH_USER?.username || ""); }
        if (handle && /^user_/.test(handle) && !window.CARMA_AUTH_USER?.username) handle = "";
        nameEl.innerHTML = `<span class="account-display-name" dir="auto">${escHtml(displayName)}</span>${nickname ? icon("badge-check", { width: "18", height: "18" }) : ""}${handle ? `<span class="account-user-handle" dir="ltr">@${escHtml(handle.replace(/^@/, ""))}</span>` : ""}`;
      } else {
        nameEl.classList.remove("account-name-empty", "account-phone-row");
        nameEl.textContent = "مهمان";
      }
      const action=profile.querySelector('[data-slot="action"]'); action.dataset.action="openAccountEdit"; action.querySelector('[data-slot="action-label"]').textContent=logged?"ویرایش اطلاعات":"ورود / ثبت‌نام";
      const logoutBtn=profile.querySelector('[data-slot="logout"]'); if(logoutBtn) logoutBtn.hidden=!logged;
      profileSlot.replaceWith(profile);
      // Optional dealership: normal accounts get a "create dealership" button;
      // once created, a card links to its public page and to editing it.
      if (logged) {
        const holder = document.createElement("div");
        const d = state.dealership;
        holder.innerHTML = d
          ? `<div class="dealership-card"><div class="dealership-card-head"><span class="dealership-card-logo" data-dealer-ring="${sellerIdForPhone(state.account)}">${d.logo ? `<img src="${d.logo}" alt="" style="width:100%;height:100%;object-fit:cover"/>` : escHtml((d.name || "ن").trim().charAt(0).toUpperCase())}</span><div class="dealership-card-id"><div class="dealership-card-namerow"><span class="dealership-card-name">${escHtml(d.name)}</span>${d.status === "approved" ? `<span class="dealership-card-verified" title="تأییدشده">${icon("badge-check", { width: "17", height: "17" })}</span>` : ""}</div><div class="dealership-card-meta"><span class="seller-tag seller-tag-dealer">${SELLER_ICON_STORE}نمایشگاه</span>${d.city ? `<span class="dealership-card-city">${icon("map-pin", { width: "12", height: "12" })}${escHtml(d.city)}</span>` : ""}</div></div></div><div class="dealership-card-actions">${d.status === "approved" ? `<button type="button" class="dealership-btn-main" data-action="goSeller" data-seller-kind="dealer" data-seller-id="${sellerIdForPhone(state.account)}">صفحه نمایشگاه</button>` : ""}<button type="button" class="dealership-btn-sub" data-action="openDealershipEdit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 7.5l3 3"/></svg>ویرایش نمایشگاه</button></div>${dealershipStatusBanner(d)}</div>`
          : `<button type="button" class="dealership-create-btn" data-action="openDealershipEdit">${SELLER_ICON_STORE.replace(/width="11" height="11"/, 'width="17" height="17"')}ایجاد نمایشگاه</button>`;
        const tabsAnchor = root.querySelector('[data-slot="tabs"]');
        if (tabsAnchor && tabsAnchor.parentNode) tabsAnchor.parentNode.insertBefore(holder.firstElementChild, tabsAnchor);
      }
      if(window.MARQUE_STORIES&&window.MARQUE_STORIES.syncDealerRing) setTimeout(window.MARQUE_STORIES.syncDealerRing,0);
      const tabsSlot=root.querySelector('[data-slot="tabs"]'); setDynamicHTML(tabsSlot,renderAccountTabs(activeTab));
      const contentSlot=root.querySelector('[data-slot="tab-content"]'); contentSlot.replaceChildren(renderAccountTabContent(activeTab,likedListings,myListings));
      if (false && bannerEl) {
        requestAnimationFrame(() => {
          const blurWrap=document.getElementById("pageBlurWrap");
          const pageContent=document.getElementById("pageContent");
          const sticky=document.getElementById("stickyHeaderGroup");
          if(!blurWrap || !pageContent || !sticky || !pageContent.contains(root)) return;
          bannerEl.classList.add("account-cover-banner-layer");
          blurWrap.insertBefore(bannerEl,pageContent);
          // The cover is pinned to the viewport (position:fixed, see styles.css), so it
          // never moves while the page scrolls. Only its HEIGHT is measured here: from the
          // top of the screen down to the bottom of the showroom card, taken in document
          // coordinates so the result does not depend on the current scroll offset.
          const syncCoverGeometry = () => {
            if(!bannerEl.isConnected || !root.isConnected) return;
            // The cover lives inside #pageBlurWrap and scrolls with the page. It starts at the very top
            // of the screen (behind the header) and ends at the vertical middle of the avatar.
            // All numbers are differences of rects, so they do not depend on the scroll offset.
            const av=root.querySelector(".account-avatar-wrap") || root.querySelector('[data-slot="avatar"]') || profile;
            const ar=av.getBoundingClientRect();
            const wrapTop=blurWrap.getBoundingClientRect().top;
            const headerH=sticky.offsetHeight||0;
            const height=Math.max(120,Math.round(headerH + (ar.top - wrapTop) + ar.height/2));
            bannerEl.style.setProperty("top", `${-headerH}px`);
            bannerEl.style.setProperty("height", `${height}px`);
            bannerEl.style.setProperty("min-height", `${height}px`);
          };
          syncCoverGeometry();
          if(window.__carmaaAccountCoverRO){try{window.__carmaaAccountCoverRO.disconnect();}catch(_){}}
          if(typeof ResizeObserver==="function"){
            window.__carmaaAccountCoverRO=new ResizeObserver(()=>syncCoverGeometry());
            window.__carmaaAccountCoverRO.observe(profile);
          }
          window.__carmaaAccountCoverSync=syncCoverGeometry;
          if(!window.__carmaaAccountCoverResizeBound){
            window.addEventListener("resize",()=>{if(typeof window.__carmaaAccountCoverSync==="function") window.__carmaaAccountCoverSync();},{passive:true});
            window.__carmaaAccountCoverResizeBound=true;
          }
        });
      }
    });
  }

  function renderAccountEditScreen() {
    const savedBanner = !window.CARMA_API?.enabled && state.account ? mrGetAvatar("ab", sellerIdForPhone(state.account)) : "";
    const p={...(state.accountProfile||{}), banner:savedBanner || ((state.accountProfile||{}).banner || "")};
    return hydratePageShell("tpl-account-edit",(root)=>{
      mountBreadcrumbs(root,[{label:"جستجو",action:"goHome"},{label:"حساب من",action:"openAccount"},{label:"ویرایش اطلاعات"}]);
      const avatarPreview=root.querySelector('[data-slot="avatar-preview"]');
      if(p.avatar){avatarPreview.innerHTML=`<img src="${p.avatar}" alt="عکس پروفایل" class="w-full h-full object-cover"/>`;}
      else{const initials=((p.firstName||state.account||"G").trim()[0]||"G").toUpperCase();avatarPreview.textContent=initials;}
      const bannerPreview=root.querySelector('[data-slot="banner-preview"]');
      const bannerButton=root.querySelector('.account-edit-banner-button');
      if(bannerPreview){
        if(p.banner){bannerPreview.style.backgroundImage=`url("${p.banner}")`;bannerPreview.classList.add("has-banner");bannerPreview.innerHTML="";}
        else{bannerPreview.style.backgroundImage="none";bannerPreview.classList.remove("has-banner");bannerPreview.innerHTML="<span>پیش‌نمایش بنر حساب کاربری</span>";}
      }
      if(bannerButton) bannerButton.innerHTML = `<span aria-hidden="true">＋</span> ${p.banner ? "تغییر بنر" : "انتخاب بنر"}`;
      {
        const nk = root.querySelector('input[name="nickname"]');
        if (nk) {
          nk.value = p.nickname || "";
          nk.required = true;
          nk.minLength = 2;
          nk.setAttribute("aria-required", "true");
        }
      }

      const firstInput = root.querySelector('input[name="firstName"]');
      if (firstInput) {
        firstInput.value = p.firstName || "";
        firstInput.required = true;
        firstInput.minLength = 2;
      }

      const lastInput = root.querySelector('input[name="lastName"]');
      if (lastInput) {
        lastInput.value = p.lastName || "";
        lastInput.required = true;
        lastInput.minLength = 2;
      }

      root.querySelector('input[name="email"]').value = p.email || "";

      const unameInput = root.querySelector('input[name="username"]');
      if (unameInput) {
        if (window.MR_PROFILE) {
          window.MR_PROFILE.decorateField(unameInput, "user");
        }

        const authUser = window.CARMA_AUTH_USER || {};

        if (!unameInput.value) {
          unameInput.value = String(authUser.username || "").replace(/^@/, "");
        }

        if (/^@?user-\d+$/i.test(String(unameInput.value || ""))) { unameInput.value = ""; }
        if (!unameInput.value) unameInput.placeholder = "یک نام کاربری یکتا انتخاب کنید";
        unameInput.required = true;
        unameInput.minLength = 3;
        unameInput.maxLength = 20;
        unameInput.setAttribute("autocapitalize", "none"); // CARMAA-PROFILE-FIX2

        if (authUser.usernameAuto === true) {
          unameInput.readOnly = false;
          unameInput.placeholder = "یک نام کاربری یکتا انتخاب کنید";
        }
      }

      root.querySelector('input[name="phone"]').value = state.account || "";
      const errBox=root.querySelector('[data-slot="form-error"]');
      if(errBox){errBox.hidden=!state.accountEditError;if(state.accountEditError)errBox.textContent=state.accountEditError;}
      if(window.CARMA_PROFILE_SETUP) window.CARMA_PROFILE_SETUP.decorateEditPage(root); // PROFILE-SETUP
    });
  }

  function renderDealershipEditScreen() {
    const d = state.dealership;
    return hydratePageShell("tpl-dealership-edit",(root)=>{
      mountBreadcrumbs(root,[{label:"جستجو",action:"goHome"},{label:"حساب من",action:"openAccount"},{label:d?"ویرایش نمایشگاه":"ایجاد نمایشگاه"}]);
      root.querySelector('[data-slot="title"]').textContent = d ? "ویرایش نمایشگاه" : "ایجاد نمایشگاه";
      root.querySelector('[data-slot="submit"]').textContent = d ? "ذخیره تغییرات" : "ایجاد نمایشگاه";
      const dr = state.dealershipDraft;
      root.querySelector('input[name="dealerName"]').value = dr ? dr.name : (d ? d.name : "");
      const cityInput=root.querySelector('input[name="dealerCity"]'); if(cityInput) cityInput.value=dr ? (dr.city||"") : (d ? (d.city||"") : "");
      { const dUn=root.querySelector('input[name="dealerUsername"]'); if(window.MR_PROFILE){window.MR_PROFILE.decorateField(dUn,"dealer"); if(dr&&dr.username!=null&&!dUn.readOnly) dUn.value=dr.username;} else if(dr) dUn.value=dr.username||""; }
      root.querySelector('input[name="ownerName"]').value = dr ? dr.ownerName : (d ? (d.ownerName || "") : "");
      const tagsInput=root.querySelector('input[name="dealerTags"]');
      if(tagsInput){const tl=(dr&&dr.tags!=null)?window.MR_PROFILE.parseTags(dr.tags):((d&&d.id&&Array.isArray(d.tags))?d.tags:(d&&window.MR_PROFILE)?window.MR_PROFILE.dealerTags(sellerIdForPhone(state.account)):[]);tagsInput.value=tl.map((t)=>"#"+t).join(" ");}
      root.querySelector('textarea[name="dealerAddress"]').value = dr ? dr.address : (d ? (d.address || "") : "");
      root.querySelector('input[name="nationalId"]').value = dr ? dr.nid : "";
      if (d) {
        root.querySelector('input[name="nationalId"]').placeholder = "برای تغییر، کد ملی جدید را وارد کنید";
        root.querySelector('[data-slot="nid-hint"]').textContent = "کد ملی ثبت‌شده برای امنیت نمایش داده نمی‌شود. فقط اگر می‌خواهید تغییر دهید وارد کنید. تغییر نام، مالک، آدرس یا کد ملی دوباره به تأیید مدیریت نیاز دارد.";
      }
      const bannerSlot=root.querySelector('[data-slot="banner"]');
      if(bannerSlot){
        // SB-FIX: show only the real showroom banner (or the draft), never the auto-generated one.
        const bannerUrl=state.dealershipBannerDraft||(d&&d.banner)||(state.account&&typeof mrGetAvatar==="function"?mrGetAvatar("db",sellerIdForPhone(state.account)):"")||"";
        if(bannerUrl) bannerSlot.innerHTML=`<img src="${bannerUrl}" alt="" class="w-full h-full object-cover"/>`;
        else bannerSlot.innerHTML='<span style="color:#8b8f94;font-size:13px;font-weight:600">افزودن عکس بنر</span>';
      }
      const logoSlot=root.querySelector('[data-slot="logo"]');
      if(logoSlot){
        const logoUrl=state.dealershipLogoDraft||(d&&d.logo)||"";
        if(logoUrl) logoSlot.innerHTML=`<img src="${logoUrl}" alt="عکس پروفایل نمایشگاه" class="w-full h-full object-cover"/>`;
        else logoSlot.textContent=((dr?dr.name:(d?d.name:""))||"ن").trim().charAt(0).toUpperCase()||"ن";
      }
      const nidInput=root.querySelector('input[name="nationalId"]'); if(window.CARMA_API?.enabled && nidInput){const nidField=nidInput.parentElement;if(nidField)nidField.hidden=true;}
      const errBox=root.querySelector('[data-slot="form-error"]');
      if(errBox){errBox.hidden=!state.dealershipError;if(state.dealershipError)errBox.textContent=state.dealershipError;}
    });
  }
