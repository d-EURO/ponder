// Chain configurations
export const CITREA_TESTNET = {
  chainId: 5115,
  name: 'Citrea Testnet',
  rpcUrl: 'https://rpc.testnet.citrea.xyz',
  explorerUrl: 'https://explorer.testnet.citrea.xyz',
  nativeCurrency: {
    name: 'cBTC',
    symbol: 'cBTC',
    decimals: 18
  }
};

// Token addresses on Citrea Testnet
export const CITREA_TOKENS = {
  NUSD: '0x9B28B690550522608890C3C7e63c0b4A7eBab9AA',
  cUSD: '0x2fFC18aC99D367b70dd922771dF8c2074af4aCE0',
  USDC: '0x36c16eaC6B0Ba6c50f494914ff015fCa95B7835F'
};

// JuiceSwap Router addresses on Citrea Testnet
export const JUICESWAP_ROUTERS = {
  SwapRouter02: '0x610c98EAD0df13EA906854b6041122e8A8D14413', // Primary V3 Router (most used)
  SwapRouter: '0xb2A4E33e9A9aC7c46045A2D0318a4F50194dafDE', // Alternative V3 Router
  SwapRouterAlt: '0x3012E9049d05B4B5369D690114D5A5861EbB85cb', // Alternative V3 Router
  UniswapV2Router02: '0xb45670f668EE53E62b5F170B5B1d3C6701C8d03A' // V2 Router for legacy swaps
};