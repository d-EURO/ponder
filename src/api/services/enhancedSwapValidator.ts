import { parseAbi, decodeEventLog, type Log } from 'viem';
import { CITREA_TOKENS, JUICESWAP_ROUTERS } from '../config/chains';
import { rpcClient } from './rpcClient';
import { swapValidator, SwapDetails } from './swapValidator';

export interface EnhancedSwapValidation extends SwapDetails {
  status: 'pending' | 'confirmed' | 'failed' | 'not_found';
  confirmations?: number;
  blockNumber?: bigint;
  transactionIndex?: number;
}

export class EnhancedSwapValidator {
  /**
   * Validate swap transaction with confirmation waiting and retry mechanism
   */
  async validateSwapWithConfirmation(
    txHash: string,
    walletAddress: string,
    chainId: number,
    options: {
      requiredConfirmations?: number;
      maxRetries?: number;
      retryDelay?: number;
      timeout?: number;
    } = {}
  ): Promise<EnhancedSwapValidation> {
    const {
      requiredConfirmations = 1,
      maxRetries = 10,
      retryDelay = 3000, // 3 seconds
      timeout = 60000, // 60 seconds total timeout
    } = options;

    const startTime = Date.now();
    let attempts = 0;

    console.log(`🔍 Validating swap transaction ${txHash}`);
    console.log(`⏳ Waiting for ${requiredConfirmations} confirmation(s)...`);

    while (attempts < maxRetries) {
      attempts++;
      const elapsedTime = Date.now() - startTime;

      // Check timeout
      if (elapsedTime > timeout) {
        console.error(`❌ Timeout after ${timeout}ms`);
        return {
          isValid: false,
          isSwap: false,
          inputToken: null,
          outputToken: null,
          inputAmount: null,
          outputAmount: null,
          poolAddresses: [],
          swapType: null,
          timestamp: null,
          status: 'pending',
          reason: `Transaction validation timeout after ${timeout}ms`,
        };
      }

      try {
        // First check if transaction exists
        const transaction = await rpcClient.getTransaction(txHash as `0x${string}`);

        if (!transaction) {
          console.log(`⚠️ Attempt ${attempts}/${maxRetries}: Transaction not found yet`);

          if (attempts >= maxRetries) {
            return {
              isValid: false,
              isSwap: false,
              inputToken: null,
              outputToken: null,
              inputAmount: null,
              outputAmount: null,
              poolAddresses: [],
              swapType: null,
              timestamp: null,
              status: 'not_found',
              reason: 'Transaction not found after maximum retries',
            };
          }

          // Wait before retry
          await this.delay(retryDelay);
          continue;
        }

        // Try to get receipt
        let receipt;
        try {
          receipt = await rpcClient.getTransactionReceipt(txHash as `0x${string}`);
        } catch (receiptError) {
          console.log(`⚠️ Attempt ${attempts}/${maxRetries}: Receipt not available yet`);
        }

        if (!receipt) {
          console.log(`⏳ Attempt ${attempts}/${maxRetries}: Transaction pending...`);

          // Return pending status but continue checking
          if (attempts === 1) {
            // On first attempt, return immediately with pending status
            return {
              isValid: false,
              isSwap: false,
              inputToken: null,
              outputToken: null,
              inputAmount: null,
              outputAmount: null,
              poolAddresses: [],
              swapType: null,
              timestamp: null,
              status: 'pending',
              reason: 'Transaction is pending confirmation',
            };
          }

          await this.delay(retryDelay);
          continue;
        }

        // Check confirmations
        const latestBlock = await rpcClient.getBlockNumber();
        const confirmations = Number(latestBlock - receipt.blockNumber + 1n);

        console.log(`📊 Transaction has ${confirmations} confirmation(s)`);

        if (confirmations < requiredConfirmations) {
          console.log(`⏳ Waiting for ${requiredConfirmations - confirmations} more confirmation(s)...`);
          await this.delay(retryDelay);
          continue;
        }

        // Transaction is confirmed - validate it
        console.log(`✅ Transaction confirmed with ${confirmations} confirmations`);

        // Use the existing swapValidator for actual validation
        const validationResult = await swapValidator.validateSwap(
          txHash,
          walletAddress,
          chainId
        );

        // Enhance with status information
        const enhanced: EnhancedSwapValidation = {
          ...validationResult,
          status: receipt.status === 'success' ? 'confirmed' : 'failed',
          confirmations,
          blockNumber: receipt.blockNumber,
          transactionIndex: receipt.transactionIndex,
        };

        // Log result
        if (enhanced.isValid) {
          console.log(`✅ Swap validated successfully!`);
          console.log(`   Input: ${enhanced.inputToken}`);
          console.log(`   Output: ${enhanced.outputToken}`);
          console.log(`   Amount: ${enhanced.outputAmount}`);
        } else {
          console.log(`❌ Swap validation failed: ${enhanced.reason}`);
        }

        return enhanced;

      } catch (error: any) {
        console.error(`⚠️ Error on attempt ${attempts}/${maxRetries}:`, error.message);

        if (attempts >= maxRetries) {
          return {
            isValid: false,
            isSwap: false,
            inputToken: null,
            outputToken: null,
            inputAmount: null,
            outputAmount: null,
            poolAddresses: [],
            swapType: null,
            timestamp: null,
            status: 'failed',
            reason: `Validation error: ${error.message}`,
          };
        }

        await this.delay(retryDelay);
      }
    }

    // Should not reach here
    return {
      isValid: false,
      isSwap: false,
      inputToken: null,
      outputToken: null,
      inputAmount: null,
      outputAmount: null,
      poolAddresses: [],
      swapType: null,
      timestamp: null,
      status: 'failed',
      reason: 'Maximum retry attempts exceeded',
    };
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get status of a transaction without full validation
   */
  async getTransactionStatus(txHash: string): Promise<{
    status: 'pending' | 'confirmed' | 'failed' | 'not_found';
    confirmations?: number;
    blockNumber?: bigint;
  }> {
    try {
      const transaction = await rpcClient.getTransaction(txHash as `0x${string}`);

      if (!transaction) {
        return { status: 'not_found' };
      }

      const receipt = await rpcClient.getTransactionReceipt(txHash as `0x${string}`);

      if (!receipt) {
        return { status: 'pending' };
      }

      const latestBlock = await rpcClient.getBlockNumber();
      const confirmations = Number(latestBlock - receipt.blockNumber + 1n);

      return {
        status: receipt.status === 'success' ? 'confirmed' : 'failed',
        confirmations,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      return { status: 'not_found' };
    }
  }
}

// Export singleton instance
export const enhancedSwapValidator = new EnhancedSwapValidator();