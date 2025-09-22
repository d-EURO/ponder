# Frontend Integration Guide - bApps Campaign API

## API Base Configuration

**Development API Base URL**: `http://localhost:3002`
**Production API Base URL**: `https://dev.ponder.deuro.com`
**Content-Type**: `application/json`
**Chain ID**: `5115` (Citrea Testnet)

## Required Headers

```javascript
{
  "Content-Type": "application/json"
}
```

## API Endpoints

### 1. Get Campaign Progress

Get the current progress for a wallet address.

**Endpoint**: `POST /campaign/progress`

```javascript
// Request
const response = await fetch(`${API_BASE_URL}/campaign/progress`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7",
    chainId: 5115
  })
});

// Response (200 OK)
{
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7",
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

### 2. Check Swap Transaction

Verify if a transaction qualifies for a campaign task.

**Endpoint**: `POST /campaign/check-swap`

```javascript
// Request
const response = await fetch(`${API_BASE_URL}/campaign/check-swap`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    txHash: "0x7e0f052149774eab253481e7c971c90706f6e81aaa7abd2ea5ea997d1a1611a5",
    walletAddress: "0xc89E49490020fc4e8eE681553A2354234Fc3F1D4",
    chainId: 5115
  })
});

// Response (200 OK) - Valid Task
{
  "taskId": 1,
  "taskName": "Swap cBTC to NUSD",
  "isValid": true,
  "details": {
    "inputToken": "NATIVE",
    "outputToken": "NUSD",
    "outputAddress": "0x9b28b690550522608890c3c7e63c0b4a7ebab9aa",
    "amount": "10000000000000",
    "timestamp": "2025-09-22T09:59:02.000Z"
  }
}

// Response (200 OK) - Invalid Transaction
{
  "taskId": null,
  "isValid": false,
  "reason": "Swap does not match any campaign tasks"
}
```

### 3. Complete Task

Mark a task as completed (after validation).

**Endpoint**: `POST /campaign/complete-task`

```javascript
// Request
const response = await fetch(`${API_BASE_URL}/campaign/complete-task`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: "0xc89E49490020fc4e8eE681553A2354234Fc3F1D4",
    taskId: 1,
    txHash: "0x7e0f052149774eab253481e7c971c90706f6e81aaa7abd2ea5ea997d1a1611a5",
    chainId: 5115,
    timestamp: new Date().toISOString()
  })
});

// Response (200 OK)
{
  "success": true,
  "message": "Task completed successfully",
  "taskId": 1,
  "walletAddress": "0xc89E49490020fc4e8eE681553A2354234Fc3F1D4",
  "updatedProgress": {
    "completedTasks": 1,
    "totalTasks": 3,
    "progress": 33.33
  }
}
```

## Campaign Task Configuration

| Task ID | Token Name | Contract Address | Input Token |
|---------|------------|------------------|-------------|
| 1 | NUSD | `0x9B28B690550522608890C3C7e63c0b4A7eBab9AA` | Native cBTC |
| 2 | cUSD | `0x2fFC18aC99D367b70dd922771dF8c2074af4aCE0` | Native cBTC |
| 3 | USDC | `0x36c16eaC6B0Ba6c50f494914ff015fCa95B7835F` | Native cBTC |

## Error Handling

All errors return consistent JSON format:

```javascript
// 400 Bad Request
{
  "error": "Invalid wallet address",
  "code": "INVALID_ADDRESS"
}

// 404 Not Found
{
  "error": "Transaction not found",
  "code": "TX_NOT_FOUND"
}

// 500 Internal Server Error
{
  "error": "Internal server error",
  "code": "SERVER_ERROR"
}
```

### Error Codes Reference

- `INVALID_ADDRESS` - Invalid wallet address format
- `INVALID_CHAIN` - Wrong chain ID (must be 5115)
- `INVALID_TX_HASH` - Invalid transaction hash format
- `TX_NOT_FOUND` - Transaction not found on chain
- `TASK_ALREADY_COMPLETED` - User already completed this task
- `INVALID_TRANSACTION` - Transaction doesn't match requirements
- `SERVER_ERROR` - Internal server error
- `RATE_LIMITED` - Too many requests
- `VALIDATION_ERROR` - Input validation failed

## Integration Workflow

### Recommended Frontend Flow

1. **Load User Progress**
   ```javascript
   // On wallet connect, fetch current progress
   const progress = await fetchCampaignProgress(walletAddress);
   updateProgressUI(progress);
   ```

2. **Monitor Transactions**
   ```javascript
   // After user makes a swap, check if it qualifies
   const validation = await checkSwapTransaction(txHash, walletAddress);

   if (validation.isValid) {
     // Complete the task
     await completeTask(walletAddress, validation.taskId, txHash);

     // Refresh progress
     const updatedProgress = await fetchCampaignProgress(walletAddress);
     updateProgressUI(updatedProgress);
   }
   ```

3. **Handle Errors Gracefully**
   ```javascript
   try {
     const result = await apiCall();
   } catch (error) {
     if (error.code === 'RATE_LIMITED') {
       showRateLimitMessage();
     } else if (error.code === 'TX_NOT_FOUND') {
       showTransactionNotFoundMessage();
     } else {
       showGenericErrorMessage();
     }
   }
   ```

## Rate Limits

**Per IP Address:**
- `/campaign/progress`: 30 requests/minute
- `/campaign/check-swap`: 20 requests/minute

**Per Wallet:**
- `/campaign/complete-task`: 10 requests/minute

## Example React Hook

```javascript
import { useState, useEffect } from 'react';

const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://dev.ponder.deuro.com'
  : 'http://localhost:3002';

export function useCampaignProgress(walletAddress) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProgress = async () => {
    if (!walletAddress) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/campaign/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          chainId: 5115
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch progress');
      }

      const data = await response.json();
      setProgress(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkTransaction = async (txHash) => {
    try {
      const response = await fetch(`${API_BASE_URL}/campaign/check-swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash,
          walletAddress,
          chainId: 5115
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check transaction');
      }

      return await response.json();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const completeTask = async (taskId, txHash) => {
    try {
      const response = await fetch(`${API_BASE_URL}/campaign/complete-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          taskId,
          txHash,
          chainId: 5115,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete task');
      }

      const data = await response.json();

      // Refresh progress after completing task
      await fetchProgress();

      return data;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [walletAddress]);

  return {
    progress,
    loading,
    error,
    fetchProgress,
    checkTransaction,
    completeTask
  };
}
```

## Testing

### Test Wallets
```
0xc89E49490020fc4e8eE681553A2354234Fc3F1D4
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7
```

### Test Transactions
- **Valid NUSD Swap**: `0x7e0f052149774eab253481e7c971c90706f6e81aaa7abd2ea5ea997d1a1611a5`

### Health Check
```javascript
// Check API health
const health = await fetch(`${API_BASE_URL}/health`);
// Response includes blockchain connection status
```

## Support

- **API Issues**: Check `/health` endpoint first
- **Transaction Validation**: Use `/campaign/check-swap` to debug
- **Rate Limiting**: Implement exponential backoff for retries
- **Error Handling**: Always check error codes for specific handling

## Environment Variables

```env
# Frontend .env
REACT_APP_API_BASE_URL=http://localhost:3002
REACT_APP_CHAIN_ID=5115
REACT_APP_CAMPAIGN_ENABLED=true
```