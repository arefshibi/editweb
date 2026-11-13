/*!
 * CarmaaStoryShare — ساخت و اشتراک‌گذاری بنر استوری اینستاگرام (۱۰۸۰×۱۹۲۰) از روی آگهی
 * JavaScript ساده، بدون فریم‌ورک. همه‌ی طرح‌ها در یک اسلایدر قابل انتخاب‌اند.
 *
 * استفاده:
 *   <script src="carmaa-story-share.js"></script>
 *   CarmaaStoryShare.open({
 *     title:'بنز کلاس E E350',   // الزامی
 *     image:'https://.../car.jpg', // عکس پیش‌فرض بنر (ترجیحاً هم‌دامنه یا با CORS)
 *     images:['a.jpg','b.jpg'],    // اختیاری: همه‌ی عکس‌های آگهی؛ کاربر یکی را برای بنر انتخاب می‌کند
 *     url:'https://carmaa.ir/ad/123', // لینک QR
 *     year:2022, trim:'FULL', exchange:true, paint:'۱ تکه رنگ',
 *     brandLogo:''  // اختیاری: آدرس لوگوی برند خودرو
 *   });
 */
(function (w) {
  'use strict';
  var CFG = {
    brand: 'CARMA', siteName: 'CarMa',
    font: "'Vazirmatn',Tahoma,sans-serif",
    // هر کتابخانه چند آدرس دارد؛ اگر اولی باز نشد بعدی امتحان می‌شود. برای پایداری بیشتر می‌توانید فایل‌ها را در js/vendor/ بگذارید و آدرس محلی را اول لیست قرار دهید.
    html2canvas: ['https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'],
    qrcode: ['https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js']
  };
  var NAMES = ["کارت مات", "عکس تمام‌عرض", "کارت مات با نشان خودرو", "کارت مات با پنل QR", "عکس تمام‌عرض با پنل پایین", "عکس تمام‌صفحه"];
  var STAR = '<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="46" fill="none" stroke="#fff" stroke-width="4"/><path d="M50 9 L55.5 46 L88 68 L50 55 L12 68 L44.5 46 Z" fill="#fff"/></svg>';
  var CSS = `/*tpl*/.cms-st{width:1080px;height:1920px;position:absolute;top:0;left:0;transform-origin:top left;direction:rtl;overflow:hidden;font-family:'Vazirmatn',Tahoma,sans-serif;
 --bg:#1D1D1F;--card:#1D1D1F;--line:#262628;--chip:#262628;--cl:#262628;--pr:linear-gradient(135deg,#262628,#262628);--mut:#a9aab0;--ac:#4a7bff;background:#1D1D1F;color:#fff}
.cms-ph{background:#1D1D1F  50% 50%/cover no-repeat}
.cms-sh{position:absolute;top:0;left:0;right:0;height:380px;background:linear-gradient(180deg,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.25) 55%,rgba(0,0,0,0.0) 100%);z-index:2}
.cms-logo{position:absolute;top:150px;left:0;right:0;z-index:3;display:flex;align-items:center;justify-content:center;gap:22px;direction:ltr}
.cms-wm{font-family:'Vazirmatn','Helvetica Neue',Arial,sans-serif;font-size:88px;font-weight:800;line-height:1;letter-spacing:26px;padding-left:26px;color:#fff;text-shadow:0 4px 26px rgba(0,0,0,0.67),0 2px 6px rgba(0,0,0,0.53)}
.cms-chip{display:inline-block;padding:12px 26px;border-radius:40px;font-size:32px;font-weight:600;background:var(--chip);border:2px solid var(--cl);color:#f1f1f3}
.cms-row{display:flex;flex-wrap:wrap;gap:16px}
.cms-st h2{margin:0;font-weight:800;font-size:96px;line-height:1.3}
.cms-pill{display:inline-block;white-space:nowrap;background:var(--pr);border:2px solid var(--line);border-radius:44px;padding:26px 44px;font-size:46px;font-weight:600}
.cms-pill b{color:#9db6ff;font-weight:800;display:inline;margin-right:12px}
.cms-qr{background:#fff;border-radius:36px;padding:26px;width:352px;height:352px;display:flex;align-items:center;justify-content:center}
.cms-qr img,.cms-qr canvas{width:300px!important;height:300px!important}
.cms-cap{font-size:40px;color:var(--mut);line-height:1.8}
.cms-cap b{display:block;color:#fff;font-size:50px}
.cms-A .cms-frame{position:absolute;top:50px;left:50px;right:50px;bottom:50px;background:transparent;border:2px solid var(--line);border-radius:80px;overflow:hidden}
.cms-A .cms-img{position:absolute;top:30px;left:30px;right:30px;height:800px;border-radius:56px;overflow:hidden}
.cms-A .cms-info{position:absolute;top:860px;left:60px;right:60px}
.cms-A .cms-row{margin:22px 0 26px}
.cms-A .cms-bt{position:absolute;bottom:60px;left:60px;right:60px;display:flex;align-items:center;justify-content:space-between}
.cms-B .cms-img{position:absolute;top:0;left:0;right:0;height:1180px;overflow:hidden}
.cms-B .cms-fade{position:absolute;top:560px;left:0;right:0;bottom:0;background:linear-gradient(180deg,rgba(29,29,31,0) 0,rgba(29,29,31,0.28) 110px,rgba(29,29,31,0.68) 250px,#1D1D1F 380px);z-index:1}
.cms-B .cms-info{position:absolute;top:860px;left:60px;right:60px;z-index:2}
.cms-B .cms-row{margin:26px 0 30px}
.cms-B .cms-bt{position:absolute;bottom:200px;left:60px;right:60px;z-index:2;display:flex;align-items:center;justify-content:space-between}
.cms-mk{width:84px;height:84px;margin-bottom:10px}
.cms-pill.cms-s{font-size:38px;padding:20px 32px;margin-top:18px}
.cms-sh2{position:absolute;top:520px;left:0;right:0;bottom:0;background:linear-gradient(180deg,rgba(29,29,31,0) 0,rgba(29,29,31,0.28) 110px,rgba(29,29,31,0.68) 250px,#1D1D1F 380px);z-index:1}
.cms-A2 .cms-img{height:800px;border-radius:56px 56px 56px 150px}
.cms-A2 .cms-info{top:860px}
.cms-A2 .cms-row{margin:22px 0 26px}
.cms-A3 .cms-img{height:740px}
.cms-A3 .cms-info{top:800px}
.cms-A3 .cms-row{margin:22px 0 26px}
.cms-A3 .cms-panel{position:absolute;bottom:40px;left:40px;right:40px;height:440px;background:var(--bg);border:2px solid var(--line);border-radius:56px;padding:44px;display:flex;align-items:center;justify-content:space-between}
.cms-B2 .cms-img{height:1300px}
.cms-B2 .cms-panel{position:absolute;top:700px;left:0;right:0;bottom:0;background:linear-gradient(180deg,rgba(29,29,31,0) 0,rgba(29,29,31,0.28) 110px,rgba(29,29,31,0.68) 250px,#1D1D1F 380px);z-index:2}
.cms-B2 .cms-info{top:930px;z-index:3}
.cms-B2 .cms-row{margin:22px 0 0}
.cms-B2 .cms-bt{z-index:3}
.cms-B3 .cms-info{top:960px;z-index:3}
.cms-B3 .cms-row{margin:22px 0 0}
.cms-B3 .cms-chip{background:rgba(29,29,31,0.7)}
.cms-B3 .cms-bt{z-index:3}
.cms-B3 .cms-bar{width:140px;height:10px;border-radius:6px;background:var(--ac);margin:18px 0 0}
.cms-st *{box-sizing:border-box}
.cms-st{font-family:var(--cms-font,'Vazirmatn',Tahoma,sans-serif)}
.cms-off{position:fixed;left:-10000px;top:0;width:1080px;height:1920px;pointer-events:none}
.cms-m{position:fixed;inset:0;z-index:99999;background:#1D1D1F;color:#fff;display:flex;flex-direction:column;direction:rtl;font-family:var(--cms-font,'Vazirmatn',Tahoma,sans-serif)}
.cms-top{display:flex;align-items:center;justify-content:space-between;padding:calc(env(safe-area-inset-top,0px) + 12px) 16px 8px;font-size:15px}
.cms-x{background:#262628;border:1px solid #262628;color:#fff;border-radius:12px;width:38px;height:38px;font-size:18px;cursor:pointer}
.cms-track{flex:1;min-height:0;display:flex;overscroll-behavior-x:contain;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;direction:rtl}
.cms-track::-webkit-scrollbar{display:none}
.cms-slide{flex:0 0 100%;scroll-snap-align:center;scroll-snap-stop:always;display:flex;align-items:center;justify-content:center}
.cms-box{position:relative;overflow:hidden;contain:layout paint style;border-radius:14px;background:#1D1D1F;box-shadow:0 4px 12px #0006}
.cms-box .cms-st{transform-origin:top left}
.cms-name{text-align:center;font-size:13px;color:#a9aab0;padding:8px 0 2px}
.cms-dots{display:flex;justify-content:center;gap:8px;padding:6px 0}
.cms-dots i{width:8px;height:8px;border-radius:50%;background:#262628;cursor:pointer;transition:.2s}
.cms-dots i.on{background:#4a7bff;width:22px;border-radius:6px}
.cms-pick{padding:2px 16px 6px}.cms-pick-t{font-size:12px;color:#a9aab0;margin:0 2px 6px}.cms-pick-r{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;direction:rtl;-webkit-overflow-scrolling:touch;padding:2px}.cms-pick-r::-webkit-scrollbar{display:none}.cms-th{flex:none;width:52px;height:52px;border-radius:12px;padding:0;border:2px solid #262628;background:#1D1D1F center/cover no-repeat;cursor:pointer;opacity:.7;transition:.15s;position:relative;overflow:hidden}.cms-th.on{border-color:#4a7bff;opacity:1;box-shadow:0 0 0 2px #4a7bff55}.cms-th[disabled]{pointer-events:none}.cms-th.ld::after{content:'';position:absolute;inset:0;background:#0b0b0d99}
.cms-lnk{padding:4px 16px 2px}
.cms-lk{width:100%;display:flex;align-items:center;gap:10px;background:#1D1D1F;border:1px dashed #4a7bff;color:#fff;border-radius:14px;padding:10px 12px;font-family:inherit;cursor:pointer}
.cms-lk-u{flex:1;min-width:0;direction:ltr;text-align:left;font-family:Inter,Arial,sans-serif;font-size:13px;color:#9db6ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cms-lk em{font-style:normal;font-size:12px;font-weight:700;background:#4a7bff;border-radius:8px;padding:5px 10px;flex:none}
.cms-lk.ok em{background:#2fbf71}
.cms-steps{display:flex;gap:6px;margin-top:8px;font-size:11px;color:#a9aab0;line-height:1.5}
.cms-steps span{flex:1;display:flex;gap:6px;align-items:flex-start}
.cms-steps i{flex:none;width:18px;height:18px;border-radius:50%;background:#262628;border:1px solid #262628;color:#fff;font-style:normal;font-size:11px;display:flex;align-items:center;justify-content:center}
.cms-toast{position:absolute;left:16px;right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 92px);background:#fff;color:#262628;border-radius:14px;padding:12px 14px;font-size:13px;font-weight:600;line-height:1.7;text-align:center;box-shadow:0 10px 30px #000a;opacity:0;transform:translateY(8px);transition:.25s;pointer-events:none;z-index:5}
.cms-toast.on{opacity:1;transform:none}
.cms-act{display:flex;gap:10px;padding:8px 16px calc(env(safe-area-inset-bottom,0px) + 16px)}
.cms-act button{flex:1;border:0;border-radius:14px;padding:14px 10px;font-weight:600;font-size:15px;font-family:inherit;cursor:pointer;color:#fff}
.cms-b1{background:#4a7bff}.cms-b2{background:#262628;border:1px solid #262628!important}
.cms-act button[disabled]{opacity:.55}
@media(min-width:900px){.cms-track{direction:rtl}}`;
  var TPL = [
(x)=>`<div class="cms-st cms-A"><div class="cms-frame">
  <div class="cms-img cms-ph"><div class="cms-sh"></div><div class="cms-logo" style="top:110px"><span class="cms-wm">${x.brand}</span></div></div>
  <div class="cms-info">
    ${x.mk}<h2>${x.title}</h2>
    ${x.chips}
    <div class="cms-pill">قیمت: <b>در سایت ${x.site}</b></div>
  </div>
  <div class="cms-bt"><div class="cms-cap"><b>اسکن کن، آگهی رو ببین</b>مشخصات کامل و قیمت</div><div class="cms-qr"></div></div>
</div></div>`,
(x)=>`<div class="cms-st cms-B">
  <div class="cms-img cms-ph"><div class="cms-sh"></div></div><div class="cms-fade"></div>
  <div class="cms-logo"><span class="cms-wm">${x.brand}</span></div>
  <div class="cms-info">
    ${x.mk}<h2>${x.title}</h2>
    ${x.chips}
    <div class="cms-pill">قیمت: <b>در سایت ${x.site}</b></div>
  </div>
  <div class="cms-bt"><div class="cms-cap"><b>اسکن کن</b>قیمت و مشخصات کامل</div><div class="cms-qr"></div></div>
</div>`,
(x)=>`<div class="cms-st cms-A cms-A2"><div class="cms-frame">
  <div class="cms-img cms-ph"><div class="cms-sh"></div><div class="cms-logo" style="top:110px"><span class="cms-wm">${x.brand}</span></div></div>
  <div class="cms-info">
    
    ${x.mk}<h2>${x.title}</h2>
    ${x.chips}
    <div class="cms-pill">قیمت: <b>در سایت ${x.site}</b></div>
  </div>
  <div class="cms-bt"><div class="cms-cap"><b>اسکن کن، آگهی رو ببین</b>مشخصات کامل و قیمت</div><div class="cms-qr"></div></div>
</div></div>`,
(x)=>`<div class="cms-st cms-A cms-A3"><div class="cms-frame">
  <div class="cms-img cms-ph"><div class="cms-sh"></div><div class="cms-logo" style="top:110px"><span class="cms-wm">${x.brand}</span></div></div>
  <div class="cms-info">
    ${x.mk}<h2>${x.title}</h2>
    ${x.chips}
    <div class="cms-pill">قیمت: <b>در سایت ${x.site}</b></div>
  </div>
  <div class="cms-panel"><div class="cms-cap"><b>اسکن کن</b>مشاهده آگهی کامل<br>و تماس با فروشنده</div><div class="cms-qr"></div></div>
</div></div>`,
(x)=>`<div class="cms-st cms-B cms-B2">
  <div class="cms-img cms-ph"><div class="cms-sh"></div></div>
  <div class="cms-logo"><span class="cms-wm">${x.brand}</span></div>
  <div class="cms-panel"></div>
  <div class="cms-info">
    ${x.mk}<h2>${x.title}</h2>
    ${x.chips}
  </div>
  <div class="cms-bt"><div class="cms-cap"><b>اسکن کن</b><div class="cms-pill cms-s">قیمت: <b>در سایت ${x.site}</b></div></div><div class="cms-qr"></div></div>
</div>`,
(x)=>`<div class="cms-st cms-B cms-B3">
  <div class="cms-img cms-ph" style="height:1220px"><div class="cms-sh"></div></div><div class="cms-sh2"></div>
  <div class="cms-logo"><span class="cms-wm">${x.brand}</span></div>
  <div class="cms-info">
    ${x.mk}<h2>${x.title}</h2><div class="cms-bar"></div>
    ${x.chips}
  </div>
  <div class="cms-bt"><div class="cms-cap"><b>اسکن کن</b><div class="cms-pill cms-s">قیمت: <b>در سایت ${x.site}</b></div></div><div class="cms-qr"></div></div>
</div>`
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fa(n) { return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }); }
  function load(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  function loadAny(list) {
    list = [].concat(list);
    return list.reduce(function (p, src) { return p.catch(function () { return load(src); }); }, Promise.reject());
  }
  function libs() {
    var p = [];
    if (!w.html2canvas) p.push(loadAny(CFG.html2canvas));
    if (!w.QRCode) p.push(loadAny(CFG.qrcode));
    return Promise.all(p);
  }
  function qrLib() { return w.QRCode ? Promise.resolve() : loadAny(CFG.qrcode); }
  function h2cLib() { return w.html2canvas ? Promise.resolve() : loadAny(CFG.html2canvas); }
  // عکس را یک بار می‌گیریم، به حداکثر ۱۶۰۰ پیکسل کوچک می‌کنیم و به‌صورت blob-URL نگه می‌داریم
  // (به‌جای رشتهٔ base64 سنگین که برای هر ۶ قالب جداگانه دیکد می‌شد).
  function toObjUrl(url, max) {
    max = max || 1600;
    if (!url) return Promise.resolve('');
    return fetch(url, { mode: 'cors' }).then(function (r) { return r.blob(); }).then(function (b) {
      return new Promise(function (ok) {
        var u = URL.createObjectURL(b), im = new Image();
        im.onload = function () {
          var s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
          if (s >= 1) { ok(u); return; }
          var c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
          c.toBlob(function (bb) { ok(bb ? URL.createObjectURL(bb) : url); }, 'image/jpeg', max < 1000 ? 0.82 : 0.9);
        };
        im.onerror = function () { URL.revokeObjectURL(u); ok(url); };
        im.src = u;
      });
    }).catch(function () { return url; });
  }
  function parts(d) {
    var c = [];
    if (d.trim) c.push(d.trim);
    if (d.year) c.push(fa(d.year));
    if (d.exchange) c.push('⇄ قابل معاوضه');
    if (d.paint) c.push(d.paint);
    var logo = d.brandLogo ? '<img src="' + esc(d.brandLogo) + '" alt="" style="width:100%;height:100%;object-fit:contain">'
      : (/بنز|benz|mercedes/i.test(d.title || '') ? STAR : '');
    return {
      title: esc(d.title), brand: esc(d.brand || CFG.brand), site: esc(CFG.siteName),
      chips: '<div class="cms-row">' + c.map(function (t) { return '<span class="cms-chip">' + esc(t) + '</span>'; }).join('') + '</div>',
      mk: logo ? '<div class="cms-mk">' + logo + '</div>' : ''
    };
  }
  function mount(host, i, d, img) {
    host.innerHTML = TPL[i](parts(d));
    host.firstElementChild.style.setProperty('--cms-font', CFG.font);
    var ph = host.querySelectorAll('.cms-ph');
    for (var k = 0; k < ph.length; k++) if (img) ph[k].style.backgroundImage = 'url("' + img + '")';
    var q = host.querySelectorAll('.cms-qr');
    for (var n = 0; n < q.length; n++) {
      q[n].innerHTML = '';
      try { new w.QRCode(q[n], { text: d.url || location.href, width: 300, height: 300, colorDark: '#1D1D1F', colorLight: '#ffffff', correctLevel: w.QRCode.CorrectLevel.M }); } catch (e) {}
    }
  }
  function render(i, d, img) {
    var h = document.createElement('div'); h.className = 'cms-off'; document.body.appendChild(h);
    mount(h, i, d, img);
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    return fonts.then(function () { return new Promise(function (r) { setTimeout(r, 200); }); }).then(function () {
      return w.html2canvas(h.firstElementChild, { width: 1080, height: 1920, scale: 1, useCORS: true, backgroundColor: '#1D1D1F', logging: false });
    }).then(function (c) {
      h.remove();
      return new Promise(function (ok) { c.toBlob(ok, 'image/png'); });
    }, function (e) { h.remove(); throw e; });
  }
  function ensureStyle() {
    if (document.getElementById('cms-style')) return;
    var s = document.createElement('style'); s.id = 'cms-style'; s.textContent = CSS; document.head.appendChild(s);
  }

  function open(d) {
    ensureStyle();
    d = d || {};
    var idx = 0, imgP = '', busy = false, sel = 0, tok = 0, urls = [], fullP = null, sc = 0.3, scrolling = false, nbT, startIdx = 0;
    var imgs = [].concat(Array.isArray(d.images) ? d.images : [], d.image ? [d.image] : []).filter(function (u, k, a) { return u && a.indexOf(u) === k; });
    if (d.image && imgs.indexOf(d.image) > 0) { imgs.splice(imgs.indexOf(d.image), 1); imgs.unshift(d.image); }
    var m = document.createElement('div'); m.className = 'cms-m';
    m.innerHTML = '<div class="cms-top"><button class="cms-x" aria-label="بستن">✕</button><span>انتخاب طرح استوری</span><span style="width:38px"></span></div>' +
      '<div class="cms-track"></div><div class="cms-name"></div><div class="cms-dots"></div><div class="cms-pick" hidden><div class="cms-pick-t">عکس بنر را انتخاب کنید</div><div class="cms-pick-r"></div></div>' +
      '<div class="cms-lnk"><button type="button" class="cms-lk" aria-label="کپی لینک آگهی"><span class="cms-lk-u"></span><em>کپی لینک</em></button>' +
      '<div class="cms-steps"><span><i>۱</i>لینک آگهی خودکار کپی می‌شود</span><span><i>۲</i>اینستاگرام ← استوری</span><span><i>۳</i>استیکر لینک ← Paste</span></div></div>' +
      '<div class="cms-act"><button class="cms-b1">اشتراک‌گذاری در استوری</button><button class="cms-b2">دانلود تصویر</button></div>';
    document.body.appendChild(m);
    var prevOv = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
    var track = m.querySelector('.cms-track'), dots = m.querySelector('.cms-dots'), nm = m.querySelector('.cms-name');
    var b1 = m.querySelector('.cms-b1'), b2 = m.querySelector('.cms-b2');
    var boxes = [];
    var linkUrl = d.url || location.href, lk = m.querySelector('.cms-lk'), toastEl = null, toastT;
    try { m.querySelector('.cms-lk-u').textContent = decodeURIComponent(linkUrl.replace(/^https?:\/\//, '')); } catch (_) { m.querySelector('.cms-lk-u').textContent = linkUrl; }
    function toast(msg) {
      if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'cms-toast'; m.appendChild(toastEl); }
      toastEl.textContent = msg; void toastEl.offsetWidth; toastEl.classList.add('on');
      clearTimeout(toastT); toastT = setTimeout(function () { toastEl && toastEl.classList.remove('on'); }, 4200);
    }
    // باید همزمان با لمس کاربر صدا زده شود (قبل از هر await)
    function copyLink() {
      var done = function (ok) { lk.classList.toggle('ok', !!ok); if (ok) setTimeout(function () { lk.classList.remove('ok'); }, 2500); return ok; };
      var legacy = function () {
        try { var t = document.createElement('textarea'); t.value = linkUrl; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0'; m.appendChild(t); t.select(); t.setSelectionRange(0, 99999); var ok = document.execCommand('copy'); t.remove(); return ok; } catch (_) { return false; }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(linkUrl).then(function () { return done(true); }, function () { return done(legacy()); });
      return Promise.resolve(done(legacy()));
    }
    lk.onclick = function () { copyLink().then(function (ok) { toast(ok ? 'لینک آگهی کپی شد ✓' : 'کپی خودکار ممکن نشد؛ لینک را دستی انتخاب کنید'); }); };
    TPL.forEach(function (_, i) {
      var sl = document.createElement('div'); sl.className = 'cms-slide';
      var bx = document.createElement('div'); bx.className = 'cms-box'; sl.appendChild(bx); track.appendChild(sl); boxes.push(bx);
      var dt = document.createElement('i'); dt.onclick = function () { go(i); }; dots.appendChild(dt);
    });
    mounted = {};
    function ensure(i) {
      if (i < 0 || i >= TPL.length || mounted[i] || !img0) return; mounted[i] = 1;
      var st = document.createElement('div'), bx = boxes[i]; bx.appendChild(st); mount(st, i, d, imgP); var el = st.firstElementChild; bx.replaceChild(el, st); el.style.transform = 'scale(' + sc + ')';
    }
    var ric = w.requestIdleCallback ? function (f) { w.requestIdleCallback(f, { timeout: 600 }); } : function (f) { setTimeout(f, 60); };
    // فقط طرح فعلی همین لحظه ساخته می‌شود؛ همسایه‌ها یکی‌یکی و در زمان بیکاری (نه وسط اسکرول)
    function near() {
      ensure(idx); clearTimeout(nbT);
      nbT = setTimeout(function () {
        if (!m.isConnected || scrolling) return;
        var a = idx;
        ric(function () { if (m.isConnected && !scrolling && a === idx) { ensure(a + 1); ric(function () { if (m.isConnected && !scrolling && a === idx) ensure(a - 1); }); } });
      }, 150);
    }
    function paint() { for (var k = 0; k < dots.children.length; k++) dots.children[k].className = k === idx ? 'on' : ''; nm.textContent = (idx + 1) + ' / ' + TPL.length + ' · ' + NAMES[idx]; if (img0) near(); }
    function go(i) { track.children[i].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); }
    function layout() {
      var H = track.clientHeight - 8, W = track.clientWidth * 0.9, h = Math.min(H, W * 16 / 9), wd = h * 9 / 16; sc = wd / 1080;
      boxes.forEach(function (bx) { bx.style.width = wd + 'px'; bx.style.height = h + 'px'; var st = bx.firstElementChild; if (st) st.style.transform = 'scale(' + sc + ')'; });
    }
    var tm, noSnapStop = !(w.CSS && CSS.supports && CSS.supports('scroll-snap-stop', 'always'));
    track.addEventListener('touchstart', function () { startIdx = idx; }, { passive: true });
    track.addEventListener('scroll', function () {
      scrolling = true; clearTimeout(preT); clearTimeout(nbT);
      clearTimeout(tm); tm = setTimeout(function () {
        scrolling = false;
        var n = Math.max(0, Math.min(TPL.length - 1, Math.round(Math.abs(track.scrollLeft) / track.clientWidth)));
        // مرورگرهای قدیمی (بدون scroll-snap-stop): هر سوایپ حداکثر یک قالب جلو برود
        if (noSnapStop && Math.abs(n - startIdx) > 1) { n = startIdx + (n > startIdx ? 1 : -1); idx = n; go(n); paint(); pre(); startIdx = n; return; }
        idx = n; startIdx = n; paint(); pre();
      }, 90);
    }, { passive: true });
    function close() { clearTimeout(toastT); document.removeEventListener('keydown', key); window.removeEventListener('resize', layout); document.documentElement.style.overflow = prevOv; clearTimeout(preT); clearTimeout(nbT); urls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (_) {} }); m.remove(); }
    function key(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', key); window.addEventListener('resize', layout);
    m.querySelector('.cms-x').onclick = close;
    // تصویر هر قالب از قبل (پس‌زمینه) ساخته می‌شود تا دکمهٔ اشتراک‌گذاری بلافاصله و داخل «لمس کاربر» اجرا شود
    // (مرورگر اجازهٔ navigator.share را فقط چند ثانیه بعد از لمس می‌دهد؛ ساخت تصویر آهسته باعث خطا می‌شد).
    var jobs = {}, ready = {}, img0 = null, preT, mounted;
    function getFull() {
      if (!fullP) { var url = imgs[sel]; fullP = toObjUrl(url, 1600).then(function (u) { if (/^blob:/.test(u)) urls.push(u); return u; }); }
      return fullP;
    }
    function getBlob(i) {
      if (jobs[i]) return jobs[i];
      var my = tok;
      jobs[i] = Promise.all([h2cLib(), getFull()]).then(function (r) { return render(i, d, r[1]); }).then(function (b) { if (my === tok) ready[i] = b; return b; })
        .catch(function (e) { if (my === tok) delete jobs[i]; throw e; });
      return jobs[i];
    }
    function pre() {
      clearTimeout(preT); if (!img0) return;
      // ساخت تصویر سنگین است؛ فقط وقتی کاربر چند لحظه روی یک قالب بماند و مرورگر بیکار باشد
      preT = setTimeout(function () { (w.requestIdleCallback || function (f) { setTimeout(f, 200); })(function () { if (!m.isConnected) return; getBlob(idx).catch(function () {}); }, { timeout: 3000 }); }, 1800);
    }
    function fileOf(i, blob) { return new File([blob], 'carmaa-story-' + (i + 1) + '.png', { type: 'image/png' }); }
    function saveBlob(i, blob) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileOf(i, blob).name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }
    function sharePayload(i, blob) {
      var f = fileOf(i, blob), withText = { files: [f], text: 'مشاهده آگهی در ' + CFG.siteName + '\n' + linkUrl };
      try { if (navigator.canShare && navigator.canShare(withText)) return withText; } catch (_) {}
      return { files: [f] };
    }
    function trueShare(i, blob) {
      var f = fileOf(i, blob);
      if (navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share(sharePayload(i, blob)).then(function () { return true; });
      return Promise.resolve(false);
    }
    function make(act) {
      if (busy) return;
      var i = idx, t1 = b1.textContent, t2 = b2.textContent;
      // کپی خودکار لینک آگهی، همین لحظه‌ی لمس؛ اینستاگرام در استیکر لینک آن را پیشنهاد می‌دهد
      copyLink().then(function (ok) { toast(ok ? 'لینک آگهی کپی شد ✓  در استوری: استیکر لینک ← Paste' : 'کپی خودکار ممکن نشد؛ دکمه «کپی لینک» را بزنید'); });
      // قالب آماده است → همین لحظه (بدون await) اشتراک بگذار
      if (act === 'share' && ready[i] && navigator.canShare && navigator.canShare({ files: [fileOf(i, ready[i])] })) {
        navigator.share(sharePayload(i, ready[i])).catch(function (e) { if (e && e.name !== 'AbortError') { saveBlob(i, ready[i]); } });
        return;
      }
      busy = true; b1.disabled = b2.disabled = true; ths.forEach(function (t) { t.disabled = true; }); (act === 'share' ? b1 : b2).textContent = 'در حال ساخت تصویر…';
      return getBlob(i).then(function (blob) {
        if (act === 'share') {
          return trueShare(i, blob).then(function (ok) { if (!ok) saveBlob(i, blob); }, function (e) {
            if (e && e.name === 'AbortError') return;
            if (e && e.name === 'NotAllowedError') { t1 = 'تصویر آماده است؛ دوباره بزنید'; return; } // لمس بعدی فوراً اشتراک می‌گذارد
            saveBlob(i, blob);
          });
        }
        saveBlob(i, blob);
      }).catch(function (e) { try { console.error('[CarmaaStoryShare]', e); } catch (_) {} alert('ساخت تصویر ناموفق بود. دوباره تلاش کنید.' + (e && e.message ? '\n(' + e.message + ')' : '')); })
        .then(function () { busy = false; ths.forEach(function (t) { t.disabled = false; }); b1.disabled = b2.disabled = false; b1.textContent = t1; b2.textContent = t2; });
    }
    b1.onclick = function () { make('share'); }; b2.onclick = function () { make('save'); };
    nm.textContent = 'در حال آماده‌سازی…'; layout();
    // انتخاب عکس بنر: وقتی آگهی بیش از یک عکس دارد، ردیف بندانگشتی نمایش داده می‌شود
    var pick = m.querySelector('.cms-pick'), pr = m.querySelector('.cms-pick-r'), ths = [];
    function setPick(k, loading) { ths.forEach(function (t, j) { t.classList.toggle('on', j === k); t.classList.toggle('ld', !!loading && j === k); t.setAttribute('aria-pressed', j === k ? 'true' : 'false'); }); }
    function useImage(k, first) {
      var my = ++tok; sel = k; fullP = null; setPick(k, !first);
      // پیش‌نمایش با عکس سبک (۸۰۰px)؛ عکس کامل فقط هنگام ساخت خروجی بارگذاری می‌شود
      return toObjUrl(imgs[k], 800).then(function (u) {
        if (!m.isConnected) { if (/^blob:/.test(u)) URL.revokeObjectURL(u); return; }
        if (/^blob:/.test(u)) urls.push(u);
        if (my !== tok) return; // کاربر عکس دیگری انتخاب کرده است
        imgP = u; jobs = {}; ready = {}; mounted = {}; clearTimeout(preT);
        boxes.forEach(function (bx) { bx.innerHTML = ''; });
        img0 = true; setPick(k, false); paint(); pre();
      });
    }
    if (imgs.length > 1) {
      pick.hidden = false;
      imgs.forEach(function (u, k) {
        var t = document.createElement('button'); t.type = 'button'; t.className = 'cms-th'; t.setAttribute('aria-label', 'عکس ' + fa(k + 1));
        t.style.backgroundImage = 'url("' + u.replace(/"/g, '%22') + '")';
        t.onclick = function () { if (busy || k === sel) return; useImage(k); };
        pr.appendChild(t); ths.push(t);
      });
      setPick(0, false);
    }
    Promise.all([qrLib().catch(function () { /* پیش‌نمایش حتی بدون QR نمایش داده شود */ }), imgs.length ? useImage(0, true) : Promise.resolve()]).then(function () {
      if (!m.isConnected) return;
      if (!imgs.length) { imgP = ''; img0 = true; paint(); pre(); }
      layout();
    });
    return { close: close };
  }

  function renderBlob(d, i) {
    ensureStyle(); d = d || {};
    var first = (Array.isArray(d.images) && d.images[0]) || d.image || '';
    return Promise.all([h2cLib(), qrLib().catch(function () {}), first ? toObjUrl(first, 1600) : Promise.resolve('')]).then(function (r) {
      return render(i || 0, d, r[2]).then(function (b) { if (/^blob:/.test(r[2])) { try { URL.revokeObjectURL(r[2]); } catch (_) {} } return b; });
    });
  }
  w.CarmaaStoryShare = { open: open, config: CFG, renderBlob: renderBlob };
})(window);
