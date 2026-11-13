"use strict";
/* Instant tap feedback for the bottom dock: the pill highlights the tapped tab on
   pointerdown, without waiting for the page render (updateBottomDock() then takes over).
   The temporary state clears itself after 900ms, so a login-gated tap can't leave a wrong tab lit. */
(function () {
  let timer = 0;
  function clear(dock) {
    dock.querySelectorAll(".dock-item.is-tap").forEach((b) => b.classList.remove("is-tap"));
  }
  document.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest && e.target.closest("#bottomDock .dock-pill .dock-item");
    if (!btn) return;
    const dock = btn.closest("#bottomDock");
    clear(dock);
    btn.classList.add("is-tap");
    clearTimeout(timer);
    timer = setTimeout(() => clear(dock), 900);
  }, { passive: true, capture: true });
})();
