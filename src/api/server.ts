import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import campaignRoutes from './routes/campaign';
import healthRoutes from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';

config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3001',
    'https://bapp.juiceswap.xyz',
    'https://dev.bapp.juiceswap.xyz'
  ],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(rateLimiter);

// Routes
app.use('/health', healthRoutes);
app.use('/campaign', campaignRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Campaign API server running on port ${PORT}`);
});

export default app;