import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Default rate limiter
export const defaultRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Progress endpoint rate limiter
export const progressRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: 'Too many progress requests',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Task completion rate limiter (by wallet)
export const completeTaskRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: 'Too many task completion requests',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use wallet address if available, otherwise use default (IP-based)
    return req.body?.walletAddress || req.ip || 'default';
  },
  skip: (req: Request) => {
    // Skip rate limiting if we can't identify the request
    return false;
  }
});

// Swap check rate limiter
export const checkSwapRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    error: 'Too many swap check requests',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false
});