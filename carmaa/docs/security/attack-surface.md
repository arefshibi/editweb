# attack-surface.md (خودکار از کد ساخته شده — 2026-11-08)

بهعلاوه: `/media/*` (فایلهای آپلودی، CSP sandbox)، `/health/*`، وب استاتیک Caddy، پنل admin.html.

| مسیر | متد | احراز هویت |
|---|---|---|
| /api/v1/auth/otp/request | POST | عمومی |
| /api/v1/auth/otp/verify | POST | عمومی |
| /api/v1/auth/me | GET | login |
| /api/v1/auth/logout | POST | login |
| /api/v1/auth/logout-all | POST | login |
| /api/v1/auth/totp/verify | POST | login |
| /api/v1/auth/username-available | GET | login |
| /api/v1/auth/profile | PATCH | login |
| /api/v1/listings | GET | عمومی |
| /api/v1/listings/mine | GET | login |
| /api/v1/listings/:id | GET | عمومی |
| /api/v1/listings | POST | login |
| /api/v1/listings/:id | PATCH | login |
| /api/v1/listings/:id | DELETE | login |
| /api/v1/listings/:id/favorite | POST | login |
| /api/v1/listings/:id/offers | POST | login |
| /api/v1/listings/:id/price-history | GET | عمومی |
| /api/v1/showrooms | GET | عمومی |
| /api/v1/showrooms/slug-available | GET | login |
| /api/v1/showrooms/rank-movements | GET | عمومی |
| /api/v1/showrooms/mine | GET | login |
| /api/v1/showrooms | POST | login |
| /api/v1/showrooms/mine | PATCH | login |
| /api/v1/showrooms/:slug | GET | عمومی |
| /api/v1/showrooms/:id/follow-status | GET | login |
| /api/v1/showrooms/:id/follow | POST | login |
| /api/v1/showrooms/:id/reviews | POST | login |
| /api/v1/messages/conversations | GET | authRequired |
| /api/v1/messages/conversations/direct | POST | authRequired |
| /api/v1/messages/conversations | POST | authRequired |
| /api/v1/messages/conversations/:id | DELETE | authRequired |
| /api/v1/messages/conversations/:id | GET | authRequired |
| /api/v1/messages/conversations/:id/messages | GET | authRequired |
| /api/v1/messages/conversations/:id/messages | POST | authRequired |
| /api/v1/messages/conversations/:id/media | POST | authRequired |
| /api/v1/messages/conversations/:id/typing | POST | authRequired |
| /api/v1/messages/conversations/:id/typing | GET | authRequired |
| /api/v1/messages/conversations/:id/messages/:mid/react | POST | authRequired |
| /api/v1/messages/conversations/:id/messages/:mid/like | POST | authRequired |
| /api/v1/messages/conversations/:id/messages/:mid | PATCH | authRequired |
| /api/v1/messages/conversations/:id/messages/:mid | DELETE | authRequired |
| /api/v1/messages/conversations/:id/read | POST | authRequired |
| /api/v1/messages/users/:id/block | DELETE | authRequired |
| /api/v1/messages/blocks | GET | authRequired |
| /api/v1/messages/users/:id/block | POST | authRequired |
| /api/v1/payments/checkout | POST | login |
| /api/v1/payments/orders/:id | GET | login |
| /api/v1/payments/zarinpal/callback | GET | عمومی |
| /api/v1/notifications | GET | authRequired |
| /api/v1/notifications | DELETE | authRequired |
| /api/v1/notifications/read-all | POST | authRequired |
| /api/v1/notifications/:id/read | POST | authRequired |
| /api/v1/qa/questions | GET | عمومی |
| /api/v1/qa/questions/mine | GET | login |
| /api/v1/qa/questions | POST | login |
| /api/v1/qa/questions/stats | GET | عمومی |
| /api/v1/qa/questions/:id | GET | عمومی |
| /api/v1/qa/questions/:id/view | POST | عمومی |
| /api/v1/qa/answers/:id/vote | POST | login |
| /api/v1/qa/questions/:id/answers | POST | login |
| /api/v1/qa/questions/:questionId/answers/:answerId/accept | POST | login |
| /api/v1/uploads/images | POST | login |
| /api/v1/uploads/mine | GET | login |
| /api/v1/admin/overview | GET | admin/moderator |
| /api/v1/admin/listings | GET | admin/moderator + مجوز |
| /api/v1/admin/listings/:id/review | PATCH | admin/moderator + مجوز |
| /api/v1/admin/listings-all | GET | admin/moderator + مجوز |
| /api/v1/admin/listings/:id | PATCH | admin/moderator + مجوز |
| /api/v1/admin/listings/:id | DELETE | admin/moderator + مجوز |
| /api/v1/admin/showrooms | GET | admin/moderator + مجوز |
| /api/v1/admin/showrooms/:id/review | PATCH | admin/moderator + مجوز |
| /api/v1/admin/reports | GET | admin/moderator + مجوز |
| /api/v1/admin/reports/:id | PATCH | admin/moderator + مجوز |
| /api/v1/admin/users/:id/status | PATCH | admin/moderator + مجوز |
| /api/v1/admin/audit-logs | GET | admin/moderator + مجوز |
| /api/v1/admin/staff | GET | admin/moderator |
| /api/v1/admin/staff | POST | admin/moderator |
| /api/v1/admin/staff/:id | PATCH | admin/moderator |
| /api/v1/admin/staff/:id | DELETE | admin/moderator |
| /api/v1/admin/staff-invites/:phone | DELETE | admin/moderator |
| /api/v1/admin/banners | GET | admin/moderator + مجوز |
| /api/v1/admin/banners | POST | admin/moderator + مجوز |
| /api/v1/admin/banners/:id | PATCH | admin/moderator + مجوز |
| /api/v1/admin/banners/:id/move | POST | admin/moderator + مجوز |
| /api/v1/admin/banners/:id | DELETE | admin/moderator + مجوز |
| /api/v1/admin/ad-cards | GET | admin/moderator + مجوز |
| /api/v1/admin/ad-cards | POST | admin/moderator + مجوز |
| /api/v1/admin/ad-cards/:id | PATCH | admin/moderator + مجوز |
| /api/v1/admin/ad-cards/:id | DELETE | admin/moderator + مجوز |
| /api/v1/account/favorites | GET | authRequired |
| /api/v1/account/saved-searches | GET | authRequired |
| /api/v1/account/saved-searches | POST | authRequired |
| /api/v1/account/saved-searches/:id | DELETE | authRequired |
| /api/v1/account/offers/incoming | GET | authRequired |
| /api/v1/account/offers/:id | PATCH | authRequired |
| /api/v1/account/me | DELETE | authRequired |
| /api/v1/reports | POST | login |
| /api/v1/social/users/by-username/:username | GET | عمومی |
| /api/v1/social/users/:id | GET | عمومی |
| /api/v1/social/users/:id/follow-status | GET | login |
| /api/v1/social/users/:id/followers | GET | عمومی |
| /api/v1/social/users/:id/following | GET | عمومی |
| /api/v1/social/users/:id/follow | POST | login |
| /api/v1/social/stories/mine | GET | login |
| /api/v1/social/stories/suggested | GET | اختیاری |
| /api/v1/social/stories | GET | اختیاری |
| /api/v1/social/stories | POST | login |
| /api/v1/social/stories/:id/viewers | GET | login |
| /api/v1/social/story-hides | POST | login |
| /api/v1/social/story-hides/:uid | DELETE | login |
| /api/v1/social/stories/:id/view | POST | اختیاری |
| /api/v1/social/stories/:id/seen | POST | login |
| /api/v1/social/stories/:id | DELETE | login |
| /api/v1/social/posts | GET | اختیاری |
| /api/v1/social/posts | POST | login |
| /api/v1/social/posts/:id/like | POST | login |
| /api/v1/social/posts/:id/comments | GET | اختیاری |
| /api/v1/social/posts/:id/comments | POST | login |
| /api/v1/social/posts/:id | DELETE | login |
| /api/v1/social/listings/:id/stats | GET | login |
| /api/v1/social/listings/:id/events | POST | اختیاری |
| /api/v1/support/tickets | POST | authRequired |
| /api/v1/support/tickets/mine | GET | authRequired |
| /api/v1/news/preview | GET | عمومی |
| /api/v1/news/items | GET | عمومی |
| /api/v1/news/social | GET | اختیاری |
| /api/v1/news/:newsId/like | POST | login |
| /api/v1/news/:newsId/comments | POST | login |
| /api/v1/news/comments/:commentId | DELETE | login |
| /api/v1/news/comments/:commentId/like | POST | login |
| /api/v1/ad-cards | GET | عمومی |
| /api/v1/ad-cards/:id/event | POST | عمومی |
| /api/v1/banners | GET | عمومی |
| /api/v1/live | GET | اختیاری |
