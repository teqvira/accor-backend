import { Response } from 'express';
import { sendSuccess } from '../../shared/utils/response';
import { AuthRequest } from './auth.types';
import { authService, DeviceSessionContext } from './auth.service';

function deviceContextFromRequest(
  req: AuthRequest,
  body: Partial<DeviceSessionContext> = {}
): DeviceSessionContext {
  const forwarded = req.headers['x-forwarded-for'];
  const ipFromForwarded =
    typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined;

  return {
    deviceToken: body.deviceToken,
    platform: body.platform,
    deviceId: body.deviceId,
    deviceName: body.deviceName,
    appVersion: body.appVersion,
    ipAddress: ipFromForwarded || req.ip,
    userAgent:
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : undefined,
  };
}

export class AuthController {
  async createUser(req: AuthRequest, res: Response): Promise<void> {
    const user = await authService.createUser(req.user!, req.body);
    sendSuccess(res, 'User created successfully', { user }, 201);
  }

  async login(req: AuthRequest, res: Response): Promise<void> {
    const result = await authService.login(
      req.body.email,
      req.body.password,
      deviceContextFromRequest(req, req.body)
    );
    sendSuccess(res, 'Login successful', result);
  }

  async sendMobileOtp(req: AuthRequest, res: Response): Promise<void> {
    const result = await authService.sendMobileOtp(
      req.body.mobileNumber,
      req.user?.sub
    );
    sendSuccess(res, result.message);
  }

  async resendMobileOtp(req: AuthRequest, res: Response): Promise<void> {
    const result = await authService.resendMobileOtp(
      req.body.mobileNumber,
      req.user?.sub
    );
    sendSuccess(res, result.message);
  }

  async verifyMobileOtp(req: AuthRequest, res: Response): Promise<void> {
    const result = await authService.verifyMobileOtp(
      req.body.mobileNumber,
      req.body.otp,
      req.user?.sub,
      deviceContextFromRequest(req, req.body)
    );
    sendSuccess(res, 'OTP verified successfully', result);
  }

  async refreshToken(req: AuthRequest, res: Response): Promise<void> {
    const tokens = await authService.refreshToken(
      req.body.refreshToken,
      deviceContextFromRequest(req, req.body)
    );
    sendSuccess(res, 'Token refreshed successfully', tokens);
  }

  async logout(req: AuthRequest, res: Response): Promise<void> {
    const refreshToken = req.bearerToken ?? req.body.refreshToken;
    await authService.logout(refreshToken!, {
      deviceToken: req.body.deviceToken,
    });
    sendSuccess(res, 'Logged out successfully');
  }

  async registerDeviceToken(req: AuthRequest, res: Response): Promise<void> {
    const device = await authService.registerDeviceToken(req.user!.sub, req.body);
    sendSuccess(res, 'Device token registered successfully', { device });
  }

  async forgotPassword(req: AuthRequest, res: Response): Promise<void> {
    const result = await authService.forgotPassword(req.body.email);
    sendSuccess(res, result.message);
  }

  async verifyPasswordOtp(req: AuthRequest, res: Response): Promise<void> {
    const result = await authService.verifyPasswordOtp(
      req.body.email,
      req.body.otp
    );
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
