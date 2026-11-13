// Usage (inside the api container):
//   node src/scripts/weekly-report.js            -> dry run, prints what each showroom would get
//   node src/scripts/weekly-report.js --send     -> really creates reports + notifications (+ SMS if WEEKLY_REPORT_SMS=true)
//   node src/scripts/weekly-report.js --send --no-sms
import { runWeekly } from '../services/weekly-report.js';
import { pool } from '../db.js';

const send = process.argv.includes('--send');
const sms = !process.argv.includes('--no-sms');
try {
  const out = await runWeekly({ dry: !send, sms });
  console.log(JSON.stringify({ mode: send ? 'send' : 'dry', ...out }));
} catch (error) {
  console.error('weekly report failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
