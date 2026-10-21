/**
 * Unit checks for Admin Withdrawal Rejection flow & single notification guarantee.
 * Run: DB_USER=test DB_PASSWORD=test JWT_ACCESS_SECRET=testsecret123456789012345678901234567890 JWT_REFRESH_SECRET=testsecret123456789012345678901234567890 JWT_RESET_SECRET=testsecret123456789012345678901234567890 AWS_REGION=ap-south-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_S3_BUCKET_NAME=test npx tsx scripts/test-admin-withdrawal-rejection.ts
 */
import { withdrawalService } from '../src/modules/withdrawals/withdrawal.service';
import { withdrawalRepository } from '../src/modules/withdrawals/repositories/withdrawal.repository';
import { WithdrawalStatus } from '../src/modules/withdrawals/withdrawal.constants';
import { notificationsService } from '../src/modules/notifications/index';
import { notificationRepository } from '../src/modules/notifications/notifications.repository';
import { userRepository } from '../src/modules/auth/repositories/user.repository';
import { walletService } from '../src/modules/wallet/wallet.service';
import pool from '../src/database/connection';
import { AppError, BadRequestError } from '../src/shared/utils/errors';

pool.connect = (async () => ({
  query: async () => ({ rows: [], rowCount: 1 }),
  release: () => {},
})) as any;

let failed = 0;

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
  } catch (err: any) {
    failed += 1;
    console.error(`FAIL: ${name} — ${err?.message ?? err}`);
  }
}

async function main() {
  // Test 1: Reason is required and must be at least 3 characters
  await runTest('requires rejection reason', async () => {
    let caught = false;
    try {
      await withdrawalService.adminRejectWithdrawal('w-1', { reason: '' }, 'admin-1');
    } catch (err: any) {
      caught = true;
      if (!(err instanceof AppError) || err.statusCode !== 400) {
        throw new Error(`Expected 400 AppError, got ${err}`);
      }
    }
    if (!caught) throw new Error('Expected empty reason to throw error');

    caught = false;
    try {
      await withdrawalService.adminRejectWithdrawal('w-1', { reason: 'no' }, 'admin-1');
    } catch (err: any) {
      caught = true;
      if (!(err instanceof AppError) || err.statusCode !== 400) {
        throw new Error(`Expected 400 AppError, got ${err}`);
      }
    }
    if (!caught) throw new Error('Expected short reason to throw error');
  });

  // Test 2: Cannot reject a SUCCESS withdrawal
  await runTest('cannot reject a successful withdrawal', async () => {
    const originalFind = withdrawalRepository.findById;
    (withdrawalRepository as any).findById = async () => ({
      _id: 'w-success-1',
      userId: 'u-1',
      payoutProfileId: 'pp-1',
      amount: 500,
      method: 'upi',
      status: WithdrawalStatus.SUCCESS,
      providerReferenceId: 'ref-1',
      payoutDestination: 'test@upi',
      requestedAt: new Date(),
      createdAt: new Date(),
    });

    try {
      let caught = false;
      try {
        await withdrawalService.adminRejectWithdrawal(
          'w-success-1',
          { reason: 'Invalid details' },
          'admin-1'
        );
      } catch (err: any) {
        caught = true;
        if (!(err instanceof AppError) || err.statusCode !== 400) {
          throw new Error(`Expected 400 error, got ${err}`);
        }
      }
      if (!caught) throw new Error('Expected rejecting success withdrawal to throw');
    } finally {
      withdrawalRepository.findById = originalFind;
    }
  });

  // Test 3: Successful reject marks withdrawal as FAILED, stores reason, and sends user notification
  await runTest('rejects pending withdrawal, marks failed, stores reason, and notifies user', async () => {
    const originalFind = withdrawalRepository.findById;
    const originalReject = withdrawalRepository.rejectWithdrawal;
    const originalCredit = walletService.creditInSession;
    const originalFindUser = userRepository.findById;
    const originalExistsRef = notificationRepository.existsByReference;
    const originalCreatePush = notificationsService.createAndPush;

    let storedStatus: WithdrawalStatus | null = null;
    let storedReason: string | null = null;
    let storedAdminNotes: string | null = null;
    let userNotificationCreated: any = null;
    let createdNotificationCount = 0;

    let currentWithdrawal: any = {
      _id: 'w-pending-1',
      userId: 'u-1',
      payoutProfileId: 'pp-1',
      amount: 1200,
      method: 'upi',
      status: WithdrawalStatus.PENDING,
      providerReferenceId: 'ref-pending-1',
      payoutDestination: 'mechanic@upi',
      requestedAt: new Date(),
      createdAt: new Date(),
    };

    (withdrawalRepository as any).findById = async () => currentWithdrawal;

    (withdrawalRepository as any).rejectWithdrawal = async (
      _id: string,
      data: { reason: string; adminNotes?: string; reviewedBy: string }
    ) => {
      storedStatus = WithdrawalStatus.FAILED;
      storedReason = data.reason;
      storedAdminNotes = data.adminNotes ?? null;
      currentWithdrawal = {
        ...currentWithdrawal,
        status: WithdrawalStatus.FAILED,
        failureReason: data.reason,
        remarks: data.reason,
        adminNotes: data.adminNotes,
        reviewedBy: data.reviewedBy,
      };
      return currentWithdrawal;
    };

    (walletService as any).creditInSession = async () => ({
      _id: 'tx-refund-1',
      userId: 'u-1',
      amount: 1200,
      type: 'withdrawal',
    });

    (userRepository as any).findById = async () => ({
      _id: 'u-1',
      name: 'Ramesh Mechanic',
      mobileNumber: '9876543210',
    });

    const createdReferences = new Set<string>();
    (notificationRepository as any).existsByReference = async (refType: string, refId: string) => {
      return createdReferences.has(`${refType}:${refId}`);
    };

    (notificationsService as any).createAndPush = async (input: any) => {
      createdNotificationCount++;
      createdReferences.add(`${input.referenceType}:${input.referenceId}`);
      userNotificationCreated = input;
      return { _id: 'notif-1', ...input };
    };

    try {
      const result = await withdrawalService.adminRejectWithdrawal(
        'w-pending-1',
        { reason: 'Invalid UPI handle. Bank returned account not found.' },
        'admin-user-99'
      );

      // Verify status contract
      if (result.status !== WithdrawalStatus.FAILED) {
        throw new Error(`Expected status FAILED, got ${result.status}`);
      }
      if (storedStatus !== WithdrawalStatus.FAILED) {
        throw new Error(`Expected storedStatus FAILED, got ${storedStatus}`);
      }

      // Verify stored reason
      if (storedReason !== 'Invalid UPI handle. Bank returned account not found.') {
        throw new Error(`Unexpected storedReason: ${storedReason}`);
      }
      if (storedAdminNotes !== 'Invalid UPI handle. Bank returned account not found.') {
        throw new Error(`Unexpected storedAdminNotes: ${storedAdminNotes}`);
      }
      if (result.failureReason !== 'Invalid UPI handle. Bank returned account not found.') {
        throw new Error(`Unexpected failureReason on withdrawal: ${result.failureReason}`);
      }

      // Verify user notification
      if (!userNotificationCreated) {
        throw new Error('User notification was not created');
      }
      if (userNotificationCreated.audience !== 'user') {
        throw new Error(`Expected audience 'user', got ${userNotificationCreated.audience}`);
      }
      if (!userNotificationCreated.recipientUserIds?.includes('u-1')) {
        throw new Error(`Expected recipientUserIds to include 'u-1'`);
      }
      if (!userNotificationCreated.body.includes('Invalid UPI handle. Bank returned account not found.')) {
        throw new Error(`Notification body missing rejection reason: ${userNotificationCreated.body}`);
      }
      if (!userNotificationCreated.body.includes('₹1200.00')) {
        throw new Error(`Notification body missing amount: ${userNotificationCreated.body}`);
      }
      if (userNotificationCreated.referenceType !== 'withdrawal_rejection') {
        throw new Error(`Expected referenceType 'withdrawal_rejection', got ${userNotificationCreated.referenceType}`);
      }
      if (userNotificationCreated.referenceId !== 'w-pending-1') {
        throw new Error(`Expected referenceId 'w-pending-1', got ${userNotificationCreated.referenceId}`);
      }

      // Test 4: Retry reject action ensures notification is created ONLY ONCE
      const initialCount = createdNotificationCount;
      const retryResult = await withdrawalService.adminRejectWithdrawal(
        'w-pending-1',
        { reason: 'Invalid UPI handle. Bank returned account not found.' },
        'admin-user-99'
      );

      if (retryResult.status !== WithdrawalStatus.FAILED) {
        throw new Error(`Retry expected status FAILED, got ${retryResult.status}`);
      }
      if (createdNotificationCount !== initialCount) {
        throw new Error(
          `Notification was created again on retry! Initial: ${initialCount}, After retry: ${createdNotificationCount}`
        );
      }
    } finally {
      withdrawalRepository.findById = originalFind;
      withdrawalRepository.rejectWithdrawal = originalReject;
      walletService.creditInSession = originalCredit;
      userRepository.findById = originalFindUser;
      notificationRepository.existsByReference = originalExistsRef;
      notificationsService.createAndPush = originalCreatePush;
    }
  });

  if (failed > 0) {
    console.error(`\n${failed} checks failed`);
    process.exit(1);
  } else {
    console.log('\nAll admin withdrawal rejection checks passed successfully!');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
