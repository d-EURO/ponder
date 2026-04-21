import { ponder } from 'ponder:registry';
import { SavingsV2ABI, SavingsGatewayV2ABI } from '@deuro/eurocoin';
import { ADDR } from '../ponder.config';
import { Address, decodeFunctionData, getAddress } from 'viem';
import {
	addSavingsUserInterestReceived,
	isSavingsVaultAccount,
	normalizeSavingsAccount,
	syncSavingsTotalHistory,
	syncSavingsUserAggregate,
} from './utils/savings';
import {
	savingsRateProposed,
	savingsRateChanged,
	savingsSaved,
	savingsSavedMapping,
	savingsInterest,
	savingsInterestMapping,
	savingsWithdrawn,
	savingsWithdrawnMapping,
	ecosystem,
} from '../ponder.schema';

ponder.on('SavingsV2:RateProposed', async ({ event, context }) => {
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
		source: 'v2',
	});
});

ponder.on('SavingsV2:RateChanged', async ({ event, context }) => {
	const { db } = context;
	const { newRate } = event.args;

	await db.insert(savingsRateChanged).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		created: event.block.timestamp,
		blockheight: event.block.number,
		txHash: event.transaction.hash,
		approvedRate: newRate,
		source: 'v2',
	});
});

ponder.on('SavingsV2:Saved', async ({ event, context }) => {
	const { client, db } = context;
	const { amount } = event.args;
	const account: Address = normalizeSavingsAccount(event.args.account);

	const ratePPM = await client.readContract({
		abi: SavingsV2ABI,
		address: ADDR.savingsGateway,
		functionName: 'currentRatePPM',
	});

	let frontendCode: string | undefined;
	if (event.transaction.to?.toLowerCase() === ADDR.savingsGateway.toLowerCase()) {
		const { args } = decodeFunctionData({
			abi: SavingsGatewayV2ABI,
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

	await syncSavingsUserAggregate(db, client, account, event.block.number, event.block.timestamp);
	await syncSavingsTotalHistory(db, client, event.block.timestamp);
});

ponder.on('SavingsV2:InterestCollected', async ({ event, context }) => {
	const { client, db } = context;
	const { interest } = event.args;
	const account: Address = normalizeSavingsAccount(event.args.account);

	const ratePPM = await client.readContract({
		abi: SavingsV2ABI,
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
		compounded: true,
	});

	await db
		.insert(ecosystem)
		.values({ id: 'Savings:TotalInterestCollected', value: '', amount: interest })
		.onConflictDoUpdate((row) => ({ amount: row.amount + interest }));

	await syncSavingsUserAggregate(db, client, account, event.block.number, event.block.timestamp);
	if (!isSavingsVaultAccount(account)) {
		await addSavingsUserInterestReceived(db, account, interest);
	}
	await syncSavingsTotalHistory(db, client, event.block.timestamp);
});

ponder.on('SavingsV2:Withdrawn', async ({ event, context }) => {
	const { client, db } = context;
	const { amount } = event.args;
	const account: Address = normalizeSavingsAccount(event.args.account);

	const ratePPM = await client.readContract({
		abi: SavingsV2ABI,
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

	await syncSavingsUserAggregate(db, client, account, event.block.number, event.block.timestamp);
	await syncSavingsTotalHistory(db, client, event.block.timestamp);
});
