import { createConfig, factory } from 'ponder';
import { mainnet, polygon } from 'viem/chains';
import { Address, zeroAddress, http } from 'viem';
import { AbiEvent } from 'abitype';
import {
	ADDRESS,
	EquityABI,
	DecentralizedEUROABI,
	MintingHubV3ABI,
	PositionRollerV2ABI,
	PositionV2ABI,
	SavingsV2ABI,
	SavingsV3ABI,
	SavingsVaultDEUROABI,
	FrontendGatewayV2ABI,
} from '@deuro/eurocoin';

// mainnet (default) or polygon
export const chain = (process.env.PONDER_PROFILE as string) == 'polygon' ? polygon : mainnet;
export const Id = chain.id!;
export const ADDR = ADDRESS[chain.id]!;

export const CONFIG = {
	[mainnet.id]: {
		rpc: process.env.RPC_URL_MAINNET ?? mainnet.rpcUrls.default.http[0],
		startStablecoin: 22088283,
		startMintingHubV2: 22088283,
		maxRequestsPerSecond: 50,
		pollingInterval: 5_000,
	},
	[polygon.id]: {
		rpc: process.env.RPC_URL_POLYGON ?? polygon.rpcUrls.default.http[0],
		startStablecoin: 64985436,
		startMintingHubV2: 64985436,
		maxRequestsPerSecond: 50,
		pollingInterval: 5_000,
	},
};

export const config = CONFIG[Id];

// V3 contracts deployed at this block on mainnet
export const V3_START_BLOCK = 24721024;

const isDeployed = (addr: string | undefined): addr is Address => !!addr && addr !== zeroAddress;

// Use V3 ABI (superset) to extract the PositionOpened event
const openPositionEvent = MintingHubV3ABI.find((a) => a.type === 'event' && a.name === 'PositionOpened') as AbiEvent;
if (!openPositionEvent) throw new Error('openPositionEvent not found.');

// MintingHub addresses (V2 + V3) for use in handlers
export const MINTING_HUB_ADDRESSES = new Set(
	[ADDR.mintingHubGateway, ADDR.mintingHub].filter(isDeployed).map((a) => a.toLowerCase())
);

export default createConfig({
	chains: {
		[chain.name]: {
			id: Id,
			rpc: http(config.rpc),
			maxRequestsPerSecond: config.maxRequestsPerSecond,
			pollingInterval: config.pollingInterval,
		},
	},
	contracts: {
		Stablecoin: {
			chain: chain.name,
			abi: DecentralizedEUROABI,
			address: ADDR.decentralizedEURO as Address,
			startBlock: config.startStablecoin,
		},
		Equity: {
			chain: chain.name,
			abi: EquityABI,
			address: ADDR.equity as Address,
			startBlock: config.startStablecoin,
		},
		MintingHub: {
			// V2 + V3 (V3 ABI is superset — includes RateProposed/RateChanged from Leadrate)
			chain: chain.name,
			abi: MintingHubV3ABI,
			address: [ADDR.mintingHubGateway, ADDR.mintingHub].filter(isDeployed),
			startBlock: config.startMintingHubV2,
		},
		Position: {
			// Positions from V2 + V3 MintingHub factories
			chain: chain.name,
			abi: PositionV2ABI,
			address: factory({
				address: [ADDR.mintingHubGateway, ADDR.mintingHub].filter(isDeployed),
				event: openPositionEvent,
				parameter: 'position',
			}),
			startBlock: config.startMintingHubV2,
		},
		SavingsV2: {
			chain: chain.name,
			abi: SavingsV2ABI,
			address: ADDR.savingsGateway as Address,
			startBlock: config.startMintingHubV2,
		},
		SavingsV3: {
			chain: chain.name,
			abi: SavingsV3ABI,
			address: ADDR.savings as Address,
			startBlock: V3_START_BLOCK,
		},
		SavingsVaultDEURO: {
			// V2 + V3 (identical event signatures)
			chain: chain.name,
			abi: SavingsVaultDEUROABI,
			address: [ADDR.savingsVaultV2, ADDR.savingsVaultV3].filter(isDeployed),
			startBlock: config.startMintingHubV2,
		},
		Roller: {
			// V2 + V3 (identical Roll event)
			chain: chain.name,
			abi: PositionRollerV2ABI,
			address: [ADDR.rollerV2, ADDR.rollerV3].filter(isDeployed),
			startBlock: config.startMintingHubV2,
		},
		FrontendGateway: {
			chain: chain.name,
			abi: FrontendGatewayV2ABI,
			address: ADDR.frontendGateway as Address,
			startBlock: config.startMintingHubV2,
		},
	},
});
