"use strict";
/* CarMaa late-stage usability guardrails. This file is intentionally loaded last. */
(function () {
  // Single entry point for inbox row taps prevents competing handlers from
  // opening/rerendering the same conversation several times on rapid taps.
  document.addEventListener("click", function (event) {
    const opener = event.target.closest('[data-action="openChat"], [data-action="openConversation"], [data-chat-open]');
    if (!opener || !window.MARQUE_CHAT || typeof window.MARQUE_CHAT.openChat !== "function") return;
    if (opener.dataset.chatOpening === "1") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const id = opener.dataset.id || opener.dataset.conversationId || opener.dataset.chatId || "";
    if (!id) return;
    opener.dataset.chatOpening = "1";
    event.preventDefault();
    event.stopImmediatePropagation();
    Promise.resolve(window.MARQUE_CHAT.openChat(id)).catch(() => {}).finally(() => {
      if (opener.isConnected) delete opener.dataset.chatOpening;
    });
  }, true);
})();
