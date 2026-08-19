import { Response } from 'express';
import {
  getOptionalQueryParam,
  getParam,
  getQueryNumber,
} from '../../shared/utils/params';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from '../auth/auth.types';
import { walletService } from './wallet.service';

export class WalletAdminController {
  async getKpis(_req: AuthRequest, res: Response): Promise<void> {
    const result = await walletService.getAdminKpis();
    sendSuccess(res, 'Wallet KPIs fetched successfully', result);
  }

  async listScans(req: AuthRequest, res: Response): Promise<void> {
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    const search = getOptionalQueryParam(req.query.search);
    const startDate = getOptionalQueryParam(req.query.startDate);
    const endDate = getOptionalQueryParam(req.query.endDate);

    const result = await walletService.getAdminScans(page, limit, {
      search,
      startDate,
      endDate,
    });
    sendSuccess(res, 'Wallet scans fetched successfully', result);
  }

  async getTopupDetails(_req: AuthRequest, res: Response): Promise<void> {
    const result = await walletService.getTopupDetails();
    sendSuccess(res, 'Razorpay wallet top-up details fetched successfully', result);
  }

  async getUserWallet(req: AuthRequest, res: Response): Promise<void> {
    const result = await walletService.getUserWalletAdmin(
      getParam(req.params.userId)
    );
    sendSuccess(res, 'User wallet fetched successfully', result);
  }

  async getUserTransactions(req: AuthRequest, res: Response): Promise<void> {
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    const result = await walletService.getTransactions(
      getParam(req.params.userId),
      page,
      limit
    );
    sendSuccess(res, 'User wallet transactions fetched successfully', result);
  }

  async createOrder(req: AuthRequest, res: Response): Promise<void> {
    const { amount, currency } = req.body;
    const result = await walletService.createOrder(amount, currency);
    sendSuccess(res, 'Wallet order created successfully', result);
  }

  async verifyPayment(req: AuthRequest, res: Response): Promise<void> {
    const result = await walletService.verifyPayment(req.body, req.user?.sub);
    sendSuccess(res, 'Wallet payment verified successfully', result);
  }

}

export const walletAdminController = new WalletAdminController();


