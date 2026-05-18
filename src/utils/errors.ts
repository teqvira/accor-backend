export class AppError extends Error {
  public readonly userMessage: string;
  public readonly developerMessage: string;

  constructor(
    public statusCode: number,
    userMessage: string,
    developerMessage?: string,
    public isOperational = true
  ) {
    const devMsg = developerMessage ?? userMessage;
    super(devMsg);
    this.userMessage = userMessage;
    this.developerMessage = devMsg;
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    userMessage = 'You are not authorized to perform this action',
    developerMessage?: string
  ) {
    super(401, userMessage, developerMessage);
  }
}

export class ForbiddenError extends AppError {
  constructor(
    userMessage = 'You do not have permission to perform this action',
    developerMessage?: string
  ) {
    super(403, userMessage, developerMessage);
  }
}

export class NotFoundError extends AppError {
  constructor(
    userMessage = 'The requested resource was not found',
    developerMessage?: string
  ) {
    super(404, userMessage, developerMessage);
  }
}

export class ConflictError extends AppError {
  constructor(
    userMessage = 'This action could not be completed due to a conflict',
    developerMessage?: string
  ) {
    super(409, userMessage, developerMessage);
  }
}

export class BadRequestError extends AppError {
  constructor(
    userMessage = 'Invalid request. Please check your input',
    developerMessage?: string
  ) {
    super(400, userMessage, developerMessage);
  }
}
