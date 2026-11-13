# JavaScript file map

The app's JavaScript is split into `js/01-...` through `js/26-...`, loaded in order by plain `<script>` tags in `index.html`. They are **not** ES modules: the scripts share the global scope like the original single-file app. Load order matters, so do not reorder the tags casually.

| File | What's inside |
|---|---|
| `01-data.js` | Brands, dealers, locations, listing seed data and shared catalog values |
| `02-helpers.js` | Formatting, listing statistics, vehicle specs and reusable helpers |
| `02a-admin-store.js` | Shared local store used by the site and `admin.html` |
| `03-icons.js` | Inline SVG icon set and `icon()` helper |
| `04-state-core.js` | Main app state, route serialization, vehicle details, maps and filters |
| `05-small-render-pieces.js` | Shared header, menu drawer and skeleton loaders |
| `06-home-cards.js` | Listing cards and brand-chip markup |
| `07-vehicle-account-common.js` | Small widgets shared by vehicle and account pages |
| `08-auth-modal-toast.js` | Local/demo phone sign-in flow, toast and bottom navigation updates |
| `09-search-overlay.js` | Full-screen search overlay |
| `10-search-bar-rotator.js` | Search-bar placeholder rotation and live search results |
| `11-filters-overlay.js` | Full-screen filters and sort controls |
| `12-templates-toolbar.js` | Template mounting, breadcrumbs and shared page-shell helpers |
| `13-pages-home-listings-vehicle.js` | Listings, vehicle detail, dealers and seller pages |
| `14-pages-sell-saved-manage.js` | Listing creation, saved listings and listing management |
| `15-pages-account.js` | Account and account-edit screens |
| `16-app-render-router.js` | Main `render()` function, route handling and sticky chrome |
| `17-chip-dropdown.js` | Click-action delegation, filters and many page interactions |
| `18-peek-preview-init.js` | Card preview and swipe behavior, app startup |
| `19-swipe-save-card.js` | Listing card gestures and save behavior |
| `20-body-condition-overlay.js` | Vehicle body-condition overlay and controls |
| `21-brand-sheet.js` | Brand picker sheet |
| `22-share-poster.js` | Listing share-poster generation |
| `23-admin-sync.js` | Applies local admin decisions to listing and account data |
| `24-paid-services.js` | Listing promotion / paid-service UI flows |
| `25-ad-stats.js` | Listing stats UI |
| `26-messaging.js` | Messaging inbox, conversation view, local preview storage and API adapter |
| `27-stories.js` | 24-hour stories: rail at top of the inbox (first tile from the right = my story), composer, viewer, auto-expiry, listing link and replies (localStorage `marque_stories_v1`) |

Messaging details and the backend contract are documented in `CHAT_API_CONTRACT.md`. The default messaging mode is local preview only; it does not deliver messages to other devices or users until a backend is connected.
