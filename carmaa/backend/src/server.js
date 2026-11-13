import app from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { redis, connectRedis } from './middleware/security.js';
import { initMedia } from './services/media.js';
import { startLive, stopLive } from './live.js';
import { startNewsIngest, stopNewsIngest } from './services/news-ingest.js';
import { startNotificationSms, stopNotificationSms } from './services/notification-sms.js';
import { startWeeklyReport, stopWeeklyReport } from './services/weekly-report.js';

let server;
async function start() {
  await pool.query('SELECT 1');
  await initMedia();
  if (config.adminBootstrapPhones.length) {
    const { rows } = await pool.query("UPDATE users SET role='admin',updated_at=now() WHERE phone_e164=ANY($1) AND status='active' AND role<>'admin' RETURNING id", [config.adminBootstrapPhones]);
    for (const r of rows) await pool.query("INSERT INTO admin_audit_logs(actor_id,action,target_type,target_id,metadata) VALUES($1::uuid,'bootstrap.admin_promote','user',$1::text,$2)", [r.id, { method: 'env_bootstrap_on_start' }]);
  }
  try { await connectRedis(); }
  catch (error) {
    if (config.isProduction) throw new Error('Redis is required in production for shared rate limits.');
    console.warn('Redis unavailable; development-only in-memory rate limits are being used.');
  }
  // Expired OTP challenges and sessions are dead rows; keep the tables small.
  const sweep = () => pool.query("DELETE FROM auth_otps WHERE expires_at < now() - interval '1 day'")
    .then(() => pool.query("DELETE FROM sessions WHERE expires_at < now() - interval '30 days' OR revoked_at < now() - interval '30 days'"))
    .catch(() => {});
  setTimeout(sweep, 60_000).unref?.();
  setInterval(sweep, 6 * 3600_000).unref?.();
  server = app.listen(config.PORT, config.HOST, () => {
    console.log(JSON.stringify({ level:'info', event:'api_started', host:config.HOST, port:config.PORT, env:config.NODE_ENV }));
  });
  startLive();
  startNewsIngest();
  startNotificationSms();
  startWeeklyReport();
  server.requestTimeout = 30_000;
  server.headersTimeout = 35_000;
  server.keepAliveTimeout = 5_000;
}
async function shutdown(signal) {
  console.log(JSON.stringify({level:'info',event:'shutdown',signal}));
  stopNewsIngest();
  stopNotificationSms();
  stopWeeklyReport();
  await stopLive(); // open event streams would otherwise keep server.close() waiting
  if (server) await new Promise((resolve) => server.close(resolve));
  await Promise.allSettled([pool.end(), redis.quit()]);
  process.exit(0);
}
process.once('SIGINT',()=>shutdown('SIGINT'));
process.once('SIGTERM',()=>shutdown('SIGTERM'));
start().catch(async (error)=>{
  console.error(JSON.stringify({level:'fatal',event:'startup_failed',message:error.message}));
  await Promise.allSettled([pool.end(),redis.quit()]);
  process.exit(1);
});
