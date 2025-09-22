import { createPublicClient, http, PublicClient, HttpTransportConfig } from 'viem';
import { CITREA_TESTNET } from '../config/chains';

// RPC endpoints with priority (primary first)
const RPC_ENDPOINTS = [
  'https://rpc.testnet.citrea.xyz',
  // Add more fallback RPCs here when available
];

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2
};

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Calculate delay with exponential backoff
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const delay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt);
  return Math.min(delay, options.maxDelay);
}

// Create client for specific RPC endpoint
function createClient(rpcUrl: string): PublicClient {
  return createPublicClient({
    chain: {
      id: CITREA_TESTNET.chainId,
      name: CITREA_TESTNET.name,
      nativeCurrency: CITREA_TESTNET.nativeCurrency,
      rpcUrls: {
        default: { http: [rpcUrl] },
        public: { http: [rpcUrl] }
      }
    },
    transport: http(rpcUrl, {
      timeout: 10000, // 10 second timeout
      retryCount: 0, // We handle retries ourselves
    } as HttpTransportConfig)
  });
}

export class ResilientRPCClient {
  private clients: PublicClient[];
  private currentClientIndex: number = 0;
  private retryOptions: Required<RetryOptions>;

  constructor(retryOptions: RetryOptions = {}) {
    this.retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
    this.clients = RPC_ENDPOINTS.map(url => createClient(url));

    if (this.clients.length === 0) {
      throw new Error('No RPC endpoints configured');
    }
  }

  // Get current client
  private getCurrentClient(): PublicClient {
    return this.clients[this.currentClientIndex];
  }

  // Switch to next available RPC
  private switchToNextRPC(): boolean {
    const nextIndex = (this.currentClientIndex + 1) % this.clients.length;

    // If we've cycled through all RPCs, return false
    if (nextIndex === 0 && this.currentClientIndex !== 0) {
      return false;
    }

    this.currentClientIndex = nextIndex;
    console.log(`Switching to RPC endpoint ${nextIndex + 1}/${this.clients.length}`);
    return true;
  }

  // Execute RPC call with retry logic
  async executeWithRetry<T>(
    operation: (client: PublicClient) => Promise<T>,
    operationName: string = 'RPC call'
  ): Promise<T> {
    let lastError: Error | undefined;
    let totalAttempts = 0;
    const maxTotalAttempts = this.retryOptions.maxRetries * this.clients.length;

    // Try each RPC endpoint with retries
    for (let rpcAttempt = 0; rpcAttempt < this.clients.length; rpcAttempt++) {
      // Try current RPC with retries
      for (let retry = 0; retry < this.retryOptions.maxRetries; retry++) {
        totalAttempts++;

        try {
          const client = this.getCurrentClient();
          const result = await operation(client);

          // Success - reset to primary RPC for next call
          if (this.currentClientIndex !== 0) {
            console.log('Resetting to primary RPC endpoint');
            this.currentClientIndex = 0;
          }

          return result;
        } catch (error: any) {
          lastError = error;

          console.warn(
            `${operationName} failed (attempt ${totalAttempts}/${maxTotalAttempts}):`,
            error.message?.slice(0, 100)
          );

          // Check if error is retryable
          const isRetryable = this.isRetryableError(error);

          if (!isRetryable) {
            throw error; // Don't retry non-retryable errors
          }

          // If not last retry for this RPC, wait and retry
          if (retry < this.retryOptions.maxRetries - 1) {
            const delay = calculateDelay(retry, this.retryOptions);
            console.log(`Retrying in ${delay}ms...`);
            await sleep(delay);
          }
        }
      }

      // All retries failed for this RPC, try next one
      if (rpcAttempt < this.clients.length - 1) {
        this.switchToNextRPC();
      }
    }

    // All RPCs and retries exhausted
    throw new Error(
      `${operationName} failed after ${totalAttempts} attempts across ${this.clients.length} RPC endpoints: ${lastError?.message}`
    );
  }

  // Check if error is retryable
  private isRetryableError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';

    // Network errors
    if (message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnrefused') ||
        message.includes('enotfound') ||
        message.includes('etimedout')) {
      return true;
    }

    // Rate limiting
    if (message.includes('rate limit') ||
        message.includes('too many requests') ||
        error.code === 429) {
      return true;
    }

    // Server errors (5xx)
    if (error.statusCode >= 500 && error.statusCode < 600) {
      return true;
    }

    // Specific RPC errors that are retryable
    if (message.includes('server error') ||
        message.includes('internal error')) {
      return true;
    }

    return false;
  }

  // Wrapped client methods with retry logic
  async getTransaction(hash: `0x${string}`) {
    return this.executeWithRetry(
      client => client.getTransaction({ hash }),
      `getTransaction(${hash.slice(0, 10)}...)`
    );
  }

  async getTransactionReceipt(hash: `0x${string}`) {
    return this.executeWithRetry(
      client => client.getTransactionReceipt({ hash }),
      `getTransactionReceipt(${hash.slice(0, 10)}...)`
    );
  }

  async getBlock(args: { blockNumber: bigint }) {
    return this.executeWithRetry(
      client => client.getBlock(args),
      `getBlock(${args.blockNumber})`
    );
  }

  async getBlockNumber() {
    return this.executeWithRetry(
      client => client.getBlockNumber(),
      'getBlockNumber'
    );
  }

  // Health check for monitoring
  async healthCheck(): Promise<{
    healthy: boolean;
    currentRPC: number;
    totalRPCs: number;
    blockNumber?: bigint;
    error?: string;
  }> {
    try {
      const blockNumber = await this.getBlockNumber();
      return {
        healthy: true,
        currentRPC: this.currentClientIndex + 1,
        totalRPCs: this.clients.length,
        blockNumber
      };
    } catch (error: any) {
      return {
        healthy: false,
        currentRPC: this.currentClientIndex + 1,
        totalRPCs: this.clients.length,
        error: error.message
      };
    }
  }
}

// Singleton instance
export const rpcClient = new ResilientRPCClient();