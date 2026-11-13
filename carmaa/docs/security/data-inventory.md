# data-inventory.md (D1 — خودکار از migrationها، 2026-11-08)

ستونهایی که احتمالاً داده شخصی/متن کاربر هستند. بازبینی دستی لازم است (D2: دلیل هر فیلد).

| جدول | ستونهای حساس/شخصی | نگهداری (retention) |
|---|---|---|
| users | phone_e164, display_name, avatar_url, phone_verified_at | تا حذف حساب — ⚠ «حذف حساب» هنوز پیادهسازی نشده (finding F2) |
| auth_otps | phone_e164, request_ip_hash | حذف خودکار ۱ روز بعد از انقضا (server.js sweep) |
| sessions | user_agent_hash | حذف خودکار ۳۰ روز بعد از انقضا/ابطال (server.js sweep) |
| images | — | نیاز به تصمیم صاحب سایت |
| showrooms | name, address, description, banner_image_id, phone_public | نیاز به تصمیم صاحب سایت |
| listings | title, body_type, description | نیاز به تصمیم صاحب سایت |
| listing_images | — | نیاز به تصمیم صاحب سایت |
| listing_private_details | seller_phone_public | نیاز به تصمیم صاحب سایت |
| listing_price_history | — | نیاز به تصمیم صاحب سایت |
| listing_favorites | — | نیاز به تصمیم صاحب سایت |
| follows | — | نیاز به تصمیم صاحب سایت |
| saved_searches | — | نیاز به تصمیم صاحب سایت |
| conversations | — | نیاز به تصمیم صاحب سایت |
| messages | body | نیاز به تصمیم صاحب سایت |
| conversation_reads | — | نیاز به تصمیم صاحب سایت |
| user_blocks | — | نیاز به تصمیم صاحب سایت |
| notifications | title, body | نیاز به تصمیم صاحب سایت |
| reports | message_id | نیاز به تصمیم صاحب سایت |
| payment_orders | — | طبق قانون/حسابداری (بدون شماره کارت/CVV) |
| admin_audit_logs | — | نیاز به تصمیم صاحب سایت |
| idempotency_records | response_body | نیاز به تصمیم صاحب سایت |
| listing_offers | message | نیاز به تصمیم صاحب سایت |
| qa_questions | title, body | نیاز به تصمیم صاحب سایت |
| qa_answers | body | نیاز به تصمیم صاحب سایت |
| showroom_reviews | body | نیاز به تصمیم صاحب سایت |
| qa_answer_votes | — | نیاز به تصمیم صاحب سایت |
| stories | caption | نیاز به تصمیم صاحب سایت |
| story_views | device_digest | نیاز به تصمیم صاحب سایت |
| listing_interaction_events | device_digest | نیاز به تصمیم صاحب سایت |
| support_tickets | body | نیاز به تصمیم صاحب سایت |
| message_likes | message_id | نیاز به تصمیم صاحب سایت |
| news_likes | — | نیاز به تصمیم صاحب سایت |
| news_comments | body | نیاز به تصمیم صاحب سایت |
| news_comment_likes | — | نیاز به تصمیم صاحب سایت |
| showroom_rank_snapshots | — | نیاز به تصمیم صاحب سایت |
| story_seen | — | نیاز به تصمیم صاحب سایت |
| news_items | title | نیاز به تصمیم صاحب سایت |
| sms_notifications | — | نیاز به تصمیم صاحب سایت |
| admin_invites | phone_e164 | نیاز به تصمیم صاحب سایت |
| home_banners | — | نیاز به تصمیم صاحب سایت |
| ad_cards | title, description, cta_text, badge_text | نیاز به تصمیم صاحب سایت |
| story_hides | — | نیاز به تصمیم صاحب سایت |
| conversation_clears | — | نیاز به تصمیم صاحب سایت |
| social_posts | body | نیاز به تصمیم صاحب سایت |
| social_post_likes | — | نیاز به تصمیم صاحب سایت |
| social_post_comments | body | نیاز به تصمیم صاحب سایت |

**پرداخت (D4):** فقط authority/ref_id/مبلغ؛ شماره کارت و CVV هرگز ذخیره نمیشود (زرینپال صفحهی میزبانی).
**شخص ثالث (D13):** کاوهنگار/ملیپیامک (شماره)، زرینپال (مبلغ/سفارش)، Anthropic (فقط متن خبر RSS، نه داده کاربر)، HuggingFace (فقط دانلود مدل).
