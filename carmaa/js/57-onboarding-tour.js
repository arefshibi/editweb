"use strict";
/* FIRST-VISIT ONBOARDING TOUR — multi-step iOS-style sheet. Preview: ?tour=1 */
(function () {
  const KEY = "carma_onboarding_v1";
  const FORCE = /[?&]tour=1\b/.test(location.search);
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (_) { return {}; } };
  const write = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (_) {} };
  const done = () => !!read().done;
  let scheduled = false, root = null, idx = 0, lastFocus = null;

  const IC = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    home: '<path d="M4 10.9 12 4l8 6.9V19a1.5 1.5 0 0 1-1.5 1.5h-3.2V15h-6.6v5.5H5.5A1.5 1.5 0 0 1 4 19z"/>',
    listings: '<path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.2"/><circle cx="16.5" cy="16.5" r="2.2"/>',
    saved: '<path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4-6.5 4V4.5a1 1 0 0 1 1-1z"/>',
    messages: '<path d="M12 3.6c-4.7 0-8.4 3.1-8.4 7.1 0 2.2 1.1 4.1 2.9 5.4-.1 1.1-.6 2.2-1.5 3.1-.3.3-.1.8.4.7 1.7-.2 3.2-.9 4.3-1.8.8.2 1.5.3 2.3.3 4.7 0 8.4-3.1 8.4-7.1S16.7 3.6 12 3.6Z"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.4"/>',
    chev: '<path d="m15 6-6 6 6 6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'
  };
  const svg = (k, sw) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 1.9}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;

  const STEPS = [
    { hero: "welcome", dock: ["home"], tint: "#ffffff",
      title: "به کارما خوش اومدی", text: "بازار خودرو، ساده و سریع. در چند لحظه با بخش‌های اصلی آشنات می‌کنیم." },
    { hero: "search", dock: ["search"], tint: "#5ac8fa",
      title: "جستجو و فیلتر دقیق", text: "برند، مدل، قیمت یا شهر رو بنویس و فیلتر کن؛ فقط خودروهای مناسب خودت رو ببین." },
    { hero: "listings", dock: ["listings", "saved"], tint: "#ff9f0a",
      title: "آگهی‌ها را ببین و نشان کن", text: "روی هر آگهی بزن تا عکس‌ها و مشخصات رو ببینی. آگهی‌های جالب رو نشان کن تا در «نشان‌شده‌ها» بمونن." },
    { hero: "showrooms", dock: ["home"], tint: "#bf5af2",
      title: "نمایشگاه‌های خودرو", text: "نمایشگاه‌های برتر رو از صفحهٔ اصلی پیدا کن و مستقیم سراغ آگهی‌هاشون برو." },
    { hero: "chat", dock: ["messages"], tint: "#30d158",
      title: "گفتگوی مستقیم", text: "با فروشنده یا خریدار در «پیام‌ها» حرف بزن. استوری‌های ۲۴ ساعته هم همون‌جاست." },
    { hero: "story", dock: ["messages"], tint: "#ffffff",
      title: "استوری بذار؛ ۲۴ ساعت می‌مونه", text: "توی «پیام‌ها» روی «استوری شما» بزن و عکس بذار؛ متن کوتاه و لینک آگهی هم می‌تونی اضافه کنی. بعد از ۲۴ ساعت خودش پاک می‌شه." },
    { hero: "sell", dock: ["sell"], tint: "#ffffff",
      title: "آگهی خودت رو ثبت کن", text: "دکمهٔ سبز «+» رو بزن و قدم‌به‌قدم آگهی بذار. همین حالا هم می‌تونی شروع کنی." }
  ];

  const car = (n) => `images/listings/car-${String(n).padStart(2, "0")}.webp`;
  const sh = (n) => `assets/showrooms/${n}.webp`;
  const HERO = {
    welcome: () => `
      <div class="tr-welcome">
        <img class="tr-appicon" src="icons/icon-192.v2.png" alt="" />
        <span class="tr-chip c1">${svg("listings")}آگهی</span>
        <span class="tr-chip c2">${svg("pin")}نمایشگاه</span>
        <span class="tr-chip c3">${svg("messages")}پیام</span>
      </div>`,
    search: () => `
      <div class="tr-search">
        <div class="tr-sbar">${svg("search", 2.2)}<span class="tr-type">پورشه ۹۱۱ تهران</span><i class="tr-caret"></i></div>
        <div class="tr-chips"><b>برند</b><b>قیمت</b><b>سال</b><b>شهر</b></div>
        <div class="tr-res"><span class="th" style="background-image:url(${car(2)})"></span><span class="ln"><i></i><i class="s"></i></span></div>
      </div>`,
    listings: () => `
      <div class="tr-cards">
        <div class="tr-car l" style="background-image:url(${car(4)})"></div>
        <div class="tr-car r" style="background-image:url(${car(9)})"></div>
        <div class="tr-car m" style="background-image:url(${car(1)})">
          <span class="tr-save">${svg("saved", 2)}</span>
          <div class="tr-cap"><i></i><i class="s"></i></div>
        </div>
      </div>`,
    showrooms: () => `
      <div class="tr-show">
        <div class="tr-banner" style="background-image:url(${sh("banner-2")})"><span>${svg("check", 2.6)}</span></div>
        <div class="tr-avs">${[1, 3, 5, 7, 9].map((n, i) => `<img style="--i:${i}" src="${sh("avatar-" + n)}" alt="" />`).join("")}</div>
      </div>`,
    chat: () => `
      <div class="tr-chat">
        <div class="tr-stories">${[1, 4, 6, 8].map((n, i) => `<span class="${i === 0 ? "me" : ""}"><img src="${sh("avatar-" + n)}" alt="" /></span>`).join("")}</div>
        <div class="tr-b a">سلام، هنوز موجوده؟</div>
        <div class="tr-b b">سلام، بله؛ می‌تونید ببینید 👋</div>
        <div class="tr-b a c">عالی، امروز میام</div>
      </div>`,
    story: () => `
      <div class="tr-story">
        <div class="tr-sme">
          <span class="tr-sring"><img src="${sh("avatar-2")}" alt="" /><i class="tr-splus">${svg("plus", 2.8)}</i><b class="tr-tap"></b></span>
          <em>استوری شما</em>
        </div>
        <div class="tr-sphone" style="background-image:url(${car(6)})">
          <div class="tr-sprog"><u><s></s></u><u></u><u></u></div>
          <span class="tr-s24">۲۴ ساعت</span>
          <div class="tr-slink">${svg("link", 2.2)}<span>لینک آگهی</span></div>
          <div class="tr-scap"><i></i><i class="s"></i></div>
        </div>
      </div>`,
    sell: () => `
      <div class="tr-sell">
        <div class="tr-flow"><span><i>۱</i>عکس</span><u></u><span><i>۲</i>مشخصات</span><u></u><span><i>۳</i>انتشار</span></div>
        <div class="tr-bigplus">${svg("plus", 2.6)}</div>
      </div>`
  };

  const css = `
#mrTour{--tr-fg:#fff;--tr-sub:rgba(235,235,245,.62);--tr-card:rgba(255,255,255,.08);--tr-line:rgba(255,255,255,.14);--tr-sheet:rgba(38,38,40,.8);--tr-lime:#ffffff;--tr-ink:#fff;
  position:fixed;inset:0;z-index:100002;display:flex;align-items:flex-end;justify-content:center;direction:rtl;font-family:inherit;color:var(--tr-fg);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;pointer-events:none;visibility:hidden}
html.theme-light #mrTour{--tr-fg:#1D1D1F;--tr-sub:rgba(51,51,54,.66);--tr-card:rgba(0,0,0,.05);--tr-line:rgba(0,0,0,.1);--tr-sheet:rgba(246,247,249,.86)}
#mrTour.is-in{visibility:visible;pointer-events:auto}
#mrTour .tr-dim{position:absolute;inset:0;background:rgba(0,0,0,.5);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .45s ease}
#mrTour.is-in .tr-dim{opacity:1}
#mrTour.is-out .tr-dim{opacity:0}
#mrTour .tr-sheet{position:relative;width:calc(100% - 16px);max-width:440px;margin:0 8px calc(8px + env(safe-area-inset-bottom,0px));padding:14px 20px 16px;box-sizing:border-box;overflow:hidden;
  background:var(--tr-sheet);-webkit-backdrop-filter:saturate(180%) blur(34px);backdrop-filter:saturate(180%) blur(34px);border:.5px solid var(--tr-line);border-radius:36px;box-shadow:0 30px 80px rgba(0,0,0,.5);
  transform:translateY(115%);transition:transform .6s cubic-bezier(.22,1,.36,1);touch-action:pan-y}
#mrTour.is-in .tr-sheet{transform:none}
#mrTour.is-out .tr-sheet{transform:translateY(115%);transition-duration:.45s;transition-timing-function:cubic-bezier(.5,0,.75,0)}
#mrTour .tr-glow{position:absolute;inset:-30% -10% auto;height:300px;background:radial-gradient(60% 60% at 50% 40%,color-mix(in srgb,var(--tint,#ffffff) 34%,transparent),transparent 70%);pointer-events:none;transition:background .6s ease;opacity:.9;color:#1D1D1F}
#mrTour .tr-top{position:relative;display:flex;align-items:center;justify-content:space-between;min-height:30px}
#mrTour .tr-count{font-size:12.5px;font-weight:700;color:var(--tr-sub);letter-spacing:.2px}
#mrTour .tr-skip{border:0;background:transparent;color:var(--tr-sub);font:inherit;font-size:14.5px;font-weight:600;padding:6px 4px;cursor:pointer;transition:opacity .25s}
#mrTour .tr-skip:active{opacity:.5}
#mrTour.is-last .tr-skip{opacity:0;pointer-events:none}
#mrTour .tr-stage{position:relative;display:grid;margin-top:2px}
#mrTour .tr-slide{grid-area:1/1;opacity:0;visibility:hidden;transform:translateX(0);transition:opacity .35s ease,transform .6s cubic-bezier(.22,1,.36,1),visibility 0s .6s;text-align:center}
#mrTour .tr-slide.is-active{opacity:1;visibility:visible;transform:none;transition-delay:0s}
#mrTour .tr-slide.is-before{transform:translateX(44px)}
#mrTour .tr-slide.is-after{transform:translateX(-44px)}
#mrTour .tr-hero{position:relative;height:196px;margin:2px -4px 4px;display:flex;align-items:center;justify-content:center}
#mrTour h2{margin:6px 0 0;font-size:25px;font-weight:800;line-height:1.4;letter-spacing:-.3px;color:var(--tr-fg)}
#mrTour .tr-text{margin:8px auto 0;max-width:330px;min-height:5.1em;font-size:15px;line-height:1.7;color:var(--tr-sub)}
#mrTour .tr-dock{direction:ltr;display:flex;align-items:center;justify-content:center;gap:8px;margin:10px auto 0;width:max-content;max-width:100%}
#mrTour .tr-pill{display:flex;gap:2px;padding:4px;border-radius:999px;background:var(--tr-card);border:.5px solid var(--tr-line)}
#mrTour .tr-di{position:relative;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--tr-sub);opacity:.75;transition:background .45s cubic-bezier(.22,1,.36,1),color .3s,transform .5s cubic-bezier(.34,1.56,.64,1),opacity .3s,box-shadow .45s}
#mrTour .tr-di svg{width:21px;height:21px}
#mrTour .tr-di.solo{background:var(--tr-card);border:.5px solid var(--tr-line);width:44px;height:44px}
#mrTour .tr-di.is-on{background:var(--tr-lime);color:var(--tr-ink);opacity:1;transform:scale(1.14);box-shadow:0 0 0 4px color-mix(in srgb,var(--tr-lime) 28%,transparent),0 6px 18px color-mix(in srgb,var(--tr-lime) 40%,transparent)}
#mrTour .tr-di.plus{background:var(--tr-lime);color:var(--tr-ink);opacity:.9;width:44px;height:44px}
#mrTour .tr-dots{display:flex;justify-content:center;gap:7px;margin:16px 0 14px}
#mrTour .tr-dot{width:7px;height:7px;padding:0;border:0;border-radius:99px;background:var(--tr-line);cursor:pointer;transition:width .45s cubic-bezier(.22,1,.36,1),background .3s}
#mrTour .tr-dot.is-on{width:24px;background:var(--tr-fg)}
#mrTour .tr-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:54px;border:0;border-radius:999px;background:var(--tr-lime);color:var(--tr-ink);font:inherit;font-size:17px;font-weight:800;cursor:pointer;box-shadow:0 8px 24px color-mix(in srgb,var(--tr-lime) 30%,transparent);transition:transform .18s cubic-bezier(.34,1.56,.64,1),opacity .15s}
#mrTour .tr-btn:active{transform:scale(.965);opacity:.9}
#mrTour .tr-btn svg{width:18px;height:18px;stroke-width:2.6}
#mrTour .tr-back{position:absolute;inset-inline-end:0;top:0;border:0;background:transparent;color:var(--tr-sub);width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .25s}
#mrTour .tr-back svg{width:20px;height:20px;transform:scaleX(-1)}
#mrTour.has-prev .tr-back{opacity:1;pointer-events:auto}
#mrTour .tr-sheet:focus{outline:none}
#mrTour button:focus-visible{outline:2.5px solid var(--tr-lime);outline-offset:2px}

#mrTour .tr-slide:not(.is-active) *{animation:none!important}
#mrTour .tr-welcome{position:relative;width:260px;height:190px}
#mrTour .tr-appicon{position:absolute;left:50%;top:50%;width:92px;height:92px;margin:-46px 0 0 -46px;border-radius:22.4%;box-shadow:0 0 0 .5px rgba(255,255,255,.2),0 18px 40px rgba(0,0,0,.45),0 0 60px color-mix(in srgb,var(--tr-lime) 35%,transparent);animation:trPop .8s cubic-bezier(.34,1.56,.64,1) both}
#mrTour .tr-chip{position:absolute;display:flex;align-items:center;gap:6px;padding:7px 12px 7px 10px;border-radius:99px;font-size:12.5px;font-weight:700;background:var(--tr-card);border:.5px solid var(--tr-line);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:var(--tr-fg);animation:trFloat 4s ease-in-out infinite,trFade .6s .3s both}
#mrTour .tr-chip svg{width:15px;height:15px}
#mrTour .tr-chip.c1{top:14px;right:6px}
#mrTour .tr-chip.c2{top:78px;left:-6px;animation-delay:-1.3s,.5s}
#mrTour .tr-chip.c3{bottom:12px;right:22px;animation-delay:-2.4s,.7s}
#mrTour .tr-search{width:300px;display:flex;flex-direction:column;gap:9px}
#mrTour .tr-sbar{display:flex;align-items:center;gap:10px;height:46px;padding:0 14px;border-radius:15px;background:var(--tr-card);border:.5px solid var(--tr-line);font-size:14.5px;font-weight:600;animation:trRise .6s both}
#mrTour .tr-sbar svg{width:19px;height:19px;flex:none;opacity:.7}
#mrTour .tr-type{display:inline-block;overflow:hidden;white-space:nowrap;width:0;animation:trType 1.5s .5s steps(14,end) forwards}
#mrTour .tr-caret{width:2px;height:18px;background:var(--tr-lime);border-radius:2px;animation:trBlink 1s steps(2) infinite;color:#1D1D1F}
#mrTour .tr-chips{display:flex;gap:7px;justify-content:center;animation:trRise .6s .1s both}
#mrTour .tr-chips b{font-size:12.5px;font-weight:700;padding:6px 13px;border-radius:99px;background:var(--tr-card);border:.5px solid var(--tr-line)}
#mrTour .tr-chips b:first-child{background:var(--tr-lime);color:var(--tr-ink);border-color:transparent;animation:trPop .5s 1.9s both}
#mrTour .tr-res{display:flex;align-items:center;gap:11px;padding:8px;border-radius:16px;background:var(--tr-card);border:.5px solid var(--tr-line);animation:trRise .6s 2s both}
#mrTour .tr-res.r2{animation-delay:2.15s;opacity:.7}
#mrTour .tr-res .th{width:62px;height:44px;border-radius:10px;background-size:cover;background-position:center;flex:none}
#mrTour .ln{flex:1;display:flex;flex-direction:column;gap:7px;align-items:flex-start}
#mrTour .ln i,#mrTour .tr-cap i{display:block;height:8px;width:70%;border-radius:4px;background:var(--tr-line)}
#mrTour .ln i.s,#mrTour .tr-cap i.s{width:38%;background:var(--tr-lime);opacity:.9;color:#1D1D1F}
#mrTour .tr-cards{position:relative;width:300px;height:180px}
#mrTour .tr-car{position:absolute;top:14px;left:50%;width:170px;height:132px;margin-left:-85px;border-radius:22px;background-size:cover;background-position:center;box-shadow:0 14px 34px rgba(0,0,0,.4),0 0 0 .5px rgba(255,255,255,.18);animation:trRise .7s both}
#mrTour .tr-car.l{transform:translateX(-86px) rotate(-8deg) scale(.86);filter:brightness(.8);animation-delay:.05s}
#mrTour .tr-car.r{transform:translateX(86px) rotate(8deg) scale(.86);filter:brightness(.8);animation-delay:.12s}
#mrTour .tr-car.m{z-index:2;top:20px;width:184px;height:140px;margin-left:-92px;animation:trRiseM .7s .2s both}
#mrTour .tr-cap{position:absolute;inset:auto 0 0;padding:26px 14px 13px;display:flex;flex-direction:column;gap:7px;border-radius:0 0 22px 22px;background:linear-gradient(transparent,rgba(0,0,0,.7))}
#mrTour .tr-cap i{background:rgba(255,255,255,.5)}
#mrTour .tr-cap i.s{background:var(--tr-lime)}
#mrTour .tr-save{position:absolute;top:10px;left:10px;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(0,0,0,.42);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);animation:trSave 1s 1.1s both}
#mrTour .tr-save svg{width:17px;height:17px}
#mrTour .tr-show{width:300px}
#mrTour .tr-banner{position:relative;height:106px;border-radius:22px;background-size:cover;background-position:center;box-shadow:0 14px 34px rgba(0,0,0,.35),0 0 0 .5px rgba(255,255,255,.16);animation:trRise .7s both}
#mrTour .tr-banner span{position:absolute;top:10px;right:10px;width:26px;height:26px;border-radius:50%;background:var(--tr-lime);color:var(--tr-ink);display:flex;align-items:center;justify-content:center;animation:trPop .5s 1s both}
#mrTour .tr-banner svg{width:14px;height:14px}
#mrTour .tr-avs{display:flex;justify-content:center;margin-top:-22px;position:relative}
#mrTour .tr-avs img{width:52px;height:52px;border-radius:50%;object-fit:cover;margin:0 -5px;border:3px solid #262628;box-shadow:0 6px 14px rgba(0,0,0,.35);animation:trPop .55s calc(.35s + var(--i)*.09s) cubic-bezier(.34,1.56,.64,1) both}
html.theme-light #mrTour .tr-avs img{border-color:#f6f7f9}
#mrTour .tr-chat{width:290px;display:flex;flex-direction:column;gap:7px}
#mrTour .tr-stories{display:flex;gap:11px;justify-content:center;margin-bottom:3px}
#mrTour .tr-stories span{width:42px;height:42px;border-radius:50%;padding:2.5px;background:conic-gradient(#ffffff,#30d158,#5ac8fa,#9a9aa1);animation:trPop .5s both;color:#1D1D1F}
#mrTour .tr-stories span:nth-child(2){animation-delay:.07s}#mrTour .tr-stories span:nth-child(3){animation-delay:.14s}#mrTour .tr-stories span:nth-child(4){animation-delay:.21s}
#mrTour .tr-stories span.me{background:var(--tr-line)}
#mrTour .tr-stories img{width:100%;height:100%;border-radius:50%;object-fit:cover;border:2px solid #262628;box-sizing:border-box}
html.theme-light #mrTour .tr-stories img{border-color:#f6f7f9}
#mrTour .tr-b{max-width:78%;padding:8px 14px;border-radius:19px;font-size:13.5px;font-weight:600;line-height:1.55;text-align:right;animation:trBubble .5s both}
#mrTour .tr-b.a{align-self:flex-start;background:var(--tr-card);border:.5px solid var(--tr-line);border-end-start-radius:6px;animation-delay:.45s}
#mrTour .tr-b.b{align-self:flex-end;background:var(--tr-lime);color:var(--tr-ink);border-end-end-radius:6px;animation-delay:1.1s}
#mrTour .tr-b.c{animation-delay:1.8s}
#mrTour .tr-sell{width:300px;display:flex;flex-direction:column;align-items:center;gap:18px}
#mrTour .tr-bigplus{width:92px;height:92px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--tr-lime);color:var(--tr-ink);box-shadow:0 0 0 0 color-mix(in srgb,var(--tr-lime) 50%,transparent),0 16px 40px color-mix(in srgb,var(--tr-lime) 35%,transparent);animation:trPop .7s .15s cubic-bezier(.34,1.56,.64,1) both,trPulse 2.2s 1s ease-out infinite}
#mrTour .tr-bigplus svg{width:42px;height:42px}
#mrTour .tr-flow{display:flex;align-items:center;gap:8px;order:2;animation:trRise .6s .4s both}
#mrTour .tr-flow span{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;padding:6px 12px 6px 8px;border-radius:99px;background:var(--tr-card);border:.5px solid var(--tr-line)}
#mrTour .tr-flow i{font-style:normal;width:20px;height:20px;border-radius:50%;background:var(--tr-lime);color:#262628;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800}
#mrTour .tr-flow u{width:12px;height:1.5px;background:var(--tr-line)}
#mrTour .tr-story{width:300px;display:flex;align-items:center;justify-content:center;gap:24px}
#mrTour .tr-sme{display:flex;flex-direction:column;align-items:center;gap:10px;animation:trRise .6s both}
#mrTour .tr-sme em{font-style:normal;font-size:12.5px;font-weight:700;color:var(--tr-sub)}
#mrTour .tr-sring{position:relative;width:78px;height:78px;border-radius:50%;padding:3px;box-sizing:border-box;background:var(--tr-line)}
#mrTour .tr-sring img{width:100%;height:100%;border-radius:50%;object-fit:cover;border:3px solid #262628;box-sizing:border-box}
html.theme-light #mrTour .tr-sring img,html.theme-light #mrTour .tr-splus{border-color:#f6f7f9}
#mrTour .tr-splus{position:absolute;right:-3px;bottom:-3px;width:30px;height:30px;border-radius:50%;background:var(--tr-lime);color:var(--tr-ink);display:flex;align-items:center;justify-content:center;border:3px solid #262628;box-sizing:border-box;animation:trPop .6s .5s cubic-bezier(.34,1.56,.64,1) both}
#mrTour .tr-splus svg{width:14px;height:14px}
#mrTour .tr-tap{position:absolute;right:-3px;bottom:-3px;width:30px;height:30px;border-radius:50%;border:2px solid var(--tr-lime);opacity:0;animation:trTap 1.8s 1.2s ease-out infinite}
#mrTour .tr-sphone{position:relative;width:112px;height:184px;border-radius:22px;overflow:hidden;background-size:cover;background-position:center;box-shadow:0 14px 34px rgba(0,0,0,.4),0 0 0 .5px rgba(255,255,255,.18);animation:trRiseM .7s .2s both}
#mrTour .tr-sphone::after{content:"";position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,.35),transparent 30%,transparent 55%,rgba(0,0,0,.72))}
#mrTour .tr-sphone>*{z-index:1}
#mrTour .tr-sprog{position:absolute;top:8px;left:8px;right:8px;display:flex;gap:3px}
#mrTour .tr-sprog u{flex:1;height:3px;border-radius:3px;background:rgba(255,255,255,.35);overflow:hidden;text-decoration:none}
#mrTour .tr-sprog s{display:block;height:100%;width:0;background:#fff;border-radius:3px;text-decoration:none;animation:trFill 4s 1s linear infinite}
#mrTour .tr-s24{position:absolute;top:20px;right:8px;font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:99px;background:var(--tr-lime);color:var(--tr-ink);animation:trPop .5s .9s both}
#mrTour .tr-slink{position:absolute;left:8px;right:8px;bottom:38px;display:flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:99px;font-size:10.5px;font-weight:700;color:#fff;background:rgba(255,255,255,.22);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);animation:trRise .5s 1.3s both}
#mrTour .tr-slink svg{width:12px;height:12px;flex:none}
#mrTour .tr-scap{position:absolute;left:10px;right:10px;bottom:12px;display:flex;flex-direction:column;gap:6px}
#mrTour .tr-scap i{display:block;height:6px;width:80%;border-radius:3px;background:rgba(255,255,255,.55)}
#mrTour .tr-scap i.s{width:45%;background:var(--tr-lime);color:#1D1D1F}
@keyframes trFill{0%{width:0}100%{width:100%}}
@keyframes trTap{0%{opacity:.9;transform:scale(.8)}100%{opacity:0;transform:scale(2.4)}}
@keyframes trPop{0%{opacity:0;transform:scale(.5)}100%{opacity:1;transform:scale(1)}}
@keyframes trFade{from{opacity:0}to{opacity:1}}
@keyframes trRise{from{opacity:0;translate:0 18px}to{opacity:1;translate:0 0}}
@keyframes trRiseM{from{opacity:0;translate:0 26px;scale:.92}to{opacity:1;translate:0 0;scale:1}}
@keyframes trFloat{0%,100%{translate:0 0}50%{translate:0 -7px}}
@keyframes trType{to{width:9.6em}}
@keyframes trBlink{50%{opacity:0}}
@keyframes trBubble{from{opacity:0;translate:0 12px;scale:.9}to{opacity:1;translate:0 0;scale:1}}
@keyframes trSave{0%{opacity:0;scale:.6}40%{opacity:1;scale:1.25;background:var(--tr-lime);color:var(--tr-ink)}100%{opacity:1;scale:1;background:var(--tr-lime);color:var(--tr-ink)}}
@keyframes trPulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--tr-lime) 50%,transparent),0 16px 40px color-mix(in srgb,var(--tr-lime) 35%,transparent)}70%,100%{box-shadow:0 0 0 26px transparent,0 16px 40px color-mix(in srgb,var(--tr-lime) 35%,transparent)}}
@media (max-height:700px){#mrTour .tr-hero{height:160px}#mrTour .tr-welcome,#mrTour .tr-cards,#mrTour .tr-search,#mrTour .tr-chat,#mrTour .tr-show,#mrTour .tr-sell,#mrTour .tr-story{transform:scale(.86)}#mrTour h2{font-size:22px}#mrTour .tr-text{min-height:4.6em;font-size:14.5px}#mrTour .tr-dots{margin:12px 0 10px}#mrTour .tr-btn{height:50px}}
@media (min-width:600px){#mrTour{align-items:center}#mrTour .tr-sheet{margin:0}}
@media (prefers-reduced-motion:reduce){#mrTour .tr-sheet,#mrTour .tr-dim,#mrTour .tr-slide{transition:opacity .2s!important;transform:none!important}#mrTour *{animation:none!important}#mrTour .tr-type{width:auto}}
`;

  const dockItem = (k, cls) => `<span class="tr-di ${cls || ""}" data-k="${k}">${k === "sell" ? svg("plus", 2.4) : svg(k)}</span>`;
  function build() {
    const el = document.createElement("div");
    el.id = "mrTour";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "آشنایی با کارما");
    const slides = STEPS.map((s, i) => `
      <section class="tr-slide" data-i="${i}" aria-hidden="true" style="--tint:${s.tint}">
        <div class="tr-hero">${HERO[s.hero]()}</div>
        <h2>${s.title}</h2>
        <p class="tr-text">${s.text}</p>
      </section>`).join("");
    el.innerHTML = `
      <div class="tr-dim" data-tr="skip"></div>
      <div class="tr-sheet" tabindex="-1">
        <div class="tr-glow"></div>
        <div class="tr-top">
          <button type="button" class="tr-skip" data-tr="skip">رد کردن</button>
          <span class="tr-count" aria-live="polite"></span>
          <button type="button" class="tr-back" data-tr="prev" aria-label="مرحلهٔ قبل">${svg("chev", 2.2)}</button>
        </div>
        <div class="tr-stage">${slides}</div>
        <div class="tr-dock" aria-hidden="true">
          ${dockItem("search", "solo")}
          <div class="tr-pill">${["messages", "saved", "listings", "home"].map((k) => dockItem(k)).join("")}</div>
          ${dockItem("sell", "solo plus")}
        </div>
        <div class="tr-dots" role="tablist">${STEPS.map((_, i) => `<button type="button" class="tr-dot" data-tr="go" data-i="${i}" role="tab" aria-label="مرحلهٔ ${i + 1}"></button>`).join("")}</div>
        <button type="button" class="tr-btn" data-tr="next"></button>
      </div>`;
    return el;
  }
  const fa = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

  function render() {
    if (!root) return;
    const last = idx === STEPS.length - 1;
    root.querySelectorAll(".tr-slide").forEach((s, i) => {
      s.classList.toggle("is-active", i === idx);
      s.classList.toggle("is-before", i < idx);
      s.classList.toggle("is-after", i > idx);
      s.setAttribute("aria-hidden", i === idx ? "false" : "true");
    });
    root.querySelectorAll(".tr-dot").forEach((d, i) => { d.classList.toggle("is-on", i === idx); d.setAttribute("aria-selected", i === idx); });
    const on = STEPS[idx].dock;
    root.querySelectorAll(".tr-di").forEach((d) => d.classList.toggle("is-on", on.indexOf(d.dataset.k) > -1 && d.dataset.k !== "sell"));
    root.querySelector(".tr-glow").style.setProperty("--tint", STEPS[idx].tint);
    root.querySelector(".tr-count").textContent = `${fa(idx + 1)} از ${fa(STEPS.length)}`;
    root.classList.toggle("is-last", last);
    root.classList.toggle("has-prev", idx > 0);
    root.querySelector(".tr-btn").innerHTML = last ? `شروع کنیم${svg("check", 2.6)}` : "ادامه";
    const plus = root.querySelector('.tr-di[data-k="sell"]');
    if (plus) plus.style.transform = on.indexOf("sell") > -1 ? "scale(1.18)" : "";
  }
  function go(n) { n = Math.max(0, Math.min(STEPS.length - 1, n)); if (n === idx) return; idx = n; render(); }
  function next() { if (idx >= STEPS.length - 1) return close(); go(idx + 1); }

  function onKey(e) {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") next();
    else if (e.key === "ArrowRight") go(idx - 1);
    else if (e.key === "Tab") {
      const f = [...root.querySelectorAll("button")].filter((b) => b.offsetParent !== null && getComputedStyle(b).pointerEvents !== "none");
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  }

  function open(startAt) {
    if (root) return;
    if (!document.getElementById("mrTourCss")) {
      const st = document.createElement("style"); st.id = "mrTourCss"; st.textContent = css; document.head.appendChild(st);
    }
    scheduled = false;
    lastFocus = document.activeElement;
    idx = Math.max(0, Math.min(STEPS.length - 1, startAt | 0));
    root = build();
    document.body.appendChild(root);
    render();
    requestAnimationFrame(() => requestAnimationFrame(() => root && root.classList.add("is-in")));
    root.addEventListener("click", (e) => {
      const t = e.target.closest("[data-tr]"); if (!t) return;
      const a = t.dataset.tr;
      if (a === "next") next();
      else if (a === "prev") go(idx - 1);
      else if (a === "go") go(+t.dataset.i);
      else if (a === "skip") close();
    });
    let x0 = null, y0 = 0;
    const sheet = root.querySelector(".tr-sheet");
    sheet.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; x0 = e.clientX; y0 = e.clientY; });
    sheet.addEventListener("pointerup", (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) (dx < 0 ? next() : go(idx - 1));
    });
    sheet.addEventListener("pointercancel", () => { x0 = null; });
    document.addEventListener("keydown", onKey);
    setTimeout(() => { const sh = root && root.querySelector(".tr-sheet"); if (sh) sh.focus({ preventScroll: true }); }, 650);
  }

  function close() {
    if (!root) return;
    const r = root; root = null;
    write({ done: Date.now() });
    r.classList.add("is-out");
    document.removeEventListener("keydown", onKey);
    setTimeout(() => r.remove(), 520);
    try { lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true }); } catch (_) {}
  }

  function blocked() {
    const h = document.documentElement;
    return h.classList.contains("auth-active") || h.classList.contains("menu-active") ||
      !!document.querySelector("#authFlow:not([hidden]),#loginModal:not([hidden]),#genericModal:not([hidden]),#searchOverlay:not([hidden]),#filterOverlay:not([hidden])");
  }
  function autoStart() {
    if (!FORCE && done()) return;
    scheduled = true;
    let tries = 0;
    const tick = () => {
      if (!scheduled) return;
      if (blocked() && tries++ < 20) return setTimeout(tick, 1000);
      open(0);
    };
    setTimeout(tick, FORCE ? 500 : 1400);
  }

  window.CARMA_TOUR = {
    open: () => open(0),
    close,
    reset: () => { try { localStorage.removeItem(KEY); } catch (_) {} },
    active: () => !!root,
    busy: () => !!root || scheduled,
    done
  };
  if (document.readyState === "complete") autoStart(); else window.addEventListener("load", autoStart, { once: true });
})();
