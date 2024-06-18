import { createConfig } from '@ponder/core';
import { Address, http, parseAbiItem } from 'viem';

import { Equity } from './abis/Equity';
import { MintingHub } from './abis/MintingHub';
import { Frankencoin } from './abis/Frankencoin';
import { Position } from './abis/Position';
import { ADDRESS } from './ponder.address';
import { mainnet } from 'viem/chains';
import { ethereum3 } from './ponder.chains';

// TODO: >>>>> change chain here <<<<<
// (add custom chain in ./ponder.address.ts)
// mainnet or ethereum3
const chain = mainnet;
const blockRange = undefined; // undefined, ignores block range
const startBlockA = (chain.id as number) === 1 ? 18451518 : 0;
const startBlockB = (chain.id as number) === 1 ? 18451536 : 30;

const transport = http((chain.id as number) === 1 ? process.env.PONDER_RPC_URL_1 : chain.rpcUrls.default.http[0]);
const openPositionEvent = parseAbiItem(
	'event PositionOpened(address indexed owner,address indexed position,address zchf,address collateral,uint256 price)'
);

export default createConfig({
	networks: {
		[chain.name]: {
			// TODO: Adjust if you have issues with free api key or fetch restrictions
			// maxRequestsPerSecond: 5,
			// pollingInterval: 10_000,
			chainId: chain.id,
			transport,
		},
	},
	contracts: {
		Frankencoin: {
			network: chain.name,
			abi: Frankencoin,
			address: ADDRESS[chain!.id]!.frankenCoin as Address,
			startBlock: startBlockA,
			maxBlockRange: blockRange,
		},
		Equity: {
			network: chain.name,
			abi: Equity,
			address: ADDRESS[chain!.id]!.equity as Address,
			startBlock: startBlockA,
			maxBlockRange: blockRange,
		},
		MintingHub: {
			network: chain.name,
			abi: MintingHub,
			address: ADDRESS[chain!.id]!.mintingHub as Address,
			startBlock: startBlockB,
			maxBlockRange: blockRange,
		},
		Position: {
			network: chain.name,
			abi: Position,
			factory: {
				address: ADDRESS[chain!.id]!.mintingHub as Address,
				event: openPositionEvent,
				parameter: 'position',
			},
			startBlock: startBlockB,
			maxBlockRange: blockRange,
		},
	},
});
