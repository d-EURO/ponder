import { Router } from 'express';
import { pool } from '../database/client';
import { CITREA_TESTNET } from '../config/chains';
import { createPublicClient, http } from 'viem';

const router = Router();

// GET /health - Health check endpoint
router.get('/', async (req, res) => {
  try {
    const checks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      chain: {
        connected: false,
        chainId: CITREA_TESTNET.chainId,
        blockNumber: null as number | null
      },
      database: {
        connected: false,
        latency: null as string | null
      }
    };

    // Check database connection
    const dbStart = Date.now();
    try {
      await pool.query('SELECT 1');
      checks.database.connected = true;
      checks.database.latency = `${Date.now() - dbStart}ms`;
    } catch (error) {
      checks.status = 'unhealthy';
      console.error('Database health check failed:', error);
    }

    // Check blockchain connection
    try {
      const client = createPublicClient({
        chain: {
          id: CITREA_TESTNET.chainId,
          name: CITREA_TESTNET.name,
          nativeCurrency: CITREA_TESTNET.nativeCurrency,
          rpcUrls: {
            default: { http: [CITREA_TESTNET.rpcUrl] },
            public: { http: [CITREA_TESTNET.rpcUrl] }
          }
        },
        transport: http(CITREA_TESTNET.rpcUrl)
      });

      const blockNumber = await client.getBlockNumber();
      checks.chain.connected = true;
      checks.chain.blockNumber = Number(blockNumber);
    } catch (error) {
      checks.status = 'unhealthy';
      console.error('Blockchain health check failed:', error);
    }

    const statusCode = checks.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(checks);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

export default router;