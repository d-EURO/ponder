# Frankencoin Ponder

## Deployment of service

-   Main branch should auto. deploy to: **ponder.frankencoin.com**
-   Developer Mainnet deploy to: **ponder.frankencoin.org**
-   Developer Testnet deploy to: **ponder.testnet.frankencoin.org**

## Ponder needs .env.local

check out ".env.local" file to adjust environment.
For SQLite, REMOVE THE DATABASE_URL LINE.

```
# Select Profile/Chain
PONDER_PROFILE=polygon

# Mainnet RPC URL used for fetching blockchain data. Alchemy is recommended.
PONDER_RPC_URL_MAINNET=https://eth-mainnet.g.alchemy.com/v2/...
PONDER_RPC_URL_POLYGON=... # For testing purposes only

# (Optional) Postgres database URL. If not provided, SQLite will be used.
DATABASE_URL=
```

## Ponder config

You can adjust the default chain and chain specific parameters in "ponder.config.ts".

```
// (add custom chain in ./ponder.address.ts)
// mainnet (default), ethereum3, polygon
const chain =
	(process.env.PONDER_PROFILE as string) == 'polygon'
		? polygon
		: (process.env.PONDER_PROFILE as string) == 'ethereum3'
		? ethereum3
		: mainnet;

const CONFIG = {
	[mainnet.id]: {
		rpc: process.env.RPC_URL_MAINNET ?? mainnet.rpcUrls.default.http[0],
		startBlockA: 18451518,
		startBlockB: 18451536,
		blockrange: undefined,
		maxRequestsPerSecond: undefined,
		pollingInterval: undefined,
	},
```

## Add / Adjust custom chain(s)

Edit and add your custom chain: "ponder.chains.ts"

Example:

```
export const ethereum3 = {
	id: 1337,
	name: 'Ethereum3',
	nativeCurrency: { name: 'Ethereum3', symbol: 'ETH3', decimals: 18 },
	rpcUrls: {
		default: { http: ['https://ethereum3.3dotshub.com'] },
	},
	blockExplorers: {
		default: { name: 'Blockscout', url: 'https://blockscout3.3dotshub.com' },
	},
} as const satisfies Chain;
```

## Add / Adjust Contract Addresses

Make sure to add your custom chain first, then edit and add your custom contract addresses: "ponder.contracts.ts"

Example:

```
[mainnet.id]: {
    frankenCoin: '0xB58E61C3098d85632Df34EecfB899A1Ed80921cB',
    bridge: '0x7bbe8F18040aF0032f4C2435E7a76db6F1E346DF',
    xchf: '0xb4272071ecadd69d933adcd19ca99fe80664fc08',
    equity: '0x1bA26788dfDe592fec8bcB0Eaff472a42BE341B2',
    mintingHub: '0x7546762fdb1a6d9146b33960545C3f6394265219',
    wFPS: '0x5052D3Cc819f53116641e89b96Ff4cD1EE80B182',
},
[ethereum3.id]: {
    frankenCoin: '0x9800f06718bB6F7FCAC181ED26753E2E670cb9e0',
    bridge: zeroAddress,
    xchf: zeroAddress,
    equity: '0x97e3bbF39138B1e7E1d06dd26E7E3b9d558b00b2',
    mintingHub: '0xA0d6ce30a8a4eab09eD74f434dcA4Ce4169aDd03',
    wFPS: zeroAddress,
    // mockWbtc: '0x1b01c6b10ca8AeD4F1e0d39319aa27183BBC1578',
    // mockLseth: '0xd54Fb4EE40ca7F0FeF1cd87AC81dE3F247776209',
    // mockBoss: '0x7f6c45725F521e7B5b0e3357A8Ed4152c0BBd01E',
},
```
