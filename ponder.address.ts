import { Address, zeroAddress } from 'viem';
import { Chain, mainnet, polygon } from 'viem/chains';
import { ethereum3 } from './ponder.chains';

export type AddressObject = { [chainId in Chain['id']]?: { [key: string]: Address } };

export const ADDRESS: AddressObject = {
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
	[polygon.id]: {
		// For testing purposes only
		frankenCoin: '0x3EC9BCe8b7E8e1F17c4BeB9e18C75622920995c7',
		bridge: zeroAddress,
		xchf: zeroAddress,
		equity: '0xa51ABAb13EEB61b839303dE72E1Ab8dFCc55e9F2',
		mintingHub: '0x492929dd8eb0B4D0070BAC909b83aF519496e12f',
		wFPS: zeroAddress,
	},
};
