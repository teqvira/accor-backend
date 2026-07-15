import pool from '../../../database/connection';

export type OtpPurpose = 'login' | 'password_reset';

export interface IOtpVerification {
  _id: string;
  mobileNumber?: string;
  email?: string;
  otpHash: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
}

interface OtpRow {
  id: string;
  mobile_number: string | null;
  email: string | null;
  otp_hash: string;
  purpose: OtpPurpose;
  expires_at: Date;
  verified: boolean;
  created_at: Date;
}

function mapOtpRow(row: OtpRow): IOtpVerification {
  return {
    _id: row.id,
    mobileNumber: row.mobile_number ?? undefined,
    email: row.email ?? undefined,
    otpHash: row.otp_hash,
    purpose: row.purpose,
    expiresAt: row.expires_at,
    verified: row.verified,
    createdAt: row.created_at,
  };
}

const OTP_COLUMNS = `
  id, mobile_number, email, otp_hash, purpose, expires_at, verified, created_at
`;

export const otpVerificationRepository = {
  create: async (data: {
    mobileNumber?: string | null;
    email?: string | null;
    otpHash: string;
    purpose: OtpPurpose;
    expiresAt: Date;
  }): Promise<IOtpVerification> => {
    const result = await pool.query<OtpRow>(
      `INSERT INTO otp_verifications
         (mobile_number, email, otp_hash, purpose, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${OTP_COLUMNS}`,
      [
        data.mobileNumber ?? null,
        data.email?.toLowerCase() ?? null,
        data.otpHash,
        data.purpose,
        data.expiresAt,
      ]
    );
    return mapOtpRow(result.rows[0]);
  },

  findLatestActive: async (filters: {
    mobileNumber?: string;
    email?: string;
    purpose: OtpPurpose;
  }): Promise<IOtpVerification | null> => {
    const conditions = ['purpose = $1', 'verified = false', 'expires_at > NOW()'];
    const values: unknown[] = [filters.purpose];
    let paramIndex = 2;

    if (filters.mobileNumber) {
      conditions.push(`mobile_number = $${paramIndex++}`);
      values.push(filters.mobileNumber);
    }
    if (filters.email) {
      conditions.push(`email = $${paramIndex++}`);
      values.push(filters.email.toLowerCase());
    }

    const result = await pool.query<OtpRow>(
      `SELECT ${OTP_COLUMNS}
       FROM otp_verifications
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT 1`,
      values
    );
    return result.rows[0] ? mapOtpRow(result.rows[0]) : null;
  },

  findLatest: async (filters: {
    mobileNumber?: string;
    email?: string;
    purpose: OtpPurpose;
  }): Promise<IOtpVerification | null> => {
    const conditions = ['purpose = $1'];
    const values: unknown[] = [filters.purpose];
    let paramIndex = 2;

    if (filters.mobileNumber) {
      conditions.push(`mobile_number = $${paramIndex++}`);
      values.push(filters.mobileNumber);
    }
    if (filters.email) {
      conditions.push(`email = $${paramIndex++}`);
      values.push(filters.email.toLowerCase());
    }

    const result = await pool.query<OtpRow>(
      `SELECT ${OTP_COLUMNS}
       FROM otp_verifications
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT 1`,
      values
    );
    return result.rows[0] ? mapOtpRow(result.rows[0]) : null;
  },

  markVerified: async (id: string): Promise<void> => {
    await pool.query(
      `UPDATE otp_verifications SET verified = true WHERE id = $1`,
      [id]
    );
  },

  invalidateActive: async (filters: {
    mobileNumber?: string;
    email?: string;
    purpose: OtpPurpose;
  }): Promise<void> => {
    const conditions = ['purpose = $1', 'verified = false'];
    const values: unknown[] = [filters.purpose];
    let paramIndex = 2;

    if (filters.mobileNumber) {
      conditions.push(`mobile_number = $${paramIndex++}`);
      values.push(filters.mobileNumber);
    }
    if (filters.email) {
      conditions.push(`email = $${paramIndex++}`);
      values.push(filters.email.toLowerCase());
    }

    await pool.query(
      `UPDATE otp_verifications
       SET verified = true
       WHERE ${conditions.join(' AND ')}`,
      values
    );
  },
};
