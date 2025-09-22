import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import {
  getCampaignProgress,
  completeTask,
  checkSwapTransaction
} from '../controllers/campaignController';
// import {
//   progressRateLimiter,
//   completeTaskRateLimiter,
//   checkSwapRateLimiter
// } from '../middleware/rateLimiter';

const router = Router();

// Validation middleware
const validateWallet = body('walletAddress')
  .isEthereumAddress()
  .withMessage('Invalid wallet address');

const validateChainId = body('chainId')
  .isInt()
  .equals('5115')
  .withMessage('Invalid chain ID - must be 5115 for Citrea Testnet');

const validateTaskId = body('taskId')
  .isInt({ min: 1, max: 3 })
  .withMessage('Task ID must be 1, 2, or 3');

const validateTxHash = body('txHash')
  .matches(/^0x[a-fA-F0-9]{64}$/)
  .withMessage('Invalid transaction hash');

// Handle validation errors
const handleValidation = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: errors.array()
    });
  }
  next();
};

// POST /campaign/progress
router.post('/progress',
  // progressRateLimiter,
  validateWallet,
  validateChainId,
  handleValidation,
  getCampaignProgress
);

// POST /campaign/complete-task
router.post('/complete-task',
  // completeTaskRateLimiter,
  validateWallet,
  validateChainId,
  validateTaskId,
  validateTxHash,
  body('timestamp').isISO8601(),
  handleValidation,
  completeTask
);

// POST /campaign/check-swap
router.post('/check-swap',
  // checkSwapRateLimiter,
  validateWallet,
  validateChainId,
  validateTxHash,
  handleValidation,
  checkSwapTransaction
);

export default router;