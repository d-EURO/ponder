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

// JuiceSwap contract addresses (need to be verified on Citrea)
export const JUICESWAP_CONTRACTS = {
  V3_SWAP_ROUTER: '', // TODO: Get from Citrea deployment
  UNIVERSAL_ROUTER: '', // TODO: Get from Citrea deployment
  V3_FACTORY: '' // TODO: Get from Citrea deployment
};