import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../../config/env';
import { AppError } from '../utils/errors';
import { buildErrorBody, sendError } from '../utils/response';

function formatZodDeveloperMessage(err: ZodError): string {
  const { fieldErrors } = err.flatten();
  const details = Object.entries(fieldErrors)
    .filter((entry): entry is [string, string[]] => {
      const messages = entry[1];
      return Array.isArray(messages) && messages.length > 0;
    })
    .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
    .join('; ');
  return details || err.message;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(
      buildErrorBody(err.userMessage, err.developerMessage)
    );
    return;
  }

  if (err instanceof ZodError) {
    sendError(
      res,
      400,
      'Please check your input and try again',
      `Validation failed: ${formatZodDeveloperMessage(err)}`,
      { errors: err.flatten().fieldErrors }
    );
    return;
  }

  if (err instanceof Error && err.name === 'JsonWebTokenError') {
    sendError(
      res,
      401,
      'Your session is invalid. Please log in again',
      `JWT error: ${err.message}`
    );
    return;
  }

  if (err instanceof Error && err.name === 'TokenExpiredError') {
    sendError(
      res,
      401,
      'Your session has expired. Please log in again',
      `JWT expired: ${err.message}`
    );
    return;
  }

  const isDev = env.NODE_ENV === 'development';
  const devMessage =
    err instanceof Error
      ? isDev && err.stack
        ? `${err.message}\n${err.stack}`
        : err.message
      : 'Unknown error';

  console.error(err);
  sendError(
    res,
    500,
    'Something went wrong. Please try again later',
    devMessage
  );
}
