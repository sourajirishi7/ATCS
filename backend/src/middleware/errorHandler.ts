import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;
  public action?: string;
  public details?: any;

  constructor(message: string, statusCode = 400, errorCode = 'BAD_REQUEST', action?: string, details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.action = action;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If headers already sent, delegate to default express handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle custom AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      errorCode: err.errorCode,
      message: err.message,
      action: err.action || 'Check request payload or verify your credentials.',
      details: err.details || undefined,
    });
    return;
  }

  // Handle Prisma Known Request Errors
  if (err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        errorCode: 'DUPLICATE_ENTRY',
        message: 'A record with this unique identifier already exists in the system.',
        action: 'Ensure reference numbers, codes, or email values are unique.',
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        errorCode: 'RECORD_NOT_FOUND',
        message: 'The requested resource was not found.',
        action: 'Verify resource identifier.',
      });
      return;
    }
  }

  // Unhandled / Unexpected Server Errors (never leak internal stack traces)
  console.error('[ATCS Unhandled Error]:', err);

  res.status(500).json({
    success: false,
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected system error occurred while processing the financial request.',
    action: 'Contact IT/Financial Systems administration if this issue persists.',
  });
}
