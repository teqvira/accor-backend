/**
 * Unit checks for 7-day withdrawal restriction.
 * Run: npx tsx scripts/test-withdrawal-cooldown.ts
 */
import { withdrawalService } from '../src/modules/withdrawals/withdrawal.service';
import {
  WithdrawalStatus,
  WITHDRAWAL_COOLDOWN_DAYS,
} from '../src/modules/withdrawals/withdrawal.constants';
import { IWithdrawal } from '../src/modules/withdrawals/withdrawal.types';
import { AppError, BadRequestError } from '../src/shared/utils/errors';

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

// Test 1: Recent withdrawal 1 day ago should throw BadRequestError (status 400)
runTest('blocks request made 1 day after previous withdrawal', () => {
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const withdrawal = makeMockWithdrawal(oneDayAgo, WithdrawalStatus.SUCCESS);

  let caught = false;
  try {
    withdrawalService.assertWithdrawalCooldown(withdrawal, 'u-test-456', now);
  } catch (err: any) {
    caught = true;
    if (!(err instanceof AppError) || err.statusCode !== 400) {
      throw new Error(`Expected 400 AppError, got ${err?.constructor?.name} with status ${err?.statusCode}`);
    }
    if (!err.userMessage.includes('maximum of one withdrawal request within a 7-day period')) {
      throw new Error(`Unexpected message: ${err.userMessage}`);
    }
    if (!err.userMessage.includes('6 days')) {
      throw new Error(`Expected 6 days remaining in message, got: ${err.userMessage}`);
    }
  }
  if (!caught) throw new Error('Expected assertWithdrawalCooldown to throw');
});

// Test 2: Withdrawal 6 days and 23 hours ago should throw with 1 day remaining
runTest('blocks request made 6 days and 23 hours after previous withdrawal', () => {
  const almostSevenDaysAgo = new Date(now.getTime() - (7 * 24 - 1) * 60 * 60 * 1000);
  const withdrawal = makeMockWithdrawal(almostSevenDaysAgo, WithdrawalStatus.PENDING);

  let caught = false;
  try {
    withdrawalService.assertWithdrawalCooldown(withdrawal, 'u-test-456', now);
  } catch (err: any) {
    caught = true;
    if (!(err instanceof AppError) || err.statusCode !== 400) {
      throw new Error(`Expected 400 AppError, got ${err?.constructor?.name} with status ${err?.statusCode}`);
    }
    if (!err.userMessage.includes('1 day')) {
      throw new Error(`Expected 1 day remaining in message, got: ${err.userMessage}`);
    }
  }
  if (!caught) throw new Error('Expected assertWithdrawalCooldown to throw');
});

// Test 3: Withdrawal with FAILED status within 7 days is also counted (per user requirement)
runTest('blocks request if previous withdrawal was failed within 7 days', () => {
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const withdrawal = makeMockWithdrawal(threeDaysAgo, WithdrawalStatus.FAILED);

  let caught = false;
  try {
    withdrawalService.assertWithdrawalCooldown(withdrawal, 'u-test-456', now);
  } catch (err: any) {
    caught = true;
    if (!(err instanceof AppError) || err.statusCode !== 400) {
      throw new Error(`Expected 400 AppError, got ${err?.constructor?.name} with status ${err?.statusCode}`);
    }
    if (!err.userMessage.includes('4 days')) {
      throw new Error(`Expected 4 days remaining in message, got: ${err.userMessage}`);
    }
  }
  if (!caught) throw new Error('Expected assertWithdrawalCooldown to throw');
});

// Test 4: Exactly 7 days elapsed should pass
runTest('allows request exactly 7 days after previous withdrawal', () => {
  const exactlySevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const withdrawal = makeMockWithdrawal(exactlySevenDaysAgo);
  // Should not throw
  withdrawalService.assertWithdrawalCooldown(withdrawal, 'u-test-456', now);
});

// Test 5: 8 days elapsed should pass
runTest('allows request 8 days after previous withdrawal', () => {
  const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  const withdrawal = makeMockWithdrawal(eightDaysAgo);
  // Should not throw
  withdrawalService.assertWithdrawalCooldown(withdrawal, 'u-test-456', now);
});

// Test 6: Verify WITHDRAWAL_COOLDOWN_DAYS constant is 7
runTest('WITHDRAWAL_COOLDOWN_DAYS is 7', () => {
  if (WITHDRAWAL_COOLDOWN_DAYS !== 7) {
    throw new Error(`Expected 7, got ${WITHDRAWAL_COOLDOWN_DAYS}`);
  }
});

if (failed > 0) {
  console.error(`\n${failed} checks failed`);
  process.exit(1);
} else {
  console.log('\nAll withdrawal cooldown checks passed successfully!');
}
