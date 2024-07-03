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
		// For testing purposes only
		frankenCoin: '0x9800f06718bB6F7FCAC181ED26753E2E670cb9e0',
		bridge: zeroAddress,
		xchf: zeroAddress,
		equity: '0x97e3bbF39138B1e7E1d06dd26E7E3b9d558b00b2',
		mintingHub: '0xA0d6ce30a8a4eab09eD74f434dcA4Ce4169aDd03',
		wFPS: zeroAddress,
	},
	[polygon.id]: {
		// For testing purposes only
		frankenCoin: '0xAFAA1F380957072762b80dc9036c451bcd6e774f',
		bridge: zeroAddress,
		xchf: zeroAddress,
		equity: '0x9f40894a2E47305DE4C79b53B48B7a57805065eA',
		mintingHub: '0xa3039043B2C5a74A39b139e389b7591Ab76d20d1',
		wFPS: zeroAddress,
		faucetCommunity: '0x9dD9C448A76fA0752eE7D61e211dFC4D646a0b96',
	},
};
