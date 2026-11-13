# Listings page — performance pass (no visual changes)

- js/06-home-cards.js — card thumbnails request a 480px image instead of the 1200px original (detail page unchanged); `decoding="async"`.
- js/13-pages-home-listings-vehicle.js
  - pull-to-refresh: the card list is no longer a permanent GPU layer (will-change/transform only while pulling/animating).
  - non-passive `touchmove` is attached only while the page is at the top, so normal scrolling stays on the compositor thread.
  - "load more" inserts cards a few per frame (CHUNK) and prefetches earlier (rootMargin 900px).
- js/17-chip-dropdown.js — global scroll listener is passive and exits immediately when no chip dropdown is open.
- styles.css — no permanent `will-change` on every swipe card; hidden refresh spinner animation is paused (`.is-idle`); `.car-photo.img-ready` uses `filter:none`.
- index.html — preconnect to the photo host.


## Mobile + startup optimization (2026-11-03)

- `index.html`: all classic external app scripts use `defer` in their original dependency order. The admin-only `layout-editor.js` and `color-tool.js` load only when enabled through their query flags or stored admin flags.
- CSS: 44 local stylesheet requests are combined into `carmaa-core.min.css` and `carmaa-layers.min.css`; `perf-final.css` is the last mobile GPU optimization layer. Inline style boundaries and original CSS sources remain intact.
- `js/26-messaging.js`, `js/37-notifications.js`, `js/47-live.js`: reduced periodic fallback work; SSE remains the fast path.
- Homepage banner images are recompressed as WebP at quality 82 with a 1440px maximum width. Their query versions are updated to bypass previous cache entries.
- See `PERFORMANCE_OPTIMIZATION_REPORT_FA.md` for measured local file sizes and limitations.
