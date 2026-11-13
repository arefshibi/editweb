"use strict";

/* ---------------------------------------------------------------
   MODAL / TOAST / LOGIN-SIGNUP FLOW — phone/country selection, OTP keypad, resend cooldown, the whole sign-in modal state machine, and the toast/bottom-dock UI updaters.
// Edit the login/OTP modal or the account-menu modal here.
--------------------------------------------------------------- */

  /* ---------------------------------------------------------------
     MODAL / TOAST
  --------------------------------------------------------------- */


  const AUTH_COUNTRIES = {
    US: { flag: "🇺🇸", code: "+1", min: 10, max: 10 },
    DE: { flag: "🇩🇪", code: "+49", min: 7, max: 12 },
    IR: { flag: "🇮🇷", code: "+98", min: 10, max: 11 },
    GB: { flag: "🇬🇧", code: "+44", min: 9, max: 10 },
  };
  let authCountry = "IR";
  let authFocusTimer = null;
  let authDoneTimer = null;

  // Resend-code cooldown: 90 seconds between OTP sends.
  const RESEND_COOLDOWN_MS = 90 * 1000;
  let resendCooldownUntil = 0;
  let resendCooldownTimer = null;
  function resendButtonLabel(remaining) {
    if (remaining <= 0) return "دریافت کد از طریق پیامک";
    const m = Math.floor(remaining / 60);
    const s = String(remaining % 60).padStart(2, "0");
    return `ارسال مجدد کد تا ${m}:${s} دیگر`;
  }
  function updateResendCooldownUI() {
    const btn = document.querySelector('.auth-resend-button[data-action="resendOtp"]');
    const remaining = Math.max(0, Math.ceil((resendCooldownUntil - Date.now()) / 1000));
    if (btn) {
      btn.disabled = remaining > 0;
      btn.classList.toggle("is-disabled", remaining > 0);
      btn.textContent = resendButtonLabel(remaining);
    }
    if (remaining <= 0 && resendCooldownTimer) {
      clearInterval(resendCooldownTimer);
      resendCooldownTimer = null;
    }
  }
  function startResendCooldown() {
    resendCooldownUntil = Date.now() + RESEND_COOLDOWN_MS;
    updateResendCooldownUI();
    if (resendCooldownTimer) clearInterval(resendCooldownTimer);
    resendCooldownTimer = setInterval(updateResendCooldownUI, 1000);
  }
  function resetResendCooldown() {
    resendCooldownUntil = 0;
    if (resendCooldownTimer) { clearInterval(resendCooldownTimer); resendCooldownTimer = null; }
    updateResendCooldownUI();
  }

  function authDigits(value) { return String(value || "").replace(/\D/g, ""); }
  function authFormatPhone(value) {
    const d = authDigits(value).slice(0, (AUTH_COUNTRIES[authCountry] || AUTH_COUNTRIES.US).max);
    if (!d) return "";
    if (authCountry === "IR" && d.startsWith("0") && d.length > 3) {
      if (d.length <= 4) return d;
      if (d.length <= 7) return `${d.slice(0,4)} ${d.slice(4)}`;
      return `${d.slice(0,4)} ${d.slice(4,7)} ${d.slice(7,11)}`;
    }
    if (authCountry === "US") {
      if (d.length <= 3) return d;
      if (d.length <= 6) return `${d.slice(0,3)} ${d.slice(3)}`;
      return `${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6,10)}`;
    }
    if (authCountry === "IR") {
      if (d.length <= 3) return d;
      if (d.length <= 6) return `${d.slice(0,3)} ${d.slice(3)}`;
      return `${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6,10)}`;
    }
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0,3)} ${d.slice(3)}`;
    return `${d.slice(0,3)} ${d.slice(3,7)} ${d.slice(7)}`;
  }
  function authPhoneIsValid(value) {
    const c = AUTH_COUNTRIES[authCountry] || AUTH_COUNTRIES.US;
    const d = authDigits(value);
    if (authCountry === "IR") return (d.length === 10 && d.startsWith("9")) || (d.length === 11 && d.startsWith("09"));
    return d.length >= c.min && d.length <= c.max;
  }
  function authPhoneForApi(value) {
    const c = AUTH_COUNTRIES[authCountry] || AUTH_COUNTRIES.US;
    let digits = authDigits(value);
    if (authCountry === "IR" && digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    return `${c.code}${digits}`;
  }
  function updateAuthPhoneControls() {
    const input = document.getElementById("authPhoneInput");
    const btn = document.getElementById("authPhoneContinue");
    if (!input || !btn) return;
    const formatted = authFormatPhone(input.value);
    if (input.value !== formatted) input.value = formatted;
    btn.disabled = !authPhoneIsValid(input.value);
  }
  function setAuthCountry(key) {
    if (!AUTH_COUNTRIES[key]) return;
    authCountry = key;
    const c = AUTH_COUNTRIES[key];
    document.getElementById("authCountryFlag")?.replaceChildren(document.createTextNode(c.flag));
    document.getElementById("authCountryCode")?.replaceChildren(document.createTextNode(c.code));
    const picker = document.getElementById("authCountryPicker");
    const toggle = document.getElementById("authCountryButton");
    const input = document.getElementById("authPhoneInput");
    if (picker) picker.hidden = true;
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (input) { input.value = ""; input.focus({ preventScroll: true }); }
    updateAuthPhoneControls();
  }
  function authDisplayPhone(value) {
    const c = AUTH_COUNTRIES[authCountry] || AUTH_COUNTRIES.US;
    return `${c.code} ${authFormatPhone(value)}`.trim();
  }
  function getOtpValue() {
    return Array.from(document.querySelectorAll("#authOtpInputs [data-otp-index]"), el => authDigits(el.value).slice(0,1)).join("");
  }
  function updateOtpContinue() {
    const btn = document.getElementById("authOtpContinue");
    if (btn) btn.disabled = getOtpValue().length !== 6;
  }

  // ---------------------------------------------------------------
  // VIRTUAL NUMERIC KEYPAD — both #authPhoneInput and the OTP boxes are
  // readonly/inputmode="none" so the device's own keyboard never opens;
  // these are the only way digits get typed. We reuse the exact same
  // "input" event the fields already listen for (see the delegated
  // "input"/"keydown" handlers below) so formatting, auto-advance and
  // validation all stay in one place.
  function activeAuthOtpBox() {
    const active = document.activeElement;
    if (active && active.matches && active.matches("#authOtpInputs [data-otp-index]")) return active;
    const boxes = Array.from(document.querySelectorAll("#authOtpInputs [data-otp-index]"));
    return boxes.find(b => !b.value) || boxes[boxes.length - 1] || null;
  }
  function pressAuthKeypadDigit(key) {
    if (!/^[0-9]$/.test(key)) return;
    if (state.loginStep === "code") {
      const box = activeAuthOtpBox();
      if (!box) return;
      box.value = key;
      box.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      const input = document.getElementById("authPhoneInput");
      if (!input) return;
      const max = (AUTH_COUNTRIES[authCountry] || AUTH_COUNTRIES.US).max;
      input.value = (authDigits(input.value) + key).slice(0, max);
      input.focus({ preventScroll: true });
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  function pressAuthKeypadBackspace() {
    if (state.loginStep === "code") {
      const box = activeAuthOtpBox();
      if (!box) return;
      if (box.value) {
        box.value = "";
        box.classList.remove("has-value");
        box.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        const idx = Number(box.dataset.otpIndex || 0);
        if (idx > 0) {
          const prev = document.querySelector(`#authOtpInputs [data-otp-index="${idx - 1}"]`);
          if (prev) { prev.value = ""; prev.classList.remove("has-value"); prev.focus({ preventScroll: true }); }
        }
      }
      updateOtpContinue();
    } else {
      const input = document.getElementById("authPhoneInput");
      if (!input) return;
      input.value = authDigits(input.value).slice(0, -1);
      input.focus({ preventScroll: true });
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  function focusAuthField(selector, delay=90) {
    if (authFocusTimer) clearTimeout(authFocusTimer);
    authFocusTimer = setTimeout(() => document.querySelector(selector)?.focus({ preventScroll: true }), delay);
  }
  // FIX: دکمه‌های Continue/Submit در .auth-bottom-bar باید همیشه بالای
  // کیبورد موبایل بمانند و روی اینپوت‌های دیگر نیفتند. رفتار پیش‌فرض اکثر
  // مرورگرهای موبایل «resizes-visual» است — یعنی با باز شدن کیبورد،
  // 100dvh/100vh کوچک نمی‌شود، فقط window.visualViewport کوچک می‌شود؛ پس
  // با CSS تنها (دیناه) نمی‌شود این را حل کرد. اینجا ارتفاع کیبورد را از
  // روی اختلاف innerHeight و visualViewport اندازه می‌گیریم و آن را
  // به‌صورت padding-bottom روی #authFlow اعمال می‌کنیم. چون .auth-app-shell
  // و .auth-screen-* هر دو height:100% هستند، این padding از پایین کل
  // چینش را جمع می‌کند؛ در نتیجه ناحیه‌ی محتوا (.auth-scroll-area با
  // flex:1) کوچک و قابل‌اسکرول می‌شود و .auth-bottom-bar (که بعد از آن در
  // همان ستون flex می‌نشیند) خودش را دقیقاً بالای کیبورد نگه می‌دارد —
  // بدون overlap با فیلدها یا دکمه‌ی Back.
  function updateAuthKeyboardOffset() {
    const flow = document.getElementById("authFlow");
    if (!flow) return;
    if (flow.hidden || !window.visualViewport) { flow.style.paddingBottom = ""; return; }
    const vv = window.visualViewport;
    const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    flow.style.paddingBottom = offset > 40 ? `${offset}px` : "";
  }
  if (typeof window !== "undefined" && window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateAuthKeyboardOffset);
    window.visualViewport.addEventListener("scroll", updateAuthKeyboardOffset);
  }
  let authSheetCloseTimer = null;
  function updateAuthFlowUI() {
    const flow = document.getElementById("authFlow");
    const success = document.getElementById("authSuccessBackdrop");
    if (!flow) return;
    const open = (!!state.modal && state.modal.type === "login" && !state.account) || !!state.authSuccess;
    if (!open) {
      if (authSheetCloseTimer) { clearTimeout(authSheetCloseTimer); authSheetCloseTimer = null; }
      if (!flow.hidden) {
        // Slide the sheet back down before actually hiding it, instead of
        // just vanishing — same bottom-sheet feel as opening.
        flow.classList.remove("is-open");
        flow.classList.add("is-closing");
        authSheetCloseTimer = setTimeout(() => {
          flow.hidden = true;
          flow.classList.remove("is-closing");
          authSheetCloseTimer = null;
        }, 320);
      }
      document.documentElement.classList.remove("auth-active");
      if (success) success.hidden = true;
      updateAuthKeyboardOffset();
      if (resendCooldownTimer) { clearInterval(resendCooldownTimer); resendCooldownTimer = null; }
      return;
    }
    if (authSheetCloseTimer) { clearTimeout(authSheetCloseTimer); authSheetCloseTimer = null; }
    document.documentElement.classList.add("auth-active");
    flow.hidden = false;
    flow.classList.remove("is-closing");
    requestAnimationFrame(() => requestAnimationFrame(() => flow.classList.add("is-open")));
    updateAuthKeyboardOffset();
    if (state.authSuccess) {
      const success = document.getElementById("authSuccessBackdrop");
      if (success) {
        success.hidden = false;
        success.classList.add("is-visible");
        success.classList.remove("is-hiding");
      }
      return;
    }
    const phone = document.getElementById("authScreenPhone");
    const otp = document.getElementById("authScreenOtp");
    const step = state.loginStep === "code" ? "code" : "phone";
    if (phone) phone.hidden = step === "code";
    if (otp) otp.hidden = step !== "code";
    if (step === "phone") {
      const input = document.getElementById("authPhoneInput");
      if (input) input.value = authFormatPhone(state.loginPhone || "");
      const country = AUTH_COUNTRIES[authCountry] || AUTH_COUNTRIES.US;
      const flag = document.getElementById("authCountryFlag"); const code = document.getElementById("authCountryCode");
      if (flag) flag.textContent = country.flag;
      if (code) code.textContent = country.code;
      updateAuthPhoneControls();
      focusAuthField("#authPhoneInput", 100);
      resetResendCooldown();
    } else {
      const phoneLabel = document.getElementById("authOtpPhone");
      if (phoneLabel) phoneLabel.textContent = authDisplayPhone(state.loginPhone);
      updateOtpContinue();
      updateResendCooldownUI();
      if (!document.activeElement?.matches("#authOtpInputs [data-otp-index]")) focusAuthField('#authOtpInputs [data-otp-index="0"]', 110);
    }
  }

  // ---------------------------------------------------------------
  // OTP VERIFIED ANIMATION — replays the reference clip in place, inside
  // the same code-entry sheet (no second sheet slides in over it):
  //   1) every cell's border ignites simultaneously, drawn on with an
  //      SVG stroke (pathLength trick keeps the math simple at any size)
  //   2) the title crossfades to "verified", the subtitle fades away
  //   3) the cells converge on the sheet's centre (measured live via
  //      getBoundingClientRect, so it holds up at any width) and fade out
  //   4) a single glowing checkmark pops in and draws itself
  //   5) after a short hold, the sheet closes and the account opens
  function resetOtpVerifiedAnimation() {
    const inputsWrap = document.getElementById("authOtpInputs");
    const icon = document.getElementById("authOtpSuccessIcon");
    const title = document.getElementById("authOtpTitle");
    const subtitle = document.getElementById("authOtpSubtitle");
    const continueBtn = document.getElementById("authOtpContinue");
    const resend = document.querySelector('.auth-screen-otp [data-action="resendOtp"]');
    if (inputsWrap) {
      inputsWrap.classList.remove("is-igniting", "is-verified", "is-merging", "is-merged");
      inputsWrap.style.visibility = "";
      inputsWrap.querySelectorAll(".otp-cell").forEach(c => {
        c.style.transform = ""; c.style.opacity = ""; c.style.transition = "";
      });
    }
    if (icon) icon.classList.remove("is-visible");
    if (title) { title.textContent = "کد تایید را وارد کنید"; title.style.opacity = ""; }
    if (subtitle) subtitle.style.opacity = "";
    if (continueBtn) continueBtn.disabled = false;
    if (resend) resend.style.visibility = "";
  }
  // Build the editable account profile from the canonical server user on OTP login.
  // Previously the login handoff restored only the avatar, so fields cleared on logout
  // (first/last name, nickname, email and banner) stayed blank until a full page refresh.
  function accountProfileFromAuthUser(user, previous = {}) {
    if (!user || !user.phone) return { ...previous };
    const displayName = String(user.displayName || "").trim().replace(/\s+/g, " ");
    const parts = displayName ? displayName.split(" ") : [];
    return {
      ...previous,
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
      nickname: String(user.nickname || ""),
      email: String(user.email || ""),
      avatar: user.avatarUrl || null,
      banner: user.bannerUrl || null,
    };
  }

  // CARMAA-PROFILE-FIX2: is the logged-in user's profile incomplete?
  function carmaProfileIncomplete(user) {
    if (!user || !user.phone || !window.CARMA_API?.enabled) return false;
    const parts = String(user.displayName || "").trim().split(/\s+/).filter(Boolean);
    const uname = String(user.username || "").trim().replace(/^@/, "");
    return parts.length < 2 || parts[0].length < 2 ||
      String(user.nickname || "").trim().length < 2 ||
      !uname || user.usernameAuto === true || /^user-\d+$/i.test(uname);
  }

  function profileAtLoginHandoff(user, previous = {}) {
    if (window.CARMA_API?.enabled && user?.phone) return accountProfileFromAuthUser(user, previous);
    return { ...previous, avatar: user?.phone ? (user.avatarUrl || mrGetAvatar("p", sellerIdForPhone(user.phone)) || null) : null };
  }

  function finalizeOtpLogin() { completeOtpLogin(); }
  function completeOtpLogin() {
    const flow = document.getElementById("authFlow");
    if (!flow) return;
    flow.classList.remove("is-open");
    flow.classList.add("is-closing");
    if (authDoneTimer) clearTimeout(authDoneTimer);
    authDoneTimer = setTimeout(() => {
      flow.hidden = true;
      flow.classList.remove("is-closing");
      document.documentElement.classList.remove("auth-active");
      const verifiedPhone = window.CARMA_AUTH_USER?.phone || null;
      const authUser = window.CARMA_AUTH_USER || {};
      const fullName = String(authUser.displayName || "").trim();

      const profileIncomplete = !!verifiedPhone &&
        !!window.CARMA_API?.enabled && (
          fullName.split(/\s+/).filter(Boolean).length < 2 || fullName.split(/\s+/)[0].length < 2 ||
          String(authUser.nickname || "").trim().length < 2 ||
          !String(authUser.username || "").trim() ||
          authUser.usernameAuto === true ||
        /^user-\d+$/i.test(String(authUser.username || "").trim().replace(/^@/, ""))
        );

      const returnRoute1 = profileIncomplete
        ? { page: "accountEdit" }
        : (state.loginReturnTo || { page: "account" });
      state = { ...state, modal: null, modalClosing: false, account: verifiedPhone, dealership: verifiedPhone ? loadDealership(verifiedPhone) : null, accountProfile: profileAtLoginHandoff(window.CARMA_AUTH_USER, state.accountProfile), authSuccess: false, loginStep: "phone" };
      // Native-style handoff: bypass the site's long 2s/4s page loader for auth completion.
      state = { ...state, route: returnRoute1, loading: false, loadingStage: null, pendingRoute: null, loginReturnTo: null };
      navigationLock = false;
      try { mrApplyStore(); } catch (_) {}
      render();
      resetOtpVerifiedAnimation();
      if (verifiedPhone && window.CARMA_API?.enabled) {
        Promise.resolve().then(async () => {
          await window.CARMA_MARKETPLACE?.syncPublicListings?.(); // ads approved since page start become visible after login
          await window.CARMA_MARKETPLACE?.syncMyListings?.();
          await window.CARMA_MARKETPLACE?.syncFavorites?.();
          await window.CARMA_SESSION?.refreshShowrooms?.();
          await window.CARMA_SESSION?.syncMyShowroom?.();
          if (typeof render === "function") render();
        }).catch(() => { /* Session remains valid; the next page refresh retries hydration. */ });
      }
    }, 320);
  }
  function playOtpVerifiedAnimation() {
    const inputsWrap = document.getElementById("authOtpInputs");
    const stage = document.querySelector(".auth-otp-stage");
    const title = document.getElementById("authOtpTitle");
    const subtitle = document.getElementById("authOtpSubtitle");
    const icon = document.getElementById("authOtpSuccessIcon");
    const continueBtn = document.getElementById("authOtpContinue");
    const resend = document.querySelector('.auth-screen-otp [data-action="resendOtp"]');
    if (!inputsWrap || !stage || !title || !icon) { finalizeOtpLogin(); return; }

    if (continueBtn) continueBtn.disabled = true;
    if (resend) resend.style.visibility = "hidden";
    document.querySelectorAll("#authOtpInputs [data-otp-index]").forEach(i => i.blur());

    // 1) ignite — every cell's border draws itself on at once
    inputsWrap.classList.add("is-igniting");

    setTimeout(() => {
      // 2) swap the copy: subtitle fades out, title crossfades to "verified"
      if (subtitle) subtitle.style.opacity = "0";
      title.style.opacity = "0";
      setTimeout(() => {
        title.textContent = "با موفقیت تایید شد";
        title.style.opacity = "1";
      }, 180);

      // 3) swap the ignite halo from orange to green and hold for a beat
      // — this has to run to completion and stay visible for a moment
      // BEFORE the cells start shrinking/fading, otherwise the color
      // finishes turning green at almost the same instant the cells hit
      // opacity 0 and nobody actually sees the green.
      inputsWrap.classList.add("is-verified");

      setTimeout(() => {
        // 4) now converge every cell on the stage's centre and fade them out
        inputsWrap.classList.add("is-merging");
        const cells = Array.from(inputsWrap.querySelectorAll(".otp-cell"));
        const stageRect = stage.getBoundingClientRect();
        const centerX = stageRect.left + stageRect.width / 2;
        const centerY = stageRect.top + stageRect.height / 2;
        cells.forEach(cell => {
          const r = cell.getBoundingClientRect();
          const dx = centerX - (r.left + r.width / 2);
          const dy = centerY - (r.top + r.height / 2);
          cell.style.transition = "transform .32s cubic-bezier(.3,.7,.35,1), opacity .32s ease";
          requestAnimationFrame(() => {
            cell.style.transform = `translate(${dx}px, ${dy}px) scale(.16)`;
            cell.style.opacity = "0";
          });
        });

        setTimeout(() => {
          // 5) hide the cells, pop the single glowing checkmark in their place
          inputsWrap.classList.add("is-merged");
          icon.classList.add("is-visible");

          // 6) hold on the result, then close the sheet and land on the account
          setTimeout(() => finalizeOtpLogin(), 1100);
        }, 340);
      }, 380);
    }, 560);
  }

  function showAuthSuccess() {
    const success = document.getElementById("authSuccessBackdrop");
    const sheet = document.getElementById("authSuccessSheet");
    if (!success || !sheet) return;
    success.hidden = false;
    document.documentElement.classList.add("auth-active");
    success.classList.remove("is-hiding");
    requestAnimationFrame(() => success.classList.add("is-visible"));
  }
  function hideAuthSuccessThenEnterAccount() {
    const flow = document.getElementById("authFlow");
    const success = document.getElementById("authSuccessBackdrop");
    if (!flow || !success) return;
    success.classList.remove("is-visible");
    success.classList.add("is-hiding");
    flow.classList.add("is-closing");
    if (authDoneTimer) clearTimeout(authDoneTimer);
    authDoneTimer = setTimeout(() => {
      success.hidden = true;
      flow.hidden = true;
      document.documentElement.classList.remove("auth-active");
      const verifiedPhone = window.CARMA_AUTH_USER?.phone || null;
      const returnRoute2 = carmaProfileIncomplete(window.CARMA_AUTH_USER) ? { page: "accountEdit" } : (state.loginReturnTo || { page: "account" });
      state = { ...state, modal: null, modalClosing: false, account: verifiedPhone, dealership: verifiedPhone ? loadDealership(verifiedPhone) : null, accountProfile: profileAtLoginHandoff(window.CARMA_AUTH_USER, state.accountProfile), authSuccess: false, loginStep: "phone" };
      // Native-style handoff: bypass the site's long 2s/4s page loader for auth completion.
      state = { ...state, route: returnRoute2, loading: false, loadingStage: null, pendingRoute: null, loginReturnTo: null };
      navigationLock = false;
      try { mrApplyStore(); } catch (_) {}
      render();
      if (verifiedPhone && window.CARMA_API?.enabled) {
        Promise.resolve().then(async () => {
          await window.CARMA_MARKETPLACE?.syncPublicListings?.(); // ads approved since page start become visible after login
          await window.CARMA_MARKETPLACE?.syncMyListings?.();
          await window.CARMA_MARKETPLACE?.syncFavorites?.();
          await window.CARMA_SESSION?.refreshShowrooms?.();
          await window.CARMA_SESSION?.syncMyShowroom?.();
          if (typeof render === "function") render();
        }).catch(() => {});
      }
    }, 430);
  }
  function updateModalUI() {
    const generic=document.getElementById("genericModal"), login=document.getElementById("loginModal");
    const modalTitle=document.getElementById("modalTitle"), modalBody=document.getElementById("modalBody");
    if(!generic||!login)return;
    const m=state.modal, isLogin=!!m&&m.type==="login";
    // FIX: #loginModal is a legacy empty shell — its body (#loginModalBody)
    // is never populated by any code, so it has no phone/OTP form inside,
    // just a header icon/title. It used to be unhidden any time isLogin was
    // true (`login.hidden = !isLogin`), sitting at z-index:80 directly
    // underneath #authFlow (z-index:200), the actual login UI. While
    // #authFlow was fully opaque this stray empty card was invisible, but
    // the instant #authFlow starts its .42s fade-out (Back button, or the
    // post-login success hand-off), it becomes visible through the
    // dissolving overlay as a blank "ورود به حساب" card with no content —
    // then disappears the moment the fade finishes and state.modal clears.
    // That's the "buggy profile page that suddenly appears and vanishes"
    // after logging in. #authFlow is the real, fully-implemented login UI,
    // so this dead placeholder should just never be shown.
    login.hidden = true;
    // FIX: updateAuthFlowUI() must run every time this function runs, not
    // only while isLogin is true. It used to be called only inside the
    // isLogin branch, so it ran when the login flow OPENED but never again
    // when it CLOSED (e.g. tapping the auth-flow's own Back button, which
    // just sets state.modal = null and re-renders) — #authFlow stayed
    // hidden=false forever after that, trapping the user behind the
    // full-screen overlay with no way back to the home page.
    updateAuthFlowUI();
    if(isLogin){
      generic.hidden=true;
      return;
    }
    const hasGeneric=!!m;
    generic.hidden=!hasGeneric;
    if(!m)return;
    generic.classList.toggle("is-closing",!!state.modalClosing);
    modalBody.replaceChildren();
    if(m.type==="getstarted"){
      modalTitle.textContent=m.title||"شروع کنید";
      modalBody.appendChild(mountTemplate("tpl-modal-getstarted"));
      return;
    }
    if(m.type==="pricing"){
      modalTitle.textContent="جزئیات قیمت";
      const body=mountTemplate("tpl-modal-pricing");
      const price=parseInt(m.listing.price.replace(/[^0-9]/g,""),10)||0;
      const tax=Math.round(price*0.0725);
      body.querySelector('[data-slot="price"]').textContent=price?"$"+price.toLocaleString():m.listing.price;
      body.querySelector('[data-slot="tax"]').textContent=price?"$"+tax.toLocaleString():"—";
      body.querySelector('[data-slot="total"]').textContent=price?"$"+(price+tax+599).toLocaleString():m.listing.price;
      const est=body.querySelector('[data-slot="estimate"]');
      est.hidden=!m.listing.est;
      if(m.listing.est)est.textContent=`تأمین مالی تخمینی: ${m.listing.est} — منوط به تأیید اعتباری`;
      modalBody.appendChild(body);
      return;
    }
    if(m.type==="sharePoster"){
      modalTitle.textContent=(m.listing&&m.listing.kind==="showroom")?"بنر اشتراک‌گذاری نمایشگاه":"پوستر استوری";
      modalBody.appendChild(buildSharePosterBody(m));
      return;
    }
    if(m.type==="supportTicket"){
      modalTitle.textContent="تماس با پشتیبانی";
      const form=document.createElement("form"); form.dataset.supportTicket="1"; form.className="space-y-3";
      const subjectLabel=document.createElement("label"); subjectLabel.className="block text-sm"; subjectLabel.textContent="موضوع درخواست";
      const subject=document.createElement("input"); subject.name="subject"; subject.required=true; subject.minLength=4; subject.maxLength=120; subject.placeholder="خلاصه مشکل شما"; subject.className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 p-3"; subjectLabel.appendChild(subject);
      const categoryLabel=document.createElement("label"); categoryLabel.className="block text-sm"; categoryLabel.textContent="دسته‌بندی";
      const category=document.createElement("select"); category.name="category"; category.className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 p-3";
      [["general","عمومی"],["account","حساب کاربری"],["listing","آگهی"],["payment","پرداخت"],["security","امنیت"],["other","سایر"]].forEach(([v,label])=>{const o=document.createElement("option");o.value=v;o.textContent=label;category.appendChild(o);}); categoryLabel.appendChild(category);
      const bodyLabel=document.createElement("label"); bodyLabel.className="block text-sm"; bodyLabel.textContent="شرح درخواست";
      const body=document.createElement("textarea"); body.name="body"; body.required=true; body.minLength=10; body.maxLength=4000; body.rows=5; body.placeholder="مشکل یا درخواست خود را با جزئیات بنویسید…"; body.className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 p-3"; bodyLabel.appendChild(body);
      const submit=document.createElement("button"); submit.type="button"; submit.dataset.action="submitSupportTicket"; submit.className="w-full rounded-xl bg-blue-600 p-3 font-semibold text-white"; submit.textContent="ارسال درخواست";
      const note=document.createElement("p"); note.className="text-xs opacity-70"; note.textContent="درخواست در حساب شما ثبت می‌شود و برای تیم پشتیبانی اعلان می‌فرستد.";
      form.append(subjectLabel,categoryLabel,bodyLabel,note,submit); modalBody.appendChild(form); return;
    }
    if(m.type==="adStats"){
      modalTitle.textContent="آمار آگهی";
      modalBody.appendChild(mrBuildAdStatsBody(m));
      return;
    }
    if(m.type==="adService"){
      const s=PAID_SERVICES[m.service];
      modalTitle.textContent=s.title;
      const body=document.createElement("div");body.className="adService";
      const desc=document.createElement("p");desc.className="adService-desc";desc.textContent=s.desc;
      const box=document.createElement("div");box.className="adService-price-box";
      const l1=document.createElement("span");l1.textContent="هزینه";
      const l2=document.createElement("strong");l2.textContent=mrFormatToman(s.price);
      box.append(l1,l2);
      const acts=document.createElement("div");acts.className="adService-actions";
      const back=document.createElement("button");back.type="button";back.className="manageAd-reject-btn";back.dataset.action="adServiceBack";back.dataset.id=m.id;back.textContent="بازگشت";back.disabled=!!m.paying;
      const pay=document.createElement("button");pay.type="button";pay.className="manageAd-reject-btn is-primary";pay.dataset.action="payService";pay.dataset.id=m.id;pay.dataset.service=m.service;pay.disabled=!!m.paying;
      pay.textContent=m.paying?"در حال اتصال به درگاه…":"پرداخت و فعال‌سازی";
      acts.append(back,pay);
      const hero=document.createElement("div");hero.className="adService-hero";hero.dataset.svc=m.service;
      const hic=document.createElement("span");hic.className="adService-hero-ic";setDynamicHTML(hic,icon(s.icon,{width:"26",height:"26",strokeWidth:"2"}));
      const hname=document.createElement("strong");hname.textContent=s.title;
      const hshort=document.createElement("span");hshort.textContent=s.short;
      hero.append(hic,hname,hshort);
      body.append(hero,desc,box,acts);
      modalBody.appendChild(body);
      return;
    }
    if(m.type==="manageAd"&&m.step==="delete"){
      modalTitle.textContent="حذف آگهی";
      const body=mountTemplate("tpl-modal-manage-ad-delete");
      const reasonsWrap=body.querySelector('[data-slot="reasons"]');
      MANAGE_AD_DELETE_REASONS.forEach((reasonText)=>{
        const row=document.createElement("button");
        row.type="button";
        row.dataset.action="selectDeleteReason";
        row.dataset.reason=reasonText;
        row.className="manageAd-reason-row"+(m.reason===reasonText?" is-selected":"");
        const label=document.createElement("span");label.textContent=reasonText;
        const dot=document.createElement("span");dot.className="manageAd-reason-dot";
        row.append(label,dot);
        reasonsWrap.appendChild(row);
      });
      const confirmBtn=body.querySelector('[data-slot="confirmBtn"]');
      confirmBtn.classList.toggle("is-enabled",!!m.reason);
      confirmBtn.dataset.id=m.id;
      modalBody.appendChild(body);
      return;
    }
    if(m.type==="manageAd"){
      modalTitle.textContent="مدیریت آگهی";
      const body=mountTemplate("tpl-modal-manage-ad");
      const entry=state.myListings.find((x)=>x.id===m.id);
      const pending=!entry||entry.status==="pending";
      const removed=!!entry&&entry.status==="removed";
      const rejected=!!entry&&(entry.status==="rejected"||removed);
      const statusEl=body.querySelector('[data-slot="status"]');
      statusEl.classList.toggle("is-listed",!pending&&!rejected);
      statusEl.classList.toggle("is-rejected",rejected);
      // Ad summary (thumbnail, title, price) so the sheet says which ad it manages.
      const lst=entry&&entry.listing?entry.listing:null;
      if(lst){
        body.querySelector('[data-slot="adTitle"]').textContent=listingDisplayTitle(lst)||"";
        body.querySelector('[data-slot="adPrice"]').textContent=lst.price||"";
        const ph=(Array.isArray(lst.photos)?lst.photos.filter(Boolean)[0]:lst.photo)||"";
        const th=body.querySelector('[data-slot="thumb"]');
        if(ph){const im=document.createElement("img");im.src=ph;im.alt="";th.appendChild(im);}
        else setDynamicHTML(th,icon("camera",{width:"20",height:"20",strokeWidth:"1.8"}));
      }
      body.querySelector('[data-slot="statusTitle"]').textContent=pending?"در صف بررسی":removed?"حذف‌شده توسط مدیریت":rejected?"رد شده":"منتشر شده";
      body.querySelector('[data-slot="statusDesc"]').textContent=pending
        ?(MR_STORE.settings().manual?"آگهی شما ثبت شده و منتظر تایید مدیریت است.":"آگهی شما ثبت شده و تا چند ثانیه دیگر منتشر می‌شود.")
        :removed?"این آگهی توسط مدیریت از سایت حذف شد و دیگر نمایش داده نمی‌شود. می‌توانید آن را اصلاح کنید یا دوباره برای بررسی ثبت کنید.":rejected?"آگهی شما توسط مدیریت تأیید نشد. می‌توانید آن را اصلاح کنید یا بدون تغییر دوباره ثبت کنید.":"این آگهی هم‌اکنون در نتایج جستجو نمایش داده می‌شود.";
      if(rejected){
        const box=document.createElement("div");box.className="manageAd-reject-box";
        const lab=document.createElement("div");lab.className="manageAd-reject-label";lab.textContent=removed?"دلیل حذف آگهی":"دلیل رد آگهی";
        const txt=document.createElement("div");txt.className="manageAd-reject-text";txt.textContent=entry.why||"دلیلی ثبت نشده است.";
        box.append(lab,txt);
        const acts=document.createElement("div");acts.className="manageAd-reject-actions";
        const bEdit=document.createElement("button");bEdit.type="button";bEdit.dataset.action="manageAdEdit";bEdit.dataset.id=m.id;bEdit.className="manageAd-reject-btn";bEdit.textContent="اصلاح آگهی";
        const bRe=document.createElement("button");bRe.type="button";bRe.dataset.action="resubmitListing";bRe.dataset.id=m.id;bRe.className="manageAd-reject-btn is-primary";bRe.textContent="ثبت دوباره";
        acts.append(bEdit,bRe);
        statusEl.after(box,acts);
      }
      const mainGroup=body.querySelector('[data-slot="mainGroup"]');
      if(!pending&&!rejected&&entry){
        const expired=entry.status==="expired";
        // Paid services: three compact tiles instead of three tall rows.
        const head=document.createElement("div");head.className="ma-label";head.textContent="ارتقای آگهی";
        const tiles=document.createElement("div");tiles.className="ma-tiles";
        ["ladder","urgent","renew"].forEach((key)=>{
          const s=PAID_SERVICES[key];
          const tile=document.createElement("button");tile.type="button";tile.className="ma-tile";tile.dataset.svc=key;
          const locked=(key==="renew"&&!expired)||(key!=="renew"&&expired);
          const hint=(key==="renew"&&!expired)?"پس از منقضی شدن آگهی فعال می‌شود":(key!=="renew"&&expired)?"برای آگهی منقضی‌شده در دسترس نیست":mrServiceHint(key,entry.listing);
          tile.title=hint;tile.setAttribute("aria-label",s.title+" — "+hint);
          if(locked){tile.disabled=true;tile.classList.add("is-locked");}else{tile.dataset.action="openAdService";tile.dataset.id=m.id;tile.dataset.service=key;}
          const ic=document.createElement("span");ic.className="ma-tile-ic";setDynamicHTML(ic,icon(s.icon,{width:"19",height:"19",strokeWidth:"2"}));
          const nm=document.createElement("span");nm.className="ma-tile-name";nm.textContent=s.title.replace(/ آگهی$/,"");
          const pr=document.createElement("span");pr.className="ma-tile-price";pr.textContent=mrFormatToman(s.price);
          tile.append(ic,nm,pr);tiles.appendChild(tile);
        });
        mainGroup.before(head,tiles);
        const sb=document.createElement("button");sb.type="button";sb.className="ma-row";sb.dataset.action="openAdStats";sb.dataset.id=m.id;
        const si=document.createElement("span");si.className="ma-row-ic";si.dataset.c="blue";setDynamicHTML(si,icon("bar-chart",{width:"17",height:"17",strokeWidth:"2"}));
        const sl=document.createElement("span");sl.className="ma-row-label";sl.textContent="آمار آگهی";
        const sc=document.createElement("span");sc.className="ma-row-chev";setDynamicHTML(sc,icon("chevron-left",{width:"16",height:"16",strokeWidth:"2.2"}));
        sb.append(si,sl,sc);
        mainGroup.prepend(sb);
      }
      [["Preview","eye"],["Edit","pencil"],["Delete","trash"],["Support","life-buoy"]].forEach(([slot,name])=>{
        setDynamicHTML(body.querySelector(`[data-slot="icon${slot}"]`),icon(name,{width:"17",height:"17",strokeWidth:"2"}));
        setDynamicHTML(body.querySelector(`[data-slot="chev${slot}"]`),icon("chevron-left",{width:"16",height:"16",strokeWidth:"2.2"}));
      });
      body.querySelectorAll('[data-action="manageAdPreview"],[data-action="manageAdEdit"],[data-action="manageAdDeleteAsk"]').forEach((btn)=>{
        btn.dataset.id=m.id;
      });
      modalBody.appendChild(body);
      return;
    }
    if(m.type==="manageAdConfirm"){
      modalTitle.textContent="حذف آگهی";
      const body=mountTemplate("tpl-modal-manage-ad-confirm");
      setDynamicHTML(body.querySelector('[data-slot="warnIcon"]'),icon("alert-triangle",{width:"20",height:"20",strokeWidth:"2"}));
      const reasons=[
        {key:"sold",label:"آگهی به فروش رسید"},
        {key:"changed-mind",label:"دیگر مایل به فروش نیستم"},
        {key:"wrong-info",label:"قیمت یا اطلاعات آگهی اشتباه است"},
        {key:"duplicate",label:"آگهی تکراری ثبت شده"},
        {key:"other",label:"دلیل دیگر"},
      ];
      const list=body.querySelector('[data-slot="reasons"]');
      reasons.forEach((r)=>{
        const row=document.createElement("button");
        row.type="button";
        row.setAttribute("data-action","selectDeleteReason");
        row.setAttribute("data-reason",r.key);
        row.className="manageAd-reason-row"+(m.reason===r.key?" is-selected":"");
        const label=document.createElement("span");
        label.textContent=r.label;
        const tick=document.createElement("span");
        tick.className="manageAd-reason-tick";
        if(m.reason===r.key) setDynamicHTML(tick,icon("check",{width:"12",height:"12",strokeWidth:"3"}));
        row.append(label,tick);
        list.appendChild(row);
      });
      const confirmBtn=body.querySelector('[data-slot="confirmBtn"]');
      confirmBtn.classList.toggle("is-unarmed",!m.reason);
      modalBody.appendChild(body);
      return;
    }
    if(m.type==="contact"){
      modalTitle.textContent="اطلاعات تماس";
      const body=mountTemplate("tpl-modal-contact");
      const listing=m.listing,specs=buildVehicleSpecs(listing),tel=listing.phone.replace(/[^0-9+]/g,""),digits=listing.phone.replace(/\D/g,""),masked=digits.slice(0,4)+" "+"•".repeat(Math.max(digits.length-4,4));
      body.querySelector('[data-slot="dealer"]').textContent=specs.dealer.name;
      body.querySelector('[data-slot="city"]').textContent=specs.dealer.city;
      setDynamicHTML(body.querySelector('[data-slot="icon"]'),icon("map-pin",{width:"12",height:"12"}));
      const phoneArea=body.querySelector('[data-slot="phone-area"]');
      if(m.revealed){
        const a=document.createElement("a");a.href=`tel:${tel}`;a.dataset.action="clickContact";a.dataset.id=listing.id;a.className="flex flex-col items-center justify-center gap-0.5 bg-violet-300 text-neutral-950 rounded-2xl py-4 mb-3";
        const n=document.createElement("span");n.className="flex items-center gap-2 text-[19px] font-bold tracking-wide";n.dir="ltr";setDynamicHTML(n,icon("phone",{width:"16",height:"16",strokeWidth:"2"}));const num=document.createElement("span");num.textContent=listing.phone;n.appendChild(num);
        const sub=document.createElement("span");sub.className="text-[11.5px] font-semibold opacity-70";sub.textContent="برای تماس ضربه بزنید";a.replaceChildren(n,sub);phoneArea.appendChild(a);
      } else {
        const b=document.createElement("button");b.dataset.action="revealPhone";b.className="w-full flex flex-col items-center justify-center gap-1 bg-neutral-900 border border-neutral-700 rounded-2xl py-4 mb-3";
        const n=document.createElement("span");n.className="flex items-center gap-2 text-[19px] font-bold tracking-widest text-neutral-300";n.dir="ltr";n.textContent=masked;
        const sub=document.createElement("span");sub.className="text-[11.5px] font-semibold text-violet-400";sub.textContent="برای نمایش شماره ضربه بزنید";b.replaceChildren(n,sub);phoneArea.appendChild(b);
      }
      const sms=body.querySelector('[data-slot="sms"]');
      sms.href=`sms:${tel}?body=${encodeURIComponent(`سلام، آیا این ${specs.year} ${listing.brand} هنوز موجود است؟`)}`;sms.dataset.id=listing.id;
      modalBody.appendChild(body);
      return;
    }
    modalTitle.textContent="اطلاعات";
    const info=mountTemplate("tpl-modal-info");info.textContent=m.title||"";modalBody.appendChild(info);
  }
  function updateToastUI() {
    const toast = document.getElementById("toastMessage");
    if (!toast) return;
    toast.hidden = !state.toast;
    toast.textContent = state.toast || "";
    toast.classList.toggle("is-leaving", !!state.toastLeaving);
  }

  function updateBottomDock() {
    const dock = document.getElementById("bottomDock");
    if (!dock) return;
    const page = (state.loading && state.pendingRoute) ? state.pendingRoute.page : state.route.page;
    const activeKey = page === "brand" || page === "listings" ? "listings" : (page === "accountEdit" ? "account" : (page === "conversation" ? "messages" : (page === "newsItem" ? "news" : ((page === "qaAsk" || page === "qaQuestion" || page === "qaMine") ? "qa" : page))));
    // Mirrored on <body> so the dock's per-page layout (CSS) follows the page
    // being navigated TO as well — not only the one already rendered — which
    // keeps the dock from flashing its old full style while a page loads.
    const socialFeedDock = page === "feed";
    dock.classList.toggle("cm-social-dock", socialFeedDock);
    try { document.body.setAttribute("data-dock-page", page === "brand" ? "listings" : String(page || "")); } catch (_) {}
    const socialKeys = new Set(["home", "messages", "sell", "social-account"]);
    dock.querySelectorAll("[data-dock]").forEach((btn) => {
      const key = btn.getAttribute("data-dock");
      btn.hidden = socialFeedDock ? !socialKeys.has(key) : key === "social-account";
      btn.classList.toggle("is-active", !socialFeedDock && key === activeKey);
    });
    // On the social feed the central plus means "write a post"; everywhere
    // else it keeps the site's existing "post an ad" behaviour.
    const plusButton = dock.querySelector('[data-dock="sell"]');
    if (plusButton) {
      plusButton.dataset.action = socialFeedDock ? "feedOpenComposer" : "goSell";
      plusButton.setAttribute("aria-label", socialFeedDock ? "انتشار پست" : "ثبت آگهی");
      const label = plusButton.querySelector(".dock-label");
      if (label) label.textContent = socialFeedDock ? "انتشار پست" : "ثبت آگهی";
    }
  }

