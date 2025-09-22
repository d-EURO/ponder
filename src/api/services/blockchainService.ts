import { createPublicClient, http, parseAbi, decodeEventLog } from 'viem';
import { CITREA_TESTNET, CITREA_TOKENS, JUICESWAP_ROUTERS } from '../config/chains';

// Create Citrea client
const citreaClient = createPublicClient({
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

// Uniswap V3 Swap event ABI
const SWAP_EVENT_ABI = parseAbi([
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)'
]);

// Common swap method signatures
const SWAP_METHODS = {
  EXACT_INPUT_SINGLE: '0x414bf389',
  EXACT_OUTPUT_SINGLE: '0xdb3e2198',
  MULTICALL: '0xac9650d8',
  SWAP_EXACT_ETH_FOR_TOKENS: '0x7ff36ab5'
};

export interface SwapValidation {
  isValid: boolean;
  inputToken?: string;
  outputToken?: string;
  amount?: string;
  timestamp?: string;
  reason?: string;
  details?: any;
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

    // Get transaction and receipt
    const [transaction, receipt] = await Promise.all([
      citreaClient.getTransaction({ hash: txHash as `0x${string}` }),
      citreaClient.getTransactionReceipt({ hash: txHash as `0x${string}` })
    ]);

    if (!transaction || !receipt) {
      return {
        isValid: false,
        reason: 'Transaction not found'
      };
    }

    // Verify transaction is from the correct wallet
    if (transaction.from.toLowerCase() !== walletAddress.toLowerCase()) {
      return {
        isValid: false,
        reason: 'Transaction sender does not match wallet address',
        details: { expected: walletAddress, found: transaction.from }
      };
    }

    // Verify transaction was successful
    if (receipt.status !== 'success') {
      return {
        isValid: false,
        reason: 'Transaction failed'
      };
    }

    // Check if transaction is to a JuiceSwap router
    const toAddress = transaction.to?.toLowerCase();
    const validRouters = Object.values(JUICESWAP_ROUTERS).map(addr => addr.toLowerCase());

    if (!toAddress || !validRouters.includes(toAddress)) {
      return {
        isValid: false,
        reason: 'Transaction not sent to JuiceSwap router',
        details: {
          to: transaction.to,
          validRouters: Object.keys(JUICESWAP_ROUTERS)
        }
      };
    }

    // Check if this is a swap transaction
    const methodId = transaction.input.slice(0, 10);
    const isSwap = Object.values(SWAP_METHODS).includes(methodId);

    if (!isSwap) {
      return {
        isValid: false,
        reason: 'Not a swap transaction',
        details: { methodId }
      };
    }

    // Analyze logs to find token transfers
    let outputToken: string | undefined;
    let isNativeInput = false;

    // Check if transaction value > 0 (native token input)
    if (transaction.value > 0n) {
      isNativeInput = true;
    }

    // Look for ERC20 Transfer events TO the user
    const transferEventAbi = parseAbi([
      'event Transfer(address indexed from, address indexed to, uint256 value)'
    ]);

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: transferEventAbi,
          data: log.data,
          topics: log.topics as [string, ...string[]]
        });

        // Check if this is a transfer TO the user
        if (decoded.eventName === 'Transfer' &&
            decoded.args.to?.toLowerCase() === walletAddress.toLowerCase()) {

          // Check if this token is one of our campaign tokens
          const tokenAddress = log.address.toLowerCase();
          if (Object.values(CITREA_TOKENS).map(t => t.toLowerCase()).includes(tokenAddress)) {
            outputToken = log.address;
            break;
          }
        }
      } catch {
        // Not a Transfer event, continue
      }
    }

    // Validate swap requirements
    if (!isNativeInput) {
      return {
        isValid: false,
        reason: 'Input token must be native cBTC',
        details: { inputToken: 'non-native' }
      };
    }

    if (!outputToken) {
      return {
        isValid: false,
        reason: 'No valid output token found in transaction'
      };
    }

    // Get block for timestamp
    const block = await citreaClient.getBlock({ blockNumber: receipt.blockNumber });

    return {
      isValid: true,
      inputToken: 'NATIVE',
      outputToken,
      amount: transaction.value.toString(),
      timestamp: new Date(Number(block.timestamp) * 1000).toISOString()
    };

  } catch (error) {
    console.error('Error validating swap transaction:', error);
    return {
      isValid: false,
      reason: 'Error validating transaction',
      details: error
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