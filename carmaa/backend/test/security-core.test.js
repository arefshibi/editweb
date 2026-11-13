import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { normalizePhoneValue } from '../src/phone.js';
import { isUuid } from '../src/validation.js';
import { secureEqual, otpDigestWithPepper, sessionDigestWithPepper } from '../src/crypto-core.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');

test('Iranian local and international phone inputs normalize consistently', () => {
  assert.equal(normalizePhoneValue('0912 345 6789', '98'), '+989123456789');
  assert.equal(normalizePhoneValue('9123456789', '98'), '+989123456789');
  assert.equal(normalizePhoneValue('+98 912 345 6789', '98'), '+989123456789');
  assert.equal(normalizePhoneValue('00989123456789', '98'), '+989123456789');
  assert.equal(normalizePhoneValue('not-a-number', '98'), null);
  assert.equal(normalizePhoneValue('+123', '98'), null);
});

test('OTP digest binds both phone and code and is keyed with server pepper', () => {
  const a = otpDigestWithPepper('pepper-one', '+989123456789', '123456');
  const same = otpDigestWithPepper('pepper-one', '+989123456789', '123456');
  const otherPhone = otpDigestWithPepper('pepper-one', '+989123456780', '123456');
  const otherPepper = otpDigestWithPepper('pepper-two', '+989123456789', '123456');
  assert.equal(secureEqual(a, same), true);
  assert.equal(secureEqual(a, otherPhone), false);
  assert.equal(secureEqual(a, otherPepper), false);
});

test('session digest does not store the raw session token', () => {
  const token = 'A'.repeat(48);
  const digest = sessionDigestWithPepper('server-pepper', token);
  assert.equal(digest.length, 32);
  assert.equal(digest.toString('utf8').includes(token), false);
  assert.equal(secureEqual(digest, sessionDigestWithPepper('server-pepper', token)), true);
  assert.equal(secureEqual(Buffer.from('x'), Buffer.from('xx')), false);
});

test('client authentication has no fixed OTP bypass or persistent bearer token', () => {
  const auth = fs.readFileSync(path.join(root, 'js/17-chip-dropdown.js'), 'utf8');
  const core = fs.readFileSync(path.join(root, 'js/04-state-core.js'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'js/00-api-client.js'), 'utf8');
  assert.equal(auth.includes('otp !== "123456"'), false);
  assert.equal(auth.includes('otp === "123456"'), false);
  assert.match(core, /Authentication is server-issued/);
  assert.match(client, /credentials: 'include'/);
  assert.equal(client.includes('localStorage.setItem("marqueAccessToken"'), false);
});

test('paid services cannot grant effects from a client-side demo success', () => {
  const paid = fs.readFileSync(path.join(root, 'js/24-paid-services.js'), 'utf8');
  const click = fs.readFileSync(path.join(root, 'js/17-chip-dropdown.js'), 'utf8');
  assert.equal(paid.includes('DEMO-'), false);
  assert.equal(paid.includes('function mrApplyService'), false);
  const section = click.slice(click.indexOf('case "payService"'), click.indexOf('case "resubmitListing"'));
  assert.match(section, /window\.location\.assign\(res\.redirectUrl\)/);
  assert.equal(section.includes('mrApplyService('), false);
});

test('schema defines private offer thresholds separately and session revocation', () => {
  const sql = fs.readFileSync(path.join(root, 'backend/migrations/001_initial.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS listing_private_details/);
  assert.match(sql, /minimum_offer_toman bigint/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS sessions/);
  assert.match(sql, /revoked_at timestamptz/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS admin_audit_logs/);
});

test('payment fulfillment verifies with provider and runs once under row lock', () => {
  const payment = fs.readFileSync(path.join(root, 'backend/src/routes/payments.js'), 'utf8');
  assert.match(payment, /verifyGatewayPayment\(order, authority\)/);
  assert.match(payment, /SELECT \* FROM payment_orders WHERE id=\$1 FOR UPDATE/);
  assert.match(payment, /current\.status === 'paid'/);
  assert.equal(payment.includes('req.query.amount'), false);
});


test('OTP issuance serializes per phone and throttles verification by phone and IP', () => {
  const auth = fs.readFileSync(path.join(root, 'backend/src/routes/auth.js'), 'utf8');
  const sms = fs.readFileSync(path.join(root, 'backend/src/services/sms.js'), 'utf8');
  assert.match(auth, /pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/);
  assert.match(auth, /verifyPhoneLimit/);
  assert.match(auth, /attempts=attempts\+1.*attempts\+1 >= 5/s);
  assert.match(sms, /method: 'POST'/);
  assert.match(sms, /body: form/);
  assert.equal(sms.includes("url.searchParams.set('message', text)"), false);
});

test('report creation uses the canonical endpoint with resource membership checks', () => {
  const messages = fs.readFileSync(path.join(root, 'backend/src/routes/messages.js'), 'utf8');
  const reports = fs.readFileSync(path.join(root, 'backend/src/routes/reports.js'), 'utf8');
  assert.equal(messages.includes("router.post('/reports'"), false);
  assert.match(reports, /JOIN conversations c ON c.id=m.conversation_id/);
  assert.match(reports, /reportLimit/);
});

test('admin frontend checks the server session and role before rendering the panel', () => {
  const admin = fs.readFileSync(path.join(root, 'js/admin-panel.js'), 'utf8');
  assert.match(admin, /api\('\/auth\/me'\)/);
  assert.match(admin, /\['admin','moderator'\]\.includes\(role\)/);
  assert.equal(admin.includes('localStorage'), false);
});


test('UUID path validation rejects malformed IDs before database calls', () => {
  assert.equal(isUuid('550e8400-e29b-41d4-a716-446655440000'), true);
  assert.equal(isUuid('not-a-uuid'), false);
  assert.equal(isUuid('550e8400-e29b-41d4-a716-446655440000 OR 1=1'), false);
  assert.equal(isUuid('550e8400-e29b-01d4-a716-446655440000'), false);
});

test('Redis rate limiting increments and applies TTL in one Lua operation', () => {
  const security = fs.readFileSync(path.join(root, 'backend/src/middleware/security.js'), 'utf8');
  assert.match(security, /redis\.eval\(/);
  assert.match(security, /redis\.call\('INCR', KEYS\[1\]\)/);
  assert.match(security, /redis\.call\('EXPIRE', KEYS\[1\], ARGV\[1\]\)/);
  assert.equal(/await redis\.incr\([\s\S]{0,150}?await redis\.expire\(/.test(security), false);
});

test('a browser cancellation callback cannot mark a payment failed', () => {
  const payment = fs.readFileSync(path.join(root, 'backend/src/routes/payments.js'), 'utf8');
  const callback = payment.slice(payment.indexOf("router.get('/zarinpal/callback'"));
  const cancellation = callback.slice(callback.indexOf("if (status.toUpperCase() !== 'OK')"), callback.indexOf('let verification;'));
  assert.match(cancellation, /status=cancelled/);
  assert.equal(cancellation.includes("SET status='failed'"), false);
  assert.match(callback, /current\.status !== 'pending'/);
});

test('only explicit gateway success codes can fulfill payment; inconclusive codes throw', () => {
  const service = fs.readFileSync(path.join(root, 'backend/src/services/payments.js'), 'utf8');
  assert.match(service, /code === 100 \|\| code === 101/);
  assert.match(service, /if \(code === -51\) return \{ paid: false, code \}/);
  assert.match(service, /PAYMENT_VERIFICATION_UNCERTAIN/);
});

test('public API has a broad request ceiling and sensitive endpoints retain local limits', () => {
  const app = fs.readFileSync(path.join(root, 'backend/src/app.js'), 'utf8');
  const security = fs.readFileSync(path.join(root, 'backend/src/middleware/security.js'), 'utf8');
  assert.match(app, /name: 'api-global', windowSeconds: 60, max: 600/);
  assert.match(app, /app\.use\('\/api\/v1', globalApiLimit, csrfOriginGuard\)/);
  assert.match(security, /RATE_LIMIT_UNAVAILABLE/);
});

test('reports target exactly one UUID resource and do not accept arbitrary identifier text', () => {
  const reports = fs.readFileSync(path.join(root, 'backend/src/routes/reports.js'), 'utf8');
  assert.match(reports, /listingId:z\.string\(\)\.uuid\(\)\.optional\(\)/);
  assert.match(reports, /filter\(Boolean\)\.length!==1/);
  assert.match(reports, /reportedUserId\)\{/);
});

test('message quota is serialized across concurrent conversations and accepted answer changes are transactional', () => {
  const messages = fs.readFileSync(path.join(root, 'backend/src/routes/messages.js'), 'utf8');
  const qa = fs.readFileSync(path.join(root, 'backend/src/routes/qa.js'), 'utf8');
  assert.match(messages, /pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/);
  assert.match(messages, /message-send:\$\{req\.auth\.userId\}/);
  assert.match(qa, /transaction\(async \(client\) =>/);
  assert.match(qa, /FOR UPDATE/);
});

test('production rejects duplicate secret peppers and requires TLS for remote PostgreSQL', () => {
  const config = fs.readFileSync(path.join(root, 'backend/src/config.js'), 'utf8');
  assert.match(config, /OTP_PEPPER === parsed\.data\.SESSION_PEPPER/);
  assert.match(config, /Production remote PostgreSQL must use DATABASE_SSL=true/);
  assert.match(config, /POSTGRES_PASSWORD and REDIS_PASSWORD must be different secrets/);
});


test('schema migration leaves transaction ownership to the migration runner', () => {
  const sql = fs.readFileSync(path.join(root, 'backend/migrations/001_initial.sql'), 'utf8');
  const migrate = fs.readFileSync(path.join(root, 'backend/src/migrate.js'), 'utf8');
  assert.doesNotMatch(sql, /^\s*(?:BEGIN|COMMIT|ROLLBACK);\s*$/im);
  assert.match(migrate, /await client\.query\('BEGIN'\)/);
  assert.match(migrate, /await client\.query\('INSERT INTO schema_migrations/);
  assert.match(migrate, /await client\.query\('COMMIT'\)/);
  assert.match(migrate, /await client\.query\('ROLLBACK'\)/);
});

test('client-only auto-approval timer is disabled when server API is enabled', () => {
  const sell = fs.readFileSync(path.join(root, 'js/17-chip-dropdown.js'), 'utf8');
  assert.match(sell, /if \(!window\.CARMA_API\?\.enabled && !MR_STORE\.settings\(\)\.manual\) \{\s*setTimeout/);
});

test('listing migration stores validated metadata and migrations are tracked atomically', () => {
  const route = fs.readFileSync(path.join(root, 'backend/src/routes/listings.js'), 'utf8');
  const migrate = fs.readFileSync(path.join(root, 'backend/src/migrate.js'), 'utf8');
  const migration = fs.readFileSync(path.join(root, 'backend/migrations/002_listing_metadata.sql'), 'utf8');
  assert.match(route, /metadata: listingMetadata/);
  assert.match(route, /\(l\.metadata - 'mapPos' - 'clientKey'\) AS metadata/);
  assert.doesNotMatch(route, /mapPos: z\.object/);
  const publicSelect = route.slice(route.indexOf('const listingSelect'), route.indexOf("router.get('/',"));
  assert.doesNotMatch(publicSelect, /rejection_reason/);
  assert.match(route, /l\.published_at,l\.rejection_reason/);
  assert.match(route, /sets\.push\('rejection_reason=NULL'\)/);
  assert.match(migrate, /schema_migrations/);
  assert.match(migrate, /pg_advisory_lock/);
  assert.match(migrate, /BEGIN/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS metadata jsonb/);
});

test('public DTO never reveals minimum offer threshold and offer endpoint requires opt-in', () => {
  const route = fs.readFileSync(path.join(root, 'backend/src/routes/listings.js'), 'utf8');
  const select = route.slice(route.indexOf('const listingSelect'), route.indexOf("router.get('/',"));
  const offer = route.slice(route.indexOf("router.post('/:id/offers'"), route.indexOf("router.get('/:id/price-history'"));
  assert.equal(select.includes('minimum_offer_toman'), false);
  assert.match(offer, /metadata\?\.acceptsOffers !== true/);
  const uploads = fs.readFileSync(path.join(root, 'backend/src/routes/uploads.js'), 'utf8');
  assert.match(uploads, /image-quota/);
  assert.match(uploads, /250 \* 1024 \* 1024/);
});

test('server-backed listing creation fails closed and client templates escape persistent text', () => {
  const bridge = fs.readFileSync(path.join(root, 'js/42-api-marketplace-bridge.js'), 'utf8');
  const cards = fs.readFileSync(path.join(root, 'js/06-home-cards.js'), 'utf8');
  const account = fs.readFileSync(path.join(root, 'js/15-pages-account.js'), 'utf8');
  const core = fs.readFileSync(path.join(root, 'js/04-state-core.js'), 'utf8');
  assert.match(bridge, /await api\.listings\.create\(payload, idempotencyKey\)/);
  assert.match(bridge, /await api\.listings\.update\(editId, payload\)/);
  assert.match(bridge, /only images uploaded in your account|تصویر را دوباره انتخاب کنید/s);
  assert.match(bridge, /safePublicImageUrl/);
  assert.match(cards, /return escHtml\(milesStr \|\| \"\"\)/);
  assert.match(cards, /escHtml\(listingDisplayTitle\(listing\)\)/);
  assert.match(cards, /escHtml\(listing\.price\)/);
  assert.match(account, /escHtml\(listingDisplayTitle\(listing\)\)/);
  assert.match(core, /escHtml\(listing\.region\)/);
});


test('runtime marketplace DTO rejects active and insecure photo schemes and suppresses precise coordinates', () => {
  const bridge = fs.readFileSync(path.join(root, 'js/42-api-marketplace-bridge.js'), 'utf8');
  const window = { CARMA_API: { enabled: true }, location: { origin: 'https://carma.test' } };
  vm.runInNewContext(bridge, { window, URL, console, Date, Map, Number, String, Array, Object, Promise });
  const mapped = window.CARMA_MARKETPLACE.rowToCard({
    id: 'd8eec5e2-2d9a-4f4a-8d58-7fb84c0f1e39', make: 'آزمایشی', title: '<img src=x onerror=alert(1)>',
    price_toman: '1200000000', price_negotiable: false, mileage_km: 100, city: 'تهران', status: 'published',
    metadata: { mapPos: { lat: 35.7, lng: 51.4 }, region: 'مرکز', acceptsOffers: false },
    photos: [
      { url: 'javascript:alert(1)' },
      { url: 'data:text/html,<script>alert(1)</script>' },
      { url: 'http://insecure.example/car.webp' },
      { url: 'https://cdn.carma.test/car.webp' },
      { url: '/media/car.webp' },
    ],
  });
  assert.deepEqual(Array.from(mapped.photos), ['https://cdn.carma.test/car.webp', '/media/car.webp']);
  assert.equal(mapped.mapPos, null);
  assert.equal(mapped.title, '<img src=x onerror=alert(1)>'); // Escaping belongs to the template sink, not DTO mutation.
  assert.equal(mapped.status, 'listed');
});


test('staging smoke script is read-only and guards remote targets', () => {
  const smoke = fs.readFileSync(path.join(root, 'backend/test/staging-smoke.sh'), 'utf8');
  assert.match(smoke, /CARMA_ALLOW_REMOTE_STAGING/);
  assert.match(smoke, /never production/i);
  assert.match(smoke, /check_status GET \/api\/v1\/listings\/mine 401/);
  assert.match(smoke, /check_status GET \/api\/v1\/admin\/overview 401/);
  assert.doesNotMatch(smoke, /curl[^\n]*(POST|PATCH|DELETE)|\/payments\/(checkout|zarinpal)/i);
});


test('server mode hydrates favorites from API and toggles them server-authoritatively', () => {
  const client = fs.readFileSync(path.join(root, 'js/00-api-client.js'), 'utf8');
  const bridge = fs.readFileSync(path.join(root, 'js/42-api-marketplace-bridge.js'), 'utf8');
  const bootstrap = fs.readFileSync(path.join(root, 'js/41-api-bootstrap.js'), 'utf8');
  const actions = fs.readFileSync(path.join(root, 'js/17-chip-dropdown.js'), 'utf8');
  assert.match(client, /favorites\(\)\s*\{\s*return request\('\/account\/favorites'\)/);
  assert.match(client, /updateProfile\(payload\)\s*\{\s*return request\('\/auth\/profile'/);
  assert.match(bridge, /async function syncFavorites\(\)/);
  assert.match(bridge, /const result = await api\.listings\.favorite\(id\)/);
  assert.match(bootstrap, /syncFavorites\?\.\(\)/);
  assert.match(actions, /window\.CARMA_MARKETPLACE\?\.toggleFavorite\?\.\(id\)/);
});


test('successful OTP login hydrates server-owned listings and favorites after session establishment', () => {
  const authUi = fs.readFileSync(path.join(root, 'js/08-auth-modal-toast.js'), 'utf8');
  assert.match(authUi, /if \(verifiedPhone && window\.CARMA_API\?\.enabled\)/);
  assert.match(authUi, /syncMyListings\?\.\(\)/);
  assert.match(authUi, /syncFavorites\?\.\(\)/);
});


test('performance: public startup reads run concurrently and rank history writes are batched', () => {
  const bootstrap = fs.readFileSync(path.join(root, 'js/41-api-bootstrap.js'), 'utf8');
  const showrooms = fs.readFileSync(path.join(root, 'backend/src/routes/showrooms.js'), 'utf8');
  assert.match(bootstrap, /Promise\.allSettled\(\[/);
  assert.match(bootstrap, /syncPublicListings\?\.\(\)/);
  assert.match(bootstrap, /refreshShowrooms\(\)/);
  assert.match(showrooms, /FROM unnest\(\$2::uuid\[\], \$3::int\[\]\)/);
  assert.match(showrooms, /FROM unnest\(\$1::uuid\[\], \$2::int\[\], \$3::int\[\], \$4::timestamptz\[\]\)/);
  assert.doesNotMatch(showrooms, /await client\.query\('INSERT INTO showroom_rank_snapshots\(sort_key,showroom_id,rank\) VALUES\(\$1,\$2,\$3\)'/);
});


test('performance: map library is lazy-loaded and static frontend assets have bounded caching', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const loader = fs.readFileSync(path.join(root, 'js/00-leaflet-loader.js'), 'utf8');
  const detail = fs.readFileSync(path.join(root, 'js/04-state-core.js'), 'utf8');
  const sell = fs.readFileSync(path.join(root, 'js/14-pages-sell-saved-manage.js'), 'utf8');
  const caddy = fs.readFileSync(path.join(root, 'deploy/Caddyfile'), 'utf8');
  assert.match(html, /js\/00-leaflet-loader\.js/);
  assert.doesNotMatch(html, /https:\/\/unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.js/);
  assert.match(loader, /window\.CARMA_LOAD_LEAFLET\s*=\s*function/);
  assert.match(detail, /CARMA_LOAD_LEAFLET\(\)/);
  assert.match(sell, /CARMA_LOAD_LEAFLET\(\)/);
  assert.match(html, /Fredoka[^\n]+media="print" onload="this\.media='all'"/);
  assert.match(caddy, /@frontendCode path \*\.css \*\.js \*\.json \*\.webmanifest/);
  assert.match(caddy, /max-age=300, must-revalidate/);
});
