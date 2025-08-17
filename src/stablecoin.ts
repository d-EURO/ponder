import { ponder } from '@/generated';
import { Address, zeroAddress } from 'viem';
import { ADDR, config } from '../ponder.config';
import { getRandomHex } from './utils/randomString';

ponder.on('Stablecoin:Profit', async ({ event, context }) => {
	const { DEPS, ActiveUser, Ecosystem } = context.db;

	await Ecosystem.upsert({
		id: 'Equity:ProfitCounter',
		create: {
			value: '',
			amount: 1n,
		},
		update: ({ current }) => ({
			amount: current.amount + 1n,
		}),
	});

	await DEPS.upsert({
		id: ADDR.decentralizedEURO,
		create: {
			profits: event.args.amount,
			loss: 0n,
			reserve: 0n,
		},
		update: ({ current }) => ({
			profits: current.profits + event.args.amount,
		}),
	});

	await ActiveUser.upsert({
		id: event.transaction.from,
		create: {
			lastActiveTime: event.block.timestamp,
		},
		update: () => ({
			lastActiveTime: event.block.timestamp,
		}),
	});
});

ponder.on('Stablecoin:Loss', async ({ event, context }) => {
	const { DEPS, ActiveUser, Ecosystem } = context.db;

	await Ecosystem.upsert({
		id: 'Equity:LossCounter',
		create: {
			value: '',
			amount: 1n,
		},
		update: ({ current }) => ({
			amount: current.amount + 1n,
		}),
	});

	await DEPS.upsert({
		id: ADDR.decentralizedEURO,
		create: {
			profits: 0n,
			loss: event.args.amount,
			reserve: 0n,
		},
		update: ({ current }) => ({
			loss: current.loss + event.args.amount,
		}),
	});

	await ActiveUser.upsert({
		id: event.transaction.from,
		create: {
			lastActiveTime: event.block.timestamp,
		},
		update: () => ({
			lastActiveTime: event.block.timestamp,
		}),
	});
});

ponder.on('Stablecoin:MinterApplied', async ({ event, context }) => {
	const { Minter, ActiveUser, Ecosystem } = context.db;

	await Ecosystem.upsert({
		id: 'Stablecoin:MinterAppliedCounter',
		create: {
			value: '',
			amount: 1n,
		},
		update: ({ current }) => ({
			amount: current.amount + 1n,
		}),
	});

	await Minter.upsert({
		id: event.args.minter,
		create: {
			txHash: event.transaction.hash,
			minter: event.args.minter,
			applicationPeriod: event.args.applicationPeriod,
			applicationFee: event.args.applicationFee,
			applyMessage: event.args.message,
			applyDate: event.block.timestamp,
			suggestor: event.transaction.from,
		},
		update: ({ current }) => ({
			txHash: event.transaction.hash,
			minter: event.args.minter,
			applicationPeriod: event.args.applicationPeriod,
			applicationFee: event.args.applicationFee,
			applyMessage: event.args.message,
			applyDate: event.block.timestamp,
			suggestor: event.transaction.from,
			denyDate: undefined,
			denyMessage: undefined,
			denyTxHash: undefined,
			vetor: undefined,
		}),
	});

	await ActiveUser.upsert({
		id: event.transaction.from,
		create: {
			lastActiveTime: event.block.timestamp,
		},
		update: () => ({
			lastActiveTime: event.block.timestamp,
		}),
	});
});

ponder.on('Stablecoin:MinterDenied', async ({ event, context }) => {
	const { Minter, ActiveUser, Ecosystem } = context.db;

	await Ecosystem.upsert({
		id: 'Stablecoin:MinterDeniedCounter',
		create: {
			value: '',
			amount: 1n,
		},
		update: ({ current }) => ({
			amount: current.amount + 1n,
		}),
	});

	await Minter.update({
		id: event.args.minter,
		data: {
			denyMessage: event.args.message,
			denyDate: event.block.timestamp,
			denyTxHash: event.transaction.hash,
			vetor: event.transaction.from,
		},
	});

	await ActiveUser.upsert({
		id: event.transaction.from,
		create: {
			lastActiveTime: event.block.timestamp,
		},
		update: () => ({
			lastActiveTime: event.block.timestamp,
		}),
	});
});

ponder.on('Stablecoin:Transfer', async ({ event, context }) => {
	const {
		Mint,
		Burn,
		MintBurnAddressMapper,
		ActiveUser,
		Ecosystem,
		BridgeEURC,
		BridgeEURS,
		BridgeVEUR,
		BridgeEURR,
		BridgeEUROP,
		BridgeEURI,
		BridgeEURE,
		StablecoinTransferHistory,
	} = context.db;

	await StablecoinTransferHistory.create({
		id: `${event.transaction.from}-${event.transaction.to}-${getRandomHex()}`,
		data: {
			from: event.args.from,
			to: event.args.to,
			amount: event.args.value,
			timestamp: event.block.timestamp,
			blockheight: event.block.number,
			txHash: event.transaction.hash,
			transactionTo: event.transaction.to ?? undefined,
		},
	});

	await Ecosystem.upsert({
		id: 'Stablecoin:TransferCounter',
		create: {
			value: '',
			amount: 1n,
		},
		update: ({ current }) => ({
			amount: current.amount + 1n,
		}),
	});

	// emit Transfer(address(0), recipient, amount);
	if (event.args.from === zeroAddress) {
		// Determine mint type based on the transaction destination
		let mintType = 'other';
		const txTo = event.transaction.to?.toLowerCase();
		
		// Check if it's a direct mint from MintingHub
		if (txTo && ADDR.mintingHubGateway && txTo === ADDR.mintingHubGateway.toLowerCase()) {
			mintType = 'direct';
		}
		// Check if it's a CoW Protocol mint
		else if (txTo && config.cowProtocolAddress && txTo === config.cowProtocolAddress.toLowerCase()) {
			mintType = 'cow';
		}
		// Check if it's a bridge mint
		else if (txTo && (
			(ADDR.bridgeEURC && txTo === ADDR.bridgeEURC.toLowerCase()) ||
			(ADDR.bridgeEURS && txTo === ADDR.bridgeEURS.toLowerCase()) ||
			(ADDR.bridgeVEUR && txTo === ADDR.bridgeVEUR.toLowerCase()) ||
			(ADDR.bridgeEURR && txTo === ADDR.bridgeEURR.toLowerCase()) ||
			(ADDR.bridgeEUROP && txTo === ADDR.bridgeEUROP.toLowerCase()) ||
			(ADDR.bridgeEURI && txTo === ADDR.bridgeEURI.toLowerCase()) ||
			(ADDR.bridgeEURE && txTo === ADDR.bridgeEURE.toLowerCase())
		)) {
			mintType = 'bridge';
		}

		await Mint.create({
			id: `${event.args.to}-mint-${event.transaction.hash}-${event.log.logIndex}-${getRandomHex()}`,
			data: {
				to: event.args.to,
				value: event.args.value,
				blockheight: event.block.number,
				timestamp: event.block.timestamp,
				txHash: event.transaction.hash,
				// Extended fields for better tracking
				source: event.transaction.to || undefined,
				initiator: event.transaction.from,
				logIndex: event.log.logIndex !== undefined ? Number(event.log.logIndex) : undefined,
				mintType: mintType,
			},
		});

		await Ecosystem.upsert({
			id: 'Stablecoin:MintCounter',
			create: {
				value: '',
				amount: 1n,
			},
			update: ({ current }) => ({
				amount: current.amount + 1n,
			}),
		});

		await Ecosystem.upsert({
			id: 'Stablecoin:Mint',
			create: {
				value: '',
				amount: event.args.value,
			},
			update: ({ current }) => ({
				amount: current.amount + event.args.value,
			}),
		});

		await MintBurnAddressMapper.upsert({
			id: event.args.to.toLowerCase(),
			create: {
				mint: event.args.value,
				burn: 0n,
			},
			update: ({ current }) => ({
				mint: current.mint + event.args.value,
			}),
		});

		await ActiveUser.upsert({
			id: event.transaction.to as Address,
			create: {
				lastActiveTime: event.block.timestamp,
			},
			update: () => ({
				lastActiveTime: event.block.timestamp,
			}),
		});
	}

	// emit Transfer(account, address(0), amount);
	if (event.args.to === zeroAddress) {
		await Burn.create({
			id: `${event.args.from}-burn-${event.transaction.hash}-${event.log.logIndex}-${getRandomHex()}`,
			data: {
				from: event.args.from,
				value: event.args.value,
				blockheight: event.block.number,
				timestamp: event.block.timestamp,
				txHash: event.transaction.hash,
			},
		});

		await Ecosystem.upsert({
			id: 'Stablecoin:BurnCounter',
			create: {
				value: '',
				amount: 1n,
			},
			update: ({ current }) => ({
				amount: current.amount + 1n,
			}),
		});

		await Ecosystem.upsert({
			id: 'Stablecoin:Burn',
			create: {
				value: '',
				amount: event.args.value,
			},
			update: ({ current }) => ({
				amount: current.amount + event.args.value,
			}),
		});

		await MintBurnAddressMapper.upsert({
			id: event.args.from.toLowerCase(),
			create: {
				mint: 0n,
				burn: event.args.value,
			},
			update: ({ current }) => ({
				burn: current.burn + event.args.value,
			}),
		});

		await ActiveUser.upsert({
			id: event.transaction.from,
			create: {
				lastActiveTime: event.block.timestamp,
			},
			update: () => ({
				lastActiveTime: event.block.timestamp,
			}),
		});
	}

	// Capture bridge transactions
	const bridgeData = {
		swapper: event.transaction.from,
		txHash: event.transaction.hash,
		amount: event.args.value,
		isMint: event.args.from === zeroAddress,
		timestamp: event.block.timestamp,
	};

	switch (event.transaction.to?.toLowerCase()) {
		case ADDR.bridgeEURC.toLowerCase():
			await BridgeEURC.create({
				id: `${event.transaction.hash}-${event.log.logIndex}-${getRandomHex()}`,
				data: bridgeData,
			});
			break;
		case ADDR.bridgeEURS.toLowerCase():
			await BridgeEURS.create({
				id: `${event.transaction.hash}-${event.log.logIndex}-${getRandomHex()}`,
				data: bridgeData,
			});
			break;
		case ADDR.bridgeVEUR.toLowerCase():
			await BridgeVEUR.create({
				id: `${event.transaction.hash}-${event.log.logIndex}-${getRandomHex()}`,
				data: bridgeData,
			});
			break;
		case ADDR.bridgeEURR.toLowerCase():
			await BridgeEURR.create({
				id: `${event.transaction.hash}-${event.log.logIndex}-${getRandomHex()}`,
				data: bridgeData,
			});
			break;
		case ADDR.bridgeEUROP.toLowerCase():
			await BridgeEUROP.create({
				id: `${event.transaction.hash}-${event.log.logIndex}-${getRandomHex()}`,
				data: bridgeData,
			});
			break;
		case ADDR.bridgeEURI.toLowerCase():
			await BridgeEURI.create({
				id: `${event.transaction.hash}-${event.log.logIndex}-${getRandomHex()}`,
				data: bridgeData,
			});
			break;
		case ADDR.bridgeEURE.toLowerCase():
			await BridgeEURE.create({
				id: `${event.transaction.hash}-${event.log.logIndex}-${getRandomHex()}`,
				data: bridgeData,
			});
			break;
		default:
			// no action
			break;
	}
});
