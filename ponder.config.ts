import { createConfig } from '@ponder/core';
import { http, parseAbiItem } from 'viem';

import { Equity } from './abis/Equity';
import { MintingHub } from './abis/MintingHub';
import { Frankencoin } from './abis/Frankencoin';
import { Position } from './abis/Position';

const transport = http('https://ethereum3.3dotshub.com');

const openPositionEvent = parseAbiItem(
	'event PositionOpened(address indexed owner,address indexed position,address zchf,address collateral,uint256 price)'
);

export default createConfig({
	networks: {
		ethereum3: {
			chainId: 1337,
			transport,
		},
	},
	contracts: {
		Frankencoin: {
			network: 'ethereum3',
			abi: Frankencoin,
			address: '0x4800b6c288e4B2BBa7b2314328DB485F5FfB0414',
			startBlock: 0,
		},
		Equity: {
			network: 'ethereum3',
			abi: Equity,
			address: '0xD47DE3328848cf8fd4079673cA40510536323e59',
			startBlock: 0,
		},
		MintingHub: {
			network: 'ethereum3',
			abi: MintingHub,
			address: '0x60614BE7fD2F92bf96caa61d434a4e04Af6228c3',
			startBlock: 1400,
		},
		Position: {
			network: 'ethereum3',
			abi: Position,
			factory: {
				address: '0x60614BE7fD2F92bf96caa61d434a4e04Af6228c3',
				event: openPositionEvent,
				parameter: 'position',
			},
			startBlock: 1400,
		},
	},
});
