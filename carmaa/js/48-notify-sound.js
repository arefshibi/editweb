"use strict";
/* NOTIFICATION SOUND — a short, soft two-note chime generated with Web Audio (no audio file needed).
   window.CARMA_NOTIFY_SOUND() plays it (max once per 1.5s, so a message + its notification never double-ring).
   Browsers only allow sound after the user has touched the page once, so the audio engine is unlocked on the first tap/key.
   To mute: localStorage.setItem("carma_sound","off")  (and "on" to bring it back). */
(function () {
  let ctx = null, lastAt = 0;
  const muted = () => { try { return localStorage.getItem("carma_sound") === "off"; } catch (_) { return false; } };
  function engine() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (_) { ctx = null; }
    return ctx;
  }
  function unlock() {
    const c = engine();
    if (c && c.state === "suspended") c.resume().catch(() => {});
  }
  ["pointerdown", "touchstart", "keydown", "click"].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));

  function note(c, freq, start, dur, peak) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(c.destination);
    o.start(start); o.stop(start + dur + 0.03);
  }
  function play() {
    if (muted()) return;
    const now = Date.now();
    if (now - lastAt < 1500) return;
    const c = engine();
    if (!c || c.state !== "running") return;   // not unlocked yet -> stay silent instead of erroring
    lastAt = now;
    const t = c.currentTime + 0.01;
    note(c, 880, t, 0.22, 0.16);          // A5
    note(c, 1318.5, t + 0.11, 0.34, 0.14); // E6
  }
  window.CARMA_NOTIFY_SOUND = play;
})();
