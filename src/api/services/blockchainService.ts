import { CITREA_TESTNET, CITREA_TOKENS } from '../config/chains';
import { swapValidator } from './swapValidator';
import { rpcClient } from './rpcClient';

export interface SwapValidation {
  isValid: boolean;
  inputToken?: string;
  outputToken?: string;
  amount?: string;
  timestamp?: string;
  reason?: string;
  details?: any;
  taskId?: number;
}

export async function validateSwapTransaction(
  txHash: string,
  walletAddress: string,
  chainId: number
): Promise<SwapValidation> {
  try {
    // Verify chain ID
    if (chainId !== CITREA_TESTNET.chainId) {
      return {
        isValid: false,
        reason: 'Invalid chain ID',
        details: { expected: CITREA_TESTNET.chainId, received: chainId }
      };
    }

    // Use the enhanced swap validator
    const swapDetails = await swapValidator.validateSwap(txHash, walletAddress, chainId);

    // Convert to legacy format for backward compatibility
    const result: SwapValidation = {
      isValid: swapDetails.isValid,
      inputToken: swapDetails.inputToken,
      outputToken: swapDetails.outputToken,
      amount: swapDetails.inputAmount || swapDetails.outputAmount,
      timestamp: swapDetails.timestamp,
      reason: swapDetails.reason,
      details: {
        swapType: swapDetails.swapType,
        poolAddresses: swapDetails.poolAddresses,
        outputAmount: swapDetails.outputAmount,
        warnings: swapDetails.warnings
      }
    };

    // Add task ID if we have a valid output token
    if (swapDetails.outputToken) {
      result.taskId = swapValidator.getTaskIdFromToken(swapDetails.outputToken);
    }

    return result;

  } catch (error: any) {
    console.error('Error validating swap transaction:', error);
    return {
      isValid: false,
      reason: 'Error validating transaction',
      details: { error: error.message }
    };
  }
}

// Cache transaction results for performance
const txCache = new Map<string, SwapValidation>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function validateSwapTransactionWithCache(
  txHash: string,
  walletAddress: string,
  chainId: number
): Promise<SwapValidation> {
  const cacheKey = `${txHash}-${walletAddress}-${chainId}`;

  // Check cache
  const cached = txCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Validate transaction
  const result = await validateSwapTransaction(txHash, walletAddress, chainId);

  // Cache result
  txCache.set(cacheKey, result);
  setTimeout(() => txCache.delete(cacheKey), CACHE_TTL);

  return result;
}