/* CarMaa Layout Editor v1 — جابجایی المان‌ها با دستگیره، پنل حرفه‌ای، بدون دست‌زدن به DOM سایت
 * فعال‌سازی: آدرس سایت + ?layout=1   |   خاموش: ?layout=0   |   اضطراری (بدون اعمال چیدمان): ?nolayout=1   |   پاک‌کردن همه‌چیز محلی: ?layout=reset
 * روش کار: فقط یک <style> با قانون «translate» برای هر المان ساخته می‌شود؛ رندر مجدد صفحه چیزی را خراب نمی‌کند.
 * انتشار: فایل layout-default.json کنار index.html (همه‌ی بازدیدکننده‌ها اعمالش می‌کنند). */
(function () {
  "use strict";
  if (window.__cmLE) return;
  window.__cmLE = 1;
  try { boot(); } catch (e) { try { console.warn("[layout-editor]", e); } catch (_) {} }

  function boot() {
    var D = document, W = window, V = 1;
    var PROP = (W.CSS && CSS.supports && CSS.supports("translate", "1px 1px")) ? "translate" : "transform";
    var K_ADMIN = "cm_le_admin", K_DRAFT = "cm_le_draft", K_PUB = "cm_le_pub", K_UI = "cm_le_ui";
    var src = (D.currentScript && D.currentScript.src) || "";
    var BASE = src ? src.replace(/[^\/]*$/, "") : "/";
    var qs = location.search || "";

    function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
    function lsRm(k) { try { localStorage.removeItem(k); } catch (e) {} }
    function jparse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
    function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }
    function num(v) { v = Math.round(Number(v)); return isFinite(v) ? clamp(v, -3000, 3000) : 0; }
    function esc(v) { return (W.CSS && CSS.escape) ? CSS.escape(v) : String(v).replace(/[^\w-]/g, "\\$&"); }
    function h(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

    if (/[?&]layout=reset\b/.test(qs)) { lsRm(K_ADMIN); lsRm(K_DRAFT); lsRm(K_PUB); lsRm(K_UI); }
    if (/[?&]layout=1\b/.test(qs)) lsSet(K_ADMIN, "1");
    if (/[?&]layout=0\b/.test(qs)) lsRm(K_ADMIN);
    var BYPASS = /[?&]nolayout=1\b/.test(qs);
    var isAdmin = ls(K_ADMIN) === "1";
    var autoOpen = /[?&]layout=1\b/.test(qs);

    /* ---------- داده ---------- */
    var BADSEL = /[{}<;@]|\/\*/;
    function okItem(o) {
      return o && typeof o.s === "string" && o.s.length > 0 && o.s.length <= 700 && !BADSEL.test(o.s) &&
        typeof o.p === "string" && /^[\w*.\-]{1,40}$/.test(o.p) && (o.b === "m" || o.b === "d");
    }
    function clean(a) {
      var out = [], seen = {};
      if (!Array.isArray(a)) return out;
      for (var i = 0; i < a.length && out.length < 400; i++) {
        var o = a[i];
        if (!okItem(o)) continue;
        var x = num(o.x), y = num(o.y);
        if (!x && !y) continue;
        var k = o.b + "|" + o.p + "|" + o.s;
        if (seen[k]) continue;
        seen[k] = 1;
        out.push({ s: o.s, p: o.p, b: o.b, x: x, y: y, n: typeof o.n === "string" ? o.n.slice(0, 40) : "" });
      }
      return out;
    }
    function clone(a) { return jparse(JSON.stringify(a)) || []; }
    function canon(a) {
      return JSON.stringify(clean(a).map(function (o) { return [o.b, o.p, o.s, o.x, o.y]; }).sort(function (a, b) { return a.join("|") < b.join("|") ? -1 : 1; }));
    }
    function readStore(k) { var j = jparse(ls(k)); return j && Array.isArray(j.items) ? { items: clean(j.items) } : null; }

    var pub = readStore(K_PUB) || { items: [] };
    var draft = isAdmin ? readStore(K_DRAFT) : null;
    var items = clone(draft ? draft.items : pub.items);
    var editing = false, sel = null, drag = null;
    var hist = [JSON.stringify(items)], hi = 0, hKey = null, hT = 0;
    var ui = { dock: "b", step: 5, snap: 0, lock: "f" };
    (function () { var u = jparse(ls(K_UI)); if (u && typeof u === "object") { if (u.dock === "t") ui.dock = "t"; if ([1, 5, 10, 25].indexOf(u.step) > -1) ui.step = u.step; if ([0, 5, 10].indexOf(u.snap) > -1) ui.snap = u.snap; if (u.lock === "x" || u.lock === "y") ui.lock = u.lock; } })();
    function saveUI() { lsSet(K_UI, JSON.stringify(ui)); }

    /* ---------- قوانین CSS ---------- */
    var style = D.createElement("style");
    style.id = "cm-le-rules";
    (D.head || D.documentElement).appendChild(style);
    var lastCss = null, selOK = {};
    function selValid(s) {
      if (selOK[s] !== undefined) return selOK[s];
      var ok = true;
      try { D.createDocumentFragment().querySelector(s); } catch (e) { ok = false; }
      return (selOK[s] = ok);
    }
    function pageKey() {
      try { if (typeof state !== "undefined" && state && state.route && state.route.page) return String(state.route.page).replace(/[^\w.\-]/g, "").slice(0, 40) || "home"; } catch (e) {}
      var p = (location.pathname || "/").split("/").filter(Boolean)[0];
      return (p || "home").replace(/[^\w.\-]/g, "").slice(0, 40) || "home";
    }
    function bpNow() { return W.innerWidth >= 900 ? "d" : "m"; }
    function applyRules() {
      var t = "";
      if (!BYPASS) {
        var pg = pageKey(), b = bpNow(), out = [];
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          if (it.b !== b || (it.p !== "*" && it.p !== pg) || !selValid(it.s)) continue;
          out.push(it.s + "{" + PROP + ":" + (PROP === "translate" ? it.x + "px " + it.y + "px" : "translate(" + it.x + "px," + it.y + "px)") + " !important}");
        }
        t = out.join("\n");
      }
      if (t !== lastCss) { style.textContent = t; lastCss = t; }
    }
    applyRules();

    /* ---------- انتشار (layout-default.json) ---------- */
    function syncPublished() {
      if (BYPASS || !W.fetch) return;
      fetch(BASE + "layout-default.json", { cache: "no-cache", credentials: "same-origin" }).then(function (r) {
        if (!r.ok) return { none: 1 };
        return r.text().then(function (t) { var j = jparse(t); return j && Array.isArray(j.items) ? { j: j } : { none: 1 }; });
      }).then(function (res) {
        if (res.none) { pub = { items: [] }; lsRm(K_PUB); } else { pub = { items: clean(res.j.items) }; lsSet(K_PUB, JSON.stringify({ v: V, items: pub.items })); }
        if (draft && canon(draft.items) === canon(pub.items)) { draft = null; lsRm(K_DRAFT); }
        if (!draft && !(editing && hi > 0)) { items = clone(pub.items); hist = [JSON.stringify(items)]; hi = 0; applyRules(); }
        refresh();
      }).catch(function () {});
    }
    syncPublished();

    /* ---------- تولید سلکتور پایدار ---------- */
    var UTIL = /^(?:flex|grid|block|inline|hidden|relative|absolute|fixed|sticky|static|w|h|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|text|bg|border|rounded|font|min|max|z|overflow|items|justify|self|shrink|grow|basis|col|row|space|leading|tracking|opacity|shadow|cursor|select|transition|duration|ease|top|left|right|bottom|inset|object|whitespace|truncate|uppercase|underline|order|translate|scale|rotate|sr|aspect|size|line|backdrop|ring|outline|fill|stroke|divide|pointer|snap|scroll|touch|will|isolate|container|float|clear|list|align|content|place)(?:-|$)/;
    var STATE = /^(?:is-|has-|js-|cm-le|active$|open$|show$|shown$|visible$|selected$|current$|loading$|loaded$|ready$|on$|off$|hover|focus|pressed$|disabled$|entering$|leaving$|enter|leave|in$|out$|animate|skeleton)/i;
    function goodClass(k) {
      return k && k.length <= 48 && !/[\[\]:\/\\%!@.()#]/.test(k) && !UTIL.test(k) && !STATE.test(k) && !/\d{4,}/.test(k) && !/^[a-f0-9]{8,}$/i.test(k);
    }
    function seg(el) {
      if (el.id && !/\d{5,}/.test(el.id) && D.querySelectorAll("#" + esc(el.id)).length === 1) return { s: "#" + esc(el.id), id: 1 };
      var s = el.tagName.toLowerCase(), cl = (el.getAttribute("class") || "").split(/\s+/).filter(goodClass).slice(0, 3), i;
      for (i = 0; i < cl.length; i++) s += "." + esc(cl[i]);
      ["data-page", "data-dock", "data-tab", "data-section"].forEach(function (a) {
        var v = el.getAttribute(a);
        if (v && /^[\w\-]{1,40}$/.test(v)) s += "[" + a + '="' + v + '"]';
      });
      var p = el.parentElement;
      if (p) {
        var ch = p.children, idx = 0, dup = false;
        for (i = 0; i < ch.length; i++) { if (ch[i] === el) idx = i + 1; else if (!dup) { try { dup = ch[i].matches(s); } catch (e) {} } }
        if (dup) s += ":nth-child(" + idx + ")";
      }
      return { s: s };
    }
    function isUnique(sel, el) {
      try { var l = D.querySelectorAll(sel); return l.length === 1 && l[0] === el; } catch (e) { return false; }
    }
    function selectorFor(el) {
      var path = [], cur = el;
      while (cur && cur.nodeType === 1 && cur !== D.body && cur !== D.documentElement) {
        var sg = seg(cur);
        path.unshift(sg.s);
        var sel = path.join(" > ");
        if (isUnique(sel, el)) return sel;
        if (sg.id) break;
        cur = cur.parentElement;
      }
      path = []; cur = el;
      while (cur && cur !== D.documentElement) {
        var p = cur.parentElement, i = p ? Array.prototype.indexOf.call(p.children, cur) + 1 : 1;
        path.unshift(cur.tagName.toLowerCase() + ":nth-child(" + i + ")");
        cur = p;
      }
      return path.join(" > ");
    }
    function labelFor(el) {
      var t = (el.getAttribute("aria-label") || (el.textContent || "")).replace(/\s+/g, " ").trim().slice(0, 18);
      var c = (el.getAttribute("class") || "").split(/\s+/).filter(goodClass)[0];
      return t || (el.tagName.toLowerCase() + (c ? "." + c : "")).slice(0, 24);
    }
    function chipFor(el) {
      var c = (el.getAttribute("class") || "").split(/\s+/).filter(goodClass)[0];
      return (el.tagName.toLowerCase() + (c ? "." + c : "")).slice(0, 22);
    }

    /* ---------- همه‌ی بخش‌های ویرایش فقط برای ادمین ساخته می‌شود ---------- */
    var host, sh, R = {}, raf = 0, lastPage = pageKey(), lastBp = bpNow();
    function el$(id) { return sh.getElementById ? sh.getElementById(id) : sh.querySelector("#" + id); }

    function findItem(s) {
      var pg = pageKey(), b = bpNow();
      for (var i = 0; i < items.length; i++) { var it = items[i]; if (it.s === s && it.b === b && (it.p === pg || it.p === "*")) return it; }
      return null;
    }
    function curOff() { var it = sel && findItem(sel.s); return it ? { x: it.x, y: it.y } : { x: 0, y: 0 }; }
    function defaultScope(el) {
      try { var cs = getComputedStyle(el); if (cs.position === "fixed" || cs.position === "sticky" || !el.closest("#pageContent")) return "*"; } catch (e) {}
      return pageKey();
    }
    function persistDraft() {
      if (!isAdmin) return;
      draft = { v: V, t: Date.now(), items: clone(items) };
      if (!lsSet(K_DRAFT, JSON.stringify(draft))) toast("حافظهٔ مرورگر پر است؛ پیش‌نویس ذخیره نشد");
    }
    function commit(key) {
      var snap = JSON.stringify(items);
      if (snap === hist[hi]) return;
      var now = Date.now();
      if (key && key === hKey && now - hT < 900) hist[hi] = snap;
      else { hist.length = hi + 1; hist.push(snap); hi++; if (hist.length > 100) { hist.shift(); hi--; } }
      hKey = key || null; hT = now;
      persistDraft(); refresh();
    }
    function setOff(x, y, final, key) {
      if (!sel) return;
      x = num(x); y = num(y);
      var it = findItem(sel.s);
      if (!it) {
        if (!x && !y) { refresh(); return; }
        if (items.length >= 400) { toast("سقف ۴۰۰ المان جابجاشده"); return; }
        it = { s: sel.s, p: sel.scope, b: bpNow(), x: 0, y: 0, n: labelFor(sel.el) };
        items.push(it);
      }
      it.x = x; it.y = y;
      if (!x && !y) items.splice(items.indexOf(it), 1);
      applyRules();
      if (final) commit(key); else refresh(true);
    }
    function undo() { if (hi > 0) { hi--; items = jparse(hist[hi]) || []; hKey = null; persistDraft(); applyRules(); refresh(); } }
    function redo() { if (hi < hist.length - 1) { hi++; items = jparse(hist[hi]) || []; hKey = null; persistDraft(); applyRules(); refresh(); } }
    function exportJSON() { return JSON.stringify({ v: V, t: new Date().toISOString(), items: clean(items) }, null, 1); }

    /* ---------- انتخاب المان ---------- */
    var SKIPID = { app: 1, appFrame: 1, appViewport: 1, pageBlurWrap: 1, pageContent: 1 };
    function pickable(el) {
      if (!el || el.nodeType !== 1 || el === host || el === D.documentElement || el === D.body) return false;
      if (el.id && SKIPID[el.id]) return false;
      var r = el.getBoundingClientRect();
      return r.width >= 2 && r.height >= 2;
    }
    function pickAt(x, y) {
      var l = D.elementsFromPoint ? D.elementsFromPoint(x, y) : [D.elementFromPoint(x, y)];
      for (var i = 0; i < l.length; i++) {
        var el = l[i];
        if (el && el.closest) { var sv = el.closest("svg"); if (sv && sv !== el) el = sv; }
        if (pickable(el)) { select(el); return; }
      }
    }
    function select(el) {
      if (!el || !el.isConnected) { sel = null; refresh(); return; }
      sel = { el: el, s: selectorFor(el), scope: defaultScope(el) };
      var it = findItem(sel.s);
      if (it) sel.scope = it.p;
      refresh();
    }

    /* ---------- رابط کاربری (Shadow DOM) ---------- */
    var CSS_UI = "\
:host{all:initial}*{box-sizing:border-box;font-family:Vazirmatn,system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;-webkit-tap-highlight-color:transparent}\
.root{position:fixed;inset:0;pointer-events:none;direction:rtl;color:#fff;font-size:13px;line-height:1.5}.root>*{pointer-events:auto}\
button{font:inherit;color:inherit;cursor:pointer;touch-action:manipulation}[hidden]{display:none!important}\
.fab{position:fixed;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 92px);width:46px;height:46px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:#1a0c0e;display:grid;place-items:center;box-shadow:0 8px 24px rgba(0,0,0,.55);padding:0}\
.fab i{position:absolute;top:1px;right:1px;width:12px;height:12px;border-radius:50%;background:#f5b301;border:2px solid #1a0c0e;display:none}.fab.dirty i{display:block}\
.box{position:fixed;pointer-events:none;border:2px solid #9b1b30;border-radius:6px;background:rgba(155,27,48,.1);display:none}\
.lb{position:absolute;top:-26px;inset-inline-start:-2px;max-width:70vw;padding:2px 8px;border-radius:7px;background:#9b1b30;font-size:11px;white-space:nowrap;direction:ltr;overflow:hidden;text-overflow:ellipsis}\
.hdl{position:fixed;width:48px;height:48px;border-radius:50%;background:#9b1b30;border:3px solid #fff;display:none;place-items:center;box-shadow:0 6px 20px rgba(0,0,0,.6);touch-action:none;cursor:grab;pointer-events:auto}.hdl.dg{cursor:grabbing;transform:scale(1.08)}\
.pn{position:fixed;left:0;right:0;margin:0 auto;bottom:0;width:min(100%,540px);max-height:min(54vh,470px);max-height:min(54dvh,470px);display:flex;flex-direction:column;background:rgba(18,12,13,.97);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.12);border-bottom:0;border-radius:20px 20px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,.55);padding-bottom:env(safe-area-inset-bottom,0px)}\
.pn.t{bottom:auto;top:0;border-radius:0 0 20px 20px;border:1px solid rgba(255,255,255,.12);border-top:0;padding:env(safe-area-inset-top,0px) 0 0;box-shadow:0 12px 40px rgba(0,0,0,.55)}\
.pn.min .tabs,.pn.min .bd,.pn.min .ms{display:none}\
.hd{display:flex;align-items:center;gap:6px;padding:10px 12px 8px}.ti{flex:1;min-width:0}.ti b{display:block;font-size:14px}.ti small{display:block;color:#a99a9c;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.ib{min-width:36px;height:36px;border-radius:11px;border:1px solid rgba(255,255,255,.14);background:#241a1c;font-size:15px;padding:0 8px}.ib:disabled{opacity:.3}.ib.x{background:#9b1b30;border-color:#9b1b30}\
.tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.1);padding:0 8px}.tb{flex:1;height:38px;border:0;border-bottom:2px solid transparent;background:none;color:#a99a9c;font-weight:700;font-size:12.5px;white-space:nowrap}.tb.on{color:#fff;border-bottom-color:#9b1b30}.tb em{font-style:normal;color:#9b1b30}\
.bd{overflow:auto;padding:12px;flex:1 1 auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}\
.ms{min-height:0;text-align:center;color:#ffb3b8;font-size:11.5px}.ms:not(:empty){padding:4px 12px 8px}\
.hint{color:#a99a9c;font-size:12.5px;line-height:1.9;text-align:center;padding:14px 6px}\
.nm{font-weight:800;font-size:13.5px;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.cr{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none}.cr::-webkit-scrollbar{display:none}\
.chip{flex:0 0 auto;height:28px;padding:0 10px;border-radius:99px;border:1px solid rgba(255,255,255,.16);background:#241a1c;font-size:11px;direction:ltr}.chip.on{background:#9b1b30;border-color:#9b1b30}\
.g2{display:flex;gap:14px;align-items:center;justify-content:space-between;margin:4px 0 10px}\
.dp{direction:ltr;display:grid;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,46px);gap:5px}.dp button{border-radius:13px;border:1px solid rgba(255,255,255,.14);background:#2a1d20;font-size:16px;padding:0}.dp .u{grid-area:1/2}.dp .l{grid-area:2/1}.dp .z{grid-area:2/2;background:#1a0c0e;font-size:14px}.dp .r{grid-area:2/3}.dp .d{grid-area:3/2}.dp button:active{background:#9b1b30}\
.xy{flex:1;display:flex;flex-direction:column;gap:8px}.xy label{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#cdbfc1}.xy label span{width:62px}\
input,textarea{width:100%;min-width:0;height:38px;border-radius:11px;border:1px solid rgba(255,255,255,.16);background:#0e0809;color:#fff;font-size:15px;padding:0 10px;direction:ltr;text-align:center}textarea{height:120px;padding:8px;font-size:11px;text-align:left;font-family:ui-monospace,Menlo,monospace}\
.opt{display:flex;align-items:center;gap:10px;margin:7px 0}.opt>span{width:76px;font-size:11.5px;color:#cdbfc1;flex:0 0 auto}\
.seg{flex:1;display:flex;background:#0e0809;border:1px solid rgba(255,255,255,.12);border-radius:11px;padding:2px}.seg button{flex:1;height:30px;border:0;border-radius:9px;background:none;font-size:12px;color:#cdbfc1}.seg button.on{background:#9b1b30;color:#fff;font-weight:700}\
.bt{width:100%;height:42px;margin-top:8px;border-radius:13px;border:1px solid rgba(255,255,255,.14);background:#2a1d20;font-weight:700;font-size:12.5px}.bt.pri{background:#9b1b30;border-color:#9b1b30}.bt.dg{color:#9b1b30}.bt.arm{background:#9b1b30;color:#fff;border-color:#9b1b30}\
.two{display:flex;gap:8px}.two .bt{flex:1}\
.li{display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:13px;background:#241a1c;border:1px solid rgba(255,255,255,.08);margin-bottom:7px}.li .tx{flex:1;min-width:0}.li b{display:block;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.li small{display:block;color:#a99a9c;font-size:10.5px;direction:ltr;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.li .ib{height:32px}.li.gone b{opacity:.5}\
.st{font-size:12px;line-height:1.9;color:#cdbfc1;margin-bottom:6px}.st b{color:#fff}.cmd{direction:ltr;text-align:left;font:11px ui-monospace,Menlo,monospace;background:#0e0809;border-radius:10px;padding:8px 10px;color:#ffb3b8;margin:6px 0;overflow-x:auto;white-space:nowrap}\
.ts{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 14px);transform:translateX(-50%);background:#1a0c0e;border:1px solid #9b1b30;padding:8px 16px;border-radius:99px;font-size:12px;opacity:0;transition:opacity .2s;pointer-events:none;max-width:88vw;text-align:center}.ts.on{opacity:1}";

    var HTML_UI = '<div class="root">' +
      '<div class="box" id="bx"><span class="lb" id="lb"></span></div>' +
      '<div class="hdl" id="hdl" title="بکش"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg></div>' +
      '<button class="fab" id="fab" aria-label="ویرایش چیدمان"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg><i></i></button>' +
      '<div class="pn" id="pn" hidden>' +
        '<div class="hd"><div class="ti"><b>ویرایش چیدمان</b><small id="pg"></small></div>' +
          '<button class="ib" id="un" title="بازگشت">↶</button><button class="ib" id="re" title="جلو">↷</button>' +
          '<button class="ib" id="dk" title="بالا / پایین">⇅</button><button class="ib" id="mn" title="کوچک‌کردن">▾</button><button class="ib x" id="ex" title="بستن">✕</button></div>' +
        '<div class="tabs"><button class="tb on" data-t="el">المان</button><button class="tb" data-t="ls">جابجاشده‌ها <em id="cn"></em></button><button class="tb" data-t="sv">ذخیره و انتشار</button></div>' +
        '<div class="bd">' +
          '<section data-p="el"><div class="hint" id="hint">روی هر المانی در صفحه بزن تا انتخاب شود.<br>بعد دستگیرهٔ قرمز را بکش، یا از دکمه‌های جهت‌دار استفاده کن.</div>' +
            '<div id="ctl" hidden><div class="nm" id="nm"></div><div class="cr" id="cr"></div>' +
            '<div class="g2"><div class="dp"><button class="u" data-d="0,-1">▲</button><button class="l" data-d="-1,0">◀</button><button class="z" id="z0" title="بازنشانی">⟲</button><button class="r" data-d="1,0">▶</button><button class="d" data-d="0,1">▼</button></div>' +
            '<div class="xy"><label><span>افقی X</span><input id="ix" type="number" inputmode="numeric" step="1"></label><label><span>عمودی Y</span><input id="iy" type="number" inputmode="numeric" step="1"></label>' +
            '<div class="seg" data-k="step"><button data-v="1">۱</button><button data-v="5">۵</button><button data-v="10">۱۰</button><button data-v="25">۲۵</button></div></div></div>' +
            '<div class="opt"><span>قفل محور</span><div class="seg" data-k="lock"><button data-v="f">آزاد</button><button data-v="x">فقط افقی</button><button data-v="y">فقط عمودی</button></div></div>' +
            '<div class="opt"><span>چسبندگی</span><div class="seg" data-k="snap"><button data-v="0">خاموش</button><button data-v="5">۵px</button><button data-v="10">۱۰px</button></div></div>' +
            '<div class="opt"><span>اعمال روی</span><div class="seg" data-k="scope"><button data-v="page">همین صفحه</button><button data-v="*">همهٔ صفحه‌ها</button></div></div></div></section>' +
          '<section data-p="ls" hidden><div id="lsb"></div></section>' +
          '<section data-p="sv" hidden><div class="st" id="sts"></div>' +
            '<div class="two"><button class="bt pri" id="cp">کپی JSON</button><button class="bt" id="dl">دانلود فایل</button></div>' +
            '<div class="st" style="margin-top:10px">برای انتشار روی سرور: «کپی JSON» را بزن، سپس در ترمینال:</div><div class="cmd">cat &gt; layout-default.json</div><div class="st">متن را Paste کن و Ctrl+D بزن. (یا فایل دانلودشده را کنار index.html آپلود کن.)</div>' +
            '<button class="bt" id="im">وارد کردن JSON</button><div id="imb" hidden><textarea id="ita" placeholder="JSON را اینجا Paste کن"></textarea><button class="bt pri" id="iok">اعمال</button></div>' +
            '<button class="bt dg" id="rp">بازنشانی همین صفحه</button><button class="bt dg" id="rd">حذف پیش‌نویس (برگشت به نسخهٔ منتشرشده)</button><button class="bt dg" id="ra">بازنشانی همهٔ المان‌ها</button></section>' +
        '</div><div class="ms" id="ms"></div></div><div class="ts" id="ts"></div></div>';

    var toastT = 0;
    function toast(t) { if (!R.ts) return; R.ts.textContent = t; R.ts.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function () { R.ts.classList.remove("on"); }, 2200); }
    function arm(btn, label, fn) {
      if (btn._arm) { clearTimeout(btn._arm); btn._arm = 0; btn.textContent = btn._txt; btn.classList.remove("arm"); fn(); return; }
      btn._txt = btn.textContent; btn.textContent = label; btn.classList.add("arm");
      btn._arm = setTimeout(function () { btn._arm = 0; btn.textContent = btn._txt; btn.classList.remove("arm"); }, 3000);
    }

    var tabNow = "el";
    function setTab(t) {
      tabNow = t;
      [].forEach.call(sh.querySelectorAll(".tb"), function (b) { b.classList.toggle("on", b.dataset.t === t); });
      [].forEach.call(sh.querySelectorAll("section"), function (s) { s.hidden = s.dataset.p !== t; });
      refresh();
    }
    function segSet(k, v) {
      [].forEach.call(sh.querySelectorAll('.seg[data-k="' + k + '"] button'), function (b) { b.classList.toggle("on", b.dataset.v === String(v)); });
    }

    /* نمایش/به‌روزرسانی همه‌ی بخش‌های پنل — سبک و بدون ساخت‌ودوباره‌ی ورودی‌ها */
    function refresh(light) {
      if (!R.pn) return;
      var pg = pageKey(), b = bpNow(), cnt = 0, i;
      for (i = 0; i < items.length; i++) if (items[i].b === b) cnt++;
      R.pg.textContent = "صفحه: " + pg + " · " + (b === "m" ? "موبایل" : "دسکتاپ");
      R.cn.textContent = cnt ? "(" + cnt + ")" : "";
      R.un.disabled = hi <= 0; R.re.disabled = hi >= hist.length - 1;
      var dirty = !!draft && canon(draft.items) !== canon(pub.items);
      R.fab.classList.toggle("dirty", dirty);
      R.ctl.hidden = !sel; R.hint.hidden = !!sel;
      if (sel) {
        var o = curOff(), act = sh.activeElement;
        if (act !== R.ix) R.ix.value = o.x;
        if (act !== R.iy) R.iy.value = o.y;
        R.nm.textContent = labelFor(sel.el);
        segSet("step", ui.step); segSet("lock", ui.lock); segSet("snap", ui.snap);
        var it = findItem(sel.s); segSet("scope", (it ? it.p : sel.scope) === "*" ? "*" : "page");
        if (!light) {
          var chain = [], c = sel.el;
          while (c && c !== D.body && c !== D.documentElement && chain.length < 8) { if (!(c.id && SKIPID[c.id])) chain.push(c); c = c.parentElement; }
          R.cr.innerHTML = "";
          chain.forEach(function (n, idx) {
            var bt = D.createElement("button"); bt.className = "chip" + (idx === 0 ? " on" : ""); bt.textContent = chipFor(n);
            bt.addEventListener("click", function () { select(n); }); R.cr.appendChild(bt);
          });
        }
      }
      if (tabNow === "ls" && !light) renderList();
      if (tabNow === "sv") renderSave(dirty);
      track();
    }
    function renderList() {
      var b = bpNow(), pg = pageKey(), html = "", n = 0;
      items.forEach(function (it, idx) {
        if (it.b !== b) return;
        n++;
        var here = it.p === "*" || it.p === pg, found = false;
        if (here) { try { found = !!D.querySelector(it.s); } catch (e) {} }
        html += '<div class="li' + (here && !found ? " gone" : "") + '"><div class="tx"><b>' + h(it.n || it.s.slice(0, 24)) + '</b><small>' + (it.p === "*" ? "همه‌ی صفحه‌ها" : "صفحه " + h(it.p)) + " · X " + it.x + " · Y " + it.y + (here && !found ? " · روی این صفحه نیست" : "") + '</small></div>' +
          (here && found ? '<button class="ib" data-a="go" data-i="' + idx + '">انتخاب</button>' : "") + '<button class="ib dg" data-a="rs" data-i="' + idx + '">بازنشانی</button></div>';
      });
      R.lsb.innerHTML = n ? html : '<div class="hint">هنوز المانی جابجا نشده.</div>';
    }
    function renderSave(dirty) {
      var m = 0, d = 0;
      items.forEach(function (it) { if (it.b === "m") m++; else d++; });
      R.sts.innerHTML = "وضعیت: <b>" + (dirty ? "پیش‌نویس ذخیره‌شده (هنوز منتشر نشده)" : "مطابق نسخهٔ منتشرشده") + "</b><br>المان‌های جابجاشده: موبایل <b>" + m + "</b> · دسکتاپ <b>" + d + "</b><br>تغییرات خودکار در همین مرورگر ذخیره می‌شود؛ بازدیدکننده‌ها فقط بعد از انتشار می‌بینند.";
    }

    /* ---------- ردیابی کادر و دستگیره (فقط وقتی ویرایش روشن است) ---------- */
    function track() {
      if (!editing || !sel) { R.bx.style.display = "none"; R.hdl.style.display = "none"; return; }
      var el = sel.el;
      if (!el.isConnected) { var n = null; try { n = D.querySelector(sel.s); } catch (e) {} if (n) sel.el = el = n; else { R.bx.style.display = "none"; R.hdl.style.display = "none"; return; } }
      var r = el.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) { R.bx.style.display = "none"; R.hdl.style.display = "none"; return; }
      var s = R.bx.style;
      s.display = "block"; s.left = r.left + "px"; s.top = r.top + "px"; s.width = r.width + "px"; s.height = r.height + "px";
      var o = curOff(), t = "X " + o.x + "   Y " + o.y;
      if (R.lb._t !== t) { R.lb.textContent = t; R.lb._t = t; }
      var cx = r.left + r.width / 2, cy = (r.width < 70 || r.height < 70) ? r.bottom + 32 : r.top + r.height / 2;
      var pr = R.pn.getBoundingClientRect(), lo = 30, hiY = W.innerHeight - 30;
      if (!R.pn.hidden) { if (ui.dock === "t") lo = pr.bottom + 30; else hiY = pr.top - 30; }
      cx = clamp(cx, 28, W.innerWidth - 28); cy = clamp(cy, lo, Math.max(lo, hiY));
      R.hdl.style.display = "grid"; R.hdl.style.left = (cx - 24) + "px"; R.hdl.style.top = (cy - 24) + "px";
    }
    function tick() { raf = 0; if (!editing) return; try { track(); } catch (e) {} raf = requestAnimationFrame(tick); }

    /* ---------- روشن/خاموش‌کردن ویرایش ---------- */
    var pageCss;
    function setEditing(on) {
      editing = on;
      D.documentElement.classList.toggle("cm-le-on", on);
      R.pn.hidden = !on; R.fab.hidden = on;
      if (on) { try { D.activeElement && D.activeElement.blur && D.activeElement.blur(); } catch (e) {} if (!raf) raf = requestAnimationFrame(tick); }
      else { sel = null; drag = null; }
      R.pn.classList.toggle("t", ui.dock === "t");
      refresh();
    }

    /* ---------- مسدودکردن رفتار صفحه در حالت ویرایش ---------- */
    function inUI(e) { var p = e.composedPath ? e.composedPath() : []; return p.indexOf(host) > -1; }
    function isForm(t) { return t && t.nodeType === 1 && /^(INPUT|TEXTAREA|SELECT|OPTION)$/.test(t.tagName) || (t && t.isContentEditable); }
    var tap = null;
    function onDown(e) {
      if (!editing || inUI(e)) return;
      e.stopPropagation();
      if (isForm(e.target)) e.preventDefault();
      tap = (e.isPrimary && (e.pointerType !== "mouse" || e.button === 0)) ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() } : null;
    }
    function onUp(e) {
      if (!editing || inUI(e)) return;
      e.stopPropagation();
      if (tap && tap.id === e.pointerId && Math.abs(e.clientX - tap.x) < 9 && Math.abs(e.clientY - tap.y) < 9 && Date.now() - tap.t < 700) pickAt(e.clientX, e.clientY);
      tap = null;
    }
    function onCancel() { tap = null; }
    function onBlock(e) { if (editing && !inUI(e)) e.stopPropagation(); }
    function onClick(e) { if (editing && !inUI(e)) { e.preventDefault(); e.stopPropagation(); } }

    /* ---------- ساخت UI ---------- */
    function buildUI() {
      if (host) return;
      host = D.createElement("div"); host.id = "cm-le-host";
      host.setAttribute("style", "position:fixed;inset:0;pointer-events:none;z-index:2147483646");
      sh = host.attachShadow({ mode: "open" });
      sh.innerHTML = "<style>" + CSS_UI + "</style>" + HTML_UI;
      D.documentElement.appendChild(host);
      ["bx", "lb", "hdl", "fab", "pn", "pg", "un", "re", "dk", "mn", "ex", "cn", "hint", "ctl", "nm", "cr", "ix", "iy", "z0", "lsb", "sts", "cp", "dl", "im", "imb", "ita", "iok", "rp", "rd", "ra", "ms", "ts"].forEach(function (id) { R[id] = el$(id); });
      pageCss = D.createElement("style");
      pageCss.textContent = "html.cm-le-on,html.cm-le-on *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}";
      (D.head || D.documentElement).appendChild(pageCss);

      var O = { capture: true }, P = { capture: true, passive: true };
      W.addEventListener("pointerdown", onDown, O); W.addEventListener("pointerup", onUp, O); W.addEventListener("pointercancel", onCancel, O);
      ["mousedown", "mouseup", "dblclick", "contextmenu", "auxclick", "submit"].forEach(function (n) { W.addEventListener(n, onBlock, O); });
      ["touchstart", "touchend"].forEach(function (n) { W.addEventListener(n, function (e) { onBlock(e); }, P); });
      W.addEventListener("click", onClick, O);

      R.fab.addEventListener("click", function () { setEditing(true); });
      R.ex.addEventListener("click", function () { setEditing(false); });
      R.mn.addEventListener("click", function () { var m = R.pn.classList.toggle("min"); R.mn.textContent = m ? "▴" : "▾"; });
      R.dk.addEventListener("click", function () { ui.dock = ui.dock === "t" ? "b" : "t"; saveUI(); R.pn.classList.toggle("t", ui.dock === "t"); });
      R.un.addEventListener("click", undo); R.re.addEventListener("click", redo);
      [].forEach.call(sh.querySelectorAll(".tb"), function (b) { b.addEventListener("click", function () { setTab(b.dataset.t); }); });

      sh.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest(".seg button");
        if (!b) return;
        var k = b.parentNode.dataset.k, v = b.dataset.v;
        if (k === "step") ui.step = +v; else if (k === "snap") ui.snap = +v; else if (k === "lock") ui.lock = v;
        else if (k === "scope" && sel) {
          var np = v === "*" ? "*" : pageKey(), it = findItem(sel.s);
          sel.scope = np;
          if (it && it.p !== np) {
            for (var i = items.length - 1; i >= 0; i--) if (items[i] !== it && items[i].s === it.s && items[i].b === it.b && items[i].p === np) items.splice(i, 1);
            it.p = np; applyRules(); commit();
          }
        }
        saveUI(); refresh(true);
      });

      function nudge(dx, dy) { if (!sel) return; var o = curOff(); setOff(o.x + dx * ui.step, o.y + dy * ui.step, true, "n:" + sel.s); }
      [].forEach.call(sh.querySelectorAll(".dp button[data-d]"), function (btn) {
        var d = btn.dataset.d.split(","), t = 0, iv = 0, dx = +d[0], dy = +d[1];
        function stop() { clearTimeout(t); clearInterval(iv); t = iv = 0; }
        btn.addEventListener("pointerdown", function (e) { e.preventDefault(); stop(); nudge(dx, dy); t = setTimeout(function () { iv = setInterval(function () { nudge(dx, dy); }, 70); }, 380); });
        ["pointerup", "pointercancel", "pointerleave"].forEach(function (n) { btn.addEventListener(n, stop); });
        btn.addEventListener("click", function (e) { if (e.detail === 0) nudge(dx, dy); });
        W.addEventListener("blur", stop);
      });
      R.z0.addEventListener("click", function () { setOff(0, 0, true); });
      function onField() { setOff(R.ix.value, R.iy.value, true, "f:" + (sel && sel.s)); }
      R.ix.addEventListener("change", onField); R.iy.addEventListener("change", onField);

      /* کشیدن با دستگیره */
      R.hdl.addEventListener("pointerdown", function (e) {
        if (!sel || (e.pointerType === "mouse" && e.button !== 0)) return;
        e.preventDefault();
        var o = curOff();
        drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, bx: o.x, by: o.y, moved: false };
        try { R.hdl.setPointerCapture(e.pointerId); } catch (_) {}
        R.hdl.classList.add("dg");
      });
      R.hdl.addEventListener("pointermove", function (e) {
        if (!drag || e.pointerId !== drag.id || !sel) return;
        var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
        if (!drag.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        drag.moved = true;
        if (ui.lock === "x") dy = 0; else if (ui.lock === "y") dx = 0;
        var nx = drag.bx + dx, ny = drag.by + dy;
        if (ui.snap) { nx = Math.round(nx / ui.snap) * ui.snap; ny = Math.round(ny / ui.snap) * ui.snap; }
        setOff(nx, ny, false);
      });
      function endDrag(e) {
        if (!drag || (e && e.pointerId !== drag.id)) return;
        var mv = drag.moved; drag = null; R.hdl.classList.remove("dg");
        if (mv) commit("drag");
      }
      R.hdl.addEventListener("pointerup", endDrag); R.hdl.addEventListener("pointercancel", endDrag); R.hdl.addEventListener("lostpointercapture", endDrag);

      /* فهرست جابجاشده‌ها */
      R.lsb.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("button[data-a]");
        if (!b) return;
        var it = items[+b.dataset.i];
        if (!it) return;
        if (b.dataset.a === "go") {
          var n = null; try { n = D.querySelector(it.s); } catch (_) {}
          if (n) { try { n.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {} setTab("el"); select(n); }
        } else { items.splice(+b.dataset.i, 1); applyRules(); commit(); toast("بازنشانی شد"); }
      });

      /* ذخیره و انتشار */
      R.cp.addEventListener("click", function () {
        var t = exportJSON();
        function fb() { var a = D.createElement("textarea"); a.value = t; a.style.cssText = "position:fixed;opacity:0"; D.body.appendChild(a); a.select(); var ok = false; try { ok = D.execCommand("copy"); } catch (_) {} a.remove(); toast(ok ? "JSON کپی شد" : "کپی نشد؛ از «دانلود فایل» استفاده کن"); }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast("JSON کپی شد"); }, fb); else fb();
      });
      R.dl.addEventListener("click", function () {
        try {
          var a = D.createElement("a"); a.href = URL.createObjectURL(new Blob([exportJSON()], { type: "application/json" })); a.download = "layout-default.json";
          sh.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000); toast("فایل layout-default.json دانلود شد");
        } catch (_) { toast("دانلود ممکن نشد"); }
      });
      R.im.addEventListener("click", function () { R.imb.hidden = !R.imb.hidden; });
      R.iok.addEventListener("click", function () {
        var j = jparse(R.ita.value);
        if (!j || !Array.isArray(j.items)) { toast("JSON معتبر نیست"); return; }
        items = clean(j.items); applyRules(); commit(); R.ita.value = ""; R.imb.hidden = true; toast("وارد شد");
      });
      R.rp.addEventListener("click", function () {
        arm(R.rp, "مطمئنی؟ دوباره بزن", function () { var pg = pageKey(), b = bpNow(); items = items.filter(function (it) { return !(it.b === b && it.p === pg); }); applyRules(); commit(); toast("این صفحه بازنشانی شد"); });
      });
      R.rd.addEventListener("click", function () {
        arm(R.rd, "مطمئنی؟ دوباره بزن", function () { draft = null; lsRm(K_DRAFT); items = clone(pub.items); hist = [JSON.stringify(items)]; hi = 0; applyRules(); refresh(); toast("پیش‌نویس حذف شد"); });
      });
      R.ra.addEventListener("click", function () {
        arm(R.ra, "مطمئنی؟ دوباره بزن", function () { items = []; applyRules(); commit(); toast("همه بازنشانی شد"); });
      });

      /* کیبورد (دسکتاپ) */
      D.addEventListener("keydown", function (e) {
        if (!editing) return;
        var a = sh.activeElement;
        if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return;
        var k = e.key, m = e.ctrlKey || e.metaKey;
        if (m && (k === "z" || k === "Z")) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
        if (m && (k === "y" || k === "Y")) { e.preventDefault(); redo(); return; }
        if (k === "Escape") { sel = null; refresh(); return; }
        var st = e.shiftKey ? 10 : 1, M = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
        if (M && sel) { e.preventDefault(); var o = curOff(); setOff(o.x + M[0] * st, o.y + M[1] * st, true, "n:" + sel.s); }
      });

      /* تغییر مسیر/اندازه */
      function onRoute() {
        var k = pageKey(), b = bpNow();
        if (k !== lastPage || b !== lastBp) { lastPage = k; lastBp = b; applyRules(); if (editing) { sel = null; } refresh(); }
      }
      W.addEventListener("popstate", onRoute); W.addEventListener("hashchange", onRoute); W.addEventListener("resize", onRoute); W.addEventListener("orientationchange", onRoute);
      var pc = D.getElementById("pageContent");
      if (pc && W.MutationObserver) new MutationObserver(function () { onRoute(); }).observe(pc, { childList: true });
      setInterval(function () { if (!D.hidden) onRoute(); }, 700);

      segSet("step", ui.step);
      refresh();
      if (autoOpen) setEditing(true);
    }

    /* برای بازدیدکننده‌های عادی فقط قوانین CSS اعمال می‌شوند؛ UI فقط برای ادمین ساخته می‌شود */
    function lite() {
      function onRoute() { var k = pageKey(), b = bpNow(); if (k !== lastPage || b !== lastBp) { lastPage = k; lastBp = b; applyRules(); } }
      W.addEventListener("popstate", onRoute); W.addEventListener("hashchange", onRoute); W.addEventListener("resize", onRoute);
      var pc = D.getElementById("pageContent");
      if (pc && W.MutationObserver) new MutationObserver(onRoute).observe(pc, { childList: true });
      setInterval(function () { if (!D.hidden) onRoute(); }, 900);
    }
    function init() { try { if (isAdmin) buildUI(); else lite(); } catch (e) { try { console.warn("[layout-editor]", e); } catch (_) {} } }
    if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", init); else init();
  }
})();
