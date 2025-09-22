import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: '.env.api' });

// Import middleware
import { requestLogger, errorLogger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { defaultRateLimiter } from './middleware/rateLimiting';

// Import routes
import healthRoutes from './routes/health';
import campaignRoutes from './routes/campaign';

// Create Express app
export function createApp(): Application {
  const app = express();

  // CORS configuration
  const corsOptions = {
    origin: function(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      const allowedOrigins = [
        'http://localhost:3001',
        'http://localhost:3000',
        'https://bapp.juiceswap.xyz',
        'https://dev.bapp.juiceswap.xyz'
      ];

      // Allow requests with no origin (like Postman or curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  };

  // Apply middleware in correct order
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' })); // Body parser with size limit
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Request logging (before routes)
  app.use(requestLogger);

  // Default rate limiting
  app.use(defaultRateLimiter);

  // Health check route (no auth needed)
  app.use('/health', healthRoutes);

  // API routes
  app.use('/campaign', campaignRoutes);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Endpoint not found',
      code: 'NOT_FOUND',
      path: req.path,
      method: req.method
    });
  });

  // Error logging (before error handler)
  app.use(errorLogger);

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}

// Start server function
export async function startServer(port?: number): Promise<void> {
  const app = createApp();
  const serverPort = port || parseInt(process.env.API_PORT || '3002', 10);

  // Test database connection
  try {
    const { pool } = await import('./database/client');
    await pool.query('SELECT 1');
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('⚠️ Database connection failed:', error);
    console.log('Continuing without database...');
  }

  // Start server
  const server = app.listen(serverPort, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║     bApps Campaign API Server                     ║
║────────────────────────────────────────────────────║
║  Status:  ✅ Running                               ║
║  Port:    ${serverPort}                                    ║
║  Env:     ${process.env.NODE_ENV || 'development'}                          ║
║  Time:    ${new Date().toLocaleString()}              ║
╚════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('\nSIGINT received, closing server...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

// Export for testing
export default createApp;