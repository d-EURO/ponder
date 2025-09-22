# bApps Campaign API Specification

## Overview

This document specifies the complete API requirements for the Citrea bApps Campaign tracking system. The API should be hosted at `https://dev.ponder.deuro.com` and will track user progress through swap tasks on the Citrea Testnet.

## Campaign Context

The Citrea ₿apps Campaign is a promotional campaign where users complete specific swap tasks on JuiceSwap to earn a ₿apper Badge NFT. The campaign runs until **December 31, 2025**.

### Frontend Integration
- **Production URL**: https://bapp.juiceswap.xyz
- **Local Development**: http://localhost:3001
- **Campaign Page**: https://bapps.citrea.xyz (external reference)

## Base Configuration

- **Base URL**: `https://dev.ponder.deuro.com`
- **Content-Type**: `application/json`
- **Chain ID**: `5115` (Citrea Testnet)
- **CORS**: Must allow origins:
  - `http://localhost:3001` (development)
  - `https://bapp.juiceswap.xyz` (production)
  - `https://dev.bapp.juiceswap.xyz` (staging)

## Campaign Tasks

The campaign consists of 3 specific swap tasks that users must complete:

| Task ID | Task Name | Description | Input Token | Output Token | Contract Addresses |
|---------|-----------|-------------|-------------|--------------|-------------------|
| 1 | NUSD Swap | Swap cBTC to NUSD | Native cBTC | NUSD | Output: `0x9B28B690550522608890C3C7e63c0b4A7eBab9AA` |
| 2 | cUSD Swap | Swap cBTC to cUSD | Native cBTC | cUSD | Output: `0x2fFC18aC99D367b70dd922771dF8c2074af4aCE0` |
| 3 | USDC Swap | Swap cBTC to USDC | Native cBTC | USDC | Output: `0x36c16eaC6B0Ba6c50f494914ff015fCa95B7835F` |

**Important**:
- Input token is always the native token (cBTC on Citrea, shown as ETH/NATIVE in transactions)
- Minimum swap amount: No specific requirement, any amount counts
- Each task can only be completed once per wallet

## API Endpoints

### 1. Get Campaign Progress

Fetch the current campaign progress for a wallet address.

**Endpoint**: `POST /campaign/progress`

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "walletAddress": "0x...", // Ethereum wallet address (required, checksummed)
  "chainId": 5115           // Chain ID (required, must be 5115 for Citrea Testnet)
}
```

**Response (200 OK)**:
```json
{
  "walletAddress": "0x1234567890123456789012345678901234567890",
  "chainId": 5115,
  "tasks": [
    {
      "id": 1,
      "name": "Swap cBTC to NUSD",
      "description": "Complete a swap from cBTC to NUSD",
      "completed": false,
      "completedAt": null,
      "txHash": null
    },
    {
      "id": 2,
      "name": "Swap cBTC to cUSD",
      "description": "Complete a swap from cBTC to cUSD",
      "completed": true,
      "completedAt": "2024-09-22T14:30:00Z",
      "txHash": "0xabc123..."
    },
    {
      "id": 3,
      "name": "Swap cBTC to USDC",
      "description": "Complete a swap from cBTC to USDC",
      "completed": false,
      "completedAt": null,
      "txHash": null
    }
  ],
  "totalTasks": 3,
  "completedTasks": 1,
  "progress": 33.33,
  "nftClaimed": false,
  "claimTxHash": null
}
```

**Error Responses**:
- `400 Bad Request`: Invalid wallet address format or invalid chainId
  ```json
  {
    "error": "Invalid wallet address",
    "code": "INVALID_ADDRESS"
  }
  ```
- `500 Internal Server Error`: Database or server error
  ```json
  {
    "error": "Internal server error",
    "code": "SERVER_ERROR"
  }
  ```

### 2. Submit Task Completion

Record that a user has completed a specific task.

**Endpoint**: `POST /campaign/complete-task`

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "walletAddress": "0x...",              // Ethereum wallet address (required, checksummed)
  "taskId": 1,                           // Task ID (1, 2, or 3) (required)
  "txHash": "0x...",                     // Transaction hash of the swap (required, 66 chars)
  "chainId": 5115,                       // Chain ID (required)
  "timestamp": "2024-09-22T14:30:00Z"    // ISO 8601 timestamp (required)
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Task completed successfully",
  "taskId": 1,
  "walletAddress": "0x...",
  "updatedProgress": {
    "completedTasks": 2,
    "totalTasks": 3,
    "progress": 66.67
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid parameters or task already completed
  ```json
  {
    "error": "Task already completed",
    "code": "TASK_ALREADY_COMPLETED",
    "taskId": 1
  }
  ```
- `404 Not Found`: Transaction not found or doesn't match requirements
  ```json
  {
    "error": "Transaction does not match task requirements",
    "code": "INVALID_TRANSACTION",
    "details": {
      "expected": "Swap from NATIVE to NUSD",
      "found": "Transfer transaction"
    }
  }
  ```
- `500 Internal Server Error`: Server error

### 3. Check Swap Task Completion

Verify if a transaction hash corresponds to a campaign task and which one.

**Endpoint**: `POST /campaign/check-swap`

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "txHash": "0x...",         // Transaction hash to check (required, 66 chars)
  "walletAddress": "0x...",  // Wallet address that made the swap (required)
  "chainId": 5115            // Chain ID (required)
}
```

**Response (200 OK) - Task Match Found**:
```json
{
  "taskId": 1,
  "taskName": "Swap cBTC to NUSD",
  "isValid": true,
  "details": {
    "inputToken": "NATIVE",
    "outputToken": "NUSD",
    "outputAddress": "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA",
    "amount": "0.001",
    "timestamp": "2024-09-22T14:30:00Z"
  }
}
```

**Response (200 OK) - No Task Match**:
```json
{
  "taskId": null,
  "isValid": false,
  "reason": "Swap does not match any campaign tasks"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid transaction hash format
- `404 Not Found`: Transaction not found on chain
- `500 Internal Server Error`: Server error

## Transaction Validation Logic

### Step-by-Step Validation Process

1. **Fetch Transaction from Blockchain**
   - Use Citrea Testnet RPC: `https://rpc.testnet.citrea.xyz`
   - Get transaction by hash
   - Verify transaction is confirmed (minimum 3 block confirmations recommended)

2. **Verify Transaction Type**
   - Must be a swap transaction (not transfer, approval, etc.)
   - Look for swap-related method signatures or events

3. **Identify Swap Details**
   - **From address**: Must match the provided `walletAddress`
   - **Input token**: Must be native token (ETH/cBTC)
   - **Output token**: Extract from transaction logs/events

4. **Match Against Campaign Tasks**
   ```javascript
   const taskMapping = {
     '0x9B28B690550522608890C3C7e63c0b4A7eBab9AA': 1, // NUSD
     '0x2fFC18aC99D367b70dd922771dF8c2074af4aCE0': 2, // cUSD
     '0x36c16eaC6B0Ba6c50f494914ff015fCa95B7835F': 3  // USDC
   };
   ```

### JuiceSwap V3 Specific Details

**Router Addresses** (verify on Citrea Testnet):
- V3 SwapRouter: Check deployed contracts on Citrea
- Universal Router: May be used for some swaps

**Event Signatures to Look For**:
```solidity
// V3 Swap Event
event Swap(
    address indexed sender,
    address indexed recipient,
    int256 amount0,
    int256 amount1,
    uint160 sqrtPriceX96,
    uint128 liquidity,
    int24 tick
);
```

**Method Signatures**:
- `exactInputSingle`: 0x414bf389
- `exactOutputSingle`: 0xdb3e2198
- `multicall`: 0xac9650d8

## Data Storage Requirements

### Database Schema (PostgreSQL)

```sql
-- User progress table
CREATE TABLE campaign_progress (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  chain_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(wallet_address, chain_id)
);

-- Task completions table
CREATE TABLE task_completions (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  task_id INTEGER NOT NULL CHECK (task_id IN (1, 2, 3)),
  tx_hash VARCHAR(66) NOT NULL UNIQUE,
  completed_at TIMESTAMP NOT NULL,
  chain_id INTEGER NOT NULL,
  amount_swapped DECIMAL(36, 18), -- Optional: track swap amounts
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(wallet_address, task_id, chain_id)
);

-- Transaction cache for performance
CREATE TABLE transaction_cache (
  tx_hash VARCHAR(66) PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  from_address VARCHAR(42),
  to_address VARCHAR(42),
  input_token VARCHAR(42),
  output_token VARCHAR(42),
  amount_in DECIMAL(36, 18),
  amount_out DECIMAL(36, 18),
  block_number BIGINT,
  timestamp TIMESTAMP,
  method_signature VARCHAR(10),
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '5 minutes')
);

-- Indexes for performance
CREATE INDEX idx_wallet_chain ON campaign_progress(wallet_address, chain_id);
CREATE INDEX idx_task_wallet ON task_completions(wallet_address, chain_id);
CREATE INDEX idx_tx_cache_expires ON transaction_cache(expires_at);
```

## Implementation Requirements

### Technology Stack (Recommended)

- **Runtime**: Node.js 18+ or Python 3.10+
- **Framework**: Express.js, Fastify, or FastAPI
- **Database**: PostgreSQL 14+
- **Cache**: Redis (optional but recommended)
- **Blockchain**: ethers.js v6 or web3.js

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bapps_campaign

# Blockchain
CITREA_RPC_URL=https://rpc.testnet.citrea.xyz
CITREA_CHAIN_ID=5115
CITREA_EXPLORER_API=https://explorer.testnet.citrea.xyz/api

# Redis Cache (optional)
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=300

# API Configuration
PORT=3000
NODE_ENV=production
CORS_ORIGINS=http://localhost:3001,https://bapp.juiceswap.xyz,https://dev.bapp.juiceswap.xyz

# Rate Limiting
RATE_LIMIT_PER_SECOND=10
RATE_LIMIT_PER_MINUTE=100
RATE_LIMIT_PER_HOUR=1000

# Logging
LOG_LEVEL=info
```

### Error Handling

All errors should return consistent JSON format:
```json
{
  "error": "Human readable error message",
  "code": "ERROR_CODE",
  "details": {} // Optional additional context
}
```

Error codes to implement:
- `INVALID_ADDRESS`: Invalid wallet address format
- `INVALID_CHAIN`: Wrong chain ID
- `INVALID_TX_HASH`: Invalid transaction hash format
- `TX_NOT_FOUND`: Transaction not found on chain
- `TASK_ALREADY_COMPLETED`: User already completed this task
- `INVALID_TRANSACTION`: Transaction doesn't match requirements
- `SERVER_ERROR`: Internal server error
- `RATE_LIMITED`: Too many requests

### Rate Limiting

Implement rate limiting per endpoint:
- `/campaign/progress`: 30 requests per minute per IP
- `/campaign/complete-task`: 10 requests per minute per wallet
- `/campaign/check-swap`: 20 requests per minute per IP

### Caching Strategy

1. **Transaction Cache**: 5 minutes
2. **User Progress**: 30 seconds (or use WebSocket for real-time)
3. **Token Contract Info**: 1 hour

### Monitoring & Logging

Log these events:
- All API requests with response times
- Transaction validation results
- Database query performance
- Error rates by endpoint
- Unique daily/weekly active users

Metrics to track:
- Task completion rates (task 1 vs 2 vs 3)
- Average time to complete all tasks
- API response times (p50, p95, p99)
- Cache hit rates

## Security Considerations

### Input Validation

```javascript
// Example validation
const { body, validationResult } = require('express-validator');

app.post('/campaign/progress',
  body('walletAddress').isEthereumAddress(),
  body('chainId').isInt().equals('5115'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }
    // Process request
  }
);
```

### Transaction Verification

1. Always verify on-chain, never trust client data
2. Check transaction status is successful
3. Verify sender matches claimed wallet
4. Check block confirmations (minimum 3)
5. Validate timestamp is reasonable (not future, not too old)

## Testing

### Test Cases

1. **Happy Path**
   - New user with no progress
   - Complete task 1, verify progress updates
   - Complete task 2, verify progress
   - Complete task 3, verify 100% completion

2. **Edge Cases**
   - Duplicate task submission
   - Invalid transaction hash
   - Wrong token pairs
   - Failed transactions
   - Pending transactions
   - Cross-chain transaction (wrong chainId)

3. **Performance**
   - Concurrent requests from same wallet
   - High load testing (100+ requests/second)
   - Database connection pooling

### Test Data

**Test Wallets**:
```
0xc89E49490020fc4e8eE681553A2354234Fc3F1D4
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7
```

**Test Transactions** (you'll need to create these):
- Valid NUSD swap
- Valid cUSD swap
- Valid USDC swap
- Invalid token pair swap
- Failed transaction
- Non-swap transaction

## Deployment Checklist

- [ ] Database migrations run
- [ ] Environment variables configured
- [ ] SSL certificate installed
- [ ] CORS origins configured correctly
- [ ] Rate limiting enabled
- [ ] Error logging configured
- [ ] Monitoring/alerting setup
- [ ] API documentation accessible
- [ ] Health check endpoint (`GET /health`)
- [ ] Load testing completed
- [ ] Security audit performed

## API Health Check

Implement a health check endpoint:

**Endpoint**: `GET /health`

**Response (200 OK)**:
```json
{
  "status": "healthy",
  "timestamp": "2024-09-22T14:30:00Z",
  "version": "1.0.0",
  "chain": {
    "connected": true,
    "chainId": 5115,
    "blockNumber": 1234567
  },
  "database": {
    "connected": true,
    "latency": "2ms"
  },
  "cache": {
    "connected": true,
    "latency": "1ms"
  }
}
```

## Contact Information

- **Frontend Integration Issues**: JuiceSwap Development Team
- **Campaign Questions**: Citrea bApps Team
- **API Development**: Your team name here

## Version History

- v1.0.0 (2024-09-22): Initial specification