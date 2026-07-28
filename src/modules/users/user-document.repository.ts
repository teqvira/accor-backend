import pool from '../../database/connection';

export type UserDocumentType = 'aadhaar' | 'pan';
export type UserDocumentStatus = 'pending' | 'approved' | 'rejected';

export interface IUserDocument {
  _id: string;
  userId: string;
  documentType: UserDocumentType;
  documentNumber?: string;
  documentFront?: string;
  documentBack?: string;
  status: UserDocumentStatus;
  createdAt: Date;
}

interface UserDocumentRow {
  id: string;
  user_id: string;
  document_type: string | null;
  document_number: string | null;
  document_front: string | null;
  document_back: string | null;
  status: UserDocumentStatus;
  created_at: Date;
}

const DOC_COLUMNS = `
  id, user_id, document_type, document_number, document_front, document_back, status, created_at
`;

function mapDocumentRow(row: UserDocumentRow): IUserDocument {
  return {
    _id: row.id,
    userId: row.user_id,
    documentType: row.document_type as UserDocumentType,
    documentNumber: row.document_number ?? undefined,
    documentFront: row.document_front ?? undefined,
    documentBack: row.document_back ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

export const userDocumentRepository = {
  findByUserId: async (userId: string): Promise<IUserDocument[]> => {
    const result = await pool.query<UserDocumentRow>(
      `SELECT ${DOC_COLUMNS}
       FROM user_documents
       WHERE user_id = $1
         AND document_type IN ('aadhaar', 'pan')
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows.map(mapDocumentRow);
  },

  findByUserAndType: async (
    userId: string,
    documentType: UserDocumentType
  ): Promise<IUserDocument | null> => {
    const result = await pool.query<UserDocumentRow>(
      `SELECT ${DOC_COLUMNS}
       FROM user_documents
       WHERE user_id = $1 AND document_type = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, documentType]
    );
    return result.rows[0] ? mapDocumentRow(result.rows[0]) : null;
  },

  upsertByUserAndType: async (data: {
    userId: string;
    documentType: UserDocumentType;
    documentFront: string;
    status?: UserDocumentStatus;
  }): Promise<IUserDocument> => {
    const existing = await userDocumentRepository.findByUserAndType(
      data.userId,
      data.documentType
    );

    if (existing) {
      const result = await pool.query<UserDocumentRow>(
        `UPDATE user_documents
         SET document_front = $2,
             status = $3
         WHERE id = $1
         RETURNING ${DOC_COLUMNS}`,
        [existing._id, data.documentFront, data.status ?? 'pending']
      );
      return mapDocumentRow(result.rows[0]);
    }

    const result = await pool.query<UserDocumentRow>(
      `INSERT INTO user_documents
         (user_id, document_type, document_front, status)
       VALUES ($1, $2, $3, $4)
       RETURNING ${DOC_COLUMNS}`,
      [
        data.userId,
        data.documentType,
        data.documentFront,
        data.status ?? 'pending',
      ]
    );
    return mapDocumentRow(result.rows[0]);
  },
};
