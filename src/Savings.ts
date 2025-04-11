import { ponder } from '@/generated';
import { SavingsABI } from '@deuro/eurocoin';
import { ADDR } from '../ponder.config';
import { Address } from 'viem';

ponder.on('Savings:RateProposed', async ({ event, context }) => {
	const { SavingsRateProposed } = context.db;
	const { who, nextChange, nextRate } = event.args;

	// flat indexing
	await SavingsRateProposed.create({
		id: `${who.toLowerCase()}-${event.block.number}`,
		data: {
			created: event.block.timestamp,
			blockheight: event.block.number,
			txHash: event.transaction.hash,
			proposer: who,
			nextRate: nextRate,
			nextChange: nextChange,
		},
	});
});

ponder.on('Savings:RateChanged', async ({ event, context }) => {
	const { SavingsRateChanged } = context.db;
	const { newRate } = event.args;

	// flat indexing
	await SavingsRateChanged.create({
		id: event.block.number.toString(),
		data: {
			created: event.block.timestamp,
			blockheight: event.block.number,
			txHash: event.transaction.hash,
			approvedRate: newRate,
		},
	});
});

ponder.on('Savings:Saved', async ({ event, context }) => {
	const { client } = context;
	const { SavingsSaved, SavingsSavedMapping, SavingsWithdrawnMapping, SavingsInterestMapping, Ecosystem, SavingsUserLeaderboard } = context.db;
	const { amount } = event.args;
	const account: Address = event.args.account.toLowerCase() as Address;

	const ratePPM = await client.readContract({
		abi: SavingsABI,
		address: ADDR.savingsGateway,
		functionName: 'currentRatePPM',
	});

	// map indexing
	await SavingsSavedMapping.upsert({
		id: account,
		create: {
			created: event.block.timestamp,
			blockheight: event.block.number,
			updated: event.block.timestamp,
			amount,
		},
		update: (c) => ({
			updated: event.block.timestamp,
			amount: c.current.amount + amount,
		}),
	});

	const latestSaved = await SavingsSavedMapping.findUnique({
		id: account,
	});
	const latestWithdraw = await SavingsWithdrawnMapping.findUnique({
		id: account,
	});
	const latestInterest = await SavingsInterestMapping.findUnique({
		id: account,
	});

	const balance: bigint = latestSaved
		? latestSaved.amount - (latestWithdraw ? latestWithdraw.amount : 0n) + (latestInterest ? latestInterest.amount : 0n)
		: 0n;

	// flat indexing
	await SavingsSaved.create({
		id: `${account}-${event.block.number.toString()}`,
		data: {
			created: event.block.timestamp,
			blockheight: event.block.number,
			account: account,
			txHash: event.transaction.hash,
			amount,
			rate: ratePPM,
			total: latestSaved ? latestSaved.amount : amount,
			balance,
		},
	});

	// ecosystem
	await Ecosystem.upsert({
		id: `Savings:TotalSaved`,
		create: {
			value: '',
			amount: amount,
		},
		update: ({ current }) => ({
			amount: current.amount + amount,
		}),
	});

	const [amountSaved] = await client.readContract({
		abi: SavingsABI,
		address: ADDR.savingsGateway,
		functionName: "savings",
		args: [account],
	});

	await SavingsUserLeaderboard.upsert({
		id: account,
		create: {
			amountSaved,
			interestReceived: 0n,
		},
		update: () => ({
			amountSaved,
		}),
	});
});

ponder.on('Savings:InterestCollected', async ({ event, context }) => {
	const { client } = context;
	const { SavingsInterest, SavingsSavedMapping, SavingsWithdrawnMapping, SavingsInterestMapping, Ecosystem, SavingsUserLeaderboard } = context.db;
	const { interest } = event.args;
	const account: Address = event.args.account.toLowerCase() as Address;

	const ratePPM = await client.readContract({
		abi: SavingsABI,
		address: ADDR.savingsGateway,
		functionName: 'currentRatePPM',
	});

	// map indexing
	await SavingsInterestMapping.upsert({
		id: account,
		create: {
			created: event.block.timestamp,
			blockheight: event.block.number,
			updated: event.block.timestamp,
			amount: interest,
		},
		update: (c) => ({
			updated: event.block.timestamp,
			amount: c.current.amount + interest,
		}),
	});

	const latestSaved = await SavingsSavedMapping.findUnique({
		id: account,
	});
	const latestWithdraw = await SavingsWithdrawnMapping.findUnique({
		id: account,
	});
	const latestInterest = await SavingsInterestMapping.findUnique({
		id: account,
	});

	const balance: bigint = latestSaved
		? latestSaved.amount - (latestWithdraw ? latestWithdraw.amount : 0n) + (latestInterest ? latestInterest.amount : 0n)
		: 0n;

	// flat indexing
	await SavingsInterest.create({
		id: `${account}-${event.block.number.toString()}`,
		data: {
			created: event.block.timestamp,
			blockheight: event.block.number,
			txHash: event.transaction.hash,
			account: account,
			amount: interest,
			rate: ratePPM,
			total: latestInterest ? latestInterest.amount : interest,
			balance,
		},
	});

	// ecosystem
	await Ecosystem.upsert({
		id: `Savings:TotalInterestCollected`,
		create: {
			value: '',
			amount: interest,
		},
		update: ({ current }) => ({
			amount: current.amount + interest,
		}),
	});

	const [amountSaved] = await client.readContract({
		abi: SavingsABI,
		address: ADDR.savingsGateway,
		functionName: "savings",
		args: [account],
	});

	await SavingsUserLeaderboard.upsert({
		id: account,
		create: {
			amountSaved,
			interestReceived: 0n,
		},
		update: ({ current }) => ({
			amountSaved,
			interestReceived: current.interestReceived + interest,
		}),
	});
});

ponder.on('Savings:Withdrawn', async ({ event, context }) => {
	const { client } = context;
	const { SavingsWithdrawn, SavingsSavedMapping, SavingsWithdrawnMapping, SavingsInterestMapping, Ecosystem, SavingsUserLeaderboard } = context.db;
	const { amount } = event.args;
	const account: Address = event.args.account.toLowerCase() as Address;

	const ratePPM = await client.readContract({
		abi: SavingsABI,
		address: ADDR.savingsGateway,
		functionName: 'currentRatePPM',
	});

	// map indexing
	await SavingsWithdrawnMapping.upsert({
		id: account,
		create: {
			created: event.block.timestamp,
			blockheight: event.block.number,
			updated: event.block.timestamp,
			amount,
		},
		update: (c) => ({
			updated: event.block.timestamp,
			amount: c.current.amount + amount,
		}),
	});

	const latestSaved = await SavingsSavedMapping.findUnique({
		id: account,
	});
	const latestWithdraw = await SavingsWithdrawnMapping.findUnique({
		id: account,
	});
	const latestInterest = await SavingsInterestMapping.findUnique({
		id: account,
	});

	const balance: bigint = latestSaved
		? latestSaved.amount - (latestWithdraw ? latestWithdraw.amount : 0n) + (latestInterest ? latestInterest.amount : 0n)
		: 0n;

	// flat indexing
	await SavingsWithdrawn.create({
		id: `${account}-${event.block.number.toString()}`,
		data: {
			created: event.block.timestamp,
			blockheight: event.block.number,
			txHash: event.transaction.hash,
			account: account,
			amount,
			rate: ratePPM,
			total: latestWithdraw ? latestWithdraw.amount : amount,
			balance,
		},
	});

	// ecosystem
	await Ecosystem.upsert({
		id: `Savings:TotalWithdrawn`,
		create: {
			value: '',
			amount: amount,
		},
		update: ({ current }) => ({
			amount: current.amount + amount,
		}),
	});

	const [amountSaved] = await client.readContract({
		abi: SavingsABI,
		address: ADDR.savingsGateway,
		functionName: "savings",
		args: [account],
	});

	await SavingsUserLeaderboard.upsert({
		id: account,
		create: {
			amountSaved,
			interestReceived: 0n,
		},
		update: () => ({
			amountSaved,
		}),
	});
});
