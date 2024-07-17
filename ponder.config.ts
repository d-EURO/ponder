import { createConfig } from '@ponder/core';
import { Address, http, parseAbiItem } from 'viem';

import { Equity } from './abis/Equity';
import { MintingHub } from './abis/MintingHub';
import { Frankencoin } from './abis/Frankencoin';
import { Position } from './abis/Position';
import { ADDRESS } from './ponder.address';
import { mainnet, polygon } from 'viem/chains';
import { ethereum3 } from './ponder.chains';
import { exit } from 'process';

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
		maxRequestsPerSecond: 5,
		pollingInterval: 5_000,
	},
	[polygon.id]: {
		rpc: process.env.RPC_URL_POLYGON ?? polygon.rpcUrls.default.http[0],
		startBlockA: 58907600,
		startBlockB: 58907700,
		blockrange: undefined,
		maxRequestsPerSecond: 5,
		pollingInterval: 5_000,
	},
	[ethereum3.id]: {
		rpc: ethereum3.rpcUrls.default.http[0],
		startBlockA: 0,
		startBlockB: 80,
		blockrange: undefined,
		maxRequestsPerSecond: 5, // e.g. 5
		pollingInterval: 5_000, // e.g. 10_000
	},
};

const openPositionEvent = parseAbiItem(
	'event PositionOpened(address indexed owner,address indexed position,address zchf,address collateral,uint256 price)'
);

export default createConfig({
	networks: {
		[chain.name]: {
			chainId: chain.id,
			maxRequestsPerSecond: CONFIG[chain.id].maxRequestsPerSecond,
			pollingInterval: CONFIG[chain.id].pollingInterval,
			transport: http(CONFIG[chain!.id].rpc),
		},
	},
	contracts: {
		Frankencoin: {
			network: chain.name,
			abi: Frankencoin,
			address: ADDRESS[chain!.id]!.frankenCoin as Address,
			startBlock: CONFIG[chain!.id].startBlockA,
			maxBlockRange: CONFIG[chain!.id].blockrange,
		},
		Equity: {
			network: chain.name,
			abi: Equity,
			address: ADDRESS[chain!.id]!.equity as Address,
			startBlock: CONFIG[chain!.id].startBlockA,
			maxBlockRange: CONFIG[chain!.id].blockrange,
		},
		MintingHub: {
			network: chain.name,
			abi: MintingHub,
			address: ADDRESS[chain!.id]!.mintingHub as Address,
			startBlock: CONFIG[chain!.id].startBlockB,
			maxBlockRange: CONFIG[chain!.id].blockrange,
		},
		Position: {
			network: chain.name,
			abi: Position,
			factory: {
				address: ADDRESS[chain!.id]!.mintingHub as Address,
				event: openPositionEvent,
				parameter: 'position',
			},
			startBlock: CONFIG[chain!.id].startBlockB,
			maxBlockRange: CONFIG[chain!.id].blockrange,
		},
	},
});
