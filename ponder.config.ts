import { createConfig } from '@ponder/core';
import { mainnet, polygon } from 'viem/chains';
import { Address, http } from 'viem';
import { ADDRESS, EquityABI, EuroCoinABI } from '@deuro/eurocoin';

// mainnet (default) or polygon
export const chain = (process.env.PONDER_PROFILE as string) == 'polygon' ? polygon : mainnet;
export const Id = chain.id!;
export const ADDR = ADDRESS[chain.id]!;

export const CONFIG = {
	[mainnet.id]: {
		rpc: process.env.RPC_URL_MAINNET ?? mainnet.rpcUrls.default.http[0],
		startStablecoin: 18451518,
		blockrange: undefined,
		maxRequestsPerSecond: 5,
		pollingInterval: 5_000,
	},
	[polygon.id]: {
		rpc: process.env.RPC_URL_POLYGON ?? polygon.rpcUrls.default.http[0],
		startStablecoin: 64731388,
		blockrange: undefined,
		maxRequestsPerSecond: 5,
		pollingInterval: 5_000,
	},
};

export const config = CONFIG[Id];

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
		Eurocoin: {
			// Native
			network: chain.name,
			abi: EuroCoinABI,
			address: ADDR.eurocoin as Address,
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
	},
});
