import { Request, Response, NextFunction } from 'express';

interface LogRequest extends Request {
  startTime?: number;
}

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

// Get status color
function getStatusColor(status: number): string {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.blue;
  return colors.green;
}

// Request logger middleware
export function requestLogger(req: LogRequest, res: Response, next: NextFunction) {
  req.startTime = Date.now();

  // Log request
  console.log(
    `${colors.gray}[${new Date().toISOString()}]${colors.reset}`,
    `${colors.blue}→${colors.reset}`,
    `${req.method} ${req.path}`,
    req.body ? `${colors.gray}${JSON.stringify(req.body).slice(0, 100)}${colors.reset}` : ''
  );

  // Capture response
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    const statusColor = getStatusColor(res.statusCode);

    console.log(
      `${colors.gray}[${new Date().toISOString()}]${colors.reset}`,
      `${statusColor}←${colors.reset}`,
      `${res.statusCode}`,
      `${colors.gray}(${duration}ms)${colors.reset}`,
      req.method,
      req.path
    );

    return originalSend.call(this, data);
  };

  next();
}

// Error logger
export function errorLogger(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(
    `${colors.red}[ERROR]${colors.reset}`,
    `${colors.gray}[${new Date().toISOString()}]${colors.reset}`,
    req.method,
    req.path,
    '\n',
    err.stack || err
  );
  next(err);
}