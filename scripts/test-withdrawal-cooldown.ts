/**
 * Unit checks for 7-day withdrawal restriction.
 * Run: npx tsx scripts/test-withdrawal-cooldown.ts
 */
import {
  WITHDRAWAL_COOLDOWN_DAYS,
  WithdrawalStatus,
} from '../src/modules/withdrawals/withdrawal.constants';
import { withdrawalService } from '../src/modules/withdrawals/withdrawal.service';
import { IWithdrawal } from '../src/modules/withdrawals/withdrawal.types';

function makeMockWithdrawal(createdAt: Date, status: WithdrawalStatus = WithdrawalStatus.SUCCESS): IWithdrawal {
  return {
    _id: 'w-test-123',
    userId: 'u-test-456',
    payoutProfileId: 'pp-test-789',
    amount: 500,
    method: 'upi' as any,
    status,
    provider: 'manual' as any,
    providerReferenceId: 'ref-123',
    payoutDestination: 'user@okhdfcbank',
    requestedAt: createdAt,
    createdAt,
  };
}

let failed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (err: any) {
    failed += 1;
    console.error(`FAIL: ${name} — ${err.message}`);
  }
}

const now = new Date('2026-10-21T12:00:00.000Z');

// Test 1: Cooldown disabled (WITHDRAWAL_COOLDOWN_DAYS = 0), requests should pass without throwing
runTest('allows requests when cooldown is disabled (0 days)', () => {
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const withdrawal = makeMockWithdrawal(oneDayAgo, WithdrawalStatus.SUCCESS);
  // Should not throw
  withdrawalService.assertWithdrawalCooldown(withdrawal, 'u-test-456', now);
});

// Test 2: Verify WITHDRAWAL_COOLDOWN_DAYS constant is 0
runTest('WITHDRAWAL_COOLDOWN_DAYS is 0', () => {
  if (WITHDRAWAL_COOLDOWN_DAYS !== 0) {
    throw new Error(`Expected 0, got ${WITHDRAWAL_COOLDOWN_DAYS}`);
  }
});

if (failed > 0) {
  console.error(`\n${failed} checks failed`);
  process.exit(1);
} else {
  console.log('\nAll withdrawal cooldown checks passed successfully!');
}
