import { ponder } from '@/generated';
import { Address, zeroAddress, decodeEventLog } from 'viem';
import { ADDR } from '../ponder.config';
import { MintingHubGatewayABI } from '@deuro/eurocoin';

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
		PositionV2,
		PositionMint,
	} = context.db;

	await StablecoinTransferHistory.create({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
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
		await Mint.create({
			id: `${event.transaction.hash}-${event.log.logIndex}`,
			data: {
				to: event.args.to,
				value: event.args.value,
				blockheight: event.block.number,
				timestamp: event.block.timestamp,
				txHash: event.transaction.hash,
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

		// Capture mints from position creation
		if (event.transaction.to?.toLowerCase() === ADDR.mintingHubGateway.toLowerCase()) {
			const receipt = await context.client.request({
				method: 'eth_getTransactionReceipt',
				params: [event.transaction.hash],
			});

			const positionOpenedEvent = receipt?.logs
				.filter((log) => log.address.toLowerCase() === ADDR.mintingHubGateway.toLowerCase())
				.map(({ data, topics }) =>
					decodeEventLog({
						abi: MintingHubGatewayABI,
						data: data as `0x${string}`,
						topics: topics as [`0x${string}`, ...`0x${string}`[]],
					})
				)
				.find((event) => event.eventName === 'PositionOpened');

			await PositionMint.upsert({
				id: event.transaction.hash.toLowerCase(),
				create: {
					to: event.args.to,
					positionAddress: positionOpenedEvent?.args.position.toLowerCase() as `0x${string}`,
					value: event.args.value,
					timestamp: event.block.timestamp,
					blockheight: event.block.number,
					txHash: event.transaction.hash,
				},
				update: ({ current }) => ({
					to: event.args.to.toLowerCase() !== ADDR.equity.toLowerCase() ? event.args.to : current.to,
					value: current.value + event.args.value,
				}),
			});
		}

		// Capture mints from existing positions
		const openPosition = event.transaction.to ? await PositionV2.findUnique({ id: event.transaction.to.toLowerCase() }) : null;
		if (openPosition) {
			await PositionMint.upsert({
				id: event.transaction.hash.toLowerCase(),
				create: {
					to: event.args.to,
					positionAddress: openPosition.id,
					value: event.args.value,
					timestamp: event.block.timestamp,
					blockheight: event.block.number,
					txHash: event.transaction.hash,
				},
				update: ({ current }) => ({
					to: event.args.to.toLowerCase() !== ADDR.equity.toLowerCase() ? event.args.to : current.to,
					value: current.value + event.args.value,
				}),
			});
		}
	}

	// emit Transfer(account, address(0), amount);
	if (event.args.to === zeroAddress) {
		await Burn.create({
			id: `${event.transaction.hash}-${event.log.logIndex}`,
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

	const stablecoinToBridge = {
		[ADDR.eurc.toLowerCase()]: ADDR.bridgeEURC.toLowerCase(),
		[ADDR.eurs.toLowerCase()]: ADDR.bridgeEURS.toLowerCase(),
		[ADDR.veur.toLowerCase()]: ADDR.bridgeVEUR.toLowerCase(),
		[ADDR.eurr.toLowerCase()]: ADDR.bridgeEURR.toLowerCase(),
		[ADDR.europ.toLowerCase()]: ADDR.bridgeEUROP.toLowerCase(),
		[ADDR.euri.toLowerCase()]: ADDR.bridgeEURI.toLowerCase(),
		[ADDR.eure.toLowerCase()]: ADDR.bridgeEURE.toLowerCase(),
	};

	const bridgeAddressToTable = {
		[ADDR.bridgeEURC.toLowerCase()]: BridgeEURC,
		[ADDR.bridgeEURS.toLowerCase()]: BridgeEURS,
		[ADDR.bridgeVEUR.toLowerCase()]: BridgeVEUR,
		[ADDR.bridgeEURR.toLowerCase()]: BridgeEURR,
		[ADDR.bridgeEUROP.toLowerCase()]: BridgeEUROP,
		[ADDR.bridgeEURI.toLowerCase()]: BridgeEURI,
		[ADDR.bridgeEURE.toLowerCase()]: BridgeEURE,
	};

	const bridgeData = {
		swapper: event.transaction.from,
		txHash: event.transaction.hash,
		amount: event.args.value,
		isMint: event.args.from === zeroAddress,
		timestamp: event.block.timestamp,
	};

	// Capture direct bridge transactions
	const bridgeTable = bridgeAddressToTable[event.transaction.to?.toLowerCase() as keyof typeof bridgeAddressToTable];
	if (bridgeTable) {
		await bridgeTable.create({
			id: `${event.transaction.hash}-${event.log.logIndex}`,
			data: bridgeData,
		});
	}

	const ecosystemContract = Object.values(ADDR).map((address) => address.toLowerCase());
	const externalInteraction = event.transaction.to && !ecosystemContract.includes(event.transaction.to.toLowerCase());
	const isMintingOrBurning = event.args.from === zeroAddress || event.args.to === zeroAddress;
	const isKnownPosition = event.transaction.to ? await PositionV2.findUnique({ id: event.transaction.to.toLowerCase() }) : false;

	// Capture swaps initiated from external protocols
	if (externalInteraction && isMintingOrBurning && !isKnownPosition) {
		const receipt = await context.client.request({
			method: 'eth_getTransactionReceipt',
			params: [event.transaction.hash],
		});

		const logIndex = event.log.id.split('-')[1];
		const deuroLogIndex = receipt?.logs.findIndex((log) => log.logIndex == logIndex);
		const previousLog = deuroLogIndex ? receipt?.logs[deuroLogIndex - 1] : undefined;
		const nextLog = deuroLogIndex ? receipt?.logs[deuroLogIndex + 1] : undefined;
		const potencialBrigeLog = bridgeData.isMint ? previousLog : nextLog;
		const bridgeAddress =
			potencialBrigeLog && stablecoinToBridge[potencialBrigeLog.address.toLowerCase() as keyof typeof stablecoinToBridge];

		if (bridgeAddress) {
			await bridgeAddressToTable[bridgeAddress]?.create({
				id: `${event.transaction.hash}-${event.log.logIndex}`,
				data: bridgeData,
			});
		}
	}
});
