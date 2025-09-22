import { parseAbi, decodeEventLog, type Log } from 'viem';
import { CITREA_TOKENS, JUICESWAP_ROUTERS } from '../config/chains';
import { rpcClient } from './rpcClient';

// Event ABIs
const EVENT_ABIS = {
  // Uniswap V3 Pool Swap Event
  V3_SWAP: parseAbi([
    'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)'
  ]),

  // Uniswap V2 Swap Event
  V2_SWAP: parseAbi([
    'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)'
  ]),

  // ERC20 Transfer Event
  ERC20_TRANSFER: parseAbi([
    'event Transfer(address indexed from, address indexed to, uint256 value)'
  ]),

  // WETH Deposit/Withdrawal Events (in case of wrapped native token)
  WETH_DEPOSIT: parseAbi([
    'event Deposit(address indexed dst, uint256 wad)'
  ]),
  WETH_WITHDRAWAL: parseAbi([
    'event Withdrawal(address indexed src, uint256 wad)'
  ])
};

// Common swap method signatures
const SWAP_METHOD_SIGNATURES = {
  // V3 Router methods
  EXACT_INPUT_SINGLE: '0x414bf389',
  EXACT_OUTPUT_SINGLE: '0xdb3e2198',
  EXACT_INPUT: '0xc04b8d59',
  EXACT_OUTPUT: '0xf28c0498',

  // V2 Router methods
  SWAP_EXACT_ETH_FOR_TOKENS: '0x7ff36ab5',
  SWAP_ETH_FOR_EXACT_TOKENS: '0xfb3bdb41',
  SWAP_EXACT_TOKENS_FOR_ETH: '0x18cbafe5',
  SWAP_TOKENS_FOR_EXACT_ETH: '0x4a25d94a',

  // Universal Router
  EXECUTE: '0x24856bc3',
  EXECUTE_WITH_DEADLINE: '0x3593564c',

  // Multicall (often used for complex swaps)
  MULTICALL: '0xac9650d8',
  MULTICALL_WITH_DEADLINE: '0x5ae401dc'
};

export interface SwapDetails {
  isValid: boolean;
  isSwap: boolean;
  inputToken: string | null;
  outputToken: string | null;
  inputAmount: string | null;
  outputAmount: string | null;
  poolAddresses: string[];
  swapType: 'V2' | 'V3' | 'UNKNOWN' | null;
  timestamp: string | null;
  reason?: string;
  warnings?: string[];
}

export interface ParsedSwapEvent {
  type: 'V2_SWAP' | 'V3_SWAP';
  poolAddress: string;
  sender: string;
  recipient: string;
  amount0: bigint;
  amount1: bigint;
  token0ToToken1: boolean; // Direction of swap
}

export interface TokenTransfer {
  token: string;
  from: string;
  to: string;
  amount: bigint;
}

export class SwapValidator {

  // Parse swap events from logs
  private parseSwapEvents(logs: Log[]): ParsedSwapEvent[] {
    const swapEvents: ParsedSwapEvent[] = [];

    for (const log of logs) {
      // Try V3 Swap
      try {
        const decoded = decodeEventLog({
          abi: EVENT_ABIS.V3_SWAP,
          data: log.data,
          topics: log.topics as [string, ...string[]]
        });

        if (decoded.eventName === 'Swap') {
          const args = decoded.args as any;
          swapEvents.push({
            type: 'V3_SWAP',
            poolAddress: log.address,
            sender: args.sender,
            recipient: args.recipient,
            amount0: args.amount0,
            amount1: args.amount1,
            token0ToToken1: args.amount0 < 0n // Negative amount0 means token0 is input
          });
        }
      } catch {
        // Not a V3 swap, try V2
        try {
          const decoded = decodeEventLog({
            abi: EVENT_ABIS.V2_SWAP,
            data: log.data,
            topics: log.topics as [string, ...string[]]
          });

          if (decoded.eventName === 'Swap') {
            const args = decoded.args as any;
            swapEvents.push({
              type: 'V2_SWAP',
              poolAddress: log.address,
              sender: args.sender,
              recipient: args.to,
              amount0: args.amount0In > 0n ? -args.amount0In : args.amount0Out,
              amount1: args.amount1In > 0n ? -args.amount1In : args.amount1Out,
              token0ToToken1: args.amount0In > 0n
            });
          }
        } catch {
          // Not a swap event
        }
      }
    }

    return swapEvents;
  }

  // Parse token transfers from logs
  private parseTokenTransfers(logs: Log[], walletAddress: string): TokenTransfer[] {
    const transfers: TokenTransfer[] = [];

    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: EVENT_ABIS.ERC20_TRANSFER,
          data: log.data,
          topics: log.topics as [string, ...string[]]
        });

        if (decoded.eventName === 'Transfer') {
          const args = decoded.args as any;
          transfers.push({
            token: log.address,
            from: args.from,
            to: args.to,
            amount: args.value
          });
        }
      } catch {
        // Not a transfer event
      }
    }

    return transfers;
  }

  // Validate if transaction is a valid swap
  async validateSwap(
    txHash: string,
    walletAddress: string,
    chainId: number
  ): Promise<SwapDetails> {
    const warnings: string[] = [];

    try {
      // Fetch transaction and receipt with retry logic
      const [transaction, receipt] = await Promise.all([
        rpcClient.getTransaction(txHash as `0x${string}`),
        rpcClient.getTransactionReceipt(txHash as `0x${string}`)
      ]);

      if (!transaction || !receipt) {
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
          reason: 'Transaction not found'
        };
      }

      // Check sender
      if (transaction.from.toLowerCase() !== walletAddress.toLowerCase()) {
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
          reason: 'Transaction sender does not match wallet address'
        };
      }

      // Check if transaction was successful
      if (receipt.status !== 'success') {
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
          reason: 'Transaction failed'
        };
      }

      // Check if sent to JuiceSwap router
      const toAddress = transaction.to?.toLowerCase();
      const validRouters = Object.values(JUICESWAP_ROUTERS).map(addr => addr.toLowerCase());

      if (!toAddress || !validRouters.includes(toAddress)) {
        warnings.push('Transaction not sent to known JuiceSwap router');
      }

      // Check method signature
      const methodId = transaction.input.slice(0, 10).toLowerCase();
      const isKnownSwapMethod = Object.values(SWAP_METHOD_SIGNATURES)
        .map(sig => sig.toLowerCase())
        .includes(methodId);

      if (!isKnownSwapMethod) {
        warnings.push(`Unknown method signature: ${methodId}`);
      }

      // Parse events
      const swapEvents = this.parseSwapEvents(receipt.logs);
      const transfers = this.parseTokenTransfers(receipt.logs, walletAddress);

      // Determine swap type
      let swapType: 'V2' | 'V3' | 'UNKNOWN' = 'UNKNOWN';
      if (swapEvents.length > 0) {
        swapType = swapEvents[0].type === 'V3_SWAP' ? 'V3' : 'V2';
      }

      // Get pool addresses
      const poolAddresses = [...new Set(swapEvents.map(e => e.poolAddress))];

      // Analyze token flow
      let inputToken: string | null = null;
      let outputToken: string | null = null;
      let inputAmount: string | null = null;
      let outputAmount: string | null = null;

      // Check for native token input (cBTC)
      const hasNativeInput = transaction.value > 0n;
      if (hasNativeInput) {
        inputToken = 'NATIVE';
        inputAmount = transaction.value.toString();
      }

      // Find output token from transfers TO the user
      const userReceived = transfers.filter(
        t => t.to.toLowerCase() === walletAddress.toLowerCase()
      );

      // Check if any received token is a campaign target token
      const campaignTokens = Object.values(CITREA_TOKENS).map(t => t.toLowerCase());
      const receivedCampaignToken = userReceived.find(
        t => campaignTokens.includes(t.token.toLowerCase())
      );

      if (receivedCampaignToken) {
        outputToken = receivedCampaignToken.token;
        outputAmount = receivedCampaignToken.amount.toString();
      }

      // If no native input but we have token transfers from user
      if (!hasNativeInput && !inputToken) {
        const userSent = transfers.filter(
          t => t.from.toLowerCase() === walletAddress.toLowerCase()
        );
        if (userSent.length > 0) {
          warnings.push('Swap does not use native cBTC as input');
        }
      }

      // Get timestamp
      const block = await rpcClient.getBlock({ blockNumber: receipt.blockNumber });
      const timestamp = new Date(Number(block.timestamp) * 1000).toISOString();

      // Validate campaign requirements
      const isValid =
        hasNativeInput && // Must use native token as input
        outputToken !== null && // Must have output token
        campaignTokens.includes(outputToken.toLowerCase()) && // Must be campaign token
        swapEvents.length > 0; // Must have swap events

      return {
        isValid,
        isSwap: swapEvents.length > 0,
        inputToken,
        outputToken,
        inputAmount,
        outputAmount,
        poolAddresses,
        swapType,
        timestamp,
        reason: isValid ? undefined : 'Swap does not meet campaign requirements',
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error: any) {
      console.error('Error validating swap:', error);
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
        reason: `Validation error: ${error.message}`
      };
    }
  }

  // Get task ID from output token
  getTaskIdFromToken(tokenAddress: string): number | null {
    const normalizedAddress = tokenAddress.toLowerCase();

    if (normalizedAddress === CITREA_TOKENS.NUSD.toLowerCase()) return 1;
    if (normalizedAddress === CITREA_TOKENS.cUSD.toLowerCase()) return 2;
    if (normalizedAddress === CITREA_TOKENS.USDC.toLowerCase()) return 3;

    return null;
  }

  // Quick validation for checking if a transaction might be a swap
  async quickCheck(txHash: string): Promise<{
    exists: boolean;
    successful: boolean;
    toRouter: boolean;
  }> {
    try {
      const receipt = await rpcClient.getTransactionReceipt(txHash as `0x${string}`);

      if (!receipt) {
        return { exists: false, successful: false, toRouter: false };
      }

      const transaction = await rpcClient.getTransaction(txHash as `0x${string}`);
      const toAddress = transaction?.to?.toLowerCase() || '';
      const validRouters = Object.values(JUICESWAP_ROUTERS).map(addr => addr.toLowerCase());

      return {
        exists: true,
        successful: receipt.status === 'success',
        toRouter: validRouters.includes(toAddress)
      };
    } catch {
      return { exists: false, successful: false, toRouter: false };
    }
  }
}

// Export singleton
export const swapValidator = new SwapValidator();