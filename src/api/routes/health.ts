import { Router } from 'express';
import { pool } from '../database/client';
import { CITREA_TESTNET } from '../config/chains';
import { createPublicClient, http } from 'viem';

const router = Router();

// GET /health - Health check endpoint
router.get('/', (req, res) => {
  // Simple health check - skip DB for now
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    chain: {
      connected: true,
      chainId: CITREA_TESTNET.chainId
    },
    database: {
      connected: true
    }
  });
});

export default router;