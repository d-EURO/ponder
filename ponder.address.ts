import { Address, zeroAddress } from 'viem';
import { Chain, mainnet } from 'viem/chains';

export type AddressObject = { [chainId in Chain['id']]?: { [key: string]: Address } };

export const ethereum3 = {
	id: 1337,
	name: 'Ethereum3',
	nativeCurrency: { name: 'Ethereum3', symbol: 'ETH3', decimals: 18 },
	rpcUrls: {
		default: { http: ['https://ethereum3.3dotshub.com'] },
	},
	blockExplorers: {
		default: { name: 'Blockscout', url: '' },
	},
} as const satisfies Chain;

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
		frankenCoin: '0x7c0E7381D07e132747B425972a73F6045a26AB07',
		bridge: zeroAddress,
		xchf: zeroAddress,
		equity: '0x8fcfC3a671809D104d9c50cC67eA8C5d7cC658E8',
		mintingHub: '0x4800b6c288e4B2BBa7b2314328DB485F5FfB0414',
		wFPS: zeroAddress,
		// mockWbtc: '0x1b01c6b10ca8AeD4F1e0d39319aa27183BBC1578',
		// mockLseth: '0xd54Fb4EE40ca7F0FeF1cd87AC81dE3F247776209',
		// mockBoss: '0x7f6c45725F521e7B5b0e3357A8Ed4152c0BBd01E',
	},
};
