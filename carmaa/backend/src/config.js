import { z } from 'zod';
import path from 'node:path';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  POSTGRES_PASSWORD: z.string().optional().default(''),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_URL: z.string().min(1),
  OTP_PEPPER: z.string().min(32),
  SESSION_PEPPER: z.string().min(32),
  COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).default('carmaa_session'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  DEFAULT_PHONE_COUNTRY_CODE: z.string().regex(/^\d{1,3}$/).default('98'),
  SMS_PROVIDER: z.enum(['kavenegar', 'melipayamak']).default('kavenegar'),
  MELIPAYAMAK_OTP_URL: z.string().optional().default(''),
  MELIPAYAMAK_SHARED_URL: z.string().optional().default(''),
  MELIPAYAMAK_OTP_BODY_ID: z.coerce.number().int().positive().optional(),
  MELIPAYAMAK_ADV_URL: z.string().optional().default(''),
  MELIPAYAMAK_FROM: z.string().optional().default(''),
  MSG_SMS_COOLDOWN_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  MELIPAYAMAK_UNREAD_BODY_ID: z.coerce.number().int().positive().optional(),
  MSG_SMS_DELAY_SECONDS: z.coerce.number().int().min(0).max(3600).default(90),
  KAVENEGAR_API_KEY: z.string().optional().default(''),
  // Local/staging-only fixed OTP. Must remain empty in production.
  DEV_OTP_CODE: z.string().regex(/^(|\d{6})$/).default(''),
  KAVENEGAR_SENDER: z.string().optional().default(''),
  PAYMENT_PROVIDER: z.enum(['zarinpal']).default('zarinpal'),
  ZARINPAL_MERCHANT_ID: z.string().optional().default(''),
  PAYMENT_CALLBACK_BASE_URL: z.string().url().default('http://localhost:3000/api/v1/payments/zarinpal/callback'),
  PAYMENT_SANDBOX: z.enum(['true', 'false']).default('true'),
  MEDIA_ROOT: z.string().default('./var/media'),
  MEDIA_PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000/media'),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('true'),
  TRUST_PROXY: z.enum(['0', '1']).default('0'),
  // SEC-PATCH (A9): session timeouts
  SESSION_IDLE_MINUTES_USER: z.coerce.number().int().min(5).max(43200).default(7200),
  SESSION_IDLE_MINUTES_STAFF: z.coerce.number().int().min(5).max(43200).default(120),
  SESSION_ABSOLUTE_HOURS_STAFF: z.coerce.number().int().min(1).max(720).default(12),
  // Automatic car news: RSS feeds are read every NEWS_INGEST_MINUTES (0 = off) and translated to Persian with the Claude API.
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  NEWS_AI_MODEL: z.string().default('claude-haiku-5-5'),
  NEWS_PROVIDERS: z.string().default('huggingface,custom,anthropic,mymemory'),
  HF_TOKEN: z.string().optional().default(''),
  HF_MODEL: z.string().default('Qwen/Qwen2.5-72B-Instruct'),
  HF_BASE_URL: z.string().url().default('https://router.huggingface.co/v1'),
  NEWS_LLM_BASE_URL: z.string().optional().default(''),
  NEWS_LLM_API_KEY: z.string().optional().default(''),
  NEWS_LLM_MODEL: z.string().optional().default(''),
  MYMEMORY_EMAIL: z.string().optional().default(''),
  NEWS_ALLOW_UNTRANSLATED: z.enum(['true', 'false']).default('true'),
  NEWS_INGEST_MINUTES: z.coerce.number().int().min(0).max(1440).default(30),
  // "Name|https://feed-url" entries separated by commas.
  NEWS_FEEDS: z.string().default('KBB|https://www.kbb.com/car-news/feed/,Elektroquatsch|https://www.elektroquatsch.de/feed/'),
  // Comma-separated E.164 phones auto-promoted to admin after a successful real OTP login.
  ADMIN_BOOTSTRAP_PHONES: z.string().default(''),
});

// Docker: build connection URLs inside the container from backend/.env so they never depend on
// docker-compose variable interpolation (which silently became blank when --env-file was forgotten).
const rawEnv = { ...process.env };
if (rawEnv.DB_HOST && rawEnv.POSTGRES_PASSWORD) {
  // SEC2-PATCH (S17): api uses a least-privilege role (APP_DB_USER is set only on the api service); migrate keeps the owner
  const dbUser = rawEnv.APP_DB_USER && rawEnv.APP_DB_PASSWORD ? rawEnv.APP_DB_USER : 'carmaa';
  const dbPass = dbUser === 'carmaa' ? rawEnv.POSTGRES_PASSWORD : rawEnv.APP_DB_PASSWORD;
  rawEnv.DATABASE_URL = `postgres://${dbUser}:${encodeURIComponent(dbPass)}@${rawEnv.DB_HOST}:5432/carmaa`;
}
if (rawEnv.REDIS_HOST && rawEnv.REDIS_PASSWORD) {
  rawEnv.REDIS_URL = `redis://:${encodeURIComponent(rawEnv.REDIS_PASSWORD)}@${rawEnv.REDIS_HOST}:6379`;
}
const parsed = envSchema.safeParse(rawEnv);
if (!parsed.success) {
  const fields = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${fields}`);
}

const s3Fields = [parsed.data.S3_BUCKET, parsed.data.S3_ACCESS_KEY_ID, parsed.data.S3_SECRET_ACCESS_KEY];
if (s3Fields.some(Boolean) && !s3Fields.every(Boolean)) {
  throw new Error('S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be configured together; refusing silent local-storage fallback.');
}

export const config = Object.freeze({
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  cookieSecure: parsed.data.COOKIE_SECURE === 'true' || parsed.data.NODE_ENV === 'production',
  adminBootstrapPhones: parsed.data.ADMIN_BOOTSTRAP_PHONES.split(',').map((x) => x.trim()).filter(Boolean),
  allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  paymentSandbox: parsed.data.PAYMENT_SANDBOX === 'true',
  mediaRoot: path.resolve(process.cwd(), parsed.data.MEDIA_ROOT),
});

if (config.isProduction) {
  if (parsed.data.DEV_OTP_CODE) {
    throw new Error('DEV_OTP_CODE must be empty in production.');
  }
  if (parsed.data.OTP_PEPPER === parsed.data.SESSION_PEPPER) {
    throw new Error('OTP_PEPPER and SESSION_PEPPER must be different secrets.');
  }
  if ([parsed.data.OTP_PEPPER, parsed.data.SESSION_PEPPER].some((value) => /replace-with|change-me|example|password|secret/i.test(value))) {
    throw new Error('Production cannot start with example or placeholder secrets. Generate unique secrets.');
  }
  for (const [name, value] of [['POSTGRES_PASSWORD', parsed.data.POSTGRES_PASSWORD], ['REDIS_PASSWORD', parsed.data.REDIS_PASSWORD]]) {
    if (value && (!/^[A-Za-z0-9_-]{32,}$/.test(value) || /replace-with|change-me|example|password|secret/i.test(value))) {
      throw new Error(`Production ${name} must be a URL-safe random secret with at least 32 characters.`);
    }
  }
  if (parsed.data.POSTGRES_PASSWORD && parsed.data.POSTGRES_PASSWORD === parsed.data.REDIS_PASSWORD) {
    throw new Error('POSTGRES_PASSWORD and REDIS_PASSWORD must be different secrets.');
  }
  if (config.OTP_PEPPER.includes('replace-with') || config.SESSION_PEPPER.includes('replace-with')) {
    throw new Error('Production cannot start with example peppers. Generate unique secrets.');
  }
  if (config.allowedOrigins.some((origin) => origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    throw new Error('Production ALLOWED_ORIGINS contains localhost. Set the real HTTPS frontend origin.');
  }
  if (config.allowedOrigins.some((origin) => new URL(origin).protocol !== 'https:')) {
    throw new Error('Every production ALLOWED_ORIGINS entry must use HTTPS.');
  }
  for (const [name, value] of Object.entries({
    PUBLIC_BASE_URL: config.PUBLIC_BASE_URL,
    FRONTEND_URL: config.FRONTEND_URL,
    PAYMENT_CALLBACK_BASE_URL: config.PAYMENT_CALLBACK_BASE_URL,
    MEDIA_PUBLIC_BASE_URL: config.MEDIA_PUBLIC_BASE_URL,
  })) {
    if (new URL(value).protocol !== 'https:') throw new Error(`Production ${name} must use HTTPS.`);
  }
  if (config.S3_ENDPOINT && new URL(config.S3_ENDPOINT).protocol !== 'https:') {
    throw new Error('Production S3_ENDPOINT must use HTTPS.');
  }
  if (config.SMS_PROVIDER === 'melipayamak' ? !(config.MELIPAYAMAK_OTP_URL || (config.MELIPAYAMAK_SHARED_URL && config.MELIPAYAMAK_OTP_BODY_ID)) : !config.KAVENEGAR_API_KEY) throw new Error('Production requires the SMS provider key/URL.');
  if (!config.ZARINPAL_MERCHANT_ID) throw new Error('Production requires ZARINPAL_MERCHANT_ID.');
  if (config.paymentSandbox) throw new Error('Production must set PAYMENT_SANDBOX=false.');
  const databaseHost = (() => { try { return new URL(config.DATABASE_URL).hostname; } catch { return ''; } })();
  if (!['db', 'localhost', '127.0.0.1', '::1'].includes(databaseHost) && parsed.data.DATABASE_SSL !== 'true') {
    throw new Error('Production remote PostgreSQL must use DATABASE_SSL=true.');
  }
}
