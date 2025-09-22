import { Router } from 'express';
import { pool } from '../database/client';
import { CITREA_TESTNET } from '../config/chains';
import { rpcClient } from '../services/rpcClient';

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
        blockNumber: null as number | null,
        currentRPC: null as number | null,
        totalRPCs: null as number | null
      },
      database: {
        connected: false,
        latency: null as string | null
      }
    };

    // Check database connection with timeout
    const dbStart = Date.now();
    try {
      const dbPromise = pool.query('SELECT 1');
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database timeout')), 3000)
      );

      await Promise.race([dbPromise, timeoutPromise]);
      checks.database.connected = true;
      checks.database.latency = `${Date.now() - dbStart}ms`;
    } catch (error) {
      checks.status = 'unhealthy';
      checks.database.connected = false;
      console.error('Database health check failed:', error);
    }

    // Check RPC connection
    try {
      const rpcHealth = await rpcClient.healthCheck();
      checks.chain.connected = rpcHealth.healthy;
      checks.chain.blockNumber = rpcHealth.blockNumber ? Number(rpcHealth.blockNumber) : null;
      checks.chain.currentRPC = rpcHealth.currentRPC;
      checks.chain.totalRPCs = rpcHealth.totalRPCs;

      if (!rpcHealth.healthy) {
        checks.status = 'unhealthy';
      }
    } catch (error) {
      checks.status = 'unhealthy';
      checks.chain.connected = false;
      console.error('RPC health check failed:', error);
    }

    const statusCode = checks.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(checks);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

export default router;