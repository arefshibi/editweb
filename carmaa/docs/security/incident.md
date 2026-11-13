# incident.md — طرح واکنش به حادثه (D16)
1. **مهار:** اگر نشت مشکوک است: `docker compose -f docker-compose.prod.yml --env-file backend/.env stop web` (سایت قطع، دیتابیس سالم).
2. **چرخاندن کلیدها (S8):** ملیپیامک/کاوهنگار، زرینپال، Anthropic، HF، رمز Postgres/Redis، `bash sec.sh --rotate-secrets` (pepperها؛ همهی نشستها بسته میشود).
3. **بررسی:** `docker compose ... logs api | grep -E "login_success|otp_verify_failed|access_denied|rate_limited"` و `admin_audit_logs` در دیتابیس.
4. **اطلاع:** کاربران متأثر را از طریق پیامک/اعلان مطلع کن؛ اگر داده شخصی لو رفته مرجع قانونی مربوطه را خبر کن.
5. **ریشهیابی و اصلاح:** در `findings.md` ثبت، بستن، تست، سپس `docker compose ... up -d --build`.
6. **برگشت:** `bash sec.sh --rollback` آخرین بکاپ پچ امنیتی را برمیگرداند.
