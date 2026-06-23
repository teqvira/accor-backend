import pool from '../../../database/connection';
import { PayoutProviderName } from '../constants/withdrawal.constants';
import {
  IPayoutProfile,
  UpdatePayoutProfileData,
} from '../types/withdrawal.types';

interface PayoutProfileRow {
  id: string;
  user_id: string;
  method: IPayoutProfile['method'];
  account_holder_name: string;
  upi_id: string | null;
  account_number: string | null;
  ifsc: string | null;
  provider: PayoutProviderName;
  provider_contact_id: string | null;
  provider_fund_account_id: string | null;
  cashfree_beneficiary_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export function mapPayoutProfileRow(
  row: PayoutProfileRow,
  options?: { includeAccountNumber?: boolean }
): IPayoutProfile {
  const profile: IPayoutProfile = {
    _id: row.id,
    userId: row.user_id,
    method: row.method,
    accountHolderName: row.account_holder_name,
    upiId: row.upi_id ?? undefined,
    ifsc: row.ifsc ?? undefined,
    provider: row.provider,
    providerContactId: row.provider_contact_id ?? undefined,
    providerFundAccountId: row.provider_fund_account_id ?? undefined,
    cashfreeBeneficiaryId: row.cashfree_beneficiary_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (options?.includeAccountNumber) {
    profile.accountNumber = row.account_number ?? undefined;
  }

  return profile;
}

const PROFILE_COLUMNS = `
  id, user_id, method, account_holder_name, upi_id, account_number, ifsc,
  provider, provider_contact_id, provider_fund_account_id, cashfree_beneficiary_id,
  created_at, updated_at
`;

export interface CreatePayoutProfileData {
  userId: string;
  method: IPayoutProfile['method'];
  accountHolderName: string;
  provider: PayoutProviderName;
  upiId?: string | null;
  accountNumber?: string | null;
  ifsc?: string | null;
}

export const payoutProfileRepository = {
  create: async (data: CreatePayoutProfileData): Promise<IPayoutProfile> => {
    const result = await pool.query<PayoutProfileRow>(
      `INSERT INTO payout_profiles
         (user_id, method, account_holder_name, provider, upi_id, account_number, ifsc)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${PROFILE_COLUMNS}`,
      [
        data.userId,
        data.method,
        data.accountHolderName,
        data.provider,
        data.upiId ?? null,
        data.accountNumber ?? null,
        data.ifsc ?? null,
      ]
    );
    return mapPayoutProfileRow(result.rows[0], { includeAccountNumber: true });
  },

  findByUserId: async (
    userId: string,
    options?: { includeAccountNumber?: boolean }
  ): Promise<IPayoutProfile | null> => {
    const result = await pool.query<PayoutProfileRow>(
      `SELECT ${PROFILE_COLUMNS} FROM payout_profiles WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0]
      ? mapPayoutProfileRow(result.rows[0], options)
      : null;
  },

  update: async (
    id: string,
    data: UpdatePayoutProfileData
  ): Promise<IPayoutProfile | null> => {
    const sets: string[] = [];
    const values: unknown[] = [id];
    let paramIndex = 2;

    const assign = (column: string, value: unknown) => {
      sets.push(`${column} = $${paramIndex++}`);
      values.push(value);
    };

    if (data.method !== undefined) assign('method', data.method);
    if (data.accountHolderName !== undefined) {
      assign('account_holder_name', data.accountHolderName);
    }
    if (data.upiId !== undefined) assign('upi_id', data.upiId);
    if (data.accountNumber !== undefined) assign('account_number', data.accountNumber);
    if (data.ifsc !== undefined) assign('ifsc', data.ifsc);
    if (data.provider !== undefined) assign('provider', data.provider);
    if (data.providerContactId !== undefined) {
      assign('provider_contact_id', data.providerContactId);
    }
    if (data.providerFundAccountId !== undefined) {
      assign('provider_fund_account_id', data.providerFundAccountId);
    }
    if (data.cashfreeBeneficiaryId !== undefined) {
      assign('cashfree_beneficiary_id', data.cashfreeBeneficiaryId);
    }

    if (sets.length === 0) {
      const existing = await pool.query<PayoutProfileRow>(
        `SELECT ${PROFILE_COLUMNS} FROM payout_profiles WHERE id = $1`,
        [id]
      );
      return existing.rows[0]
        ? mapPayoutProfileRow(existing.rows[0], { includeAccountNumber: true })
        : null;
    }

    const result = await pool.query<PayoutProfileRow>(
      `UPDATE payout_profiles
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $1
       RETURNING ${PROFILE_COLUMNS}`,
      values
    );
    return result.rows[0]
      ? mapPayoutProfileRow(result.rows[0], { includeAccountNumber: true })
      : null;
  },

  upsertByUserId: async (
    userId: string,
    data: CreatePayoutProfileData
  ): Promise<IPayoutProfile> => {
    const existing = await payoutProfileRepository.findByUserId(userId, {
      includeAccountNumber: true,
    });

    if (existing) {
      const updated = await payoutProfileRepository.update(existing._id, {
        method: data.method,
        accountHolderName: data.accountHolderName,
        provider: data.provider,
        upiId: data.upiId ?? null,
        accountNumber: data.accountNumber ?? null,
        ifsc: data.ifsc ?? null,
        providerContactId: null,
        providerFundAccountId: null,
        cashfreeBeneficiaryId: null,
      });
      if (!updated) {
        throw new Error(`Failed to update payout profile for userId=${userId}`);
      }
      return updated;
    }

    return payoutProfileRepository.create(data);
  },
};
