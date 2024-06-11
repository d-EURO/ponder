import { createConfig } from '@ponder/core';
import { Address, http, parseAbiItem } from 'viem';

import { Equity } from './abis/Equity';
import { MintingHub } from './abis/MintingHub';
import { Frankencoin } from './abis/Frankencoin';
import { Position } from './abis/Position';
import { mainnet } from 'viem/chains';
import { ADDRESS, ethereum3 } from './ponder.address';

// TODO: >>>>> change chain here <<<<<
// mainnet or ethereum3 (custom chain: config in ./ponder.address.ts)
const chain = ethereum3;
const startBlockA = (chain.id as number) === 1 ? 18451518 : 0;
const startBlockB = (chain.id as number) === 1 ? 18451536 : 90;

const transport = http((chain.id as number) === 1 ? process.env.PONDER_RPC_URL_1 : ethereum3.rpcUrls.default.http[0]);
const openPositionEvent = parseAbiItem(
	'event PositionOpened(address indexed owner,address indexed position,address zchf,address collateral,uint256 price)'
);

export default createConfig({
	networks: {
		[chain.name]: {
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
		},
		Equity: {
			network: chain.name,
			abi: Equity,
			address: ADDRESS[chain!.id]!.equity as Address,
			startBlock: startBlockA,
		},
		MintingHub: {
			network: chain.name,
			abi: MintingHub,
			address: ADDRESS[chain!.id]!.mintingHub as Address,
			startBlock: startBlockB,
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
		},
	},
});
