#!/usr/bin/env bash
# ======================================================================
#  نصب «ادیتور دیزاین» + «ادیتور چیدمان» روی هر سایت
#  استفاده:
#     bash install-site-editors.sh /مسیر/ریشه/سایت  [گزینه‌ها]
#  گزینه‌ها:
#     --root  "main"            سلکتور CSS بخشی که چیدمان‌ش ویرایش شود (پیش‌فرض: خودکار)
#     --api   "/api/site-config" اگر بک‌اند ذخیره دارید (پیش‌فرض: ندارد → ثبت = دانلود فایل JSON)
#     --html  "index.html a.html" فقط همین صفحه‌ها (پیش‌فرض: همهٔ *.html همان پوشه)
#     --remove                  حذف کامل ادیتورها
#  بعد از نصب:  آدرس سایت + ?design=1  یا  ?layout=1
# ======================================================================
set -euo pipefail
SITE=""; ROOT=""; API=""; HTMLS=""; REMOVE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --root) ROOT="$2"; shift 2;;
    --api) API="$2"; shift 2;;
    --html) HTMLS="$2"; shift 2;;
    --remove) REMOVE=1; shift;;
    -h|--help) sed -n '2,15p' "$0"; exit 0;;
    *) SITE="$1"; shift;;
  esac
done
[ -n "$SITE" ] && [ -d "$SITE" ] || { echo "مسیر ریشهٔ سایت را بده:  bash $0 /var/www/html"; exit 1; }
cd "$SITE"
if [ -z "$HTMLS" ]; then HTMLS=$(ls -1 *.html 2>/dev/null | tr '\n' ' '); fi
[ -n "${HTMLS// /}" ] || { echo "هیچ فایل .html در $SITE پیدا نشد."; exit 1; }
TS=$(date +%Y%m%d-%H%M%S); V=$(date +%s)

if [ "$REMOVE" = 1 ]; then
  for f in $HTMLS; do
    [ -f "$f" ] || continue
    cp "$f" "$f.bak-editors-$TS"
    python3 - "$f" <<'PYRM'
import re,sys
p=sys.argv[1]; s=open(p,encoding="utf-8").read()
s=re.sub(r'\s*<!-- cm-editors:begin -->.*?<!-- cm-editors:end -->','',s,flags=re.S)
open(p,"w",encoding="utf-8").write(s)
PYRM
    echo ">> از $f حذف شد"
  done
  rm -f site-sync.js layout-editor.js design-inspector.js
  echo "✓ ادیتورها حذف شدند (بکاپ صفحه‌ها: *.bak-editors-$TS). فایل‌های layout-default.json / design-overrides.json دست‌نخورده ماند."
  exit 0
fi

command -v python3 >/dev/null || { echo "python3 لازم است (برای افزودن تگ‌ها به HTML)."; exit 1; }

[ -f site-sync.js ] && cp site-sync.js "site-sync.js.bak-editors-$TS"
cat > site-sync.js <<'CM_EOF_SITE_SYNC_JS'
/* Site Editors — همگام‌سازی چیدمان/دیزاین + بکاپ نسخه‌ها
 * دو حالت:
 *  ۱) بدون سرور (پیش‌فرض): «ثبت» = دانلود فایل JSON + نگه‌داشتن بکاپ روی همین دستگاه.
 *     فایل دانلودشده را کنار index.html آپلود کن:  layout-default.json  /  design-overrides.json
 *  ۲) با API:  window.CM_SYNC_API = "/api/site-config"  (GET /:kind ، GET /:kind/versions ،
 *     POST /:kind ، POST /:kind/versions/:id/activate ، DELETE /:kind/versions/:id)
 */
(function () {
  "use strict";
  if (window.CMSync) return;
  var API = window.CM_SYNC_API ? String(window.CM_SYNC_API).replace(/\/$/, "") : "";
  var TITLES = { layout: "چیدمان", design: "دیزاین" };
  var FILES = { layout: "layout-default.json", design: "design-overrides.json" };
  var KEEP = 30;

  function api(path, opt) {
    opt = opt || {};
    var h = { Accept: "application/json" };
    if (opt.body !== undefined) h["Content-Type"] = "application/json";
    return fetch(API + path, {
      method: opt.method || "GET", headers: h, credentials: "include", cache: "no-store",
      body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok) return j;
        var m = (j && j.error && j.error.message) || "خطا در ارتباط با سرور";
        if (r.status === 401) m = "برای ثبت روی سرور باید با حساب ادمین وارد شوی.";
        else if (r.status === 403) m = "این حساب ادمین نیست.";
        var e = new Error(m); e.status = r.status; throw e;
      });
    });
  }

  /* ---------- بکاپ محلی (حالت بدون سرور) ---------- */
  function bkKey(kind) { return "cm_sync_bk_" + kind; }
  function bkRead(kind) { try { var a = JSON.parse(localStorage.getItem(bkKey(kind)) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function bkWrite(kind, a) { try { localStorage.setItem(bkKey(kind), JSON.stringify(a.slice(0, KEEP))); } catch (e) {} }
  function bkAdd(kind, data) {
    var a = bkRead(kind), s = JSON.stringify(data);
    if (a[0] && JSON.stringify(a[0].data) === s) return;
    a.unshift({ id: Date.now().toString(36), t: new Date().toISOString(), data: data }); bkWrite(kind, a);
  }
  function download(name, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    /* داخل یک پوشش مخفی با کلاس cmsy-ov تا ادیتورها کلیکِ دانلود را به‌عنوان «کلیک روی صفحه» نگیرند */
    var w = document.createElement("div"); w.className = "cmsy-ov"; w.style.display = "none";
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    w.appendChild(a); document.body.appendChild(w); a.click(); w.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
  }

  function fetchStatic(url) {
    if (!url) return Promise.resolve(null);
    return fetch(url + "?_=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function load(kind, fallbackUrl) {
    if (!API) return fetchStatic(fallbackUrl);
    return api("/" + kind + "?_=" + Date.now()).then(function (j) { return j && j.data ? j.data : null; }, function () { return null; })
      .then(function (d) { return d || fetchStatic(fallbackUrl); });
  }
  function publish(kind, data) {
    if (API) return api("/" + kind, { method: "POST", body: { data: data } });
    bkAdd(kind, data); download(FILES[kind], data);
    return Promise.resolve({ unchanged: false, download: true, msg: "فایل «" + FILES[kind] + "» دانلود شد؛ آن را کنار index.html روی سایت آپلود کن تا برای همه فعال شود." });
  }

  function fmt(iso) {
    try { return new Date(iso).toLocaleString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (e) { return String(iso || ""); }
  }
  function kb(n) { return n > 1024 ? (n / 1024).toFixed(1) + " KB" : n + " B"; }
  function count(kind, d) { d = d || {}; return kind === "design" ? (d.rules || []).length : Object.keys(d.pages || {}).length; }

  var css = document.createElement("style");
  css.textContent =
    ".cmsy-ov{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;direction:rtl;font-family:Vazirmatn,system-ui,Tahoma,sans-serif}" +
    ".cmsy-box{width:min(560px,100%);max-height:82vh;display:flex;flex-direction:column;background:#111214;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:20px 20px 0 0;padding:14px 14px calc(env(safe-area-inset-bottom,0px) + 14px)}" +
    "@media(min-width:700px){.cmsy-ov{align-items:center}.cmsy-box{border-radius:20px}}" +
    ".cmsy-hd{display:flex;align-items:center;gap:8px;margin-bottom:6px}.cmsy-hd h4{flex:1;margin:0;font-size:15px}" +
    ".cmsy-sub{font-size:11px;color:#aeb2b8;margin-bottom:10px;line-height:1.7}" +
    ".cmsy-list{overflow:auto;flex:1;display:flex;flex-direction:column;gap:8px}" +
    ".cmsy-row{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:14px;background:#1c1d20;border:1px solid rgba(255,255,255,.1)}" +
    ".cmsy-row.live{border-color:#c8f31d;background:rgba(200,243,29,.07)}" +
    ".cmsy-inf{flex:1;min-width:0;font-size:12px;line-height:1.7}.cmsy-inf b{font-size:13px}.cmsy-inf small{display:block;color:#8c9097;font-size:11px}" +
    ".cmsy-tag{display:inline-block;margin-inline-start:6px;padding:1px 8px;border-radius:99px;background:#c8f31d;color:#111;font-size:10px;font-weight:800}" +
    ".cmsy-b{height:34px;padding:0 12px;border-radius:11px;border:1px solid rgba(255,255,255,.16);background:#26272b;color:#fff;font-size:12px;font-weight:700;font-family:inherit;white-space:nowrap}" +
    ".cmsy-b.pri{background:#c8f31d;color:#111;border-color:#c8f31d}.cmsy-b.dng{color:#ff6b6b}.cmsy-b[disabled]{opacity:.5}" +
    ".cmsy-empty{padding:26px 8px;text-align:center;color:#8c9097;font-size:12px}.cmsy-msg{min-height:16px;margin-top:8px;text-align:center;font-size:11px;color:#c8f31d}";
  document.head.appendChild(css);

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function b(txt, cls, fn) { var x = el("button", "cmsy-b" + (cls ? " " + cls : ""), txt); x.type = "button"; x.addEventListener("click", fn); return x; }

  function panel(kind, opts) {
    opts = opts || {};
    if (document.querySelector(".cmsy-ov")) return;
    var ov = el("div", "cmsy-ov"), box = el("div", "cmsy-box"), hd = el("div", "cmsy-hd"), list = el("div", "cmsy-list"), msg = el("div", "cmsy-msg");
    hd.appendChild(el("h4", "", "بکاپ‌های " + TITLES[kind]));
    hd.appendChild(b("✕", "", close));
    box.appendChild(hd);
    box.appendChild(el("div", "cmsy-sub", API
      ? "هر بار که «ثبت» بزنی یک نسخهٔ جدید ساخته می‌شود و نسخه‌های قبلی همین‌جا می‌مانند. با «سوییچ» هر نسخه را برای همهٔ کاربران فعال کن."
      : "بکاپ‌ها فقط روی همین دستگاه/مرورگر نگه‌داری می‌شوند (هر بار «ثبت» = یک نسخه). «سوییچ» نسخه را روی همین دستگاه اعمال می‌کند؛ برای همه، بعدش دوباره «ثبت» بزن و فایل را آپلود کن."));
    box.appendChild(list); box.appendChild(msg); ov.appendChild(box); document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    function close() { ov.remove(); }
    function say(t) { msg.textContent = t || ""; }

    function render(items) {
      list.textContent = "";
      if (!items.length) { list.appendChild(el("div", "cmsy-empty", "هنوز نسخه‌ای ثبت نشده. اول «ثبت» را بزن.")); return; }
      items.forEach(function (v, i) {
        var row = el("div", "cmsy-row" + (v.live ? " live" : "")), inf = el("div", "cmsy-inf"), t = el("b", "", fmt(v.createdAt));
        if (v.live) t.appendChild(el("span", "cmsy-tag", "فعال"));
        inf.appendChild(t);
        inf.appendChild(el("small", "", "نسخهٔ " + (items.length - i) + " · " + (kind === "design" ? v.items + " قانون" : v.items + " صفحه") + " · " + kb(v.bytes) + (v.by ? " · " + v.by : "")));
        row.appendChild(inf);
        if (!v.live) {
          row.appendChild(b("سوییچ", "pri", function () {
            if (!confirm(API ? "این نسخه برای همهٔ کاربران فعال شود؟ (نسخهٔ فعلی به‌عنوان بکاپ می‌ماند)" : "این نسخه روی همین دستگاه اعمال شود؟")) return;
            if (API) {
              say("در حال سوییچ…");
              api("/" + kind + "/versions/" + v.id + "/activate", { method: "POST" }).then(function (r) {
                say("نسخه فعال شد ✓"); if (opts.onRestored) opts.onRestored(r.data, false); refresh();
              }, function (e) { say(e.message); });
            } else {
              var it = bkRead(kind).filter(function (x) { return x.id === v.id; })[0];
              if (!it) { say("نسخه پیدا نشد"); return; }
              say("اعمال شد ✓"); if (opts.onRestored) opts.onRestored(it.data, true);
            }
          }));
          row.appendChild(b("🗑", "dng", function () {
            if (!confirm("این بکاپ برای همیشه حذف شود؟")) return;
            if (API) api("/" + kind + "/versions/" + v.id, { method: "DELETE" }).then(function () { say("حذف شد"); refresh(); }, function (e) { say(e.message); });
            else { bkWrite(kind, bkRead(kind).filter(function (x) { return x.id !== v.id; })); say("حذف شد"); refresh(); }
          }));
        }
        list.appendChild(row);
      });
    }
    function refresh() {
      if (!API) {
        render(bkRead(kind).map(function (x) { return { id: x.id, createdAt: x.t, live: false, items: count(kind, x.data), bytes: JSON.stringify(x.data).length, by: "" }; }));
        return;
      }
      api("/" + kind + "/versions").then(function (j) { render(j.items || []); }, function (e) { list.textContent = ""; list.appendChild(el("div", "cmsy-empty", e.message)); });
    }
    list.appendChild(el("div", "cmsy-empty", "در حال بارگذاری…"));
    refresh();
  }

  window.CMSync = { load: load, publish: publish, panel: panel, api: api, mode: API ? "api" : "static" };
})();
CM_EOF_SITE_SYNC_JS
echo ">> نوشته شد: site-sync.js"

[ -f layout-editor.js ] && cp layout-editor.js "layout-editor.js.bak-editors-$TS"
cat > layout-editor.js <<'CM_EOF_LAYOUT_EDITOR_JS'
(function () {
  if (window.__cmLayEd) return; window.__cmLayEd = 1;
  var LS = "cm_layout_v1", LS2 = "cm_layout_v2", ADM = "cm_layout_admin", LSU = "cm_layout_ui";
  var base = (document.currentScript && document.currentScript.src || "").replace(/layout-editor\.js.*$/, "");
  try {
    if (/[?&]layout=1\b/.test(location.search)) localStorage.setItem(ADM, "1");
    if (/[?&]layout=0\b/.test(location.search)) localStorage.removeItem(ADM);
  } catch (e) {}
  function isAdmin() { try { return localStorage.getItem(ADM) === "1"; } catch (e) { return false; } }
  var serverAll = null, loaded = false, editing = false, page = null, pend = 0, sel = null, pageKey = null, curRoute = null, drill = [];
  var touched = false, hist = [], hi = -1, histT = 0;
  var ui = { dock: "bottom", collapsed: false, tab: "list", tools: false }, lastTab = "";
  try { var u0 = JSON.parse(localStorage.getItem(LSU) || "null"); if (u0 && u0.dock === "top") ui.dock = "top"; } catch (e) {}
  function saveUI() { try { localStorage.setItem(LSU, JSON.stringify({ dock: ui.dock })); } catch (e) {} }
  var S = { order: [], hidden: [], styles: {}, custom: [] };
  var NAMES = { "cm-home-search-wrap": "جستجو", "cm-hb": "بنر", "cm-home-latest": "تازه‌ترین آگهی‌ها", "cm-lay-section--showrooms": "نمایشگاه‌ها", "cm-lay-section--news": "اخبار", "cm-home-brand-marquee": "برندها", "cm-ft": "فوتر" };
  var TYPES = {
    box: { n: "باکس خالی (blank)", st: { h: 120, bg: "#1c1d20", r: 18 } },
    space: { n: "فاصلهٔ خالی", st: { h: 40 } },
    text: { n: "متن", st: { p: 12 }, d: { text: "متن جدید", fs: 16, tc: "#ffffff", al: "right" } },
    image: { n: "عکس", st: { h: 180, r: 16 }, d: { src: "" } },
    button: { n: "دکمه / لینک", st: { p: 6 }, d: { text: "دکمه", href: "", al: "center" } },
    line: { n: "خط جداکننده", st: { mt: 8, mb: 8 } }
  };
  var COLORS = ["", "#c8f31d", "#111214", "#1c1d20", "#ffffff", "#ff4d4d", "#3b82f6", "#f59e0b"];

  /* ---------- استایل خود صفحه (حالت ویرایش) — پنل جدا در Shadow DOM است ---------- */
  var st = document.createElement("style");
  st.textContent = `
  .cm-lay-hidden{display:none!important}
  .cm-lay-flex{display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;align-items:flex-start!important;align-content:flex-start!important}
  .cm-lay-flex>[data-lay-key]{flex:0 0 100%;max-width:100%;box-sizing:border-box}
  .cm-lay-edit>[data-lay-key]{position:relative;outline:2px dashed rgba(200,243,29,.65);outline-offset:-2px;border-radius:14px;margin-block:8px}
  .cm-lay-edit>[data-lay-key]>*:not(.cm-lay-tools):not(.cm-lay-rs){pointer-events:none}
  .cm-lay-edit>.cm-lay-hidden{display:block!important;opacity:.35}
  .cm-lay-edit>.cm-lay-flex{display:flex!important}
  .cm-lay-edit>.cm-lay-sel,.cm-lay-edit>[data-lay-key].cm-lay-sel{outline:3px solid #c8f31d}
  .cm-lay-tools{position:absolute;top:6px;inset-inline-start:6px;z-index:40;display:flex;gap:6px;pointer-events:auto!important}
  .cm-lay-tools button{width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:#111214;color:#c8f31d;font-size:17px;line-height:1;padding:0;display:grid;place-items:center}
  .cm-lay-drag{touch-action:none;cursor:grab}
  .cm-lay-edit>.cm-lay-dragging{z-index:60;box-shadow:0 18px 40px rgba(0,0,0,.6);opacity:.95}
  .cm-lay-rs{position:absolute;z-index:45;touch-action:none;display:grid;place-items:center;pointer-events:auto!important}
  .cm-lay-rs i{display:block;background:#c8f31d;border-radius:99px;box-shadow:0 0 0 3px rgba(0,0,0,.45)}
  .cm-lay-rs-h{left:50%;bottom:2px;transform:translateX(-50%);width:90px;height:30px}
  .cm-lay-rs-h i{width:46px;height:6px}
  .cm-lay-rs-w{inset-inline-end:2px;top:50%;transform:translateY(-50%);width:30px;height:90px}
  .cm-lay-rs-w i{width:6px;height:46px}
  .cm-lay-custom{box-sizing:border-box}
  .cm-lc-text{white-space:pre-wrap;line-height:1.7}
  .cm-lc-btn{display:inline-block;padding:11px 22px;border-radius:999px;background:#c8f31d;color:#111;font-weight:800;font-size:14px;text-decoration:none}
  .cm-lc-line{border:0;border-top:1px solid rgba(255,255,255,.18);margin:0}
  .cm-lc-ph{display:grid;place-items:center;height:100%;min-height:60px;color:#8c9097;font-size:12px}
  `;
  document.head.appendChild(st);

  /* ---------- استایل پنل (داخل Shadow DOM؛ با استایل سایت قاطی نمی‌شود) ---------- */
  var CSS_UI = [
    ":host{all:initial}",
    "*{box-sizing:border-box;font-family:Vazirmatn,Vazir,system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif}",
    "button{-webkit-tap-highlight-color:transparent}",
    ".fab{position:fixed;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 96px);height:44px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:#111214;color:#c8f31d;font-size:13px;font-weight:700;direction:rtl;box-shadow:0 8px 24px rgba(0,0,0,.5);cursor:pointer;z-index:2147483000}",
    ".toast{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 14px);transform:translateX(-50%);background:#111214;color:#c8f31d;border:1px solid rgba(200,243,29,.5);padding:9px 16px;border-radius:999px;font-size:12px;font-weight:700;direction:rtl;opacity:0;pointer-events:none;transition:opacity .2s;z-index:2147483001;max-width:92vw;text-align:center}",
    ".toast.show{opacity:1}",
    ".pn{position:fixed;left:0;right:0;bottom:0;margin:0 auto;width:min(100vw,560px);max-height:min(46vh,430px);max-height:min(46dvh,430px);display:flex;flex-direction:column;background:#131416;color:#fff;border:1px solid rgba(255,255,255,.14);border-bottom:0;border-radius:20px 20px 0 0;direction:rtl;box-shadow:0 -10px 40px rgba(0,0,0,.55);font-size:13px;z-index:2147483000}",
    ".pn.top{bottom:auto;top:0;border-radius:0 0 20px 20px;border:1px solid rgba(255,255,255,.14);border-top:0;box-shadow:0 10px 40px rgba(0,0,0,.55);padding-top:env(safe-area-inset-top,0px)}",
    ".pn.min .bd,.pn.min .tabs,.pn.min .tgt,.pn.min .msg{display:none}",
    ".hd{display:flex;align-items:center;gap:6px;padding:10px 12px 8px;flex:0 0 auto}",
    ".hd h4{margin:0;flex:1;min-width:0;font-size:13px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}",
    ".ib{min-width:34px;height:34px;padding:0 10px;border-radius:11px;border:1px solid rgba(255,255,255,.14);background:#1f2023;color:#fff;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex:0 0 auto}",
    ".ib:disabled{opacity:.3}.ib.on{background:#c8f31d;color:#111;border-color:#c8f31d}.ib.dng{color:#ff7a7a}.ib.sm{min-width:30px;height:30px;padding:0 6px}",
    ".tgt{display:flex;align-items:center;gap:6px;padding:0 12px 8px;flex:0 0 auto;overflow-x:auto;scrollbar-width:none}",
    ".tgt::-webkit-scrollbar{display:none}",
    ".tabs{display:flex;gap:2px;padding:0 12px;flex:0 0 auto;border-bottom:1px solid rgba(255,255,255,.1)}",
    ".tb{flex:1;height:36px;border:0;border-bottom:2px solid transparent;background:transparent;color:#8c9097;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap}",
    ".tb.on{color:#c8f31d;border-bottom-color:#c8f31d}",
    ".bd{overflow:auto;padding:12px;flex:1 1 auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;min-height:80px}",
    ".msg{color:#c8f31d;font-size:11.5px;text-align:center}.msg:not(:empty){padding:5px 14px}",
    ".act{display:flex;gap:6px;padding:8px 12px calc(env(safe-area-inset-bottom,0px) + 10px);flex:0 0 auto;border-top:1px solid rgba(255,255,255,.1);background:#131416;border-radius:inherit}",
    ".pn.top .act{padding-bottom:10px}",
    ".ab{flex:1 1 0;height:42px;border-radius:13px;border:1px solid rgba(255,255,255,.14);background:#1f2023;color:#fff;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap}",
    ".ab.pri{flex:2 1 0;background:#c8f31d;color:#111;border-color:#c8f31d;font-size:13.5px}",
    "input[type=text],textarea{background:#1f2023;border:1px solid rgba(255,255,255,.14);border-radius:10px;color:#fff;padding:0 9px;height:34px;font-size:13px;min-width:0;flex:1}",
    "textarea{height:74px;padding:8px;resize:none}",
    ".sec{margin:0 0 14px}.sec>h5{margin:0 0 4px;font-size:11.5px;color:#8c9097;font-weight:700}",
    ".chips{display:flex;gap:6px;flex-wrap:wrap;flex:1}",
    ".ch{min-width:42px;height:32px;padding:0 10px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:#1f2023;color:#fff;font-size:12px;cursor:pointer}",
    ".ch.on{background:#c8f31d;color:#111;border-color:#c8f31d}",
    ".sw{width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.25);padding:0;cursor:pointer}",
    ".sw.none{background:repeating-linear-gradient(45deg,#333 0 4px,#111 4px 8px)}",
    ".sw.on{border-color:#c8f31d;box-shadow:0 0 0 2px #131416 inset}",
    ".hint{color:#8c9097;font-size:11px;margin-top:4px;line-height:1.7}",
    ".rw{display:flex;align-items:center;gap:8px;margin:9px 0}",
    ".rw>label{flex:0 0 78px;color:#c7cacf;font-size:12px}",
    ".rw .ctl{flex:1;display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}",
    ".rw input[type=range]{flex:1 1 90px;min-width:70px;accent-color:#c8f31d;direction:ltr;height:28px}",
    ".rw output{flex:0 0 48px;text-align:left;direction:ltr;color:#c8f31d;font-size:11px}",
    ".rw .x{width:24px;height:24px;border-radius:50%;border:1px solid rgba(255,255,255,.12);background:transparent;color:#555;cursor:pointer;flex:0 0 auto;padding:0;font-size:11px}",
    ".rw.set>label{color:#c8f31d;font-weight:700}.rw.set .x{color:#c8f31d;border-color:#c8f31d}",
    ".li{display:flex;align-items:center;gap:5px;padding:5px 8px;margin:0 0 6px;border-radius:12px;background:#1b1c1f;border:1px solid rgba(255,255,255,.08)}",
    ".li.on{border-color:#c8f31d;background:rgba(200,243,29,.1)}.li.hid .nm{opacity:.45;text-decoration:line-through}",
    ".li .nm{flex:1;min-width:0;font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;padding:6px 2px}",
    ".li small{color:#8c9097;font-size:10px;white-space:nowrap}",
    ".grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.grid .ib{height:46px}",
    "details{margin:10px 0 0;border:1px solid rgba(255,255,255,.1);border-radius:13px;background:#18191c}",
    "summary{padding:11px 13px;font-weight:700;font-size:12.5px;cursor:pointer;color:#e6e8ea;list-style:none}",
    "summary::-webkit-details-marker{display:none}",
    "details>div{padding:2px 13px 12px}",
    ".empty{padding:22px 10px;text-align:center;color:#9aa0a6;line-height:2;font-size:12.5px}"
  ].join("");

  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }
  function h(tag, a, kids) {
    var e = document.createElement(tag); a = a || {};
    for (var k in a) {
      if (k === "c") e.className = a[k]; else if (k === "t") e.textContent = a[k];
      else if (k.indexOf("on") === 0) e.addEventListener(k.slice(2), a[k]); else e.setAttribute(k, a[k]);
    }
    (kids || []).forEach(function (x) { if (x) e.appendChild(x); });
    return e;
  }
  function ib(t, title, fn, dis, extra) {
    var e = h("button", { c: "ib" + (extra ? " " + extra : ""), type: "button", t: t, title: title || "" });
    e.addEventListener("click", fn); if (dis) e.disabled = true; return e;
  }

  /* ---------- ذخیره‌سازی چندصفحه‌ای: { v:3, pages: { "<صفحه>[:<مسیر بخش داخلی>]": {order,hidden,styles,custom} } } ---------- */
  function readAll() {
    try { var j = JSON.parse(localStorage.getItem(LS2) || "null"); if (j && j.pages) return j; } catch (e) {}
    try { var o = JSON.parse(localStorage.getItem(LS) || "null"); if (o && Array.isArray(o.order)) return { v: 3, pages: { home: o } }; } catch (e) {}
    return null;
  }
  function writeAll(a) { try { localStorage.setItem(LS2, JSON.stringify(a)); } catch (e) {} }
  function active() {
    var l = readAll(), k = pageKey;
    return (l && l.pages[k]) || (serverAll && serverAll.pages && serverAll.pages[k]) || {};
  }
  function okUrl(u) { return typeof u === "string" && /^(https?:\/\/|\/|#|tel:|mailto:)/i.test(u.trim()); }
  function key(b) { return b.getAttribute("data-lay-key"); }
  var UTIL = /^(flex|grid|inline|block|hidden|relative|absolute|fixed|sticky|container|truncate|overflow|items-|justify-|gap-|space-|font-|text-|bg-|border|rounded|shadow|opacity|z-|top-|left-|right-|bottom-|self-|order-|col-|row-|aspect|object-|cursor|select-|pointer|transition|duration|ease|backdrop|blur|from-|to-|via-|min-|max-|w-|h-|size-|p[trblxy]?-|m[trblxy]?-|px|py|mx|my)/;
  function keyOf(el) {
    if (key(el)) return key(el);
    var cm = [].filter.call(el.classList, function (c) { return /^cm-/.test(c) && !/^cm-lay-(edit|hidden|dragging|sel|flex|custom|c-|tools|rs|drag)/.test(c); });
    var cl = cm.length ? cm : [].filter.call(el.classList, function (c) { return !/^cm-lay-/.test(c) && !/[\[\]:\/]/.test(c) && !UTIL.test(c); });
    var m = cl.filter(function (c) { return c.indexOf("--") > -1; })[0];
    return m || cl[0] || (el.tagName.toLowerCase() + "@" + [].indexOf.call(el.parentNode.children, el));
  }
  var SKIPTAG = /^(SCRIPT|STYLE|LINK|NOSCRIPT|TEMPLATE|META)$/;
  function isBlock(e) { return e.nodeType === 1 && !SKIPTAG.test(e.tagName) && e.id !== "cm-layout-ui" && e.id !== "cm-design-inspector" && !e.classList.contains("cmsy-ov") && !e.classList.contains("cm-lay-tools") && !e.classList.contains("cm-lay-rs"); }
  function assignKeys(cont) {
    var used = {}, list = [].filter.call(cont.children, isBlock);
    list.forEach(function (b) { if (key(b)) used[key(b)] = 1; });
    list.forEach(function (b) {
      if (key(b)) return;
      var k = keyOf(b), base = k, i = 2; while (used[k]) k = base + "~" + (i++);
      used[k] = 1; b.setAttribute("data-lay-key", k);
    });
    return list;
  }
  function routePage() { try { if (typeof state !== "undefined" && state.route && state.route.page) return String(state.route.page); } catch (e) {} return (location.pathname || "/") + String(location.hash || "").split("?")[0]; }
  /* ریشهٔ محتوای صفحه: window.CM_EDITOR_ROOT (سلکتور CSS) یا خودکار */
  function rootEl() {
    var sl = window.CM_EDITOR_ROOT, el = null;
    try { if (sl) el = document.querySelector(sl); } catch (e) {}
    return el || document.getElementById("pageContent") || document.querySelector("main") || document.getElementById("app") || document.getElementById("root") || document.body;
  }
  function pageRoot() {
    var pc = rootEl(), r = pc && (pc.id === "pageContent" ? pc.firstElementChild : pc); if (!r) return null;
    for (var n = 0; n < 3; n++) { var kids = [].filter.call(r.children, isBlock); if (kids.length !== 1 || kids[0].children.length < 1) break; r = kids[0]; }
    return r;
  }
  function resolveContainer() {
    var r = pageRoot(); if (!r) return null;
    for (var i = 0; i < drill.length; i++) {
      assignKeys(r);
      var nx = [].filter.call(r.children, function (e) { return e.getAttribute && e.getAttribute("data-lay-key") === drill[i]; })[0];
      if (!nx) { drill = drill.slice(0, i); break; } r = nx;
    }
    return r;
  }
  function autoName(b) {
    var hh = b.querySelector && b.querySelector("h1,h2,h3,h4,legend,[class*=title],[class*=head]");
    var t = hh && hh.textContent ? hh.textContent.replace(/\s+/g, " ").trim() : "";
    return t && t.length < 40 ? t : (t ? t.slice(0, 22) + "…" : "");
  }
  function blocks() { return [].filter.call(page.children, isBlock); }
  function getC(k) { for (var i = 0; i < S.custom.length; i++) if ("c:" + S.custom[i].id === k) return S.custom[i]; return null; }
  function sty(k) { return S.styles[k] || (S.styles[k] = {}); }
  function labelOf(b) { var k = key(b), c = getC(k); return c ? TYPES[c.type].n : (NAMES[k] || autoName(b) || k); }
  function nameOf(b) {
    var c = getC(key(b));
    if (c && c.type === "text") return "متن: " + String(c.text || "").replace(/\s+/g, " ").slice(0, 16);
    if (c && c.type === "button") return "دکمه: " + String(c.text || "").slice(0, 16);
    return labelOf(b);
  }

  function fillCustom(el, c) {
    el.textContent = ""; var t = c.type;
    if (t === "text") {
      var d = mk("div", "cm-lc-text"); d.textContent = c.text || ""; d.style.fontSize = (c.fs || 16) + "px"; d.style.color = c.tc || "#fff"; d.style.textAlign = c.al || "right"; el.appendChild(d);
    } else if (t === "image") {
      if (okUrl(c.src)) { var im = new Image(); im.src = c.src; im.alt = ""; im.style.cssText = "width:100%;height:100%;object-fit:cover;display:block"; el.appendChild(im); }
      else el.appendChild(mk("div", "cm-lc-ph", "آدرس عکس را در تنظیمات بگذار"));
    } else if (t === "button") {
      var ok = okUrl(c.href), a = mk(ok ? "a" : "span", "cm-lc-btn"); a.textContent = c.text || "دکمه";
      if (ok) { a.href = c.href; if (/^https?:/i.test(c.href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; } }
      el.style.textAlign = c.al || "center"; el.appendChild(a);
    } else if (t === "line") { el.appendChild(mk("hr", "cm-lc-line")); }
  }
  function renderCustom(c) {
    var el = mk("div", "cm-lay-custom cm-lay-c-" + c.type); el.setAttribute("data-lay-key", "c:" + c.id); fillCustom(el, c); return el;
  }
  function refreshCustom(b) {
    var c = getC(key(b)); if (!c) return; fillCustom(b, c);
    if (editing) { addTools(b); if (sel === b) showHandles(b); }
  }

  function applyStyle(b) {
    var k = key(b), s = S.styles[k] || {}, cu = k.indexOf("c:") === 0, x = b.style;
    x.minHeight = (!cu && s.h) ? s.h + "px" : "";
    x.height = (cu && s.h) ? s.h + "px" : "";
    x.zoom = (s.z && s.z !== 100) ? String(s.z / 100) : "";
    x.marginTop = s.mt != null ? s.mt + "px" : "";
    x.marginBottom = s.mb != null ? s.mb + "px" : "";
    x.background = s.bg || "";
    x.borderRadius = s.r != null ? s.r + "px" : "";
    x.padding = s.p != null ? s.p + "px" : "";
    x.overflow = (cu || s.r) ? "hidden" : "";
    x.boxSizing = (cu || s.p != null || s.h) ? "border-box" : "";
    if (s.w && s.w < 100) { x.flex = "0 0 " + s.w + "%"; x.maxWidth = s.w + "%"; } else { x.flex = ""; x.maxWidth = ""; }
  }
  function refreshFlex() {
    var any = Object.keys(S.styles).some(function (k) { var w = S.styles[k].w; return w && w < 100; });
    page.classList.toggle("cm-lay-flex", any);
  }
  function curState() {
    var bl = blocks();
    return { order: bl.map(key), hidden: bl.filter(function (b) { return b.classList.contains("cm-lay-hidden"); }).map(key), styles: S.styles, custom: S.custom };
  }
  function persist() {
    var cs = curState();
    S.order = cs.order; S.hidden = cs.hidden; S.v = 2; touched = true;
    var all = readAll() || { v: 3, pages: {} }; all.v = 3; all.pages[pageKey] = S; writeAll(all);
    pushHist(); updHead();
    return all;
  }
  function apply() {
    var c = active();
    S = JSON.parse(JSON.stringify({ order: c.order || [], hidden: c.hidden || [], styles: c.styles || {}, custom: c.custom || [] }));
    S.custom.forEach(function (cu) { if (!page.querySelector('[data-lay-key="c:' + cu.id + '"]')) page.appendChild(renderCustom(cu)); });
    var bl = assignKeys(page);
    page.__layN = page.children.length;
    bl.forEach(function (b) { var k = key(b); b.classList.toggle("cm-lay-hidden", S.hidden.indexOf(k) > -1); applyStyle(b); });
    if (S.order.length) {
      var idx = function (b) { var i = S.order.indexOf(key(b)); return i < 0 ? 1e6 + bl.indexOf(b) : i; };
      var sorted = bl.slice().sort(function (a, b) { return idx(a) - idx(b); });
      if (!sorted.every(function (b, i) { return b === bl[i]; })) sorted.forEach(function (b) { page.appendChild(b); });
    }
    refreshFlex();
  }

  /* ---------- تاریخچهٔ بازگردانی ---------- */
  function snap() { return JSON.stringify(curState()); }
  function commitHist() { histT = 0; var s = snap(); if (hist[hi] === s) return; hist = hist.slice(0, hi + 1); hist.push(s); if (hist.length > 60) hist.shift(); hi = hist.length - 1; updHead(); }
  function pushHist() { clearTimeout(histT); histT = setTimeout(commitHist, 400); }
  function flushHist() { if (histT) { clearTimeout(histT); commitHist(); } }
  function restore(str) {
    var o = JSON.parse(str);
    if (sel) { sel.classList.remove("cm-lay-sel"); clearHandles(sel); sel = null; }
    var all = readAll() || { v: 3, pages: {} }; all.v = 3; all.pages[pageKey] = { v: 2, order: o.order, hidden: o.hidden, styles: o.styles, custom: o.custom }; writeAll(all);
    [].filter.call(page.children, function (e) { return e.classList && e.classList.contains("cm-lay-custom"); }).forEach(function (e) { e.remove(); });
    apply(); blocks().forEach(addTools);
  }
  function undo(dir) {
    flushHist();
    var n = hi + dir; if (n < 0 || n >= hist.length) return;
    hi = n; restore(hist[hi]); touched = true; ui.tab = "list"; render();
  }

  /* ---------- drag to reorder ---------- */
  function startDrag(e, b) {
    e.preventDefault(); e.stopPropagation();
    var hd = e.currentTarget; try { hd.setPointerCapture(e.pointerId); } catch (_) {}
    var grab = e.clientY - b.getBoundingClientRect().top, y = e.clientY, on = true;
    var z = ((sty(key(b)).z) || 100) / 100;
    b.classList.add("cm-lay-dragging"); if ($.pn) $.pn.style.visibility = "hidden";
    function place() {
      b.style.transform = "";
      var nat = b.getBoundingClientRect();
      var cy = y - grab + nat.height / 2, ref = null, sib = blocks().filter(function (x) { return x !== b; });
      for (var i = 0; i < sib.length; i++) { var s = sib[i].getBoundingClientRect(); if (s.top + s.height / 2 > cy) { ref = sib[i]; break; } }
      if (ref !== b.nextElementSibling) { if (ref) page.insertBefore(b, ref); else page.appendChild(b); nat = b.getBoundingClientRect(); }
      b.style.transform = "translateY(" + ((y - grab - nat.top) / z) + "px)";
    }
    function tick() {
      if (!on) return;
      if (y < 90) window.scrollBy(0, -14); else if (y > innerHeight - 90) window.scrollBy(0, 14);
      place(); requestAnimationFrame(tick);
    }
    function mv(ev) { y = ev.clientY; }
    function up() {
      on = false; hd.removeEventListener("pointermove", mv); hd.removeEventListener("pointerup", up); hd.removeEventListener("pointercancel", up);
      b.style.transform = ""; b.classList.remove("cm-lay-dragging"); if ($.pn) $.pn.style.visibility = ""; persist(); render();
    }
    hd.addEventListener("pointermove", mv); hd.addEventListener("pointerup", up); hd.addEventListener("pointercancel", up);
    tick();
  }

  /* ---------- drag to resize ---------- */
  function resizeH(e, b) {
    e.preventDefault(); e.stopPropagation();
    var hd = e.currentTarget; try { hd.setPointerCapture(e.pointerId); } catch (_) {}
    var s = sty(key(b)), z = (s.z || 100) / 100, y0 = e.clientY, h0 = b.getBoundingClientRect().height / z;
    function mv(ev) { var v = Math.round((h0 + (ev.clientY - y0) / z) / 5) * 5; s.h = Math.max(20, Math.min(1500, v)); applyStyle(b); }
    function up() { hd.removeEventListener("pointermove", mv); hd.removeEventListener("pointerup", up); hd.removeEventListener("pointercancel", up); persist(); if (sel === b) render(); }
    hd.addEventListener("pointermove", mv); hd.addEventListener("pointerup", up); hd.addEventListener("pointercancel", up);
  }
  function resizeW(e, b) {
    e.preventDefault(); e.stopPropagation();
    var hd = e.currentTarget; try { hd.setPointerCapture(e.pointerId); } catch (_) {}
    var s = sty(key(b)), rtl = getComputedStyle(page).direction === "rtl";
    function mv(ev) {
      var pr = page.getBoundingClientRect(), r = b.getBoundingClientRect();
      var wpx = rtl ? r.right - ev.clientX : ev.clientX - r.left;
      var v = Math.round(wpx / pr.width * 100 / 5) * 5; s.w = Math.max(20, Math.min(100, v));
      applyStyle(b); refreshFlex();
    }
    function up() { hd.removeEventListener("pointermove", mv); hd.removeEventListener("pointerup", up); hd.removeEventListener("pointercancel", up); persist(); if (sel === b) render(); }
    hd.addEventListener("pointermove", mv); hd.addEventListener("pointerup", up); hd.addEventListener("pointercancel", up);
  }
  function clearHandles(b) { [].filter.call(b.children, function (x) { return x.classList && x.classList.contains("cm-lay-rs"); }).forEach(function (x) { x.remove(); }); }
  function showHandles(b) {
    clearHandles(b);
    var hh = mk("div", "cm-lay-rs cm-lay-rs-h", "<i></i>"), ww = mk("div", "cm-lay-rs cm-lay-rs-w", "<i></i>");
    b.appendChild(hh); b.appendChild(ww);
    hh.addEventListener("pointerdown", function (e) { resizeH(e, b); });
    ww.addEventListener("pointerdown", function (e) { resizeW(e, b); });
  }

  /* ---------- ابزار روی هر بخش ---------- */
  function addTools(b) {
    [].filter.call(b.children, function (x) { return x.classList && x.classList.contains("cm-lay-tools"); }).forEach(function (x) { x.remove(); });
    var t = mk("div", "cm-lay-tools", '<button type="button" class="cm-lay-drag" aria-label="جابجایی">⠿</button><button type="button" aria-label="نمایش یا مخفی">👁</button><button type="button" aria-label="تنظیمات">⚙</button>');
    b.appendChild(t);
    t.children[0].addEventListener("pointerdown", function (e) { startDrag(e, b); });
    t.children[1].addEventListener("click", function (e) { e.stopPropagation(); toggleHide(b); });
    t.children[2].addEventListener("click", function (e) { e.stopPropagation(); select(b); });
  }

  /* ============================================================
   *  پنل جدا (Shadow DOM) — پایین یا بالای صفحه، قابل کوچک‌شدن
   * ============================================================ */
  var $ = {};
  var host = mk("div"); host.id = "cm-layout-ui";
  host.style.cssText = "all:initial;position:fixed;z-index:2147483000;left:0;top:0;width:0;height:0;direction:rtl";
  var root = host.attachShadow({ mode: "open" });
  root.appendChild(h("style", { t: CSS_UI }));
  $.fab = h("button", { c: "fab", type: "button", t: "✎ چیدمان", onclick: function () { enter(); } });
  $.toast = h("div", { c: "toast" });
  $.pn = h("div", { c: "pn" });
  $.fab.style.display = "none"; $.pn.style.display = "none";

  $.title = h("h4", { t: "ویرایشگر چیدمان", title: "لمس = کوچک/بزرگ کردن پنل", onclick: function () { ui.collapsed = !ui.collapsed; layoutPanel(); } });
  $.bUn = ib("↶", "بازگردانی", function () { undo(-1); });
  $.bRe = ib("↷", "جلو", function () { undo(1); });
  $.bDock = ib("⇅", "پنل بالا/پایین", function () { ui.dock = ui.dock === "top" ? "bottom" : "top"; saveUI(); layoutPanel(); });
  $.bMin = ib("▾", "کوچک/بزرگ کردن پنل", function () { ui.collapsed = !ui.collapsed; layoutPanel(); });
  var hd = h("div", { c: "hd" }, [$.title, $.bUn, $.bRe, $.bDock, $.bMin]);
  $.tgt = h("div", { c: "tgt" });
  $.tabs = h("div", { c: "tabs" });
  $.bd = h("div", { c: "bd" });
  $.msg = h("div", { c: "msg" });
  $.bPub = h("button", { c: "ab pri", type: "button", t: "⬆ ثبت در سرور", onclick: function () { doPublish(); } });
  $.bBak = h("button", { c: "ab", type: "button", t: "🕘 بکاپ‌ها", onclick: function () { doBackups(); } });
  $.bDone = h("button", { c: "ab", type: "button", t: "✓ پایان", onclick: function () { exit(); flash("ذخیره شد (فقط روی همین دستگاه). برای همه: «ثبت در سرور»"); init(); } });
  var act = h("div", { c: "act" }, [$.bPub, $.bBak, $.bDone]);
  [hd, $.tgt, $.tabs, $.bd, $.msg, act].forEach(function (x) { $.pn.appendChild(x); });
  root.appendChild($.fab); root.appendChild($.toast); root.appendChild($.pn);
  ["click", "pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend", "keydown", "keyup", "wheel"].forEach(function (ev) {
    host.addEventListener(ev, function (e) { e.stopPropagation(); }, false);
  });
  document.body.appendChild(host);

  function say(t) { $.msg.textContent = t || ""; clearTimeout(say.t); if (t) say.t = setTimeout(function () { $.msg.textContent = ""; }, 3800); }
  function flash(t) { $.toast.textContent = t; $.toast.classList.add("show"); clearTimeout(flash.t); flash.t = setTimeout(function () { $.toast.classList.remove("show"); }, 3200); }

  /* جا باز کردن برای پنل تا روی صفحه را نپوشاند */
  var padBase = null;
  function pad() {
    var bs = document.body.style;
    if (!editing) { if (padBase) { bs.paddingTop = padBase.t; bs.paddingBottom = padBase.b; padBase = null; } return; }
    if (!padBase) { var cs = getComputedStyle(document.body); padBase = { t: bs.paddingTop, b: bs.paddingBottom, nt: parseFloat(cs.paddingTop) || 0, nb: parseFloat(cs.paddingBottom) || 0 }; }
    var hgt = Math.ceil($.pn.getBoundingClientRect().height) + 10;
    if (ui.dock === "top") { bs.paddingTop = (padBase.nt + hgt) + "px"; bs.paddingBottom = padBase.b; }
    else { bs.paddingBottom = (padBase.nb + hgt) + "px"; bs.paddingTop = padBase.t; }
  }
  if (window.ResizeObserver) new ResizeObserver(function () { pad(); }).observe($.pn);
  function layoutPanel() {
    $.pn.classList.toggle("top", ui.dock === "top");
    $.pn.classList.toggle("min", !!ui.collapsed);
    $.bMin.textContent = ui.collapsed ? "▴" : "▾";
    pad();
  }
  function reveal(b) {
    requestAnimationFrame(function () {
      pad();
      var r = b.getBoundingClientRect(), pr = $.pn.getBoundingClientRect();
      var top = ui.dock === "top" ? pr.bottom : 0, bottom = ui.dock === "top" ? innerHeight : pr.top;
      if (r.top < top + 10 || r.top > bottom - 90) window.scrollTo({ top: window.scrollY + r.top - top - 60, behavior: "smooth" });
    });
  }

  /* ---------- اکشن‌ها ---------- */
  function hasContent(b) { var c = b && getC(key(b)); return !!(c && (c.type === "text" || c.type === "button" || c.type === "image")); }
  function toggleHide(b) { b.classList.toggle("cm-lay-hidden"); persist(); render(); }
  function move(b, dir) {
    var bl = blocks(), i = bl.indexOf(b), j = i + dir; if (i < 0 || j < 0 || j >= bl.length) return;
    if (dir < 0) page.insertBefore(b, bl[j]); else page.insertBefore(bl[j], b);
    persist(); render(); if (sel === b) reveal(b);
  }
  function select(b) {
    if (sel) { sel.classList.remove("cm-lay-sel"); clearHandles(sel); }
    sel = b;
    if (b) { b.classList.add("cm-lay-sel"); showHandles(b); ui.tab = hasContent(b) ? "content" : "size"; ui.collapsed = false; layoutPanel(); render(); reveal(b); }
    else { ui.tab = "list"; render(); }
  }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function addCustom(type) {
    var T = TYPES[type], c = JSON.parse(JSON.stringify(T.d || {})); c.id = newId(); c.type = type;
    S.custom.push(c); S.styles["c:" + c.id] = JSON.parse(JSON.stringify(T.st || {}));
    var el = renderCustom(c), after = sel && sel.parentNode === page ? sel.nextSibling : null;
    page.insertBefore(el, after); applyStyle(el); addTools(el); persist(); select(el);
  }
  function dup(b) {
    var c = getC(key(b)); if (!c) return;
    var n = JSON.parse(JSON.stringify(c)); n.id = newId(); S.custom.push(n);
    S.styles["c:" + n.id] = JSON.parse(JSON.stringify(sty(key(b))));
    var el = renderCustom(n); page.insertBefore(el, b.nextSibling); applyStyle(el); addTools(el); persist(); select(el);
  }
  function del(b) {
    if (!confirm("این عنصر حذف شود؟")) return;
    var k = key(b); S.custom = S.custom.filter(function (c) { return "c:" + c.id !== k; }); delete S.styles[k];
    b.remove(); sel = null; refreshFlex(); persist(); ui.tab = "list"; render();
  }

  /* ---------- ثبت در سرور / بکاپ ---------- */
  function norm(o) { o = o || {}; return JSON.stringify([o.order || [], o.hidden || [], o.styles || {}, o.custom || []]); }
  function isDirty() {
    var l = readAll(); if (!l || !l.pages) return false;
    var sp = (serverAll && serverAll.pages) || {};
    return Object.keys(l.pages).some(function (k) { return norm(l.pages[k]) !== norm(sp[k]); });
  }
  function updHead() {
    $.bUn.disabled = hi <= 0; $.bRe.disabled = hi >= hist.length - 1;
    $.bPub.textContent = "⬆ ثبت در سرور" + (isDirty() ? "  ●" : "");
  }
  function doPublish() {
    if (!window.CMSync) { say("ماژول ثبت روی سرور (site-sync.js) نصب نیست"); return; }
    var all = persist(), m = { v: 3, pages: Object.assign({}, (serverAll && serverAll.pages) || {}, all.pages) };
    say("در حال ثبت روی سرور…");
    CMSync.publish("layout", m).then(function (r) {
      if (!r.download) { serverAll = m; try { localStorage.removeItem(LS); localStorage.removeItem(LS2); } catch (e) {} }
      say(r.msg || (r.unchanged ? "تغییری نسبت به نسخهٔ سرور نبود" : "ثبت شد؛ برای همهٔ کاربران فعال است ✓")); updHead();
    }, function (e) { say(e.message); });
  }
  function doBackups() {
    if (!window.CMSync) { say("ماژول بکاپ (site-sync.js) نصب نیست"); return; }
    CMSync.panel("layout", { onRestored: function (d, loc) {
      if (loc && d && d.pages) writeAll(d); else { try { localStorage.removeItem(LS); localStorage.removeItem(LS2); } catch (e) {} }
      location.reload();
    } });
  }

  /* ---------- ساخت اجزای فرم ---------- */
  function secEl(title) { return h("div", { c: "sec" }, title ? [h("h5", { t: title })] : []); }
  function chRow(label, list, cur, fn) {
    var w = h("div", { c: "chips" });
    list.forEach(function (it) { w.appendChild(h("button", { c: "ch" + (String(it[0]) === String(cur) ? " on" : ""), type: "button", t: it[1], onclick: function () { fn(it[0]); } })); });
    return h("div", { c: "rw" }, [h("label", { t: label }), w]);
  }
  function swRow(label, cur, fn) {
    var w = h("div", { c: "chips" });
    COLORS.forEach(function (col) {
      var c = h("button", { c: "sw" + (col ? "" : " none") + ((cur || "") === col ? " on" : ""), type: "button", title: col || "بدون رنگ", onclick: function () { fn(col); } });
      if (col) c.style.background = col; w.appendChild(c);
    });
    return h("div", { c: "rw" }, [h("label", { t: label }), w]);
  }
  function rRow(b, label, prop, min, max, step, def, unit) {
    var s = sty(key(b)), set = s[prop] != null;
    var i = h("input", { type: "range", min: min, max: max, step: step }); i.value = set ? s[prop] : def;
    var txt = function () { return (prop === "h" && +i.value === 0) ? "خودکار" : i.value + unit; };
    var o = h("output", { t: txt() });
    var x = h("button", { c: "x", type: "button", title: "برگشت به حالت اصلی", t: "✕" });
    var r = h("div", { c: "rw" + (set ? " set" : "") }, [h("label", { t: label }), h("div", { c: "ctl" }, [i, o, x])]);
    i.addEventListener("input", function () { s[prop] = +i.value; o.textContent = txt(); r.classList.add("set"); applyStyle(b); persist(); });
    x.addEventListener("click", function () { delete s[prop]; applyStyle(b); if (prop === "w") refreshFlex(); persist(); render(); });
    return r;
  }
  function fld(c, prop, multi, onch) {
    var i = multi ? h("textarea") : h("input", { type: "text" });
    i.value = c[prop] || "";
    i.addEventListener("input", function () { c[prop] = i.value; onch(); persist(); });
    return i;
  }

  /* ---------- تب‌ها ---------- */
  function tabsFor() {
    var t = [["list", "بخش‌ها"]];
    if (sel) { if (hasContent(sel)) t.push(["content", "محتوا"]); t.push(["size", "اندازه"], ["look", "ظاهر"]); }
    t.push(["add", "افزودن"]);
    return t;
  }
  function renderTgt() {
    $.tgt.textContent = "";
    if (!sel) { $.tgt.style.display = "none"; return; }
    $.tgt.style.display = "";
    var b = sel, c = getC(key(b)), bl = blocks(), i = bl.indexOf(b), hid = b.classList.contains("cm-lay-hidden");
    var inner = [].filter.call(b.children, isBlock).length > 0;
    [ib("▲", "بالاتر", function () { move(b, -1); }, i <= 0),
     ib("▼", "پایین‌تر", function () { move(b, 1); }, i < 0 || i >= bl.length - 1),
     ib(hid ? "👁 نمایش" : "🚫 مخفی", "", function () { toggleHide(b); }),
     (!c && inner) ? ib("⇣ داخل", "رفتن داخل این بخش", function () { setDrill(drill.concat([key(b)])); }) : null,
     c ? ib("⧉ کپی", "", function () { dup(b); }) : null,
     c ? ib("🗑 حذف", "", function () { del(b); }, false, "dng") : null,
     ib("✕ لغو", "لغو انتخاب", function () { select(null); })
    ].forEach(function (x) { if (x) $.tgt.appendChild(x); });
  }
  function rList(bd) {
    bd.appendChild(h("div", { c: "hint", t: "صفحه: " + (pageKey || "") + (drill.length ? "  (داخل یک بخش)" : "") + " — لمس = انتخاب، ▲▼ = جابجایی" }));
    if (drill.length) bd.appendChild(h("div", { c: "chips", style: "margin-top:8px" }, [h("button", { c: "ch", type: "button", t: "⇡ بیرون رفتن از این بخش", onclick: function () { setDrill(drill.slice(0, -1)); } })]));
    var bl = blocks();
    var wrap = h("div", { style: "margin-top:10px" });
    if (!bl.length) wrap.appendChild(h("div", { c: "empty", t: "در این صفحه بخشی پیدا نشد." }));
    bl.forEach(function (b, i) {
      var c = getC(key(b)), hid = b.classList.contains("cm-lay-hidden");
      wrap.appendChild(h("div", { c: "li" + (b === sel ? " on" : "") + (hid ? " hid" : "") }, [
        h("span", { c: "nm", t: nameOf(b), onclick: function () { select(b); } }),
        c ? h("small", { t: "سفارشی" }) : null,
        ib("▲", "بالاتر", function () { move(b, -1); }, i === 0, "sm"),
        ib("▼", "پایین‌تر", function () { move(b, 1); }, i === bl.length - 1, "sm"),
        ib(hid ? "🚫" : "👁", hid ? "نمایش" : "مخفی", function () { toggleHide(b); }, false, "sm")
      ]));
    });
    bd.appendChild(wrap);
    var dt = h("details", {}, [h("summary", { t: "ابزار و خروجی" })]);
    dt.open = !!ui.tools; dt.addEventListener("toggle", function () { ui.tools = dt.open; });
    var chips = h("div", { c: "chips" });
    chips.appendChild(ib("کپی خروجی", "", function () {
      var t = JSON.stringify(persist());
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { say("کپی شد"); }, function () { prompt("کپی کن:", t); });
      else prompt("کپی کن:", t);
    }));
    chips.appendChild(ib("وارد کردن", "", function () {
      var t = prompt("متن JSON خروجی را paste کن:"); if (!t) return;
      try { var j = JSON.parse(t); if (!j || !(j.pages || Array.isArray(j.order))) throw 0; if (!j.pages) j = { v: 3, pages: { home: j } }; writeAll(j); location.reload(); } catch (e) { say("JSON نامعتبر است"); }
    }));
    chips.appendChild(ib("بازنشانی صفحه", "", function () {
      if (!confirm("چیدمان همین صفحه به حالت اصلی برگردد؟")) return;
      var all = readAll() || { v: 3, pages: {} }; delete all.pages[pageKey]; writeAll(all); location.reload();
    }, false, "dng"));
    chips.appendChild(ib("بازنشانی همه", "", function () {
      if (!confirm("چیدمان همهٔ صفحات روی این دستگاه پاک شود؟")) return;
      try { localStorage.removeItem(LS); localStorage.removeItem(LS2); } catch (e) {} location.reload();
    }, false, "dng"));
    var di = h("div"); di.appendChild(chips); dt.appendChild(di); bd.appendChild(dt);
  }
  function rAdd(bd) {
    bd.appendChild(h("div", { c: "hint", t: sel ? "عنصر جدید بعد از بخش انتخاب‌شده اضافه می‌شود." : "عنصر جدید به انتهای صفحه اضافه می‌شود." }));
    var g = h("div", { c: "grid", style: "margin-top:10px" });
    Object.keys(TYPES).forEach(function (t) { g.appendChild(ib(TYPES[t].n, "", function () { addCustom(t); })); });
    bd.appendChild(g);
  }
  function rSize(bd) {
    var b = sel, k = key(b), c = getC(k), s = sty(k);
    var s1 = secEl(null);
    s1.appendChild(chRow("عرض", [[100, "۱۰۰٪"], [75, "۷۵٪"], [66, "۶۶٪"], [50, "۵۰٪"], [33, "۳۳٪"], [25, "۲۵٪"]], s.w || 100, function (v) { s.w = v; applyStyle(b); refreshFlex(); persist(); render(); }));
    s1.appendChild(h("div", { c: "hint", t: "کمتر از ۱۰۰٪ = کنار بخش‌های هم‌اندازه می‌نشیند. دستگیرهٔ سبز لبهٔ بخش هم همین را عوض می‌کند." }));
    bd.appendChild(s1);
    var s2 = secEl("ارتفاع و مقیاس");
    s2.appendChild(rRow(b, "ارتفاع", "h", 0, 900, 5, 0, "px"));
    if (!c) s2.appendChild(rRow(b, "مقیاس", "z", 50, 150, 5, 100, "%"));
    s2.appendChild(h("div", { c: "hint", t: "ارتفاع «خودکار» = اندازهٔ اصلی. برای کوچک‌کردن بخش‌های اصلی از «مقیاس» استفاده کن." }));
    bd.appendChild(s2);
    var s3 = secEl("فاصله");
    s3.appendChild(rRow(b, "فاصلهٔ بالا", "mt", 0, 80, 2, 0, "px"));
    s3.appendChild(rRow(b, "فاصلهٔ پایین", "mb", 0, 80, 2, 0, "px"));
    s3.appendChild(rRow(b, "حاشیهٔ داخلی", "p", 0, 40, 1, 0, "px"));
    bd.appendChild(s3);
  }
  function rLook(bd) {
    var b = sel, s = sty(key(b));
    var s1 = secEl("رنگ و گوشه");
    s1.appendChild(swRow("رنگ زمینه", s.bg, function (v) { s.bg = v; applyStyle(b); persist(); render(); }));
    s1.appendChild(rRow(b, "گردی گوشه", "r", 0, 40, 1, 0, "px"));
    bd.appendChild(s1);
  }
  function rContent(bd) {
    var b = sel, c = getC(key(b)), sc = secEl("محتوا"), re = function () { render(); };
    if (c.type === "text") {
      sc.appendChild(h("div", { c: "rw" }, [h("label", { t: "متن" }), fld(c, "text", true, function () { refreshCustom(b); })]));
      var i = h("input", { type: "range", min: 10, max: 48 }); i.value = c.fs || 16; var o = h("output", { t: i.value });
      i.addEventListener("input", function () { c.fs = +i.value; o.textContent = i.value; refreshCustom(b); persist(); });
      sc.appendChild(h("div", { c: "rw" }, [h("label", { t: "اندازهٔ فونت" }), h("div", { c: "ctl" }, [i, o])]));
      sc.appendChild(swRow("رنگ متن", c.tc || "#ffffff", function (v) { c.tc = v || "#ffffff"; refreshCustom(b); persist(); re(); }));
      sc.appendChild(chRow("تراز", [["right", "راست"], ["center", "وسط"], ["left", "چپ"]], c.al || "right", function (v) { c.al = v; refreshCustom(b); persist(); re(); }));
    } else if (c.type === "button") {
      sc.appendChild(h("div", { c: "rw" }, [h("label", { t: "نوشته" }), fld(c, "text", false, function () { refreshCustom(b); })]));
      sc.appendChild(h("div", { c: "rw" }, [h("label", { t: "لینک" }), fld(c, "href", false, function () { refreshCustom(b); })]));
      sc.appendChild(chRow("تراز", [["right", "راست"], ["center", "وسط"], ["left", "چپ"]], c.al || "center", function (v) { c.al = v; refreshCustom(b); persist(); re(); }));
    } else if (c.type === "image") {
      sc.appendChild(h("div", { c: "rw" }, [h("label", { t: "آدرس عکس" }), fld(c, "src", false, function () { refreshCustom(b); })]));
    }
    bd.appendChild(sc);
  }
  function render() {
    if (!$.pn) return;
    var tabs = tabsFor(), ids = tabs.map(function (t) { return t[0]; });
    if (ids.indexOf(ui.tab) < 0) ui.tab = sel ? (hasContent(sel) ? "content" : "size") : "list";
    $.tabs.textContent = "";
    tabs.forEach(function (t) { $.tabs.appendChild(h("button", { c: "tb" + (t[0] === ui.tab ? " on" : ""), type: "button", t: t[1], onclick: function () { ui.tab = t[0]; render(); } })); });
    $.title.textContent = sel ? nameOf(sel) : "ویرایشگر چیدمان";
    renderTgt();
    var keep = (lastTab === ui.tab) ? $.bd.scrollTop : 0; lastTab = ui.tab;
    $.bd.textContent = "";
    ({ list: rList, add: rAdd, size: rSize, look: rLook, content: rContent })[ui.tab]($.bd);
    $.bd.scrollTop = keep;
    updHead();
  }

  /* ---------- modes ---------- */
  function enter() {
    if (!page || editing) return; editing = true; touched = false;
    page.classList.add("cm-lay-edit"); blocks().forEach(addTools);
    hist = [snap()]; hi = 0; ui.tab = "list"; ui.collapsed = false;
    $.pn.style.display = ""; $.fab.style.display = "none";
    layoutPanel(); render(); pad();
  }
  function exit(silent) {
    if (!editing) return;
    flushHist(); select(null); editing = false;
    if (page) { page.classList.remove("cm-lay-edit"); [].forEach.call(page.querySelectorAll(".cm-lay-tools,.cm-lay-rs"), function (t) { t.remove(); }); if (!silent && touched) persist(); }
    $.pn.style.display = "none"; pad();
  }
  function setDrill(nd) {
    var was = editing; exit(); drill = nd; page = null; init(); if (was && page) enter();
  }

  document.addEventListener("click", function (e) {
    if (!editing || !page || !e.target.closest) return;
    if (e.target.closest(".cm-lay-tools,.cm-lay-rs,#cm-layout-ui,.cmsy-ov")) return;
    var b = e.target.closest("[data-lay-key]");
    if (b && b.parentNode === page) { e.preventDefault(); e.stopPropagation(); select(b); }
  }, true);

  function init() {
    var rp = routePage();
    if (rp !== curRoute) { curRoute = rp; if (editing) exit(true); drill = []; page = null; }
    var p = loaded ? resolveContainer() : null;
    var k = rp + (drill.length ? ":" + drill.join(">") : "");
    if (p !== page || k !== pageKey) { if (editing) exit(true); page = p; pageKey = k; sel = null; }
    if (page && loaded) {
      if (!page.__layDone) { page.__layDone = 1; apply(); }
      else if (!editing && page.__layN !== page.children.length) apply();
    }
    $.fab.style.display = (isAdmin() && page && !editing) ? "" : "none";
  }
  function schedule() { if (pend) return; pend = requestAnimationFrame(function () { pend = 0; init(); }); }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  (window.CMSync ? CMSync.load("layout", base + "layout-default.json") : fetch(base + "layout-default.json?_=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }))
    .then(function (j) { if (j && j.pages) serverAll = j; else if (j && Array.isArray(j.order) && (j.order.length || j.hidden.length)) serverAll = { v: 3, pages: { home: j } }; loaded = true; schedule(); })
    .catch(function () { loaded = true; schedule(); });
  schedule();
})();
CM_EOF_LAYOUT_EDITOR_JS
echo ">> نوشته شد: layout-editor.js"

[ -f design-inspector.js ] && cp design-inspector.js "design-inspector.js.bak-editors-$TS"
cat > design-inspector.js <<'CM_EOF_DESIGN_INSPECTOR_JS'
/* Design Inspector (ویرایشگر دیزاین کلاس‌به‌کلاس)
 * ------------------------------------------------------------------
 * روی همهٔ صفحات سایت کار می‌کند (SPA). هر المنتی را انتخاب کن → زنجیرهٔ والدها و کلاس‌هایش
 * نشان داده می‌شود → یک کلاس (یا کلاس + والد) را هدف بگیر → اندازه، شکل، رنگ و هر چیز دیگر را
 * عوض کن. تغییرها به‌شکل قانون CSS روی «کلاس» اعمال می‌شوند، پس همهٔ المنت‌های هم‌کلاس
 * (مثلاً همهٔ دایره‌های استوری) با هم عوض می‌شوند.
 *
 * فعال‌سازی ادمین:  آدرس سایت را با ‎?design=1‎ باز کن (خاموش: ‎?design=0‎).
 * ذخیرهٔ دائمی برای همهٔ بازدیدکننده‌ها:  «خروجی» → دانلود → جایگزین فایل design-overrides.json.
 */
(function () {
  "use strict";
  if (window.__cmDI) return; window.__cmDI = 1;

  var LS = "cm_design_v1", LSC = "cm_design_css_cache", ADM = "cm_layout_admin", LSUI = "cm_design_ui";
  var PFX = ":root:root:root ";
  var script = document.currentScript;
  var base = ((script && script.src) || "").replace(/design-inspector\.js.*$/, "");

  try {
    if (/[?&](design|layout)=1\b/.test(location.search)) localStorage.setItem(ADM, "1");
    if (/[?&](design|layout)=0\b/.test(location.search)) localStorage.removeItem(ADM);
  } catch (e) {}
  function isAdmin() { try { return localStorage.getItem(ADM) === "1"; } catch (e) { return false; } }

  /* ============================================================
   *  داده + تولید CSS
   * ============================================================ */
  var D = { v: 1, rules: [] }, server = null, hist = [], hi = -1, histT = 0;
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function readLocal() { try { var j = JSON.parse(localStorage.getItem(LS) || "null"); return j && Array.isArray(j.rules) ? j : null; } catch (e) { return null; } }
  function saveLocal() { try { localStorage.setItem(LS, JSON.stringify(D)); } catch (e) {} }
  function num(v) { v = parseFloat(v); return isNaN(v) ? 0 : v; }
  function cleanVal(v) {
    return String(v).replace(/[{}<>]/g, "").replace(/javascript:|expression\s*\(|@import|behavior\s*:/ig, "").trim();
  }
  function okProp(p) { return /^-{0,2}[a-z][a-z0-9-]*$/.test(p); }

  function expand(r) {
    var p = r.p || {}, out = [], tf = [], fl = [];
    Object.keys(p).forEach(function (k) {
      var v = p[k]; if (v === "" || v == null || k.charAt(0) === "_" || !okProp(k)) return;
      v = cleanVal(v); if (v) out.push([k, v]);
    });
    if (p._tx || p._ty) tf.push("translate(" + num(p._tx) + "px," + num(p._ty) + "px)");
    if (p._rot) tf.push("rotate(" + num(p._rot) + "deg)");
    if (p._scale) tf.push("scale(" + num(p._scale) + ")");
    if (tf.length) out.push(["transform", tf.join(" ")]);
    if (p._blur) fl.push("blur(" + num(p._blur) + "px)");
    if (p._bright) fl.push("brightness(" + num(p._bright) + ")");
    if (p._sat) fl.push("saturate(" + num(p._sat) + ")");
    if (fl.length) out.push(["filter", fl.join(" ")]);
    if (p._bd) { out.push(["backdrop-filter", "blur(" + num(p._bd) + "px)"]); out.push(["-webkit-backdrop-filter", "blur(" + num(p._bd) + "px)"]); }
    if (r.raw) String(r.raw).split(/;|\n/).forEach(function (line) {
      var i = line.indexOf(":"); if (i < 1) return;
      var k = line.slice(0, i).trim().toLowerCase(), v = cleanVal(line.slice(i + 1)).replace(/!important/ig, "").trim();
      if (okProp(k) && v) out.push([k, v]);
    });
    if (p._hide === "1") out.push(["display", "none"]);
    return out;
  }
  function buildCSS(d) {
    return ((d && d.rules) || []).map(function (r) {
      if (!r || typeof r.s !== "string" || /[{};@<,]/.test(r.s)) return "";
      var decl = expand(r).map(function (x) { return x[0] + ":" + x[1] + " !important"; }).join(";");
      if (!decl) return "";
      var rule = PFX + r.s + "{" + decl + "}";
      if (r.m === "m") rule = "@media (max-width:1023.98px){" + rule + "}";
      else if (r.m === "d") rule = "@media (min-width:1024px){" + rule + "}";
      return rule;
    }).join("\n");
  }

  var styleEl = document.createElement("style");
  styleEl.id = "cm-design-css";
  document.head.appendChild(styleEl);
  try { var cc = localStorage.getItem(LSC); if (cc && !(isAdmin() && readLocal())) styleEl.textContent = cc; } catch (e) {}
  var applyQ = 0;
  function applyCSS() { styleEl.textContent = buildCSS(D); }
  function pushHist() {
    var s = JSON.stringify(D); if (hist[hi] === s) return;
    hist = hist.slice(0, hi + 1); hist.push(s); if (hist.length > 60) hist.shift(); hi = hist.length - 1;
  }

  /* شروع: ادمین نسخهٔ محلی خودش را می‌بیند، بقیه نسخهٔ سرور را */
  if (isAdmin() && readLocal()) { D = readLocal(); applyCSS(); }
  hist = [JSON.stringify(D)]; hi = 0;

  function loadServer() {
    return (window.CMSync ? CMSync.load("design", base + "design-overrides.json") : fetch(base + "design-overrides.json?_=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }))
      .then(function (j) {
        if (j && Array.isArray(j.rules)) {
          server = j;
          try { localStorage.setItem(LSC, buildCSS(j)); } catch (e) {}
          if (!(isAdmin() && readLocal())) { D = clone(j); applyCSS(); hist = [JSON.stringify(D)]; hi = 0; }
        }
      }).catch(function () {});
  }
  var ready = loadServer();

  /* ============================================================
   *  ابزارهای DOM / سلکتور
   * ============================================================ */
  var host = null, root = null, $ = {};              // shadow host + عناصر UI
  function esc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^\w-]/g, "\\$&"); }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "c") e.className = attrs[k]; else if (k === "t") e.textContent = attrs[k]; else if (k === "html") e.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function isUI(n) { return host && (n === host || host.contains(n)); }
  var SKIP = { SCRIPT: 1, STYLE: 1, TEMPLATE: 1, NOSCRIPT: 1, LINK: 1, META: 1 };
  var STATE_RE = /^(is-|has-|js-|active$|on$|off$|open$|opened$|show$|shown$|hidden$|selected$|current$|loading$|loaded$|disabled$|visible$|hide$|expanded$|collapsed$|dragging$|pressed$|focus$|hover$|skeleton)/;
  function usable(el) {
    return [].filter.call(el.classList || [], function (c) { return !/^(cmdi-|cm-lay-)/.test(c) && c.length < 70; });
  }
  function isState(c) { return STATE_RE.test(c); }
  function primary(el) {
    var u = usable(el), a = u.filter(function (c) { return !isState(c) && c.indexOf("--") < 0; });
    return a[0] || u.filter(function (c) { return !isState(c); })[0] || u[0] || "";
  }
  function defaultCls(el) {
    var u = usable(el), a = u.filter(function (c) { return !isState(c) && c.indexOf("--") < 0; });
    return a.length ? a : (u.length ? [u[0]] : []);
  }
  function tagOf(el) { return el.tagName.toLowerCase(); }
  function label(el) {
    var u = usable(el); if (u.length) return "." + u.slice(0, 2).join(".") + (u.length > 2 ? "…" : "");
    return tagOf(el) + (el.id ? "#" + el.id : "");
  }
  function pathSel(el) {
    var parts = [], n = el;
    while (n && n.nodeType === 1 && n !== document.body) {
      var i = [].indexOf.call(n.parentNode.children, n) + 1;
      parts.unshift(tagOf(n) + ":nth-child(" + i + ")");
      var p = n.parentNode;
      if (p && p !== document.body && p.nodeType === 1 && primary(p)) { parts.unshift("." + esc(primary(p))); return parts.join(" > "); }
      n = p;
    }
    return "body > " + parts.join(" > ");
  }

  /* ============================================================
   *  وضعیت UI
   * ============================================================ */
  var T = { el: null, cls: [], tag: false, scope: -1, path: false, over: null, pseudo: "", media: "", anc: [], tab: "cls" };
  var ui = { open: false, mode: "pick", collapsed: false, dock: "bottom", groups: { "ابعاد": 1, "رنگ و زمینه": 1 } };
  try { var u0 = JSON.parse(localStorage.getItem(LSUI) || "null"); if (u0) { ui.dock = u0.dock || "bottom"; ui.tab = u0.tab; if (u0.tab) T.tab = u0.tab; } } catch (e) {}
  function saveUI() { try { localStorage.setItem(LSUI, JSON.stringify({ dock: ui.dock, tab: T.tab })); } catch (e) {} }

  function baseSel() {
    if (T.over != null) return T.over.replace(/(::?[a-z-]+(\([^)]*\))?)$/i, "");
    var e = T.el; if (!e) return "";
    if (e === document.body) return "body";
    if (T.path) return pathSel(e);
    var core = ((T.tag || !T.cls.length) ? tagOf(e) : "") + T.cls.map(function (c) { return "." + esc(c); }).join("");
    if (T.scope > -1 && T.anc[T.scope]) core = T.anc[T.scope].part + " " + core;
    return core;
  }
  function fullSel() {
    if (T.over != null) return T.over;
    var b = baseSel(); return b ? b + T.pseudo : "";
  }
  function matches() {
    var s = baseSel(); if (!s) return [];
    try { return [].filter.call(document.querySelectorAll(s), function (n) { return !isUI(n); }); } catch (e) { return []; }
  }
  function getRule(create) {
    var s = fullSel(), m = T.media;
    for (var i = 0; i < D.rules.length; i++) if (D.rules[i].s === s && (D.rules[i].m || "") === m) return D.rules[i];
    if (!create) return null;
    var r = { s: s, m: m, p: {} }; D.rules.push(r); return r;
  }
  function ruleEmpty(r) { return !Object.keys(r.p || {}).some(function (k) { return r.p[k] !== "" && r.p[k] != null; }) && !(r.raw || "").trim(); }
  function setProp(k, v) {
    var r = getRule(true);
    if (v === "" || v == null) delete r.p[k]; else r.p[k] = v;
    if (ruleEmpty(r)) D.rules.splice(D.rules.indexOf(r), 1);
    commit();
  }
  function setRaw(v) {
    var r = getRule(true); r.raw = v; if (ruleEmpty(r)) D.rules.splice(D.rules.indexOf(r), 1); commit();
  }
  function commit() {
    if (!applyQ) applyQ = requestAnimationFrame(function () { applyQ = 0; applyCSS(); sched(); });
    saveLocal(); clearTimeout(histT); histT = setTimeout(function () { pushHist(); updHead(); }, 450);
    updHead();
  }
  function undo(redo) {
    clearTimeout(histT); pushHist();
    var ni = hi + (redo ? 1 : -1); if (ni < 0 || ni >= hist.length) return;
    hi = ni; D = JSON.parse(hist[hi]); applyCSS(); saveLocal(); renderBody(); updHead(); sched();
  }

  /* ============================================================
   *  شیء‌های UI (Shadow DOM تا CSS سایت قاطی نشود)
   * ============================================================ */
  var CSS_UI = [
    ":host{all:initial}",
    "*{box-sizing:border-box;font-family:inherit}",
    "button{font-family:inherit;-webkit-tap-highlight-color:transparent}",
    ".fab{position:fixed;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 150px);height:44px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:#111214;color:#c8f31d;font:700 13px/1 inherit;z-index:2147483000;direction:rtl;box-shadow:0 8px 24px rgba(0,0,0,.5);cursor:pointer}",
    ".ov{position:fixed;inset:0;pointer-events:none;z-index:2147482990}",
    ".bx{position:fixed;pointer-events:none;border:1.5px dashed rgba(200,243,29,.75);background:rgba(200,243,29,.07);border-radius:3px}",
    ".bx.me{border:2px solid #c8f31d;background:rgba(200,243,29,.14)}",
    ".bx.hv{border:1.5px solid #5ac8fa;background:rgba(90,200,250,.12)}",
    ".bx b{position:absolute;top:-19px;left:0;background:#c8f31d;color:#111;font:700 10px/16px ui-monospace,monospace;padding:0 5px;border-radius:4px;white-space:nowrap;direction:ltr}",
    ".bx.low b{top:auto;bottom:-19px}",
    /* پنل */
    ".pn{position:fixed;left:0;right:0;bottom:0;margin:0 auto;width:min(100vw,640px);max-height:58vh;max-height:58dvh;display:flex;flex-direction:column;background:#131416;color:#fff;border:1px solid rgba(255,255,255,.14);border-bottom:0;border-radius:20px 20px 0 0;z-index:2147483000;direction:rtl;box-shadow:0 -10px 40px rgba(0,0,0,.55);font-size:13px}",
    ".pn.top{bottom:auto;top:0;border-radius:0 0 20px 20px;border:1px solid rgba(255,255,255,.14);border-top:0;box-shadow:0 10px 40px rgba(0,0,0,.55)}",
    ".pn.min .bd,.pn.min .tabs,.pn.min .tgt,.pn.min .msg{display:none}",
    "@media(min-width:1024px){.pn{top:0;bottom:0;left:0;right:auto;margin:0;width:380px;max-height:none;border-radius:0 20px 20px 0;border:1px solid rgba(255,255,255,.14)}.pn.top{bottom:0}.pn.min{bottom:auto}}",
    ".hd{display:flex;align-items:center;gap:6px;padding:10px 12px 8px;flex:0 0 auto}",
    ".hd h4{margin:0;flex:1;min-width:0;font-size:13px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;direction:ltr;text-align:right}",
    ".hd h4.fa{direction:rtl}",
    ".ib{min-width:34px;height:34px;padding:0 10px;border-radius:11px;border:1px solid rgba(255,255,255,.14);background:#1f2023;color:#fff;font:700 12px/1 inherit;cursor:pointer;white-space:nowrap}",
    ".ib:disabled{opacity:.3}.ib.on{background:#c8f31d;color:#111;border-color:#c8f31d}.ib.pri{background:#c8f31d;color:#111;border-color:#c8f31d}.ib.dng{color:#ff7a7a}",
    /* نوار هدف */
    ".tgt{display:flex;align-items:center;gap:6px;padding:0 12px 8px;flex:0 0 auto;flex-wrap:wrap}",
    ".seg{display:flex;background:#1f2023;border-radius:11px;padding:3px;gap:2px;border:1px solid rgba(255,255,255,.08)}",
    ".sg{flex:1 1 auto;height:28px;padding:0 11px;border-radius:8px;border:0;background:transparent;color:#aeb2b8;font:700 12px/1 inherit;cursor:pointer;white-space:nowrap}",
    ".sg.on{background:#c8f31d;color:#111}",
    ".tgt .ib{padding:0 8px;min-width:32px;height:32px}.tgt .sg{padding:0 8px;font-size:11.5px}.tgt{flex-wrap:nowrap}",
    ".tabs{display:flex;gap:2px;padding:0 12px;flex:0 0 auto;border-bottom:1px solid rgba(255,255,255,.1)}",
    ".tb{flex:1;height:36px;border:0;border-bottom:2px solid transparent;background:transparent;color:#8c9097;font:700 12.5px/1 inherit;cursor:pointer;white-space:nowrap}",
    ".tb.on{color:#c8f31d;border-bottom-color:#c8f31d}",
    ".bd{overflow:auto;padding:12px;flex:1 1 auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;min-height:90px}",
    ".msg{color:#c8f31d;font-size:11.5px;min-height:0;padding:0 14px;text-align:center}",
    ".msg:not(:empty){padding:5px 14px}",
    ".act{display:flex;gap:6px;padding:8px 12px calc(env(safe-area-inset-bottom,0px) + 10px);flex:0 0 auto;border-top:1px solid rgba(255,255,255,.1);background:#131416}",
    ".ab{flex:1 1 0;height:42px;border-radius:13px;border:1px solid rgba(255,255,255,.14);background:#1f2023;color:#fff;font:700 12.5px/1 inherit;cursor:pointer;white-space:nowrap}",
    ".ab.pri{flex:2 1 0;background:#c8f31d;color:#111;border-color:#c8f31d;font-size:13.5px}",
    ".ab.on{border-color:#c8f31d;color:#c8f31d}",
    "select,input[type=text],textarea{background:#1f2023;border:1px solid rgba(255,255,255,.14);border-radius:10px;color:#fff;padding:0 9px;height:34px;font:12px inherit;min-width:0}",
    "textarea{height:90px;padding:8px;direction:ltr;font-family:ui-monospace,monospace;width:100%}",
    "input.t{flex:1;direction:ltr;text-align:left}",
    "select{max-width:100%}",
    ".sec{margin:0 0 14px}.sec>h5{margin:0 0 4px;font-size:11.5px;color:#8c9097;font-weight:700}",
    ".chips{display:flex;gap:6px;flex-wrap:wrap}",
    ".ch{height:30px;padding:0 11px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:#1f2023;color:#fff;font:600 12px/1 ui-monospace,monospace;direction:ltr;cursor:pointer}",
    ".ch.on{background:#c8f31d;color:#111;border-color:#c8f31d}.ch.st{opacity:.6;border-style:dashed}",
    ".ch.q{font-family:inherit;direction:rtl;height:26px;padding:0 10px;font-size:11px}",
    ".sw{width:26px;height:26px;border-radius:50%;border:2px solid rgba(255,255,255,.25);padding:0;cursor:pointer}",
    ".hint{color:#8c9097;font-size:11px;margin-top:4px;line-height:1.7}",
    ".tr{display:flex;align-items:center;gap:6px;min-height:30px;padding:2px 6px;border-radius:8px;cursor:pointer;direction:ltr;font:600 11px ui-monospace,monospace;color:#cfd2d6;border:1px solid transparent}",
    ".tr:hover{background:#1f2124}.tr.on{background:rgba(200,243,29,.15);border-color:#c8f31d;color:#fff}",
    ".tr i{color:#7d828a;font-style:normal}.tr em{color:#c8f31d;font-style:normal;margin-left:auto}",
    ".chain{display:flex;gap:4px;overflow-x:auto;padding:2px 0 6px;scrollbar-width:none}",
    ".chain::-webkit-scrollbar{display:none}",
    ".cr{flex:0 0 auto;max-width:200px;height:26px;padding:0 9px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:#1f2023;color:#cfd2d6;font:600 11px/24px ui-monospace,monospace;direction:ltr;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}",
    ".cr.on{background:#c8f31d;color:#111;border-color:#c8f31d}",
    ".sep{flex:0 0 auto;color:#555;line-height:26px;font-size:11px}",
    "details{margin:0 0 8px;border:1px solid rgba(255,255,255,.1);border-radius:13px;background:#18191c}",
    "summary{padding:11px 13px;font-weight:700;font-size:12.5px;cursor:pointer;color:#e6e8ea;list-style:none}",
    "summary::-webkit-details-marker{display:none}",
    "summary:after{content:'▾';float:left;color:#7d828a}details[open] summary:after{content:'▴'}",
    "details>div{padding:2px 13px 11px}",
    ".rw{display:flex;align-items:center;gap:8px;margin:9px 0}",
    ".rw>label{flex:0 0 74px;color:#c7cacf;font-size:12px}",
    ".rw .ctl{flex:1;display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}",
    ".rw input[type=range]{flex:1 1 90px;min-width:70px;accent-color:#c8f31d;direction:ltr;height:28px}",
    ".rw input[type=color]{width:36px;height:34px;border:1px solid rgba(255,255,255,.2);border-radius:10px;background:none;padding:2px}",
    ".rw .x{width:24px;height:24px;border-radius:50%;border:1px solid rgba(255,255,255,.12);background:transparent;color:#555;cursor:pointer;flex:0 0 auto;padding:0;font-size:11px}",
    ".rw.set>label{color:#c8f31d;font-weight:700}.rw.set .x{color:#c8f31d;border-color:#c8f31d}",
    ".ru{display:flex;align-items:center;gap:6px;padding:8px 9px;margin:0 0 6px;border-radius:11px;background:#1b1c1f;border:1px solid rgba(255,255,255,.08)}",
    ".ru code{flex:1;direction:ltr;text-align:left;font:600 11px ui-monospace,monospace;color:#c8f31d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}",
    ".ru small{color:#9aa0a6;white-space:nowrap}",
    ".empty{padding:26px 10px;text-align:center;color:#9aa0a6;line-height:2;font-size:12.5px}",
    ".empty b{display:block;font-size:30px;margin-bottom:6px}",
    ".empty ol{margin:10px 0 0;padding:0 22px 0 0;text-align:right;color:#8c9097;font-size:12px}",
  ].join("");

  function build() {
    host = document.createElement("div"); host.id = "cm-design-inspector";
    host.style.cssText = "all:initial;position:fixed;z-index:2147483000;left:0;top:0;width:0;height:0;direction:rtl";
    root = host.attachShadow({ mode: "open" });
    root.appendChild(h("style", { t: CSS_UI }));
    $.fab = h("button", { c: "fab", t: "🎨 دیزاین", type: "button", onclick: function () { open(); } });
    $.ov = h("div", { c: "ov" });
    $.pn = h("div", { c: "pn" });
    $.pn.style.display = "none"; $.fab.style.display = "none";
    root.appendChild($.fab); root.appendChild($.ov); root.appendChild($.pn);

    /* بالا: عنوان + حالت انتخاب/حرکت + بازگشت/جلو + بستن */
    $.title = h("h4", { t: "ویرایشگر دیزاین", title: "لمس = کوچک/بزرگ کردن پنل", onclick: function () { ui.collapsed = !ui.collapsed; layoutPanel(); sched(); } });
    $.bPick = h("button", { c: "ib on", type: "button", t: "🎯 انتخاب", onclick: function () { setMode(ui.mode === "pick" ? "browse" : "pick"); } });
    $.bUn = h("button", { c: "ib", type: "button", t: "↶", title: "بازگردانی", onclick: function () { undo(false); } });
    $.bRe = h("button", { c: "ib", type: "button", t: "↷", title: "جلو", onclick: function () { undo(true); } });
    $.bX = h("button", { c: "ib", type: "button", t: "✕", title: "بستن", onclick: function () { close(); } });
    var hd = h("div", { c: "hd" }, [$.title, $.bPick, $.bUn, $.bRe, $.bX]);

    $.tgt = h("div", { c: "tgt" });
    $.tabs = h("div", { c: "tabs" });
    TABS.forEach(function (t) {
      var b = h("button", { c: "tb", type: "button", t: t[1], onclick: function () { T.tab = t[0]; saveUI(); renderBody(); } }); b.dataset.t = t[0]; $.tabs.appendChild(b);
    });
    $.bd = h("div", { c: "bd" });
    msgEl = h("div", { c: "msg" });

    /* پایین (همیشه پیدا): ثبت در سرور / بکاپ‌ها / تغییرات */
    $.bPub = h("button", { c: "ab pri", type: "button", t: "⬆ ثبت در سرور", onclick: function () { doPublish(); } });
    $.bBak = h("button", { c: "ab", type: "button", t: "🕘 بکاپ‌ها", onclick: function () { doBackups(); } });
    $.bRules = h("button", { c: "ab", type: "button", t: "📋 تغییرات", onclick: function () { T.tab = T.tab === "rules" ? "look" : "rules"; saveUI(); renderBody(); } });
    var act = h("div", { c: "act" }, [$.bPub, $.bBak, $.bRules]);

    /* عناصر پایدار بخش «پیشرفته» */
    $.chain = h("div", { c: "chain" });
    $.sPs = h("select", { onchange: function () { T.over = null; T.pseudo = $.sPs.value; renderBody(); } },
      [["", "حالت عادی"], [":hover", ":hover (موس روی آن)"], [":active", ":active (فشردن)"], [":focus", ":focus"], ["::before", "::before"], ["::after", "::after"]]
        .map(function (o) { return h("option", { value: o[0], t: o[1] }); }));

    [hd, $.tgt, $.tabs, $.bd, msgEl, act].forEach(function (x) { $.pn.appendChild(x); });

    /* جلوگیری از رسیدن رویدادهای پنل به منطق سایت (مثلاً بستن پاپ‌آپ با کلیک بیرون) */
    ["click", "pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend", "keydown", "keyup", "wheel"].forEach(function (ev) {
      host.addEventListener(ev, function (e) { e.stopPropagation(); }, false);
    });
    document.body.appendChild(host);
  }

  function layoutPanel() {
    $.pn.classList.toggle("top", ui.dock === "top");
    $.pn.classList.toggle("min", ui.collapsed || ui.mode === "browse");
    $.bPick.className = "ib" + (ui.mode === "pick" ? " on" : "");
    $.bPick.textContent = ui.mode === "pick" ? "🎯 انتخاب" : "🖐 حرکت در سایت";
    $.fab.style.display = (!ui.open && isAdmin()) ? "" : "none";
    $.pn.style.display = ui.open ? "" : "none";
    $.ov.style.display = (ui.open && ui.mode === "pick") ? "" : "none";
  }
  function open() { ui.open = true; ui.mode = "pick"; ui.collapsed = false; layoutPanel(); renderAll(); sched(); }
  function close() { ui.open = false; T.el = null; layoutPanel(); sched(); }
  function setMode(m) { ui.mode = m; if (m === "pick") ui.collapsed = false; layoutPanel(); sched(); }

  /* ============================================================
   *  انتخاب المنت: رهگیری لمس/کلیک
   * ============================================================ */
  var down = null;
  function inPick() { return ui.open && ui.mode === "pick"; }
  function fromUI(e) { var p = e.composedPath ? e.composedPath() : []; return p.indexOf(host) > -1 || (e.target && e.target.closest && !!e.target.closest(".cmsy-ov")); }
  function onDown(e) {
    if (!inPick() || fromUI(e)) return;
    down = { x: e.clientX, y: e.clientY, t: e.target }; e.stopPropagation();
  }
  function onUp(e) {
    if (!inPick() || fromUI(e)) return;
    e.stopPropagation();
    if (down && Math.abs(e.clientX - down.x) < 10 && Math.abs(e.clientY - down.y) < 10) pick(e.target);
    down = null;
  }
  function block(e) {
    if (!inPick() || fromUI(e)) return;
    e.stopPropagation(); if (e.cancelable) e.preventDefault();
  }
  function blockSoft(e) { if (!inPick() || fromUI(e)) return; e.stopPropagation(); }
  function hoverMove(e) {
    if (!inPick() || fromUI(e) || e.pointerType === "touch") return;
    var t = e.target; if (t !== hoverEl) { hoverEl = t; sched(); }
  }
  var hoverEl = null;

  function pick(el) {
    if (!el || el.nodeType !== 1 || isUI(el) || SKIP[el.tagName] || el === document.documentElement) el = document.body;
    select(el);
  }
  function ancestors(el) {
    var a = [], n = el.parentElement;
    while (n && n !== document.body && n !== document.documentElement) {
      var pc = primary(n);
      a.push({ el: n, part: pc ? "." + esc(pc) : tagOf(n), name: label(n) });
      n = n.parentElement;
    }
    return a;
  }
  function select(el) {
    T.el = el; T.anc = ancestors(el); T.cls = defaultCls(el); T.tag = false; T.scope = -1; T.path = false; T.over = null; T.pseudo = "";
    if (!T.cls.length) { for (var i = 0; i < T.anc.length; i++) if (primary(T.anc[i].el)) { T.scope = i; break; } }  /* بدون کلاس → خودکار داخل نزدیک‌ترین والد کلاس‌دار */
    $.sPs.value = "";
    renderAll(); revealEl(el); sched();
  }
  function revealEl(el) {
    if (!el || el === document.body) return;
    var r = el.getBoundingClientRect(), pr = $.pn.getBoundingClientRect();
    if (innerWidth >= 1024) return;
    var topLimit = ui.dock === "top" ? pr.bottom + 8 : 8, botLimit = ui.dock === "top" ? innerHeight - 8 : pr.top - 8;
    if (r.height > botLimit - topLimit) { if (r.top < topLimit || r.top > botLimit) window.scrollBy(0, r.top - topLimit); }
    else if (r.top < topLimit) window.scrollBy(0, r.top - topLimit);
    else if (r.bottom > botLimit) window.scrollBy(0, r.bottom - botLimit);
  }
  function nav(d) {
    var e = T.el; if (!e) return; var n = null;
    var ok = function (x) { return x && x.nodeType === 1 && !SKIP[x.tagName] && !isUI(x); };
    if (d === "up") n = e.parentElement && e.parentElement !== document.documentElement ? e.parentElement : null;
    if (d === "down") { n = [].filter.call(e.children, ok)[0]; }
    if (d === "next") { n = e.previousElementSibling; while (n && !ok(n)) n = n.previousElementSibling; }  // RTL: ◀ = بعدی بصری
    if (d === "prev") { n = e.nextElementSibling; while (n && !ok(n)) n = n.nextElementSibling; }
    if (n) select(n);
  }

  /* ============================================================
   *  هایلایت روی صفحه
   * ============================================================ */
  var schedQ = 0;
  function sched() { if (!schedQ) schedQ = requestAnimationFrame(function () { schedQ = 0; draw(); }); }
  function box(r, cls, text) {
    var d = h("div", { c: "bx " + cls });
    d.style.cssText = "left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px";
    if (text) { var b = h("b", { t: text }); d.appendChild(b); if (r.top < 22) d.classList.add("low"); }
    $.ov.appendChild(d);
  }
  function draw() {
    if (!$.ov) return;
    $.ov.textContent = "";
    if (!inPick()) return;
    if (T.el && !T.el.isConnected) { T.el = null; renderAll(); }
    if (hoverEl && hoverEl.isConnected && !isUI(hoverEl) && hoverEl !== T.el) { var hr = hoverEl.getBoundingClientRect(); if (hr.width) box(hr, "hv", ""); }
    if (!T.el) return;
    var ms = matches().slice(0, 80);
    ms.forEach(function (m) { if (m !== T.el) { var r = m.getBoundingClientRect(); if (r.width && r.height) box(r, "", ""); } });
    var r0 = T.el.getBoundingClientRect();
    box(r0, "me", Math.round(r0.width) + "×" + Math.round(r0.height));
  }

  /* ============================================================
   *  پنل: نوار هدف / تب‌ها / بدنه
   * ============================================================ */
  var TABS = [["look", "ظاهر"], ["size", "اندازه و فاصله"], ["text", "متن"], ["more", "بیشتر"]];
  var MEDIA_NEXT = { "": "m", m: "d", d: "" };
  var MEDIA_LBL = { "": "📱🖥 همه", m: "📱 موبایل", d: "🖥 دسکتاپ" };

  function isDirty() { return JSON.stringify(D.rules) !== JSON.stringify((server && server.rules) || []); }
  function updHead() {
    if (!$.bUn) return;
    $.bUn.disabled = hi <= 0 && !histT; $.bRe.disabled = hi >= hist.length - 1;
    if ($.bUp) { var has = !!T.el; $.bUp.disabled = !has || T.el === document.body; $.bDn.disabled = !has; }
    var d = isDirty();
    $.bPub.textContent = "⬆ ثبت در سرور" + (d ? "  ●" : "");
    $.bRules.textContent = "📋 تغییرات" + (D.rules.length ? " (" + D.rules.length + ")" : "");
  }
  function renderChain() {
    $.chain.textContent = "";
    if (!T.el) return;
    var items = T.anc.slice().reverse().map(function (a) { return a.el; }); items.push(T.el);
    items.forEach(function (n, i) {
      if (i) $.chain.appendChild(h("span", { c: "sep", t: "›" }));
      $.chain.appendChild(h("button", { c: "cr" + (n === T.el ? " on" : ""), type: "button", t: label(n), title: usable(n).join(" ") || tagOf(n), onclick: function () { select(n); } }));
    });
    setTimeout(function () { var on = $.chain.querySelector(".on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest" }); }, 0);
  }
  function renderBar() {
    var e = T.el;
    $.title.textContent = e ? (T.over != null ? "قانون ذخیره‌شده: " + T.over : label(e)) : "ویرایشگر دیزاین";
    $.title.className = e ? "" : "fa";
    $.tgt.textContent = "";
    if (!e) { $.tgt.style.display = "none"; return; }
    $.tgt.style.display = "";
    var n = matches().length;
    var seg = h("div", { c: "seg" }, [
      h("button", { c: "sg" + (!T.path ? " on" : ""), type: "button", t: "همهٔ مشابه‌ها" + (n > 1 ? " (" + n + ")" : ""), title: "تغییر روی همهٔ المنت‌های هم‌کلاس", onclick: function () { T.over = null; T.path = false; renderBody(); } }),
      h("button", { c: "sg" + (T.path ? " on" : ""), type: "button", t: "فقط این یکی", title: "فقط همین المنت", onclick: function () { T.over = null; T.path = true; renderBody(); } })]);
    $.bUp = h("button", { c: "ib", type: "button", t: "⬆", title: "انتخاب والد (بزرگ‌تر)", onclick: function () { nav("up"); } });
    $.bDn = h("button", { c: "ib", type: "button", t: "⬇", title: "انتخاب فرزند (کوچک‌تر)", onclick: function () { nav("down"); } });
    var dv = h("button", { c: "ib" + (T.media ? " on" : ""), type: "button", t: MEDIA_LBL[T.media], title: "این تغییر روی کدام دستگاه‌ها اعمال شود؟ (لمس = تغییر)", onclick: function () { T.media = MEDIA_NEXT[T.media]; renderBody(); } });
    [seg, $.bUp, $.bDn, dv].forEach(function (x) { $.tgt.appendChild(x); });
  }
  function renderAll() { renderChain(); renderBody(); updHead(); }
  function renderBody() {
    var ids = TABS.map(function (t) { return t[0]; });
    if (T.tab !== "rules" && ids.indexOf(T.tab) < 0) T.tab = "look";
    [].forEach.call($.tabs.children, function (b) { b.classList.toggle("on", b.dataset.t === T.tab); });
    $.bRules.classList.toggle("on", T.tab === "rules");
    renderBar(); updHead();
    $.bd.textContent = "";
    if (T.tab === "rules") return renderRules();
    if (!T.el) {
      $.bd.appendChild(h("div", { c: "empty", html: "<b>🎯</b>روی هر بخشی از صفحه بزن تا ویرایشش کنی<ol><li>یک المنت را لمس کن</li><li>رنگ، اندازه و … را با اسلایدر عوض کن</li><li>پایین «⬆ ثبت در سرور» را بزن تا همه ببینند</li></ol><div class='hint' style='margin-top:12px'>برای رفتن به صفحهٔ دیگر یا باز کردن پاپ‌آپ، بالا «حرکت در سایت» را بزن.</div>" }));
      return;
    }
    if (T.tab === "more") renderMore(); else renderGroups(TG[T.tab]);
  }

  /* ---------- بخش «پیشرفته»: کلاس‌ها، محدوده، ساختار ---------- */
  function renderAdvanced(into) {
    var e = T.el, uc = usable(e);
    var sec = h("div", { c: "sec" }); sec.appendChild(h("h5", { t: "کلاس‌های هدف (روشن = در انتخاب‌گر باشد)" }));
    var chips = h("div", { c: "chips" });
    chips.appendChild(h("button", { c: "ch" + (T.tag || !uc.length ? " on" : ""), type: "button", t: "‹" + tagOf(e) + "›", onclick: function () { T.over = null; T.tag = !T.tag; if (!T.tag && !T.cls.length && uc.length) T.cls = defaultCls(e); renderBody(); } }));
    uc.forEach(function (c) {
      chips.appendChild(h("button", { c: "ch" + (T.cls.indexOf(c) > -1 ? " on" : "") + (isState(c) ? " st" : ""), type: "button", t: "." + c, title: isState(c) ? "کلاس وضعیتی (ممکن است موقتی باشد)" : "",
        onclick: function () { T.over = null; var i = T.cls.indexOf(c); if (i > -1) T.cls.splice(i, 1); else T.cls.push(c); renderBody(); } }));
    });
    sec.appendChild(chips);
    if (!uc.length) sec.appendChild(h("div", { c: "hint", t: "این المنت کلاس ندارد؛ با «محدوده» یک والد کلاس‌دار را مشخص کن." }));
    into.appendChild(sec);

    var s2 = h("div", { c: "sec" }); s2.appendChild(h("h5", { t: "محدوده" }));
    var sel = h("select", { onchange: function () { T.over = null; T.scope = +sel.value; T.path = false; renderBody(); } });
    sel.appendChild(h("option", { value: "-1", t: "همه‌جای سایت" }));
    T.anc.forEach(function (a, i) { sel.appendChild(h("option", { value: String(i), t: "فقط داخل: " + a.name })); });
    sel.value = String(T.scope); sel.style.width = "100%";
    s2.appendChild(sel);
    $.sPs.value = T.over != null ? (T.over.match(/(::?[a-z-]+(\([^)]*\))?)$/i) || [""])[0] : T.pseudo; $.sPs.style.cssText = "width:100%;margin-top:8px";
    s2.appendChild($.sPs);
    into.appendChild(s2);

    var s3 = h("div", { c: "sec" }); s3.appendChild(h("h5", { t: "مسیر و المنت‌های کناری" }));
    renderChain(); s3.appendChild($.chain);
    var nb = h("div", { c: "chips" }, [
      h("button", { c: "ch q", type: "button", t: "▶ قبلی", onclick: function () { nav("prev"); } }),
      h("button", { c: "ch q", type: "button", t: "◀ بعدی", onclick: function () { nav("next"); } }),
      h("button", { c: "ch q", type: "button", t: "⇅ پنل بالا/پایین", onclick: function () { ui.dock = ui.dock === "top" ? "bottom" : "top"; saveUI(); layoutPanel(); } })]);
    s3.appendChild(nb); into.appendChild(s3);

    var s4 = h("div", { c: "sec" }); s4.appendChild(h("h5", { t: "ساختار داخل این المنت (لمس = انتخاب)" }));
    var rows = []; collect(e, 0, rows);
    if (!rows.length) s4.appendChild(h("div", { c: "hint", t: "فرزندی ندارد." }));
    rows.forEach(function (r) {
      var cls = usable(r.el);
      s4.appendChild(h("div", { c: "tr", style: "padding-left:" + (6 + r.d * 14) + "px", onclick: function () { select(r.el); } }, [
        h("i", { t: "‹" + tagOf(r.el) + "›" }), h("span", { t: cls.length ? "." + cls.join(" .") : "" }), r.n > 1 ? h("em", { t: "×" + r.n }) : null]));
    });
    into.appendChild(s4);
  }
  function collect(el, d, out) {
    var seen = {};
    [].forEach.call(el.children, function (c) {
      if (SKIP[c.tagName] || isUI(c) || out.length >= 90) return;
      var sig = tagOf(c) + "|" + usable(c).join(".");
      if (seen[sig]) { seen[sig].n++; return; }
      var row = { el: c, d: d, n: 1 }; seen[sig] = row; out.push(row);
      if (d < 3) collect(c, d + 1, out);
    });
  }

  /* ---------- تب ۲: استایل ---------- */
  var Q_RADIUS = [["۰", "0"], ["۸", "8px"], ["۱۶", "16px"], ["۲۴", "24px"], ["دایره", "50%"], ["کپسول", "999px"]];
  var Q_SHADOW = [["بدون", "none"], ["نرم", "0 4px 14px rgba(0,0,0,.25)"], ["قوی", "0 10px 30px rgba(0,0,0,.5)"], ["نئون", "0 0 18px rgba(200,243,29,.7)"]];
  var SW = ["#c8f31d", "#111214", "#1c1d20", "#ffffff", "#ff4d4d", "#3b82f6", "#f59e0b", "#22c55e"];
  /* هر تب چند بخش دارد؛ fold:true = جمع‌شونده (کم‌کاربرد) */
  var TG = {
    look: [
      { t: "رنگ و زمینه", c: [
        { p: "background-color", l: "رنگ زمینه", k: "color", sw: 1 },
        { p: "opacity", l: "شفافیت", k: "num", min: 0, max: 1, st: 0.05, d: 1 },
        { p: "_bd", l: "شیشه‌ای (بلور)", k: "num", min: 0, max: 40, st: 1, d: 0 }] },
      { t: "گوشه، خط و سایه", c: [
        { p: "border-radius", l: "گردی گوشه", k: "len", min: 0, max: 120, q: Q_RADIUS },
        { p: "border-width", l: "ضخامت خط", k: "len", min: 0, max: 16, auto: { "border-style": "solid" } },
        { p: "border-color", l: "رنگ خط", k: "color", sw: 1, auto: { "border-style": "solid" } },
        { p: "box-shadow", l: "سایه", k: "text", q: Q_SHADOW, ph: "0 4px 14px rgba(0,0,0,.3)" }] },
      { t: "گرادیان یا عکس زمینه", fold: 1, c: [
        { p: "background-image", l: "گرادیان/عکس", k: "text", ph: "linear-gradient(135deg,#c8f31d,#0a84ff)" },
        { p: "background-size", l: "اندازه زمینه", k: "sel", o: ["auto", "cover", "contain", "100% 100%"] },
        { p: "border-style", l: "نوع خط", k: "sel", o: ["none", "solid", "dashed", "dotted", "double"] },
        { p: "outline", l: "outline", k: "text", ph: "2px solid #c8f31d" }] }
    ],
    size: [
      { t: "اندازه", c: [
        { p: "width", l: "عرض", k: "len", min: 0, max: 500 },
        { p: "height", l: "ارتفاع", k: "len", min: 0, max: 500 }] },
      { t: "فاصله", c: [
        { p: "padding", l: "حاشیه داخلی", k: "len", min: 0, max: 80 },
        { p: "margin", l: "حاشیه بیرونی", k: "len", min: -40, max: 80 },
        { p: "gap", l: "فاصله فرزندان", k: "len", min: 0, max: 60 }] },
      { t: "جزئیات فاصله و اندازه", fold: 1, c: [
        { p: "padding-top", l: "داخلی بالا", k: "len", min: 0, max: 80 }, { p: "padding-bottom", l: "داخلی پایین", k: "len", min: 0, max: 80 },
        { p: "margin-top", l: "بیرونی بالا", k: "len", min: -40, max: 80 }, { p: "margin-bottom", l: "بیرونی پایین", k: "len", min: -40, max: 80 },
        { p: "min-width", l: "حداقل عرض", k: "text" }, { p: "max-width", l: "حداکثر عرض", k: "text" },
        { p: "min-height", l: "حداقل ارتفاع", k: "text" }, { p: "max-height", l: "حداکثر ارتفاع", k: "text" },
        { p: "aspect-ratio", l: "نسبت", k: "text", ph: "1 / 1" },
        { p: "overflow", l: "سرریز", k: "sel", o: ["visible", "hidden", "auto", "scroll", "clip"] }] }
    ],
    text: [
      { t: "متن", c: [
        { p: "color", l: "رنگ متن", k: "color", sw: 1 },
        { p: "font-size", l: "اندازه فونت", k: "len", min: 8, max: 64 },
        { p: "font-weight", l: "ضخامت", k: "sel", o: ["300", "400", "500", "600", "700", "800", "900"] },
        { p: "text-align", l: "تراز", k: "seg", o: [["right", "راست"], ["center", "وسط"], ["left", "چپ"], ["justify", "کشیده"]] }] },
      { t: "جزئیات متن", fold: 1, c: [
        { p: "line-height", l: "ارتفاع خط", k: "num", min: 0.8, max: 3, st: 0.05, d: "" },
        { p: "letter-spacing", l: "فاصله حروف", k: "len", min: -3, max: 12, st: 0.5 },
        { p: "text-transform", l: "حروف", k: "sel", o: ["none", "uppercase", "lowercase", "capitalize"] },
        { p: "white-space", l: "شکست خط", k: "sel", o: ["normal", "nowrap", "pre-wrap"] },
        { p: "font-family", l: "فونت", k: "sel", o: ["Vazirmatn, sans-serif", "Inter, sans-serif", "system-ui, sans-serif", "ui-monospace, monospace", "Georgia, serif"] }] }
    ],
    more: [
      { t: "مخفی کردن", c: [{ p: "_hide", l: "مخفی (display:none)", k: "tog" }] },
      { t: "جابجایی و چرخش", fold: 1, c: [
        { p: "_tx", l: "جابجایی افقی", k: "num", min: -200, max: 200, st: 1, d: 0 }, { p: "_ty", l: "جابجایی عمودی", k: "num", min: -200, max: 200, st: 1, d: 0 },
        { p: "_scale", l: "بزرگ/کوچک", k: "num", min: 0.2, max: 2.5, st: 0.05, d: 1 }, { p: "_rot", l: "چرخش (درجه)", k: "num", min: -180, max: 180, st: 1, d: 0 }] },
      { t: "افکت", fold: 1, c: [
        { p: "_blur", l: "بلور", k: "num", min: 0, max: 20, st: 0.5, d: 0 }, { p: "_bright", l: "روشنایی", k: "num", min: 0, max: 2, st: 0.05, d: 1 },
        { p: "_sat", l: "اشباع رنگ", k: "num", min: 0, max: 2.5, st: 0.05, d: 1 },
        { p: "transition", l: "transition", k: "text", ph: "all .25s ease" }, { p: "animation", l: "animation", k: "text", ph: "none" },
        { p: "cursor", l: "نشانگر", k: "sel", o: ["auto", "pointer", "default", "grab", "not-allowed"] }] },
      { t: "چیدمان (flex / grid)", fold: 1, c: [
        { p: "display", l: "نمایش", k: "sel", o: ["block", "flex", "inline-flex", "grid", "inline-block", "inline", "none"] },
        { p: "flex-direction", l: "جهت", k: "sel", o: ["row", "row-reverse", "column", "column-reverse"] },
        { p: "flex-wrap", l: "شکستن ردیف", k: "sel", o: ["nowrap", "wrap", "wrap-reverse"] },
        { p: "justify-content", l: "تراز اصلی", k: "sel", o: ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"] },
        { p: "align-items", l: "تراز متقابل", k: "sel", o: ["stretch", "flex-start", "center", "flex-end", "baseline"] },
        { p: "flex", l: "flex", k: "text", ph: "1 1 auto" }, { p: "order", l: "ترتیب", k: "num", min: -10, max: 10, st: 1, d: "" },
        { p: "grid-template-columns", l: "ستون‌های grid", k: "text", ph: "repeat(3,1fr)" }] },
      { t: "موقعیت", fold: 1, c: [
        { p: "position", l: "موقعیت", k: "sel", o: ["static", "relative", "absolute", "fixed", "sticky"] },
        { p: "top", l: "top", k: "len", min: -100, max: 200 }, { p: "bottom", l: "bottom", k: "len", min: -100, max: 200 },
        { p: "left", l: "left", k: "len", min: -100, max: 200 }, { p: "right", l: "right", k: "len", min: -100, max: 200 },
        { p: "z-index", l: "z-index", k: "num", min: -5, max: 100, st: 1, d: "" }] },
      { t: "تصویر", fold: 1, c: [
        { p: "object-fit", l: "پر کردن قاب", k: "sel", o: ["cover", "contain", "fill", "none", "scale-down"] },
        { p: "object-position", l: "موقعیت عکس", k: "text", ph: "center top" }] }
    ]
  };

  function comp(p) { try { return T.el ? getComputedStyle(T.el).getPropertyValue(p).trim() : ""; } catch (e) { return ""; } }
  function toHex(c) {
    var m = String(c || "").match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/); if (!m) return /^#[0-9a-f]{6}$/i.test(c) ? c : "#000000";
    return "#" + [m[1], m[2], m[3]].map(function (x) { return ("0" + (+x).toString(16)).slice(-2); }).join("");
  }
  function curRule() { return getRule(false); }
  function getV(p) { var r = curRule(); return r && r.p[p] != null ? r.p[p] : ""; }

  function ctl(def) {
    var rw = h("div", { c: "rw" }), cl = h("div", { c: "ctl" });
    var lab = h("label", { t: def.l });
    var reset = h("button", { c: "x", type: "button", t: "✕", title: "حذف این تغییر" });
    var cur = getV(def.p), k = def.k, upd;
    function mark() { rw.classList.toggle("set", getV(def.p) !== ""); }
    var put = function (v) { setProp(def.p, v); if (def.auto && v !== "") Object.keys(def.auto).forEach(function (ak) { if (getV(ak) === "") setProp(ak, def.auto[ak]); }); mark(); };

    if (k === "len") {
      var txt = h("input", { c: "t", type: "text", placeholder: comp(def.p) || "auto", value: cur }); txt.className = "t"; txt.style.cssText = "max-width:96px;flex:0 0 96px";
      var rng = h("input", { type: "range", min: def.min, max: def.max, step: def.st || 1 });
      var syncR = function () { var n = parseFloat(txt.value || comp(def.p)); if (isNaN(n)) n = 0; rng.max = Math.max(def.max, n); rng.min = Math.min(def.min, n); rng.value = n; };
      syncR();
      var unitOf = function () { var m = String(txt.value).match(/(%|rem|em|vw|vh)$/); return m ? m[1] : "px"; };
      rng.addEventListener("input", function () { txt.value = rng.value + unitOf(); put(txt.value); });
      txt.addEventListener("input", function () { put(txt.value.trim()); syncR(); });
      txt.addEventListener("change", function () { if (/^-?\d+(\.\d+)?$/.test(txt.value.trim())) { txt.value = txt.value.trim() + "px"; put(txt.value); } });
      cl.appendChild(rng); cl.appendChild(txt);
      if (def.q) { var qb = h("div", { c: "chips", style: "flex:1 1 100%" }); def.q.forEach(function (q) { qb.appendChild(h("button", { c: "ch q", type: "button", t: q[0], onclick: function () { txt.value = q[1]; put(q[1]); syncR(); } })); }); cl.appendChild(qb); }
      upd = function () { txt.value = ""; syncR(); };
    } else if (k === "num") {
      var rn = h("input", { type: "range", min: def.min, max: def.max, step: def.st });
      var out = h("input", { c: "t", type: "text", placeholder: def.p.charAt(0) === "_" ? String(def.d) : (comp(def.p) || ""), value: cur }); out.style.cssText = "max-width:70px;flex:0 0 70px";
      var start = cur !== "" ? parseFloat(cur) : (def.p.charAt(0) === "_" ? def.d : parseFloat(comp(def.p)));
      rn.value = isNaN(start) ? (def.d === "" ? def.min : def.d) : start;
      rn.addEventListener("input", function () {
        var v = +rn.value; out.value = v;
        put((def.d !== "" && v === def.d && def.p.charAt(0) === "_") ? "" : String(v));
      });
      out.addEventListener("input", function () { put(out.value.trim()); var n = parseFloat(out.value); if (!isNaN(n)) rn.value = n; });
      cl.appendChild(rn); cl.appendChild(out);
      upd = function () { out.value = ""; rn.value = def.d === "" ? def.min : def.d; };
    } else if (k === "color") {
      var pk = h("input", { type: "color", value: toHex(cur || comp(def.p)) });
      var ct = h("input", { c: "t", type: "text", placeholder: comp(def.p) || "#rrggbb", value: cur });
      pk.addEventListener("input", function () { ct.value = pk.value; put(pk.value); });
      ct.addEventListener("input", function () { put(ct.value.trim()); if (/^#[0-9a-f]{6}$/i.test(ct.value.trim())) pk.value = ct.value.trim(); });
      cl.appendChild(pk); cl.appendChild(ct);
      var tp = h("button", { c: "ch q", type: "button", t: "شفاف", onclick: function () { ct.value = "transparent"; put("transparent"); } }); cl.appendChild(tp);
      if (def.sw) { var swr = h("div", { c: "chips", style: "flex:1 1 100%" }); SW.forEach(function (c) { var sb = h("button", { c: "sw", type: "button", title: c, onclick: function () { ct.value = c; pk.value = toHex(c); put(c); } }); sb.style.background = c; swr.appendChild(sb); }); cl.appendChild(swr); }
      upd = function () { ct.value = ""; pk.value = toHex(comp(def.p)); };
    } else if (k === "sel") {
      var s = h("select", { style: "flex:1" }, [h("option", { value: "", t: comp(def.p) ? "(" + comp(def.p).slice(0, 24) + ")" : "پیش‌فرض" })].concat(def.o.map(function (o) { return h("option", { value: o, t: o.length > 28 ? o.slice(0, 28) : o }); })));
      s.value = cur; if (cur && s.value !== cur) { s.appendChild(h("option", { value: cur, t: cur })); s.value = cur; }
      s.addEventListener("change", function () { put(s.value); });
      cl.appendChild(s); upd = function () { s.value = ""; };
    } else if (k === "seg") {
      var sgw = h("div", { c: "seg", style: "flex:1" }), sgb = def.o.map(function (o) {
        return h("button", { c: "sg" + (cur === o[0] ? " on" : ""), type: "button", t: o[1], onclick: function () { put(getV(def.p) === o[0] ? "" : o[0]); syncSg(); } });
      });
      var syncSg = function () { sgb.forEach(function (b2, i) { b2.classList.toggle("on", getV(def.p) === def.o[i][0]); }); };
      sgb.forEach(function (b2) { sgw.appendChild(b2); }); cl.appendChild(sgw); upd = syncSg;
    } else if (k === "tog") {
      var tb = h("button", { c: "ib" + (cur === "1" ? " on" : ""), type: "button", t: cur === "1" ? "مخفی است" : "نمایان", onclick: function () {
        var on = getV(def.p) !== "1"; put(on ? "1" : ""); tb.className = "ib" + (on ? " on" : ""); tb.textContent = on ? "مخفی است" : "نمایان"; } });
      cl.appendChild(tb); upd = function () { tb.className = "ib"; tb.textContent = "نمایان"; };
    } else { // text
      var tx = h("input", { c: "t", type: "text", placeholder: def.ph || comp(def.p) || "", value: cur });
      tx.addEventListener("input", function () { put(tx.value.trim()); });
      cl.appendChild(tx);
      if (def.q) { var q2 = h("div", { c: "chips", style: "flex:1 1 100%" }); def.q.forEach(function (q) { q2.appendChild(h("button", { c: "ch q", type: "button", t: q[0], onclick: function () { tx.value = q[1]; put(q[1]); } })); }); cl.appendChild(q2); }
      upd = function () { tx.value = ""; };
    }
    reset.addEventListener("click", function () { put(""); upd(); });
    rw.appendChild(lab); rw.appendChild(cl); rw.appendChild(reset); mark();
    return rw;
  }

  function groupBody(g) {
    var inner = h("div"); g.c.forEach(function (d) { inner.appendChild(ctl(d)); }); return inner;
  }
  function renderGroups(groups) {
    var bd = $.bd;
    groups.forEach(function (g) {
      var used = g.c.some(function (d) { return getV(d.p) !== ""; });
      if (g.fold) {
        var dt = h("details", {}, [h("summary", { t: g.t + (used ? "  ●" : "") })]);
        dt.open = !!ui.groups[g.t] || used;
        dt.addEventListener("toggle", function () { ui.groups[g.t] = dt.open ? 1 : 0; });
        dt.appendChild(groupBody(g)); bd.appendChild(dt);
      } else {
        var sec = h("div", { c: "sec" }, [h("h5", { t: g.t })]); sec.appendChild(groupBody(g)); bd.appendChild(sec);
      }
    });
    if (T.pseudo === "::before" || T.pseudo === "::after") bd.appendChild(h("div", { c: "hint", t: "برای نمایش ::before/::after باید در «بیشتر ← CSS دلخواه» مثلاً content:'' بگذاری." }));
    bd.appendChild(h("div", { c: "hint", t: "هر عددی که عوض کنی همان لحظه روی صفحه دیده می‌شود. ✕ کنار هر مورد = برگشت به حالت اصلی." }));
  }
  function renderMore() {
    var bd = $.bd, r = curRule();
    renderGroups(TG.more);
    var dr = h("details", {}, [h("summary", { t: "CSS دلخواه" + (r && r.raw ? "  ●" : "") })]);
    dr.open = !!(r && r.raw) || !!ui.groups["raw"]; dr.addEventListener("toggle", function () { ui.groups["raw"] = dr.open ? 1 : 0; });
    var ta = h("textarea", { placeholder: "mix-blend-mode: screen;\nclip-path: circle(45%);\ncontent: '';", spellcheck: "false" }); ta.value = (r && r.raw) || "";
    ta.addEventListener("input", function () { setRaw(ta.value); });
    var di = h("div"); di.appendChild(ta); di.appendChild(h("div", { c: "hint", t: "هر خط یک پراپرتی؛ خودکار !important می‌گیرد." })); dr.appendChild(di); bd.appendChild(dr);
    var adv = h("details", {}, [h("summary", { t: "انتخاب دقیق‌تر (کلاس‌ها، محدوده، ساختار)" })]);
    adv.open = !!ui.groups["adv"]; adv.addEventListener("toggle", function () { ui.groups["adv"] = adv.open ? 1 : 0; });
    var ai = h("div"); renderAdvanced(ai); adv.appendChild(ai); bd.appendChild(adv);
  }

  /* ---------- ثبت در سرور / بکاپ‌ها ---------- */
  var msgEl = null;
  function say(t) { if (msgEl) { msgEl.textContent = t; clearTimeout(say.t); say.t = setTimeout(function () { if (msgEl) msgEl.textContent = ""; }, 4000); } }
  function doPublish() {
    if (!window.CMSync) { say("ماژول ثبت روی سرور (site-sync.js) نصب نیست"); return; }
    say("در حال ثبت روی سرور…");
    CMSync.publish("design", D).then(function (r) {
      if (!r.download) { server = clone(D); try { localStorage.removeItem(LS); localStorage.setItem(LSC, buildCSS(D)); } catch (e) {} }
      say(r.msg || (r.unchanged ? "تغییری نسبت به نسخهٔ سرور نبود" : "ثبت شد؛ برای همهٔ کاربران فعال است ✓")); updHead();
    }, function (e) { say(e.message); });
  }
  function doBackups() {
    if (!window.CMSync) { say("ماژول بکاپ (site-sync.js) نصب نیست"); return; }
    CMSync.panel("design", { onRestored: function (d, loc) {
      if (!d || !Array.isArray(d.rules)) return;
      D = clone(d);
      if (loc) { saveLocal(); try { localStorage.setItem(LSC, buildCSS(D)); } catch (e) {} }
      else { server = clone(d); try { localStorage.removeItem(LS); localStorage.setItem(LSC, buildCSS(D)); } catch (e) {} }
      applyCSS(); pushHist(); renderBody(); sched();
    } });
  }
  function copy(t, okMsg) {
    var done = function () { say(okMsg); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { window.prompt("کپی کن:", t); });
    else window.prompt("کپی کن:", t);
  }

  /* ---------- لیست تغییرات + ابزار ---------- */
  function renderRules() {
    var bd = $.bd;
    bd.appendChild(h("div", { c: "hint", style: "margin:0 0 10px", t: D.rules.length ? D.rules.length + " تغییر · " + (isDirty() ? "هنوز روی سرور ثبت نشده (دکمهٔ سبز پایین)" : "با سرور یکی است ✓") : "هنوز تغییری نداری." }));
    D.rules.forEach(function (r, i) {
      var n = Object.keys(r.p || {}).length + (r.raw ? 1 : 0);
      var el = null; try { el = document.querySelector(r.s.replace(/(::?[a-z-]+(\([^)]*\))?)$/i, "")); } catch (e) {}
      bd.appendChild(h("div", { c: "ru" }, [
        h("code", { t: r.s, title: "رفتن به این قانون", onclick: function () {
          var tgt = null; try { tgt = [].filter.call(document.querySelectorAll(r.s.replace(/(::?[a-z-]+(\([^)]*\))?)$/i, "")), function (x) { return !isUI(x); })[0]; } catch (e) {}
          if (!tgt) { say("در این صفحه چنین المنتی نیست؛ به صفحهٔ مربوطه برو"); return; }
          select(tgt); T.over = r.s; T.media = r.m || ""; T.tab = "look"; saveUI(); renderBody(); revealEl(tgt);
        } }),
        h("small", { t: (r.m === "m" ? "📱 " : r.m === "d" ? "🖥 " : "") + n + " مورد" + (el ? "" : " · ⌀") }),
        h("button", { c: "ib dng", type: "button", t: "🗑", onclick: function () { D.rules.splice(i, 1); applyCSS(); saveLocal(); pushHist(); renderBody(); sched(); } })]));
    });
    var tools = h("details", {}, [h("summary", { t: "ابزار و خروجی" })]);
    tools.open = !!ui.groups["tools"]; tools.addEventListener("toggle", function () { ui.groups["tools"] = tools.open ? 1 : 0; });
    var top = h("div", { c: "chips" });
    top.appendChild(h("button", { c: "ib", type: "button", t: "⬇ دانلود JSON", onclick: function () {
      var blob = new Blob([JSON.stringify(D, null, 2)], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "design-overrides.json"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); say("دانلود شد");
    } }));
    top.appendChild(h("button", { c: "ib", type: "button", t: "کپی JSON", onclick: function () { copy(JSON.stringify(D), "JSON کپی شد"); } }));
    top.appendChild(h("button", { c: "ib", type: "button", t: "کپی CSS", onclick: function () { copy(buildCSS(D).replace(new RegExp(PFX.replace(/[.*+?^${}()|[\]\\:]/g, "\\$&"), "g"), ""), "CSS کپی شد"); } }));
    top.appendChild(h("button", { c: "ib", type: "button", t: "وارد کردن", onclick: function () {
      var t = window.prompt("متن JSON خروجی را paste کن:"); if (!t) return;
      try { var j = JSON.parse(t); if (!j || !Array.isArray(j.rules)) throw 0; D = j; applyCSS(); saveLocal(); pushHist(); renderBody(); say("وارد شد"); } catch (e) { say("JSON نامعتبر است"); }
    } }));
    top.appendChild(h("button", { c: "ib dng", type: "button", t: "برگشت به نسخهٔ سرور", onclick: function () {
      if (!window.confirm("تغییرات ثبت‌نشده پاک و نسخهٔ سرور برگردانده شود؟")) return;
      try { localStorage.removeItem(LS); } catch (e) {} D = server ? clone(server) : { v: 1, rules: [] }; applyCSS(); pushHist(); renderBody(); sched();
    } }));
    top.appendChild(h("button", { c: "ib dng", type: "button", t: "حذف همه", onclick: function () { if (!window.confirm("همهٔ تغییرات دیزاین حذف شود؟")) return; D = { v: 1, rules: [] }; applyCSS(); saveLocal(); pushHist(); renderBody(); sched(); } }));
    var ti = h("div"); ti.appendChild(top); tools.appendChild(ti); bd.appendChild(tools);
  }

  /* ============================================================
   *  راه‌اندازی
   * ============================================================ */
  function boot() {
    if (!isAdmin()) return;
    build(); layoutPanel(); updHead();
    ["pointerdown", "mousedown", "touchstart"].forEach(function (ev) { window.addEventListener(ev, ev === "pointerdown" ? onDown : blockSoft, true); });
    ["pointerup"].forEach(function (ev) { window.addEventListener(ev, onUp, true); });
    ["mouseup", "touchend", "dblclick", "auxclick"].forEach(function (ev) { window.addEventListener(ev, blockSoft, true); });
    ["click", "contextmenu", "submit", "dragstart"].forEach(function (ev) { window.addEventListener(ev, block, true); });
    window.addEventListener("pointermove", hoverMove, true);
    window.addEventListener("scroll", sched, true);
    window.addEventListener("resize", function () { sched(); });
    new MutationObserver(function () { if (ui.open) sched(); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    window.CMDesign = { open: open, close: close, data: function () { return D; }, select: select, css: function () { return buildCSS(D); } };
  }
  window.CMDesignPublic = { css: function () { return buildCSS(D); } };
  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);
})();
CM_EOF_DESIGN_INSPECTOR_JS
echo ">> نوشته شد: design-inspector.js"

# ---- افزودن تگ‌ها به HTML (قبل از </body>) ----
CFG=""
[ -n "$ROOT" ] && CFG="$CFG window.CM_EDITOR_ROOT=$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$ROOT");"
[ -n "$API" ] && CFG="$CFG window.CM_SYNC_API=$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$API");"
for f in $HTMLS; do
  [ -f "$f" ] || { echo "!! پیدا نشد: $f"; continue; }
  cp "$f" "$f.bak-editors-$TS"
  CFG="$CFG" V="$V" python3 - "$f" <<'PYINJ'
import os,re,sys
p=sys.argv[1]; s=open(p,encoding="utf-8").read(); cfg=os.environ.get("CFG","").strip(); v=os.environ["V"]
s=re.sub(r'\s*<!-- cm-editors:begin -->.*?<!-- cm-editors:end -->','',s,flags=re.S)
blk='\n<!-- cm-editors:begin -->\n'
if cfg: blk+='<script>'+cfg+'</script>\n'
blk+=('<script src="site-sync.js?v=%s" defer></script>\n<script src="layout-editor.js?v=%s" defer></script>\n'
      '<script src="design-inspector.js?v=%s" defer></script>\n<!-- cm-editors:end -->\n')%(v,v,v)
if re.search(r'</body>',s,re.I): s=re.sub(r'</body>',lambda m: blk+m.group(0),s,count=1,flags=re.I)
else: s+=blk
open(p,"w",encoding="utf-8").write(s)
PYINJ
  echo ">> تگ‌ها اضافه شد: $f"
done
echo
echo "✓ نصب شد. (بکاپ‌ها: *.bak-editors-$TS)"
echo "  دیزاین : آدرس سایت + ?design=1   ← دکمهٔ «🎨 دیزاین»"
echo "  چیدمان : آدرس سایت + ?layout=1   ← دکمهٔ «✎ چیدمان»"
if [ -z "$API" ]; then
  echo "  ثبت برای همه: دکمهٔ «ثبت» فایل JSON دانلود می‌کند؛ آن را کنار index.html آپلود کن:"
  echo "     layout-default.json (چیدمان)  و  design-overrides.json (دیزاین)"
fi
[ -z "$ROOT" ] && echo "  اگر چیدمان بخش اشتباهی را می‌گیرد، دوباره با --root \"main\" (یا هر سلکتور) اجرا کن."
exit 0
