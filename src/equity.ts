import { ponder } from 'ponder:registry';
import { Address, decodeFunctionData, RpcTransaction, zeroAddress } from 'viem';
import { ADDR } from '../ponder.config';
import { FrontendGatewayABI } from '@deuro/eurocoin';
import { trade, votingPower, tradeChart, activeUser, ecosystem, deps, delegation } from '../ponder.schema';

ponder.on('Equity:Trade', async ({ event, context }) => {
	const { db } = context;
	const trader: Address = event.args.who;
	const amount: bigint = event.args.totPrice;
	const shares: bigint = event.args.amount;
	const price: bigint = event.args.newprice;
	const time: bigint = event.block.timestamp;
	const txHash = event.transaction.hash;

	let frontendCode: string | undefined;
	const isFrontendGateway = event.transaction.to?.toLowerCase() === ADDR.frontendGateway.toLowerCase();
	if (isFrontendGateway) {
		const txRaw = (await context.client.request({
			method: 'eth_getTransactionByHash',
			params: [txHash],
		})) as RpcTransaction;

		const decoded = decodeFunctionData({
			abi: FrontendGatewayABI,
			data: txRaw.input,
		});

		frontendCode = decoded.args.at(-1)?.toString();
	}

	await db.insert(trade).values({
		id: event.args.who + '_' + time.toString(),
		trader,
		amount,
		shares,
		price,
		time,
		txHash,
		frontendCode: frontendCode ?? null,
	});

	// invested or redeemed
	if (shares > 0n) {
		await db
			.insert(ecosystem)
			.values({ id: 'Equity:InvestedCounter', value: '', amount: 1n })
			.onConflictDoUpdate((row) => ({ amount: row.amount + 1n }));

		await db
			.insert(ecosystem)
			.values({ id: 'Equity:Invested', value: '', amount: 0n })
			.onConflictDoUpdate((row) => ({ amount: row.amount + amount }));

		await db
			.insert(ecosystem)
			.values({ id: 'Equity:InvestedFeePaidPPM', value: '', amount: 0n })
			.onConflictDoUpdate((row) => ({ amount: row.amount + amount * 3000n }));
	} else {
		await db
			.insert(ecosystem)
			.values({ id: 'Equity:RedeemedCounter', value: '', amount: 1n })
			.onConflictDoUpdate((row) => ({ amount: row.amount + 1n }));

		await db
			.insert(ecosystem)
			.values({ id: 'Equity:Redeemed', value: '', amount: 0n })
			.onConflictDoUpdate((row) => ({ amount: row.amount + amount }));

		await db
			.insert(ecosystem)
			.values({ id: 'Equity:RedeemedFeePaidPPM', value: '', amount: 0n })
			.onConflictDoUpdate((row) => ({ amount: row.amount + amount * 3000n }));
	}

	await db
		.insert(votingPower)
		.values({ id: event.args.who, address: event.args.who, votingPower: event.args.amount })
		.onConflictDoUpdate((row) => ({ votingPower: row.votingPower + event.args.amount }));

	const startTime = (event.block.timestamp / 86400n) * 86400n;
	await db
		.insert(tradeChart)
		.values({ id: startTime.toString(), time: startTime, lastPrice: event.args.newprice })
		.onConflictDoUpdate(() => ({ lastPrice: event.args.newprice }));

	await db
		.insert(activeUser)
		.values({ id: event.args.who, lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));

	const feeCollected = amount - (amount * 980n) / 1000n;
	await db
		.insert(deps)
		.values({ id: ADDR.decentralizedEURO.toLowerCase(), profits: feeCollected, loss: 0n, reserve: 0n })
		.onConflictDoUpdate((row) => ({ profits: row.profits + feeCollected }));
});

ponder.on('Equity:Transfer', async ({ event, context }) => {
	const { db } = context;

	if (event.args.from == zeroAddress || event.args.to == zeroAddress) return;

	await db
		.update(votingPower, { id: event.args.from })
		.set((row) => ({ votingPower: row.votingPower - event.args.value }));

	await db
		.insert(votingPower)
		.values({ id: event.args.to, address: event.args.to, votingPower: event.args.value })
		.onConflictDoUpdate((row) => ({ votingPower: row.votingPower + event.args.value }));

	await db
		.insert(activeUser)
		.values({ id: event.args.from, lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));

	await db
		.insert(activeUser)
		.values({ id: event.args.to, lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
});

ponder.on('Equity:Delegation', async ({ event, context }) => {
	const { db } = context;

	await db
		.insert(delegation)
		.values({ id: event.args.from, owner: event.args.from, delegatedTo: event.args.to })
		.onConflictDoUpdate(() => ({ delegatedTo: event.args.to }));

	await db
		.insert(activeUser)
		.values({ id: event.args.from, lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
});
