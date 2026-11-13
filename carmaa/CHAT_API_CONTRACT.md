# C♻️RMA Messaging: Frontend Integration Contract

This release contains the **frontend only**. No messaging server, WebSocket service, or message database is included. By default, `js/26-messaging.js` uses a local preview adapter that saves demo conversations in this browser's `localStorage`. It must not be treated as cross-user online messaging.

## Enable API mode

Define `window.CarMaa_CHAT_CONFIG` before `js/26-messaging.js` loads. For example, add this configuration before the final script tag in `index.html`:

```html
<script>
  window.CarMaa_CHAT_CONFIG = {
    mode: "api",
    baseURL: "/api/v1",
    tokenStorageKey: "marqueAccessToken"
  };
</script>
<script src="js/26-messaging.js"></script>
```

The connected authentication flow must save a valid backend access token under the selected storage key, or provide `getAccessToken: async () => ...` to retrieve it. The existing local/demo OTP flow does not issue a backend token by itself. In API mode, listings passed to `startForListing` must carry the real backend listing ID.

## Required REST endpoints

All endpoints require `Authorization: Bearer <access_token>` and return JSON. Every endpoint must verify that the current user is a participant, and every new conversation must be tied to an existing listing. Never trust a participant ID supplied by the browser as authorization.

### `GET /messages/conversations?page=1&page_size=50`

Return the current user's conversations, newest first. Either a raw array or one of `{ "results": [...] }`, `{ "items": [...] }`, or `{ "conversations": [...] }` is supported.

```json
{
  "id": "conversation-uuid",
  "listing_id": "listing-uuid",
  "listing": {
    "id": "listing-uuid",
    "title": "تویوتا کرولا ۱۴۰۰",
    "year": 2021,
    "city": "تهران",
    "price": "۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان",
    "photo": "/media/listings/cover.jpg",
    "seller_name": "فروشنده"
  },
  "other_name": "فروشنده",
  "last_message": "سلام، خودرو موجود است؟",
  "last_message_at": "2026-10-15T10:30:00Z",
  "unread_count": 1
}
```

### `POST /messages/conversations`

Creates or returns an existing conversation for the authenticated user and the target listing. The server should derive the seller from the listing, not accept a seller ID from the client.

```json
{ "listing_id": "listing-uuid" }
```

Return the conversation object shown above, either directly or wrapped in `{ "conversation": ... }`.

### `GET /messages/conversations/{conversation_id}`

Return the full conversation, including its listing summary and counterpart display name. The caller must be a participant.

### `GET /messages/conversations/{conversation_id}/messages?limit=50`

Return an array or one of `{ "results": [...] }`, `{ "items": [...] }`, or `{ "messages": [...] }`.

```json
{
  "id": "message-uuid",
  "text": "سلام، خودرو هنوز موجود است؟",
  "created_at": "2026-10-15T10:30:00Z",
  "is_mine": true
}
```

### `POST /messages/conversations/{conversation_id}/messages`

```json
{ "text": "سلام، خودرو هنوز موجود است؟" }
```

Return the created message object. Enforce length limits, rate limits, participant checks, and server-side validation. The frontend caps text at 3,000 characters.

### `POST /messages/conversations/{conversation_id}/read`

Marks incoming messages as read for the authenticated user. An empty JSON body is accepted.

## Refresh and real-time delivery

In API mode the UI refreshes the inbox or the open conversation every six seconds while the tab is visible. This works as a backend integration fallback but is not push-based real-time delivery. A future WebSocket/SSE transport can replace polling without changing the chat screens or local preview UI.

## Frontend hooks

`window.CarMaa_CHAT.mode` reports `local` or `api`. `window.CarMaa_CHAT.openInbox()` opens the inbox, `window.CarMaa_CHAT.startForListing(listingId)` starts a conversation, and `window.CarMaa_CHAT.refresh()` refreshes the inbox. The `adapter` property exposes the REST methods for integration tests.

## Production requirements not supplied by this frontend

The backend must implement authentication, conversation membership checks, transactional message creation, database persistence, read receipts, rate limiting, abuse/report/block controls, retention rules, and safe notification delivery. The local preview deliberately stores sample data on the current browser only and does not deliver messages to another person.

## Typing indicator (optional)

### `POST /messages/conversations/{conversation_id}/typing`

Body `{ "typing": true }` (or `false` to clear). The frontend sends it at most every ~2.5 s while the user types. Returns `{ "ok": true }`. The state expires on the server after 5 seconds.

### `GET /messages/conversations/{conversation_id}/typing`

Returns `{ "typing": true|false, "other_read_at": "<ISO time>|null" }`: whether the *other* participant is typing right now, and when they last read the conversation (used to flip "ارسال شد" to "دیده شد" within ~2 s). The frontend polls it every 2 s while a conversation is open. If the endpoint is missing, the indicator is simply not shown.

## Read receipts ("دیده شد")

`GET /messages/conversations/{id}/messages` returns `is_read` on each of the caller's own messages (`true` when the other participant's `last_read_at` is not older than the message) plus a top-level `other_last_read_at`. The frontend shows "ارسال شد" / "دیده شد <time>" under the latest message when it is mine, and calls `POST .../read` whenever a conversation is open and a new incoming message arrives.

## Message reactions, edit and delete (long-press menu)

Requires migrations `009_message_likes.sql` and `010_message_reactions_edit.sql`.

- `POST /messages/conversations/{id}/messages/{mid}/react` with `{ "emoji": "❤️" | "👍" | "👎" | "😂" | "😮" | "😢" | "🔥" | null }` sets (or clears with `null`) the caller's single reaction. Returns `{ "reactions": [{emoji,count}], "my_reaction": "❤️"|null }`. The older `.../like` endpoint (`{ "liked": bool }`) still works and maps to ❤️.
- `PATCH .../messages/{mid}` with `{ "text": "..." }` edits the caller's own message (24 h window, `EDIT_WINDOW_HOURS` in `messages.js`). Returns `{ "message": { id, text, created_at, edited_at } }`.
- `DELETE .../messages/{mid}` soft-deletes the caller's own message for everyone.
- `GET .../messages` returns per message: `reactions`, `my_reaction`, `edited_at`.


## Photos, voice messages and story cards

Requires migration `011_message_media.sql` (adds `messages.kind`, `media_url`, `media_mime`, `media_meta`, `story_ref`).

Every message returned by `GET .../messages` and by the send endpoints now also carries:

```json
{ "kind": "text|image|voice",
  "media": { "type": "image", "url": "/media/<uuid>.webp", "mime": "image/webp", "w": 1200, "h": 800 },
  "story": { "id": "story-uuid", "thumb": "/media/<uuid>.webp", "caption": "..." } }
```

`media` is `null` for text; for voice it is `{ "type": "voice", "url", "mime", "dur": 12.4, "wave": [1..9 x 40] }`. `story` is `null` unless the message is a reply to a story.

### `POST /messages/conversations/{conversation_id}/media`

`multipart/form-data`: `file` (required, max 4 MB), `kind` = `image` | `voice`, `caption` (image only, max 1000 chars), `duration` (voice, seconds, 0.5-180) and `wave` (voice, optional, up to 64 comma-separated digits 0-9).

- Images (JPEG/PNG/WebP, checked by magic bytes) are re-encoded by the server to WebP, max 1600 px, EXIF-rotated.
- Voice (webm/ogg from Chrome and Firefox, mp4/m4a from Safari, checked by magic bytes) is stored as uploaded.
- Returns `201 { "message": {...} }`. Same participant, block and rate checks as text; additionally 60 uploads/hour and 150 photo/voice messages per day per user.
- Chat media does not use the listing-image quota (`/uploads/images`).

### Story replies

`POST .../messages` accepts an optional `story_id`. The server only accepts a story that is still active and owned by the other participant, and stores a snapshot (id, image URL, caption) from the database, never from client-supplied values, so the story card stays in the chat after the 24-hour expiry.

### Other behaviour

- Photo/voice messages cannot be edited (`PATCH` returns 404 `NOT_EDITABLE`); they can be deleted, reacted to and replied to like text.
- The inbox `last_message` shows `📷 عکس` / `🎤 پیام صوتی` (or the photo caption).
- Local preview mode keeps the files in IndexedDB (`carmaa_chat_media`), not localStorage.
- Voice recording needs HTTPS (or localhost) and microphone permission.
