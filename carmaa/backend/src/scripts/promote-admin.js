import { pool, transaction } from '../db.js';
import { normalizePhone } from '../util.js';
const arg = process.argv.find((x)=>x.startsWith('--phone='));
const phone = normalizePhone(arg?.slice('--phone='.length) || '');
if (!phone) {
  console.error('Usage: npm run admin:promote -- --phone=+989xxxxxxxxx');
  process.exit(2);
}
try {
  const updated = await transaction(async(client)=>{
    const {rows}=await client.query("UPDATE users SET role='admin',updated_at=now() WHERE phone_e164=$1 AND status='active' RETURNING id,phone_e164,role",[phone]);
    if(!rows[0])throw new Error('No active user with this verified phone exists. First sign in using real SMS OTP.');
    await client.query('INSERT INTO admin_audit_logs(actor_id,action,target_type,target_id,metadata) VALUES($1,\'bootstrap.admin_promote\',\'user\',$2,$3)',[rows[0].id,rows[0].id,{method:'manual_cli'}]);
    return rows[0];
  });
  console.log(`Admin role granted to ${updated.phone_e164}.`);
} catch(error) {
  console.error(error.message);
  process.exitCode=1;
} finally { await pool.end(); }
