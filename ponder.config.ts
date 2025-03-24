import { createConfig } from '@ponder/core';
import { mainnet, polygon } from 'viem/chains';
import { Address, http } from 'viem';
import {
	ADDRESS,
	EquityABI,
	DecentralizedEUROABI,
	MintingHubV2ABI,
	PositionRollerABI,
	PositionV2ABI,
	SavingsABI,
	FrontendGatewayABI,
} from '@deuro/eurocoin';

// mainnet (default) or polygon
export const chain = (process.env.PONDER_PROFILE as string) == 'polygon' ? polygon : mainnet;
export const Id = chain.id!;
export const ADDR = ADDRESS[chain.id]!;

export const CONFIG = {
	[mainnet.id]: {
		rpc: process.env.RPC_URL_MAINNET ?? mainnet.rpcUrls.default.http[0],
		startStablecoin: 21932747,
		startMintingHubV2: 21932747,
		blockrange: undefined,
		maxRequestsPerSecond: 5,
		pollingInterval: 5_000,
	},
	[polygon.id]: {
		rpc: process.env.RPC_URL_POLYGON ?? polygon.rpcUrls.default.http[0],
		startStablecoin: 64985436,
		startMintingHubV2: 64985436,
		blockrange: undefined,
		maxRequestsPerSecond: 5,
		pollingInterval: 5_000,
	},
};

export const config = CONFIG[Id];

const openPositionEventV2 = MintingHubV2ABI.find((a) => a.type === 'event' && a.name === 'PositionOpened');
if (openPositionEventV2 === undefined) throw new Error('openPositionEventV2 not found.');

export default createConfig({
	networks: {
		[chain.name]: {
			chainId: Id,
			maxRequestsPerSecond: config.maxRequestsPerSecond,
			pollingInterval: config.pollingInterval,
			transport: http(config.rpc),
		},
	},
	contracts: {
		Stablecoin: {
			// Native
			network: chain.name,
			abi: DecentralizedEUROABI,
			address: ADDR.decentralizedEURO as Address,
			startBlock: config.startStablecoin,
			maxBlockRange: config.blockrange,
		},
		Equity: {
			// Native
			network: chain.name,
			abi: EquityABI,
			address: ADDR.equity as Address,
			startBlock: config.startStablecoin,
			maxBlockRange: config.blockrange,
		},
		MintingHubV2: {
			// V2
			network: chain.name,
			abi: MintingHubV2ABI,
			address: ADDR.mintingHubGateway as Address,
			startBlock: config.startMintingHubV2,
			maxBlockRange: config.blockrange,
		},
		PositionV2: {
			// V2
			network: chain.name,
			abi: PositionV2ABI,
			factory: {
				address: ADDR.mintingHubGateway as Address,
				event: openPositionEventV2,
				parameter: 'position',
			},
			startBlock: config.startMintingHubV2,
			maxBlockRange: config.blockrange,
		},
		Savings: {
			// V2
			network: chain.name,
			abi: SavingsABI,
			address: ADDR.savingsGateway as Address,
			startBlock: config.startMintingHubV2,
			maxBlockRange: config.blockrange,
		},
		Roller: {
			// V2
			network: chain.name,
			abi: PositionRollerABI,
			address: ADDR.roller as Address,
			startBlock: config.startMintingHubV2,
			maxBlockRange: config.blockrange,
		},
		FrontendGateway: {
			network: chain.name,
			abi: FrontendGatewayABI,
			address: ADDR.frontendGateway as Address,
			startBlock: config.startMintingHubV2,
			maxBlockRange: config.blockrange,
		},
	},
});
