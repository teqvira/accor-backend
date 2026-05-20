import { Response } from 'express';
import { sendSuccess } from '../../../shared/utils/response';
import { AuthRequest } from '../types/auth.types';
import { authService } from '../services/auth.service';

export class AuthController {
  async createUser(req: AuthRequest, res: Response): Promise<void> {
    const user = await authService.createUser(req.user!, req.body);
    sendSuccess(res, 'User created successfully', { user }, 201);
  }

  async login(req: AuthRequest, res: Response): Promise<void> {
    const result = await authService.login(req.body.email, req.body.password);
    sendSuccess(res, 'Login successful', result);
  }

  async refreshToken(req: AuthRequest, res: Response): Promise<void> {
    const tokens = await authService.refreshToken(req.body.refreshToken);
    sendSuccess(res, 'Token refreshed successfully', tokens);
  }

  async logout(req: AuthRequest, res: Response): Promise<void> {
    await authService.logout(req.bearerToken!);
    sendSuccess(res, 'Logged out successfully');
  }

  async forgotPassword(req: AuthRequest, res: Response): Promise<void> {
    const result = await authService.forgotPassword(req.body.email);
    sendSuccess(res, result.message);
  }

  async verifyOtp(req: AuthRequest, res: Response): Promise<void> {
    const result = await authService.verifyOtp(req.body.email, req.body.otp);
    sendSuccess(res, 'OTP verified successfully', result);
  }

  async resetPasswordWithToken(req: AuthRequest, res: Response): Promise<void> {
    const result = await authService.resetPasswordWithToken(
      req.body.resetToken,
      req.body.newPassword
    );
    sendSuccess(res, result.message);
  }

  async resetPasswordWithCurrent(req: AuthRequest, res: Response): Promise<void> {
    const result = await authService.resetPasswordWithCurrent(
      req.user!.sub,
      req.body.currentPassword,
      req.body.newPassword
    );
    sendSuccess(res, result.message);
  }
}

export const authController = new AuthController();
