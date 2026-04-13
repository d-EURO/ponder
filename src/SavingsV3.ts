import { ponder } from 'ponder:registry';
import { ERC20ABI, SavingsV3ABI } from '@deuro/eurocoin';
import { ADDR } from '../ponder.config';
import { getAddress, zeroAddress } from 'viem';
import { readCombinedAmountSaved } from './utils/savings';
import {
	savingsRateProposed,
	savingsRateChanged,
	savingsSaved,
	savingsSavedMapping,
	savingsInterest,
	savingsInterestMapping,
	savingsWithdrawn,
	savingsWithdrawnMapping,
	savingsUserLeaderboard,
	savingsStats,
	savingsTotalHistory,
	ecosystem,
} from '../ponder.schema';

/** Read the combined dEURO balance across V2 and V3 Savings contracts. */
async function readTotalSavedAcrossVersions(client: Parameters<Parameters<typeof ponder.on>[1]>[0]['context']['client']) {
	const [v2Balance, v3Balance] = await Promise.all([
		client.readContract({
			abi: ERC20ABI,
			address: ADDR.decentralizedEURO,
			functionName: 'balanceOf',
			args: [ADDR.savingsGateway],
		}),
		client.readContract({
			abi: ERC20ABI,
			address: ADDR.decentralizedEURO,
			functionName: 'balanceOf',
			args: [ADDR.savings],
		}),
	]);
	return v2Balance + v3Balance;
}

ponder.on('SavingsV3:RateProposed', async ({ event, context }) => {
	const { db } = context;
	const { who, nextChange, nextRate } = event.args;

	await db.insert(savingsRateProposed).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		created: event.block.timestamp,
		blockheight: event.block.number,
		txHash: event.transaction.hash,
		proposer: getAddress(who),
		nextRate: nextRate,
		nextChange: nextChange,
		source: 'v3',
	});
});

ponder.on('SavingsV3:RateChanged', async ({ event, context }) => {
	const { db } = context;
	const { newRate } = event.args;

	await db.insert(savingsRateChanged).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		created: event.block.timestamp,
		blockheight: event.block.number,
		txHash: event.transaction.hash,
		approvedRate: newRate,
		source: 'v3',
	});
});

ponder.on('SavingsV3:Saved', async ({ event, context }) => {
	const { client, db } = context;
	const { amount } = event.args;
	const account = getAddress(event.args.account);

	const ratePPM = await client.readContract({
		abi: SavingsV3ABI,
		address: ADDR.savings,
		functionName: 'currentRatePPM',
	});

	await db
		.insert(savingsSavedMapping)
		.values({
			id: event.args.account,
			created: event.block.timestamp,
			blockheight: event.block.number,
			updated: event.block.timestamp,
			amount,
		})
		.onConflictDoUpdate((row) => ({
			updated: event.block.timestamp,
			amount: row.amount + amount,
		}));

	const latestSaved = await db.find(savingsSavedMapping, { id: event.args.account });
	const latestWithdraw = await db.find(savingsWithdrawnMapping, { id: event.args.account });
	const latestInterest = await db.find(savingsInterestMapping, { id: event.args.account });

	const balance: bigint = latestSaved
		? latestSaved.amount - (latestWithdraw ? latestWithdraw.amount : 0n) + (latestInterest ? latestInterest.amount : 0n)
		: 0n;

	await db.insert(savingsSaved).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		created: event.block.timestamp,
		blockheight: event.block.number,
		account: event.args.account,
		txHash: event.transaction.hash,
		amount,
		rate: ratePPM,
		total: latestSaved ? latestSaved.amount : amount,
		balance,
		frontendCode: null,
	});

	await db
		.insert(ecosystem)
		.values({ id: 'Savings:TotalSaved', value: '', amount: amount })
		.onConflictDoUpdate((row) => ({ amount: row.amount + amount }));

	const amountSaved = await readCombinedAmountSaved(client, account, event.block.number);

	const existingUser = await db.find(savingsUserLeaderboard, { id: event.args.account });

	await db
		.insert(savingsUserLeaderboard)
		.values({ id: event.args.account, amountSaved, interestReceived: 0n })
		.onConflictDoUpdate(() => ({ amountSaved }));

	if (!existingUser) {
		await db
			.insert(savingsStats)
			.values({ id: 'global', totalUsers: 1, lastUpdated: event.block.timestamp })
			.onConflictDoUpdate((row) => ({
				totalUsers: row.totalUsers + 1,
				lastUpdated: event.block.timestamp,
			}));
	}

	const totalSaved = await readTotalSavedAcrossVersions(client);

	const startTime = (event.block.timestamp / 86400n) * 86400n;
	await db
		.insert(savingsTotalHistory)
		.values({ id: startTime.toString(), time: startTime, total: totalSaved })
		.onConflictDoUpdate(() => ({ total: totalSaved }));
});

ponder.on('SavingsV3:InterestCollected', async ({ event, context }) => {
	const { client, db } = context;
	const { interest, compounded } = event.args;
	const account = getAddress(event.args.account);

	const ratePPM = await client.readContract({
		abi: SavingsV3ABI,
		address: ADDR.savings,
		functionName: 'currentRatePPM',
	});

	await db
		.insert(savingsInterestMapping)
		.values({
			id: event.args.account,
			created: event.block.timestamp,
			blockheight: event.block.number,
			updated: event.block.timestamp,
			amount: interest,
		})
		.onConflictDoUpdate((row) => ({
			updated: event.block.timestamp,
			amount: row.amount + interest,
		}));

	const latestSaved = await db.find(savingsSavedMapping, { id: event.args.account });
	const latestWithdraw = await db.find(savingsWithdrawnMapping, { id: event.args.account });
	const latestInterest = await db.find(savingsInterestMapping, { id: event.args.account });

	const balance: bigint = latestSaved
		? latestSaved.amount - (latestWithdraw ? latestWithdraw.amount : 0n) + (latestInterest ? latestInterest.amount : 0n)
		: 0n;

	await db.insert(savingsInterest).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		created: event.block.timestamp,
		blockheight: event.block.number,
		txHash: event.transaction.hash,
		account: event.args.account,
		amount: interest,
		rate: ratePPM,
		total: latestInterest ? latestInterest.amount : interest,
		balance,
		compounded,
	});

	await db
		.insert(ecosystem)
		.values({ id: 'Savings:TotalInterestCollected', value: '', amount: interest })
		.onConflictDoUpdate((row) => ({ amount: row.amount + interest }));

	const amountSaved = await readCombinedAmountSaved(client, account, event.block.number);

	await db
		.insert(savingsUserLeaderboard)
		.values({ id: event.args.account, amountSaved, interestReceived: 0n })
		.onConflictDoUpdate((row) => ({
			amountSaved,
			interestReceived: row.interestReceived + interest,
		}));
});

ponder.on('SavingsV3:Withdrawn', async ({ event, context }) => {
	const { client, db } = context;
	const { amount } = event.args;
	const account = getAddress(event.args.account);

	const ratePPM = await client.readContract({
		abi: SavingsV3ABI,
		address: ADDR.savings,
		functionName: 'currentRatePPM',
	});

	await db
		.insert(savingsWithdrawnMapping)
		.values({
			id: event.args.account,
			created: event.block.timestamp,
			blockheight: event.block.number,
			updated: event.block.timestamp,
			amount,
		})
		.onConflictDoUpdate((row) => ({
			updated: event.block.timestamp,
			amount: row.amount + amount,
		}));

	const latestSaved = await db.find(savingsSavedMapping, { id: event.args.account });
	const latestWithdraw = await db.find(savingsWithdrawnMapping, { id: event.args.account });
	const latestInterest = await db.find(savingsInterestMapping, { id: event.args.account });

	const balance: bigint = latestSaved
		? latestSaved.amount - (latestWithdraw ? latestWithdraw.amount : 0n) + (latestInterest ? latestInterest.amount : 0n)
		: 0n;

	await db.insert(savingsWithdrawn).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		created: event.block.timestamp,
		blockheight: event.block.number,
		txHash: event.transaction.hash,
		account: event.args.account,
		amount,
		rate: ratePPM,
		total: latestWithdraw ? latestWithdraw.amount : amount,
		balance,
	});

	await db
		.insert(ecosystem)
		.values({ id: 'Savings:TotalWithdrawn', value: '', amount: amount })
		.onConflictDoUpdate((row) => ({ amount: row.amount + amount }));

	const amountSaved = await readCombinedAmountSaved(client, account, event.block.number);

	await db
		.insert(savingsUserLeaderboard)
		.values({ id: event.args.account, amountSaved, interestReceived: 0n })
		.onConflictDoUpdate(() => ({ amountSaved }));

	const totalSaved = await readTotalSavedAcrossVersions(client);

	const startTime = (event.block.timestamp / 86400n) * 86400n;
	await db
		.insert(savingsTotalHistory)
		.values({ id: startTime.toString(), time: startTime, total: totalSaved })
		.onConflictDoUpdate(() => ({ total: totalSaved }));
});
