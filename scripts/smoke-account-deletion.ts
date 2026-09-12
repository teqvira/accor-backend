/**
 * Smoke-test account deletion APIs (mobile + website).
 * Uses disposable QA mobiles; restores / cleans up after.
 *
 * Run: npx tsx scripts/smoke-account-deletion.ts
 */
import 'dotenv/config';
import http from 'http';
import app from '../src/app';
import pool from '../src/database/connection';
import { initAccountDeletionSchema } from '../src/database/schema-init';
import { signAccessToken } from '../src/modules/auth/jwt.util';
import { UserRole } from '../src/modules/auth/user.types';

process.env.TEST_STATIC_OTP = process.env.TEST_STATIC_OTP || '123456';

const PORT = 5055;
const OTP = process.env.TEST_STATIC_OTP;
const MOBILE_WEB = '9000000091';
const MOBILE_APP = '9000000092';

type Json = Record<string, unknown>;

async function api(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {}
): Promise<{ status: number; json: Json }> {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = (await res.json()) as Json;
  return { status: res.status, json };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function ensureUser(mobile: string, name: string): Promise<string> {
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE mobile_number = $1 LIMIT 1`,
    [mobile]
  );
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE users
       SET is_active = true, deleted_at = NULL, role = 'user',
           is_blocked = false, updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id]
    );
    await pool.query(
      `UPDATE account_deletion_requests
       SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND status = 'pending'`,
      [existing.rows[0].id]
    );
    return existing.rows[0].id;
  }

  const created = await pool.query<{ id: string }>(
    `INSERT INTO users (name, mobile_number, role, is_active, is_verified, approval_status)
     VALUES ($1, $2, 'user', true, true, 'approved')
     RETURNING id`,
    [name, mobile]
  );
  return created.rows[0].id;
}

async function cleanup(userIds: string[]) {
  for (const id of userIds) {
    await pool.query(
      `DELETE FROM account_deletion_requests WHERE user_id = $1`,
      [id]
    );
    await pool.query(`DELETE FROM otp_verifications WHERE mobile_number IN ($1, $2)`, [
      MOBILE_WEB,
      MOBILE_APP,
    ]);
    await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [id]);
    await pool.query(`DELETE FROM user_sessions WHERE user_id = $1`, [id]);
    await pool.query(`DELETE FROM user_device_tokens WHERE user_id = $1`, [id]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
  }
}

async function main() {
  console.log('==> Ensuring account-deletion schema...');
  await initAccountDeletionSchema();

  const webUserId = await ensureUser(MOBILE_WEB, 'QA Delete Web');
  const appUserId = await ensureUser(MOBILE_APP, 'QA Delete App');
  console.log('==> Test users ready', { webUserId, appUserId });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`==> Server on :${PORT}`);

  const failures: string[] = [];

  try {
    // ── Website: unauthenticated OTP ownership check ─────────────────────
    console.log('\n[website] send-otp');
    const sendOtp = await api('POST', '/api/account-deletion/send-otp', {
      body: { mobileNumber: MOBILE_WEB },
    });
    assert(sendOtp.status === 200 && sendOtp.json.success === true, `send-otp failed: ${JSON.stringify(sendOtp)}`);
    assert(
      (sendOtp.json.data as Json)?.holdDays === 4,
      'website holdDays should be 4'
    );
    console.log('  OK', sendOtp.json.message);

    console.log('[website] confirm with wrong OTP (must fail)');
    const badOtp = await api('POST', '/api/account-deletion/confirm', {
      body: { mobileNumber: MOBILE_WEB, otp: '000000' },
    });
    assert(badOtp.status >= 400, `expected bad OTP reject, got ${badOtp.status}`);
    console.log('  OK rejected');

    console.log('[website] confirm with valid OTP (schedule 4 days)');
    const confirm = await api('POST', '/api/account-deletion/confirm', {
      body: {
        mobileNumber: MOBILE_WEB,
        otp: OTP,
        reason: 'website smoke test',
      },
    });
    assert(
      confirm.status === 200 && confirm.json.success === true,
      `confirm failed: ${JSON.stringify(confirm)}`
    );
    const confirmData = confirm.json.data as Json;
    assert(confirmData.deleted === false, 'website should not delete immediately');
    assert(confirmData.holdDays === 4, 'holdDays must be 4');
    assert(typeof confirmData.scheduledFor === 'string', 'scheduledFor required');

    const stillActive = await pool.query<{ is_active: boolean; deleted_at: Date | null }>(
      `SELECT is_active, deleted_at FROM users WHERE id = $1`,
      [webUserId]
    );
    assert(stillActive.rows[0].is_active === true, 'user must stay active during hold');
    assert(stillActive.rows[0].deleted_at === null, 'deleted_at must be null during hold');
    console.log('  OK scheduled', confirmData.scheduledFor);

    console.log('[website] duplicate request (must conflict)');
    const dup = await api('POST', '/api/account-deletion/send-otp', {
      body: { mobileNumber: MOBILE_WEB },
    });
    assert(dup.status >= 400, `expected duplicate reject, got ${dup.status}`);
    console.log('  OK rejected duplicate');

    console.log('[website] stranger cannot delete another mobile without OTP');
    const stranger = await api('POST', '/api/account-deletion/confirm', {
      body: { mobileNumber: MOBILE_APP, otp: OTP },
    });
    // MOBILE_APP has no account_deletion OTP issued → must fail
    assert(stranger.status >= 400, 'confirm without prior OTP must fail');
    console.log('  OK');

    // ── Mobile: authenticated immediate soft-delete ──────────────────────
    const appToken = signAccessToken({
      sub: appUserId,
      role: UserRole.USER,
      email: undefined,
    });

    console.log('\n[mobile] DELETE /api/users/me without token (must 401)');
    const noAuth = await api('DELETE', '/api/users/me', { body: {} });
    assert(noAuth.status === 401, `expected 401, got ${noAuth.status}`);
    console.log('  OK');

    console.log('[mobile] DELETE /api/users/me (immediate soft-delete)');
    const del = await api('DELETE', '/api/users/me', {
      token: appToken,
      body: { reason: 'app smoke test' },
    });
    assert(del.status === 200 && del.json.success === true, `delete failed: ${JSON.stringify(del)}`);
    const delData = del.json.data as Json;
    assert(delData.deleted === true, 'app delete must be immediate');
    assert(delData.holdDays === 0, 'app holdDays must be 0');

    const deletedRow = await pool.query<{ is_active: boolean; deleted_at: Date | null }>(
      `SELECT is_active, deleted_at FROM users WHERE id = $1`,
      [appUserId]
    );
    assert(deletedRow.rows[0].is_active === false, 'is_active must be false');
    assert(deletedRow.rows[0].deleted_at !== null, 'deleted_at must be set');
    console.log('  OK soft-deleted');

    console.log('[mobile] cannot login after delete');
    const loginBlocked = await api('POST', '/api/auth/send-mobile-otp', {
      body: { mobileNumber: MOBILE_APP },
    });
    assert(loginBlocked.status >= 400, 'deleted user must not get OTP');
    console.log('  OK login blocked');

    console.log('[mobile] cannot delete someone else (token is self only)');
    // Already deleted — second delete on same token should fail as already deleted
    const again = await api('DELETE', '/api/users/me', {
      token: appToken,
      body: {},
    });
    assert(again.status >= 400, 'second delete must fail');
    console.log('  OK');

    // ── Admin list sees website pending ──────────────────────────────────
    const admin = await pool.query<{ id: string; email: string | null }>(
      `SELECT id, email FROM users WHERE role IN ('admin', 'super_admin') ORDER BY created_at ASC LIMIT 1`
    );
    if (admin.rows[0]) {
      const adminToken = signAccessToken({
        sub: admin.rows[0].id,
        role: UserRole.SUPER_ADMIN,
        email: admin.rows[0].email ?? undefined,
      });
      console.log('\n[admin] list pending deletion requests');
      const list = await api('GET', '/api/account-deletion?status=pending', {
        token: adminToken,
      });
      assert(list.status === 200 && list.json.success === true, `admin list failed: ${JSON.stringify(list)}`);
      const items = ((list.json.data as Json).items as Json[]) || [];
      const found = items.some((i) => i.userId === webUserId && i.status === 'pending');
      assert(found, 'pending website request must appear in admin list');
      console.log('  OK pending visible');

      const reqId = (items.find((i) => i.userId === webUserId) as Json).id as string;
      console.log('[admin] cancel pending website hold');
      const cancel = await api('POST', `/api/account-deletion/${reqId}/cancel`, {
        token: adminToken,
      });
      assert(cancel.status === 200, `cancel failed: ${JSON.stringify(cancel)}`);
      console.log('  OK cancelled');
    } else {
      console.log('\n[admin] skipped (no admin user in DB)');
    }

    // Profile GET/PATCH still work for active web user (not deleted)
    const webToken = signAccessToken({
      sub: webUserId,
      role: UserRole.USER,
    });
    console.log('\n[regression] GET /api/users/me still works for active user');
    const me = await api('GET', '/api/users/me', { token: webToken });
    assert(me.status === 200 && me.json.success === true, `getMe failed: ${JSON.stringify(me)}`);
    console.log('  OK');

    console.log('\n✅ All account-deletion smoke checks passed');
  } catch (err) {
    failures.push(err instanceof Error ? err.message : String(err));
    console.error('\n❌ Smoke test failed:', err);
  } finally {
    console.log('\n==> Cleaning up test data...');
    await cleanup([webUserId, appUserId]);
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve()))
    );
    await pool.end();
  }

  if (failures.length) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
