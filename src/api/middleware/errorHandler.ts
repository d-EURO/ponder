import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'SERVER_ERROR';

  // Log error
  console.error('API Error:', {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    statusCode,
    code,
    message: err.message,
    stack: err.stack
  });

  // Send error response
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    code,
    ...(err.details && { details: err.details })
  });
}