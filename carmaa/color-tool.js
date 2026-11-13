/* CarMaa color tool. Enable: open the site with ?colors=1   Disable: ?colors=0 */
(function () {
  "use strict";
  var DIR = "/root/qa/carmaa", KEY = "cmColorEdits", FLAG = "cmColorTool", IMP = " ! important";
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  try { var q = new URLSearchParams(location.search).get("colors"); if (q === "1") lsSet(FLAG, "1"); else if (q === "0") lsDel(FLAG); } catch (e) {}
  if (lsGet(FLAG) !== "1") return;

  var edits = []; try { edits = JSON.parse(lsGet(KEY) || "[]") || []; } catch (e) { edits = []; }
  var cur = null, tapT = null, picking = false, view = "home", ed = null, open = false;
  function save() { lsSet(KEY, JSON.stringify(edits)); }
  function isLight() { return document.documentElement.classList.contains("theme-light"); }

  function toCss(v) {
    if (!v) return "";
    if (v.a >= 100) return v.hex;
    var n = parseInt(v.hex.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + (v.a / 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + ")";
  }
  function cssOne(e) {
    var pre = e.theme === "dark" ? "html:not(.theme-light) " : e.theme === "light" ? "html.theme-light " : "html ";
    var base = pre + "body :is(" + e.sel + "):not(#cmct-a):not(#cmct-b)";
    var out = "", r = [];
    if (e.bg) r.push("background:" + toCss(e.bg) + IMP);
    if (e.border) r.push("border-color:" + toCss(e.border) + IMP);
    if (e.color) r.push("color:" + toCss(e.color) + IMP);
    if (r.length) out += base + "{" + r.join(";") + "}\n";
    if (e.color && e.kids) out += base + " *{color:" + toCss(e.color) + IMP + "}\n";
    return out;
  }
  function allCss() { return edits.map(cssOne).join(""); }
  var live = document.createElement("style"); live.id = "cmct-live"; document.head.appendChild(live);
  function applyLive() { live.textContent = allCss(); }
  applyLive();

  var STATE = /^(is-|has-|js-|active$|open$|on$|show|hidden|loading|selected|current|focus|hover|visible|in$|out$|sk-|skeleton|ready|fade|enter|leave)/;
  function cls(el) {
    var a = [];
    if (el.classList) for (var i = 0; i < el.classList.length; i++) { var c = el.classList[i]; if (!STATE.test(c) && /^[A-Za-z_][\w-]*$/.test(c) && !/\d{4,}/.test(c)) a.push(c); }
    return a.slice(0, 3);
  }
  function stableId(el) { return el.id && /^[A-Za-z][\w-]*$/.test(el.id) && !/\d{3,}/.test(el.id) ? el.id : ""; }
  function nth(el) { var i = 1, s = el; while ((s = s.previousElementSibling)) i++; return ":nth-child(" + i + ")"; }
  function buildSingle(el) {
    var parts = [], n = el, d = 0;
    while (n && n.nodeType === 1 && n !== document.body && n !== document.documentElement && d < 7) {
      var id = stableId(n);
      if (id) { parts.unshift("#" + id); break; }
      var c = cls(n);
      parts.unshift((c.length ? "." + c.join(".") : n.tagName.toLowerCase()) + nth(n));
      n = n.parentElement; d++;
    }
    return parts.join(" > ");
  }
  function buildSimilar(el) {
    var parts = [], n = el, d = 0;
    while (n && n.nodeType === 1 && n !== document.body && n !== document.documentElement && d < 5) {
      var id = stableId(n), c = cls(n);
      if (c.length) { parts.unshift("." + c.join(".")); return parts.join(" > "); }
      if (id) { parts.unshift("#" + id); return parts.join(" > "); }
      parts.unshift(n.tagName.toLowerCase());
      n = n.parentElement; d++;
    }
    return buildSingle(el);
  }
  function count(sel) { try { return document.querySelectorAll(sel).length; } catch (e) { return 0; } }

  function parseRGB(s) {
    var m = /rgba?\(([^)]+)\)/.exec(s || "");
    if (!m) return { hex: "#000000", a: 0 };
    var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat), a = p.length > 3 ? p[3] : 1;
    return { hex: "#" + [p[0], p[1], p[2]].map(function (n) { return ("0" + Math.round(n || 0).toString(16)).slice(-2); }).join(""), a: Math.round(a * 100) };
  }
  function computed(prop) { try { return parseRGB(getComputedStyle(cur)[prop]); } catch (e) { return { hex: "#000000", a: 0 }; } }

  var st = document.createElement("style");
  st.textContent = [
    "#cmct,#cmct *{box-sizing:border-box}",
    "#cmct-fab{position:fixed;left:12px;bottom:104px;z-index:2147483000;width:46px;height:46px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:#e11d48;color:#fff;font-size:22px;line-height:1;display:grid;place-items:center;box-shadow:0 6px 18px rgba(0,0,0,.5);cursor:pointer;padding:0}",
    "#cmct{position:fixed;left:0;right:0;bottom:0;z-index:2147483001;max-height:54vh;overflow:auto;direction:rtl;font-family:Vazirmatn,Tahoma,sans-serif;font-size:13px;line-height:1.6;color:#eceef2;background:#17181c;border-top:1px solid rgba(255,255,255,.14);border-radius:18px 18px 0 0;padding:12px 14px 18px;box-shadow:0 -12px 40px rgba(0,0,0,.6)}",
    "#cmct[hidden],#cmct-bar[hidden],#cmct-fab[hidden]{display:none!important}",
    "#cmct button{font:inherit;color:#eceef2;background:#2a2c33;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:6px 11px;cursor:pointer;margin:0}",
    "#cmct button.p{background:#e11d48;border-color:#e11d48;color:#fff;font-weight:700}",
    "#cmct button.on{background:#eceef2;color:#262628;border-color:#eceef2}",
    "#cmct .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:14px}",
    "#cmct .sel{direction:ltr;text-align:left;font:11px/1.5 monospace;color:#9aa0ab;background:#0e0f12;border-radius:8px;padding:6px 8px;margin-bottom:4px;word-break:break-all;max-height:56px;overflow:auto}",
    "#cmct .meta{color:#9aa0ab;font-size:12px;margin-bottom:8px}",
    "#cmct .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0}",
    "#cmct .seg{display:flex;gap:6px;margin:8px 0;flex-wrap:wrap}",
    "#cmct .cr{display:grid;grid-template-columns:62px 44px minmax(90px,1fr) 38px;align-items:center;gap:8px;margin:9px 0}",
    "#cmct .hex-wrap{display:flex;align-items:center;gap:5px;min-width:0;direction:ltr}",
    "#cmct input.cmct-hex-input{width:100%;min-width:0;height:34px;padding:0 9px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:#0e0f12;color:#fff;font:12px monospace;direction:ltr;text-align:left;outline:none}",
    "#cmct input.cmct-hex-input:focus{border-color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.12)}",
    "#cmct input.cmct-hex-input.invalid{border-color:#ff5252;color:#ff8585}",
    "#cmct .hex-error{grid-column:2/-1;color:#ff8585;font-size:10px;margin-top:-5px;direction:rtl}",
    "#cmct .cr b{font-weight:600}",
    "#cmct input[type=color]{width:44px;height:34px;padding:0;border:1px solid rgba(255,255,255,.25);border-radius:8px;background:none}",
    "#cmct input[type=range]{width:100%}",
    "#cmct .st{font-size:11px;color:#9aa0ab}",
    "#cmct .it{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid rgba(255,255,255,.08)}",
    "#cmct .it .s{flex:1;direction:ltr;text-align:left;font:11px/1.4 monospace;color:#c9ccd3;word-break:break-all;cursor:pointer}",
    "#cmct .dot{display:inline-block;width:16px;height:16px;border-radius:50%;border:1px solid rgba(255,255,255,.3);vertical-align:middle;margin-left:3px}",
    "#cmct label{display:flex;gap:8px;align-items:center;margin:8px 0}",
    "#cmct-bar{position:fixed;top:0;left:0;right:0;z-index:2147483002;direction:rtl;font-family:Vazirmatn,Tahoma,sans-serif;background:#e11d48;color:#fff;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;font-size:14px}",
    "#cmct-bar button{background:#fff;color:#e11d48;border:0;border-radius:9px;padding:5px 12px;font:inherit;font-weight:700}",
    "#cmct-hl{position:fixed;z-index:2147482999;pointer-events:none;border:2px solid #ff2d6a;background:rgba(255,45,106,.12);border-radius:4px;display:none}",
    "#cmct-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:90px;z-index:2147483003;background:#fff;color:#262628;padding:8px 16px;border-radius:999px;font:600 13px Tahoma,sans-serif;display:none}"
  ].join("\n");
  document.head.appendChild(st);

  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  var fab = el("button", { id: "cmct-fab", type: "button", "aria-label": "ابزار رنگ" }, "🎨");
  var panel = el("div", { id: "cmct", hidden: "" });
  var bar = el("div", { id: "cmct-bar", hidden: "" }, "<span>یک المنت را لمس کن</span><button type='button' data-a='cancel'>لغو</button>");
  var hl = el("div", { id: "cmct-hl" });
  var toastEl = el("div", { id: "cmct-toast" });
  document.body.appendChild(fab); document.body.appendChild(panel); document.body.appendChild(bar); document.body.appendChild(hl); document.body.appendChild(toastEl);
  window.cmColorTool = { css: allCss, cmd: function () { return serverCmd(); } };

  function toast(t) { toastEl.textContent = t; toastEl.style.display = "block"; clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.style.display = "none"; }, 1600); }
  function place() {
    if (!cur || !cur.isConnected) { hl.style.display = "none"; return; }
    var r = cur.getBoundingClientRect();
    hl.style.cssText = "display:block;left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px";
  }
  var raf = 0; function sched() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; place(); }); }
  window.addEventListener("scroll", sched, true); window.addEventListener("resize", sched);

  function ours(t) { return t && t.closest && (t.closest("#cmct") || t.closest("#cmct-bar") || t.closest("#cmct-fab")); }
  function stop(ev) { if (picking && !ours(ev.target)) ev.stopPropagation(); }
  ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend"].forEach(function (n) { document.addEventListener(n, stop, true); });
  document.addEventListener("click", function (ev) {
    if (!picking || ours(ev.target)) return;
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    picking = false; bar.hidden = true; tapT = ev.target; select(ev.target);
  }, true);
  document.addEventListener("mouseover", function (ev) { if (picking && !ours(ev.target)) { cur = ev.target; place(); } }, true);

  function find(sel, theme) { for (var i = 0; i < edits.length; i++) if (edits[i].sel === sel && edits[i].theme === theme) return edits[i]; return null; }
  function loadEd(sel, mode, theme) {
    var ex = find(sel, theme);
    ed = ex ? JSON.parse(JSON.stringify(ex)) : { sel: sel, mode: mode, theme: theme, bg: null, color: null, border: null, kids: false };
    ed.mode = mode;
  }
  function selFor(mode) { return mode === "single" ? buildSingle(cur) : buildSimilar(cur); }
  function select(t) {
    cur = t; view = "edit"; open = true;
    var mode = (ed && ed.mode) || "similar";
    loadEd(selFor(mode), mode, ed && ed.theme ? ed.theme : (isLight() ? "light" : "dark"));
    try { var r = cur.getBoundingClientRect(); if (r.top > innerHeight * 0.45 && r.height < innerHeight * 0.4) window.scrollBy(0, r.top - 120); } catch (e) {}
    render(); place();
  }
  function commit() {
    var i = edits.indexOf(find(ed.sel, ed.theme));
    var empty = !ed.bg && !ed.color && !ed.border;
    if (empty) { if (i >= 0) edits.splice(i, 1); }
    else if (i >= 0) edits[i] = JSON.parse(JSON.stringify(ed)); else edits.push(JSON.parse(JSON.stringify(ed)));
    save(); applyLive();
  }

  function seg(k, opts, val) { return "<div class='seg' data-k='" + k + "'>" + opts.map(function (o) { return "<button type='button' data-v='" + o[0] + "'" + (val === o[0] ? " class='on'" : "") + ">" + o[1] + "</button>"; }).join("") + "</div>"; }
  function rowHtml(k, label) {
    var v = ed[k], c = v || computed(k === "bg" ? "backgroundColor" : k === "color" ? "color" : "borderTopColor");
    return "<div class='cr' data-k='" + k + "'><b>" + label + "</b>" +
      "<input type='color' value='" + c.hex + "' aria-label='انتخاب رنگ'>" +
      "<div class='hex-wrap'><input class='cmct-hex-input' type='text' value='" + c.hex.toUpperCase() + "' maxlength='7' placeholder='#FFFFFF' spellcheck='false' autocomplete='off' aria-label='کد HEX'>" +
      "</div><button type='button' data-a='reset' title='برگرداندن'>↺</button>" +
      "<input type='range' min='0' max='100' value='" + c.a + "' aria-label='شفافیت' style='grid-column:2/-1;width:100%'>" +
      "<div class='st hex-error' hidden>کد رنگ معتبر نیست؛ نمونه: #FFFFFF</div></div>" +
      "<div class='st' style='margin:-4px 0 0'>" + (v ? "تغییر داده شد" : "تغییر نکرده") + "</div>";
  }
  function render() {
    fab.hidden = open;
    panel.hidden = !open || picking;
    if (!open) return;
    var h = "";
    if (view === "home") {
      h = "<div class='hd'><b>🎨 ابزار رنگ</b><button type='button' data-a='close'>✕</button></div>" +
        "<div class='row'><button type='button' class='p' data-a='pick'>انتخاب المنت از صفحه</button><button type='button' data-a='list'>تغییرات من (" + edits.length + ")</button></div>" +
        "<div class='st'>روی «انتخاب المنت» بزن و بعد هر چیزی از صفحه را لمس کن. برای خروج کامل از ابزار، آدرس را با <span dir='ltr'>?colors=0</span> باز کن.</div>";
    } else if (view === "edit") {
      var n = count(ed.sel), tag = cur ? cur.tagName.toLowerCase() : "";
      h = "<div class='hd'><b>ویرایش رنگ</b><button type='button' data-a='home'>✕</button></div>" +
        "<div class='sel'>" + ed.sel.replace(/</g, "&lt;") + "</div><div class='meta'>" + n + " المنت را شامل می‌شود · نوع: " + tag + "</div>" +
        "<div class='row'><button type='button' data-a='up'>⬆ بزرگ‌تر (والد)</button><button type='button' data-a='down'>⬇ کوچک‌تر</button><button type='button' data-a='pick'>انتخاب دوباره</button></div>" +
        seg("mode", [["similar", "همه‌ی مشابه‌ها"], ["single", "فقط همین یکی"]], ed.mode) +
        seg("theme", [["dark", "حالت تیره"], ["light", "حالت روشن"], ["both", "هر دو"]], ed.theme) +
        rowHtml("bg", "پس‌زمینه") + rowHtml("color", "رنگ متن") + rowHtml("border", "حاشیه") + "<div class='st'>لغزنده‌ی کنار هر رنگ = شفافیت · حاشیه فقط وقتی دیده می‌شود که المنت حاشیه داشته باشد</div>" +
        "<label><input type='checkbox' data-k='kids'" + (ed.kids ? " checked" : "") + "> متن‌های داخل این المنت هم همین رنگ شوند</label>" +
        "<div class='row'><button type='button' class='p' data-a='list'>تغییرات من (" + edits.length + ") و خروجی</button></div>";
    } else {
      h = "<div class='hd'><b>تغییرات من (" + edits.length + ")</b><button type='button' data-a='home'>✕</button></div>";
      if (!edits.length) h += "<div class='st'>هنوز تغییری نداری.</div>";
      edits.forEach(function (e, i) {
        function d(v) { return v ? "<span class='dot' style='background:" + toCss(v) + "'></span>" : ""; }
        h += "<div class='it'><div class='s' data-a='edit' data-i='" + i + "'>" + e.sel.replace(/</g, "&lt;") + "</div><div>" + d(e.bg) + d(e.color) + d(e.border) + "</div><button type='button' data-a='del' data-i='" + i + "'>حذف</button></div>";
      });
      if (edits.length) h += "<div class='row'><button type='button' class='p' data-a='copycmd'>کپی دستور سرور</button><button type='button' data-a='copycss'>کپی فقط CSS</button><button type='button' data-a='clear'>پاک‌کردن همه</button></div>" +
        "<div class='st'>دستور سرور را در ترمینال سرور بچسبان و اجرا کن؛ بعد از اتمام، صفحه را رفرش کن و «پاک‌کردن همه» را بزن تا تغییرات محلی با نسخه‌ی سرور یکی شود.</div>";
      h += "<div class='row'><button type='button' data-a='pick'>انتخاب المنت جدید</button></div>";
    }
    panel.innerHTML = h;
  }

  function serverCmd() {
    return "cd " + DIR + " && touch custom-colors.css && cat >> custom-colors.css <<'CMCSS'\n" + allCss() + "CMCSS\n" +
      "node -e \"const fs=require('fs'),f='index.html';fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace(/(custom-colors\\.css\\?v=)(\\d+)/,(_,a,n)=>a+(+n+1)))\" && " +
      "docker compose -f docker-compose.prod.yml $( [ -f backend/.env ] && echo --env-file backend/.env ) up -d --build --no-deps web\n";
  }
  function copy(text) {
    function fb() { var ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0;top:0;left:0"; document.body.appendChild(ta); ta.focus(); ta.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} ta.remove(); toast(ok ? "کپی شد ✓" : "کپی نشد"); }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast("کپی شد ✓"); }, fb); else fb();
  }

  fab.addEventListener("click", function () { open = true; view = edits.length && !cur ? "home" : view; render(); });
  bar.addEventListener("click", function (ev) { if (ev.target.getAttribute("data-a") === "cancel") { picking = false; bar.hidden = true; render(); } });
  panel.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-a],[data-v]"); if (!b || !panel.contains(b)) return;
    var a = b.getAttribute("data-a"), v = b.getAttribute("data-v");
    if (v != null) {
      var k = b.parentNode.getAttribute("data-k");
      if (k === "mode") { var pv = ed; loadEd(selFor(v), v, pv.theme); if (!find(ed.sel, ed.theme)) { ed.bg = pv.bg; ed.color = pv.color; ed.border = pv.border; ed.kids = pv.kids; if (ed.bg || ed.color || ed.border) commit(); } }
      else if (k === "theme") { var cp = ed; loadEd(cp.sel, cp.mode, v); if (!find(cp.sel, v)) { ed.bg = cp.bg; ed.color = cp.color; ed.border = cp.border; ed.kids = cp.kids; } }
      render(); return;
    }
    if (a === "close") { open = false; cur = null; place(); render(); }
    else if (a === "home") { view = "home"; cur = null; place(); render(); }
    else if (a === "pick") { picking = true; cur = null; place(); bar.hidden = false; render(); }
    else if (a === "list") { view = "list"; render(); }
    else if (a === "up") { var p = cur && cur.parentElement; if (p && p !== document.body && p !== document.documentElement) select(p); }
    else if (a === "down") { var c = cur, t = tapT; if (c && t && c !== t && c.contains(t)) { while (t.parentElement && t.parentElement !== c) t = t.parentElement; select(t); } else toast("پایین‌تر نمی‌شود"); }
    else if (a === "reset") { var k2 = b.parentNode.getAttribute("data-k"); ed[k2] = null; commit(); render(); }
    else if (a === "del") { edits.splice(+b.getAttribute("data-i"), 1); save(); applyLive(); render(); }
    else if (a === "edit") { var e = edits[+b.getAttribute("data-i")]; var t2 = null; try { t2 = document.querySelector(e.sel); } catch (x) {} ed = JSON.parse(JSON.stringify(e)); if (t2) { cur = t2; tapT = t2; } view = "edit"; render(); place(); }
    else if (a === "copycmd") copy(serverCmd());
    else if (a === "copycss") copy(allCss());
    else if (a === "clear") { if (confirm("همه‌ی تغییرات محلی پاک شود؟")) { edits = []; save(); applyLive(); render(); } }
  });
  function normalizeHex(value) {
    var x = String(value || "").trim();
    if (!x) return null;
    if (x.charAt(0) !== "#") x = "#" + x;
    if (/^#[0-9a-f]{3}$/i.test(x))
      x = "#" + x[1]+x[1]+x[2]+x[2]+x[3]+x[3];
    return /^#[0-9a-f]{6}$/i.test(x) ? x.toLowerCase() : null;
  }

  function onColor(ev) {
    var r = ev.target.closest(".cr"); if (!r || !ed) return;
    var k = r.getAttribute("data-k");
    var picker = r.querySelector("input[type=color]");
    var hexInput = r.querySelector(".cmct-hex-input");
    var range = r.querySelector("input[type=range]");
    var error = r.querySelector(".hex-error");
    var c = picker.value;

    if (ev.target === hexInput) {
      var normalized = normalizeHex(hexInput.value);
      if (!normalized) {
        hexInput.classList.add("invalid");
        error.hidden = false;
        return;
      }
      hexInput.classList.remove("invalid");
      error.hidden = true;
      c = normalized;
      picker.value = c;
      hexInput.value = c.toUpperCase();
    } else if (ev.target === picker) {
      c = picker.value;
      hexInput.value = c.toUpperCase();
      hexInput.classList.remove("invalid");
      error.hidden = true;
    } else if (ev.target !== range) {
      return;
    }

    var a = +range.value;
    ed[k] = { hex: c, a: a };
    commit();
    r.nextElementSibling.textContent = "تغییر داده شد";
  }
  panel.addEventListener("input", onColor);
  panel.addEventListener("change", function(ev) {
    if (ev.target.classList && ev.target.classList.contains("cmct-hex-input")) {
      var normalized = normalizeHex(ev.target.value);
      if (normalized) {
        ev.target.value = normalized.toUpperCase();
        onColor(ev);
      }
    }
  });
  panel.addEventListener("change", function (ev) {
    if (ev.target.getAttribute && ev.target.getAttribute("data-k") === "kids") { ed.kids = ev.target.checked; if (ed.bg || ed.color || ed.border) commit(); }
  });
  render();
})();
