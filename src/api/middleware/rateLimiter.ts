import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Create different rate limiters for different endpoints
export const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Default: 100 requests per minute
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Specific rate limiter for progress endpoint
export const progressRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    error: 'Too many progress requests',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Specific rate limiter for task completion endpoint
export const completeTaskRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    error: 'Too many task completion requests',
    code: 'RATE_LIMITED'
  },
  keyGenerator: (req: Request) => {
    // Rate limit by wallet address if available, otherwise by IP
    return req.body?.walletAddress || req.ip || 'unknown';
  },
  skip: (req: Request) => !req.body?.walletAddress && !req.ip,
});

// Specific rate limiter for swap check endpoint
export const checkSwapRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: {
    error: 'Too many swap check requests',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});