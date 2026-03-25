import { createConfig, factory } from 'ponder';
import { mainnet, polygon } from 'viem/chains';
import { Address, http } from 'viem';
import { AbiEvent } from 'abitype';
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

const openPositionEventV2 = MintingHubV2ABI.find((a) => a.type === 'event' && a.name === 'PositionOpened') as AbiEvent;
if (!openPositionEventV2) throw new Error('openPositionEventV2 not found.');

export default createConfig({
	chains: {
		[chain.name]: {
			id: Id,
			rpc: http(config.rpc),
			pollingInterval: config.pollingInterval,
		},
	},
	contracts: {
		Stablecoin: {
			// Native
			chain: chain.name,
			abi: DecentralizedEUROABI,
			address: ADDR.decentralizedEURO as Address,
			startBlock: config.startStablecoin,
		},
		Equity: {
			// Native
			chain: chain.name,
			abi: EquityABI,
			address: ADDR.equity as Address,
			startBlock: config.startStablecoin,
		},
		MintingHubV2: {
			// V2
			chain: chain.name,
			abi: MintingHubV2ABI,
			address: ADDR.mintingHubGateway as Address,
			startBlock: config.startMintingHubV2,
		},
		PositionV2: {
			// V2
			chain: chain.name,
			abi: PositionV2ABI,
			address: factory({
				address: ADDR.mintingHubGateway as Address,
				event: openPositionEventV2,
				parameter: 'position',
			}),
			startBlock: config.startMintingHubV2,
		},
		Savings: {
			// V2
			chain: chain.name,
			abi: SavingsABI,
			address: ADDR.savingsGateway as Address,
			startBlock: config.startMintingHubV2,
		},
		Roller: {
			// V2
			chain: chain.name,
			abi: PositionRollerABI,
			address: ADDR.roller as Address,
			startBlock: config.startMintingHubV2,
		},
		FrontendGateway: {
			chain: chain.name,
			abi: FrontendGatewayABI,
			address: ADDR.frontendGateway as Address,
			startBlock: config.startMintingHubV2,
		},
	},
});
