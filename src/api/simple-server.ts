import express from 'express';
import { config } from 'dotenv';

config({ path: '.env.api' });

const app = express();
const PORT = process.env.API_PORT || 3002;

app.use(express.json());

// Simple health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

app.listen(PORT, () => {
  console.log(`Simple API server running on port ${PORT}`);
});