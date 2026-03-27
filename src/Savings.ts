import { ponder } from 'ponder:registry';
import { ERC20ABI, SavingsABI, SavingsGatewayABI } from '@deuro/eurocoin';
import { ADDR } from '../ponder.config';
import { Address, decodeFunctionData, getAddress } from 'viem';
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

ponder.on('Savings:RateProposed', async ({ event, context }) => {
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
	});
});

ponder.on('Savings:RateChanged', async ({ event, context }) => {
	const { db } = context;
	const { newRate } = event.args;

	await db.insert(savingsRateChanged).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		created: event.block.timestamp,
		blockheight: event.block.number,
		txHash: event.transaction.hash,
		approvedRate: newRate,
	});
});

ponder.on('Savings:Saved', async ({ event, context }) => {
	const { client, db } = context;
	const { amount } = event.args;
	const account: Address = event.args.account.toLowerCase() as Address;

	const ratePPM = await client.readContract({
		abi: SavingsABI,
		address: ADDR.savingsGateway,
		functionName: 'currentRatePPM',
	});

	let frontendCode: string | undefined;
	if (event.transaction.to?.toLowerCase() === ADDR.savingsGateway.toLowerCase()) {
		const { args } = decodeFunctionData({
			abi: SavingsGatewayABI,
			data: event.transaction.input,
		});
		frontendCode = args.at(-1) as string;
	}

	await db
		.insert(savingsSavedMapping)
		.values({
			id: account,
			created: event.block.timestamp,
			blockheight: event.block.number,
			updated: event.block.timestamp,
			amount,
		})
		.onConflictDoUpdate((row) => ({
			updated: event.block.timestamp,
			amount: row.amount + amount,
		}));

	const latestSaved = await db.find(savingsSavedMapping, { id: account });
	const latestWithdraw = await db.find(savingsWithdrawnMapping, { id: account });
	const latestInterest = await db.find(savingsInterestMapping, { id: account });

	const balance: bigint = latestSaved
		? latestSaved.amount - (latestWithdraw ? latestWithdraw.amount : 0n) + (latestInterest ? latestInterest.amount : 0n)
		: 0n;

	await db.insert(savingsSaved).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		created: event.block.timestamp,
		blockheight: event.block.number,
		account: account,
		txHash: event.transaction.hash,
		amount,
		rate: ratePPM,
		total: latestSaved ? latestSaved.amount : amount,
		balance,
		frontendCode: frontendCode ?? null,
	});

	await db
		.insert(ecosystem)
		.values({ id: 'Savings:TotalSaved', value: '', amount: amount })
		.onConflictDoUpdate((row) => ({ amount: row.amount + amount }));

	const [amountSaved] = await client.readContract({
		abi: SavingsABI,
		address: ADDR.savingsGateway,
		functionName: 'savings',
		args: [account],
	});

	const existingUser = await db.find(savingsUserLeaderboard, { id: account });

	await db
		.insert(savingsUserLeaderboard)
		.values({ id: account, amountSaved, interestReceived: 0n })
		.onConflictDoUpdate(() => ({ amountSaved }));

	if (!existingUser) {
		const currentStats = await db.find(savingsStats, { id: 'global' });
		await db
			.insert(savingsStats)
			.values({ id: 'global', totalUsers: 1, lastUpdated: event.block.timestamp })
			.onConflictDoUpdate(() => ({
				totalUsers: (currentStats?.totalUsers || 0) + 1,
				lastUpdated: event.block.timestamp,
			}));
	}

	const totalSaved = await context.client.readContract({
		abi: ERC20ABI,
		address: ADDR.decentralizedEURO,
		functionName: 'balanceOf',
		args: [ADDR.savingsGateway],
	});

	const startTime = (event.block.timestamp / 86400n) * 86400n;
	await db
		.insert(savingsTotalHistory)
		.values({ id: startTime.toString(), time: startTime, total: totalSaved })
		.onConflictDoUpdate(() => ({ total: totalSaved }));
});

ponder.on('Savings:InterestCollected', async ({ event, context }) => {
	const { client, db } = context;
	const { interest } = event.args;
	const account: Address = event.args.account.toLowerCase() as Address;

	const ratePPM = await client.readContract({
		abi: SavingsABI,
		address: ADDR.savingsGateway,
		functionName: 'currentRatePPM',
	});

	await db
		.insert(savingsInterestMapping)
		.values({
			id: account,
			created: event.block.timestamp,
			blockheight: event.block.number,
			updated: event.block.timestamp,
			amount: interest,
		})
		.onConflictDoUpdate((row) => ({
			updated: event.block.timestamp,
			amount: row.amount + interest,
		}));

	const latestSaved = await db.find(savingsSavedMapping, { id: account });
	const latestWithdraw = await db.find(savingsWithdrawnMapping, { id: account });
	const latestInterest = await db.find(savingsInterestMapping, { id: account });

	const balance: bigint = latestSaved
		? latestSaved.amount - (latestWithdraw ? latestWithdraw.amount : 0n) + (latestInterest ? latestInterest.amount : 0n)
		: 0n;

	await db.insert(savingsInterest).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		created: event.block.timestamp,
		blockheight: event.block.number,
		txHash: event.transaction.hash,
		account: account,
		amount: interest,
		rate: ratePPM,
		total: latestInterest ? latestInterest.amount : interest,
		balance,
	});

	await db
		.insert(ecosystem)
		.values({ id: 'Savings:TotalInterestCollected', value: '', amount: interest })
		.onConflictDoUpdate((row) => ({ amount: row.amount + interest }));

	const [amountSaved] = await client.readContract({
		abi: SavingsABI,
		address: ADDR.savingsGateway,
		functionName: 'savings',
		args: [account],
	});

	await db
		.insert(savingsUserLeaderboard)
		.values({ id: account, amountSaved, interestReceived: 0n })
		.onConflictDoUpdate((row) => ({
			amountSaved,
			interestReceived: row.interestReceived + interest,
		}));
});

ponder.on('Savings:Withdrawn', async ({ event, context }) => {
	const { client, db } = context;
	const { amount } = event.args;
	const account: Address = event.args.account.toLowerCase() as Address;

	const ratePPM = await client.readContract({
		abi: SavingsABI,
		address: ADDR.savingsGateway,
		functionName: 'currentRatePPM',
	});

	await db
		.insert(savingsWithdrawnMapping)
		.values({
			id: account,
			created: event.block.timestamp,
			blockheight: event.block.number,
			updated: event.block.timestamp,
			amount,
		})
		.onConflictDoUpdate((row) => ({
			updated: event.block.timestamp,
			amount: row.amount + amount,
		}));

	const latestSaved = await db.find(savingsSavedMapping, { id: account });
	const latestWithdraw = await db.find(savingsWithdrawnMapping, { id: account });
	const latestInterest = await db.find(savingsInterestMapping, { id: account });

	const balance: bigint = latestSaved
		? latestSaved.amount - (latestWithdraw ? latestWithdraw.amount : 0n) + (latestInterest ? latestInterest.amount : 0n)
		: 0n;

	await db.insert(savingsWithdrawn).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		created: event.block.timestamp,
		blockheight: event.block.number,
		txHash: event.transaction.hash,
		account: account,
		amount,
		rate: ratePPM,
		total: latestWithdraw ? latestWithdraw.amount : amount,
		balance,
	});

	await db
		.insert(ecosystem)
		.values({ id: 'Savings:TotalWithdrawn', value: '', amount: amount })
		.onConflictDoUpdate((row) => ({ amount: row.amount + amount }));

	const [amountSaved] = await client.readContract({
		abi: SavingsABI,
		address: ADDR.savingsGateway,
		functionName: 'savings',
		args: [account],
	});

	await db
		.insert(savingsUserLeaderboard)
		.values({ id: account, amountSaved, interestReceived: 0n })
		.onConflictDoUpdate(() => ({ amountSaved }));

	const totalSaved = await context.client.readContract({
		abi: ERC20ABI,
		address: ADDR.decentralizedEURO,
		functionName: 'balanceOf',
		args: [ADDR.savingsGateway],
	});

	const startTime = (event.block.timestamp / 86400n) * 86400n;
	await db
		.insert(savingsTotalHistory)
		.values({ id: startTime.toString(), time: startTime, total: totalSaved })
		.onConflictDoUpdate(() => ({ total: totalSaved }));
});
