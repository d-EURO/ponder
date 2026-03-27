import { ponder } from 'ponder:registry';
import { Address, getAddress, zeroAddress, decodeEventLog } from 'viem';
import { ADDR } from '../ponder.config';
import { MintingHubGatewayABI } from '@deuro/eurocoin';
import {
	deps,
	activeUser,
	ecosystem,
	minter,
	mint,
	burn,
	mintBurnAddressMapper,
	stablecoinTransferHistory,
	positionV2,
	positionMint,
	bridgeEURC,
	bridgeEURS,
	bridgeVEUR,
	bridgeEURR,
	bridgeEUROP,
	bridgeEURI,
	bridgeEURE,
} from '../ponder.schema';

ponder.on('Stablecoin:Profit', async ({ event, context }) => {
	const { db } = context;

	await db
		.insert(ecosystem)
		.values({ id: 'Equity:ProfitCounter', value: '', amount: 1n })
		.onConflictDoUpdate((row) => ({ amount: row.amount + 1n }));

	await db
		.insert(deps)
		.values({ id: ADDR.decentralizedEURO, profits: event.args.amount, loss: 0n, reserve: 0n })
		.onConflictDoUpdate((row) => ({ profits: row.profits + event.args.amount }));

	await db
		.insert(activeUser)
		.values({ id: getAddress(event.transaction.from), lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
});

ponder.on('Stablecoin:Loss', async ({ event, context }) => {
	const { db } = context;

	await db
		.insert(ecosystem)
		.values({ id: 'Equity:LossCounter', value: '', amount: 1n })
		.onConflictDoUpdate((row) => ({ amount: row.amount + 1n }));

	await db
		.insert(deps)
		.values({ id: ADDR.decentralizedEURO, profits: 0n, loss: event.args.amount, reserve: 0n })
		.onConflictDoUpdate((row) => ({ loss: row.loss + event.args.amount }));

	await db
		.insert(activeUser)
		.values({ id: getAddress(event.transaction.from), lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
});

ponder.on('Stablecoin:MinterApplied', async ({ event, context }) => {
	const { db } = context;

	await db
		.insert(ecosystem)
		.values({ id: 'Stablecoin:MinterAppliedCounter', value: '', amount: 1n })
		.onConflictDoUpdate((row) => ({ amount: row.amount + 1n }));

	const minterAddr = getAddress(event.args.minter);
	const suggestorAddr = getAddress(event.transaction.from);
	await db
		.insert(minter)
		.values({
			id: minterAddr,
			txHash: event.transaction.hash,
			minter: minterAddr,
			applicationPeriod: event.args.applicationPeriod,
			applicationFee: event.args.applicationFee,
			applyMessage: event.args.message,
			applyDate: event.block.timestamp,
			suggestor: suggestorAddr,
			denyDate: null,
			denyMessage: null,
			denyTxHash: null,
			vetor: null,
		})
		.onConflictDoUpdate(() => ({
			txHash: event.transaction.hash,
			minter: minterAddr,
			applicationPeriod: event.args.applicationPeriod,
			applicationFee: event.args.applicationFee,
			applyMessage: event.args.message,
			applyDate: event.block.timestamp,
			suggestor: suggestorAddr,
			denyDate: null,
			denyMessage: null,
			denyTxHash: null,
			vetor: null,
		}));

	await db
		.insert(activeUser)
		.values({ id: getAddress(event.transaction.from), lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
});

ponder.on('Stablecoin:MinterDenied', async ({ event, context }) => {
	const { db } = context;

	await db
		.insert(ecosystem)
		.values({ id: 'Stablecoin:MinterDeniedCounter', value: '', amount: 1n })
		.onConflictDoUpdate((row) => ({ amount: row.amount + 1n }));

	await db.update(minter, { id: getAddress(event.args.minter) }).set({
		denyMessage: event.args.message,
		denyDate: event.block.timestamp,
		denyTxHash: event.transaction.hash,
		vetor: getAddress(event.transaction.from),
	});

	await db
		.insert(activeUser)
		.values({ id: getAddress(event.transaction.from), lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
});

ponder.on('Stablecoin:Transfer', async ({ event, context }) => {
	const { db } = context;

	await db.insert(stablecoinTransferHistory).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		from: getAddress(event.args.from),
		to: getAddress(event.args.to),
		amount: event.args.value,
		timestamp: event.block.timestamp,
		blockheight: event.block.number,
		txHash: event.transaction.hash,
		transactionTo: event.transaction.to ? getAddress(event.transaction.to) : null,
	});

	await db
		.insert(ecosystem)
		.values({ id: 'Stablecoin:TransferCounter', value: '', amount: 1n })
		.onConflictDoUpdate((row) => ({ amount: row.amount + 1n }));

	// emit Transfer(address(0), recipient, amount);
	if (event.args.from === zeroAddress) {
		await db.insert(mint).values({
			id: `${event.transaction.hash}-${event.log.logIndex}`,
			to: getAddress(event.args.to),
			value: event.args.value,
			blockheight: event.block.number,
			timestamp: event.block.timestamp,
			txHash: event.transaction.hash,
		});

		await db
			.insert(ecosystem)
			.values({ id: 'Stablecoin:MintCounter', value: '', amount: 1n })
			.onConflictDoUpdate((row) => ({ amount: row.amount + 1n }));

		await db
			.insert(ecosystem)
			.values({ id: 'Stablecoin:Mint', value: '', amount: event.args.value })
			.onConflictDoUpdate((row) => ({ amount: row.amount + event.args.value }));

		await db
			.insert(mintBurnAddressMapper)
			.values({ id: event.args.to.toLowerCase(), mint: event.args.value, burn: 0n })
			.onConflictDoUpdate((row) => ({ mint: row.mint + event.args.value }));

		await db
			.insert(activeUser)
			.values({ id: getAddress(event.transaction.to as Address), lastActiveTime: event.block.timestamp })
			.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));

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
				.find((ev) => ev.eventName === 'PositionOpened');

			const positionOpenedAddress =
				positionOpenedEvent?.eventName === 'PositionOpened'
					? ((positionOpenedEvent.args as { position: `0x${string}` }).position.toLowerCase() as `0x${string}`)
					: undefined;

			await db
				.insert(positionMint)
				.values({
					id: event.transaction.hash.toLowerCase(),
					to: getAddress(event.args.to),
					positionAddress: positionOpenedAddress,
					value: event.args.value,
					timestamp: event.block.timestamp,
					blockheight: event.block.number,
					txHash: event.transaction.hash,
				})
				.onConflictDoUpdate((row) => ({
					to: event.args.to.toLowerCase() !== ADDR.equity.toLowerCase() ? event.args.to : row.to,
					value: row.value + event.args.value,
				}));
		}

		// Capture mints from existing positions
		const openPosition = event.transaction.to ? await db.find(positionV2, { id: event.transaction.to.toLowerCase() }) : null;
		if (openPosition) {
			await db
				.insert(positionMint)
				.values({
					id: event.transaction.hash.toLowerCase(),
					to: getAddress(event.args.to),
					positionAddress: openPosition.id,
					value: event.args.value,
					timestamp: event.block.timestamp,
					blockheight: event.block.number,
					txHash: event.transaction.hash,
				})
				.onConflictDoUpdate((row) => ({
					to: event.args.to.toLowerCase() !== ADDR.equity.toLowerCase() ? event.args.to : row.to,
					value: row.value + event.args.value,
				}));
		}
	}

	// emit Transfer(account, address(0), amount);
	if (event.args.to === zeroAddress) {
		await db.insert(burn).values({
			id: `${event.transaction.hash}-${event.log.logIndex}`,
			from: getAddress(event.args.from),
			value: event.args.value,
			blockheight: event.block.number,
			timestamp: event.block.timestamp,
			txHash: event.transaction.hash,
		});

		await db
			.insert(ecosystem)
			.values({ id: 'Stablecoin:BurnCounter', value: '', amount: 1n })
			.onConflictDoUpdate((row) => ({ amount: row.amount + 1n }));

		await db
			.insert(ecosystem)
			.values({ id: 'Stablecoin:Burn', value: '', amount: event.args.value })
			.onConflictDoUpdate((row) => ({ amount: row.amount + event.args.value }));

		await db
			.insert(mintBurnAddressMapper)
			.values({ id: event.args.from.toLowerCase(), mint: 0n, burn: event.args.value })
			.onConflictDoUpdate((row) => ({ burn: row.burn + event.args.value }));

		await db
			.insert(activeUser)
			.values({ id: getAddress(event.transaction.from), lastActiveTime: event.block.timestamp })
			.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
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
		[ADDR.bridgeEURC.toLowerCase()]: bridgeEURC,
		[ADDR.bridgeEURS.toLowerCase()]: bridgeEURS,
		[ADDR.bridgeVEUR.toLowerCase()]: bridgeVEUR,
		[ADDR.bridgeEURR.toLowerCase()]: bridgeEURR,
		[ADDR.bridgeEUROP.toLowerCase()]: bridgeEUROP,
		[ADDR.bridgeEURI.toLowerCase()]: bridgeEURI,
		[ADDR.bridgeEURE.toLowerCase()]: bridgeEURE,
	};

	const bridgeData = {
		swapper: getAddress(event.transaction.from),
		txHash: event.transaction.hash,
		amount: event.args.value,
		isMint: event.args.from === zeroAddress,
		timestamp: event.block.timestamp,
	};

	// Capture direct bridge transactions
	const bridgeTable = bridgeAddressToTable[event.transaction.to?.toLowerCase() as keyof typeof bridgeAddressToTable];
	if (bridgeTable) {
		await db.insert(bridgeTable).values({
			id: `${event.transaction.hash}-${event.log.logIndex}`,
			...bridgeData,
		});
	}

	const ecosystemContract = Object.values(ADDR).map((address) => address.toLowerCase());
	const externalInteraction = event.transaction.to && !ecosystemContract.includes(event.transaction.to.toLowerCase());
	const isMintingOrBurning = event.args.from === zeroAddress || event.args.to === zeroAddress;
	const isKnownPosition = event.transaction.to ? await db.find(positionV2, { id: event.transaction.to.toLowerCase() }) : false;

	// Capture swaps initiated from external protocols
	if (externalInteraction && isMintingOrBurning && !isKnownPosition) {
		const receipt = await context.client.request({
			method: 'eth_getTransactionReceipt',
			params: [event.transaction.hash],
		});

		const logIndex = event.log.logIndex;
		const deuroLogIndex = receipt?.logs.findIndex((log) => Number(log.logIndex) === logIndex) ?? -1;
		const previousLog = deuroLogIndex > 0 ? receipt?.logs[deuroLogIndex - 1] : undefined;
		const nextLog = deuroLogIndex >= 0 ? receipt?.logs[deuroLogIndex + 1] : undefined;
		const potencialBrigeLog = bridgeData.isMint ? previousLog : nextLog;
		const bridgeAddress =
			potencialBrigeLog && stablecoinToBridge[potencialBrigeLog.address.toLowerCase() as keyof typeof stablecoinToBridge];

		if (bridgeAddress) {
			const table = bridgeAddressToTable[bridgeAddress];
			if (table) {
				await db.insert(table).values({
					id: `${event.transaction.hash}-${event.log.logIndex}`,
					...bridgeData,
				});
			}
		}
	}
});
