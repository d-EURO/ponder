import { ponder } from '@/generated';
import { ERC20ABI, SavingsABI, SavingsGatewayABI } from '@deuro/eurocoin';
import { ADDR } from '../ponder.config';
import { Address, decodeFunctionData } from 'viem';
import { getRandomHex } from './utils/randomString';

// Track last block when we updated interest
let lastInterestUpdateBlock = 0n;

// Helper function to calculate accrued interest for a user
async function calculateUserAccruedInterest(
	client: any,
	userAddress: Address
): Promise<bigint> {
	try {
		// Get accrued interest directly from contract
		const accruedInterest = await client.readContract({
			abi: SavingsGatewayABI,
			address: ADDR.savingsGateway,
			functionName: 'accruedInterest',
			args: [userAddress],
		});
		
		return accruedInterest || 0n;
	} catch (error) {
		console.error(`Error calculating interest for ${userAddress}:`, error);
		return 0n;
	}
}

// Helper function to update potential volume for all frontend codes
async function updateAllFrontendPotentialVolumes(context: any, timestamp: bigint) {
	const { FrontendRewardsMapping, UserSavingsTracking } = context.db;
	const { client } = context;
	
	// Get all frontend codes with referred users
	const allFrontendCodes = await FrontendRewardsMapping.findMany({
		limit: 1000,
	});
	
	for (const frontend of allFrontendCodes.items) {
		if (!frontend.referred || frontend.referred.length === 0) continue;
		
		let totalAccruedInterest = 0n;
		const usersWithSavings: string[] = [];
		
		// Calculate accrued interest for each referred user
		for (const userAddress of frontend.referred) {
			const userTracking = await UserSavingsTracking.findUnique({
				id: userAddress,
			});
			
			if (userTracking && userTracking.currentBalance > 0n) {
				const accruedInterest = await calculateUserAccruedInterest(client, userAddress as Address);
				
				if (accruedInterest > 0n) {
					totalAccruedInterest += accruedInterest;
					usersWithSavings.push(userAddress);
					
					// Update user tracking
					await UserSavingsTracking.update({
						id: userAddress,
						data: {
							accruedInterest,
							lastCalculated: timestamp,
						},
					});
				}
			}
		}
		
		// Update frontend rewards with potential volume
		await FrontendRewardsMapping.update({
			id: frontend.id,
			data: {
				potentialVolume: frontend.totalVolume + totalAccruedInterest,
				totalAccruedInterest,
				lastInterestUpdate: timestamp,
				referredUsersWithSavings: usersWithSavings,
			},
		});
	}
	
	console.log(`Updated potential volumes for ${allFrontendCodes.items.length} frontend codes at timestamp ${timestamp}`);
}

ponder.on('Savings:RateProposed', async ({ event, context }) => {
	const { SavingsRateProposed } = context.db;
	const { who, nextChange, nextRate } = event.args;

	// flat indexing
	await SavingsRateProposed.create({
		id: `${who.toLowerCase()}-${event.block.number.toString()}-${event.log.logIndex}-${getRandomHex()}`,
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
		id: `${event.block.number.toString()}-${event.log.logIndex}-${getRandomHex()}`,
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
	const {
		SavingsSaved,
		SavingsSavedMapping,
		SavingsWithdrawnMapping,
		SavingsInterestMapping,
		Ecosystem,
		SavingsUserLeaderboard,
		SavingsTotalHistory,
		UserSavingsTracking,
		FrontendRewardsMapping,
	} = context.db;
	const { amount } = event.args;
	const account: Address = event.args.account.toLowerCase() as Address;
	
	// Check if we should update all frontend potential volumes (every 100 blocks)
	if (event.block.number - lastInterestUpdateBlock >= 100n) {
		lastInterestUpdateBlock = event.block.number;
		await updateAllFrontendPotentialVolumes(context, event.block.timestamp);
	}

	const ratePPM = await client.readContract({
		abi: SavingsABI,
		address: ADDR.savingsGateway,
		functionName: 'currentRatePPM',
	});

	let frontendCode: string | undefined;
	if (event.transaction.to === ADDR.savingsGateway) {
		const { args } = decodeFunctionData({
			abi: SavingsGatewayABI,
			data: event.transaction.input,
		});
		frontendCode = args.at(-1) as string;
	}

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
		id: `${account}-${event.block.number.toString()}-${event.log.logIndex}-${getRandomHex()}`,
		data: {
			created: event.block.timestamp,
			blockheight: event.block.number,
			account: account,
			txHash: event.transaction.hash,
			amount,
			rate: ratePPM,
			total: latestSaved ? latestSaved.amount : amount,
			balance,
			frontendCode,
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
		functionName: 'savings',
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

	const totalSaved = await context.client.readContract({
		abi: ERC20ABI,
		address: ADDR.decentralizedEURO,
		functionName: 'balanceOf',
		args: [ADDR.savingsGateway],
	});

	const startTime = (event.block.timestamp / 86400n) * 86400n;
	await SavingsTotalHistory.upsert({
		id: startTime.toString(),
		create: {
			time: startTime,
			total: totalSaved,
		},
		update: () => ({
			total: totalSaved,
		}),
	});

	// Update user savings tracking for potential volume
	await UserSavingsTracking.upsert({
		id: account,
		create: {
			frontendCode,
			currentBalance: amountSaved,
			lastUpdateTicks: event.block.timestamp,
			accruedInterest: 0n,
			lastCalculated: event.block.timestamp,
		},
		update: () => ({
			frontendCode,
			currentBalance: amountSaved,
			lastUpdateTicks: event.block.timestamp,
		}),
	});

	// Update frontend rewards if frontendCode exists
	if (frontendCode) {
		const frontendData = await FrontendRewardsMapping.findUnique({
			id: frontendCode,
		});
		
		if (frontendData) {
			// Check if user is already in referred list
			const isNewReferred = !frontendData.referred.includes(account);
			const referredUsersWithSavings = frontendData.referredUsersWithSavings || [];
			
			if (!referredUsersWithSavings.includes(account) && amountSaved > 0n) {
				referredUsersWithSavings.push(account);
			}
			
			await FrontendRewardsMapping.update({
				id: frontendCode,
				data: {
					referred: isNewReferred ? [...frontendData.referred, account] : frontendData.referred,
					referredUsersWithSavings,
					savingsVolume: frontendData.savingsVolume + amount,
					totalVolume: frontendData.totalVolume + amount,
					potentialVolume: frontendData.totalVolume + amount,
				},
			});
		}
	}
});

ponder.on('Savings:InterestCollected', async ({ event, context }) => {
	const { client } = context;
	const { SavingsInterest, SavingsSavedMapping, SavingsWithdrawnMapping, SavingsInterestMapping, Ecosystem, SavingsUserLeaderboard, UserSavingsTracking, FrontendRewardsMapping } =
		context.db;
	const { interest } = event.args;
	const account: Address = event.args.account.toLowerCase() as Address;
	
	// Check if we should update all frontend potential volumes (every 100 blocks)
	if (event.block.number - lastInterestUpdateBlock >= 100n) {
		lastInterestUpdateBlock = event.block.number;
		await updateAllFrontendPotentialVolumes(context, event.block.timestamp);
	}

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
		id: `${account}-${event.block.number.toString()}-${event.log.logIndex}-${getRandomHex()}`,
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
		functionName: 'savings',
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

	// Reset accrued interest for user when they claim
	await UserSavingsTracking.upsert({
		id: account,
		create: {
			frontendCode: undefined,
			currentBalance: amountSaved,
			lastUpdateTicks: event.block.timestamp,
			accruedInterest: 0n,
			lastCalculated: event.block.timestamp,
		},
		update: () => ({
			accruedInterest: 0n,
			lastUpdateTicks: event.block.timestamp,
			lastCalculated: event.block.timestamp,
			currentBalance: amountSaved,
		}),
	});

	// Find user's frontend code and update volumes
	const userTracking = await UserSavingsTracking.findUnique({
		id: account,
	});

	if (userTracking?.frontendCode) {
		const frontendData = await FrontendRewardsMapping.findUnique({
			id: userTracking.frontendCode,
		});

		if (frontendData) {
			await FrontendRewardsMapping.update({
				id: userTracking.frontendCode,
				data: {
					savingsVolume: frontendData.savingsVolume + interest,
					totalVolume: frontendData.totalVolume + interest,
					potentialVolume: (frontendData.potentialVolume || frontendData.totalVolume) + interest,
				},
			});
		}
	}
});

ponder.on('Savings:Withdrawn', async ({ event, context }) => {
	const { client } = context;
	const {
		SavingsWithdrawn,
		SavingsSavedMapping,
		SavingsWithdrawnMapping,
		SavingsInterestMapping,
		Ecosystem,
		SavingsUserLeaderboard,
		SavingsTotalHistory,
		UserSavingsTracking,
	} = context.db;
	const { amount } = event.args;
	const account: Address = event.args.account.toLowerCase() as Address;
	
	// Check if we should update all frontend potential volumes (every 100 blocks)
	if (event.block.number - lastInterestUpdateBlock >= 100n) {
		lastInterestUpdateBlock = event.block.number;
		await updateAllFrontendPotentialVolumes(context, event.block.timestamp);
	}

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
		id: `${account}-${event.block.number.toString()}-${event.log.logIndex}-${getRandomHex()}`,
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
		functionName: 'savings',
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

	const totalSaved = await context.client.readContract({
		abi: ERC20ABI,
		address: ADDR.decentralizedEURO,
		functionName: 'balanceOf',
		args: [ADDR.savingsGateway],
	});

	const startTime = (event.block.timestamp / 86400n) * 86400n;
	await SavingsTotalHistory.upsert({
		id: startTime.toString(),
		create: {
			time: startTime,
			total: totalSaved,
		},
		update: () => ({
			total: totalSaved,
		}),
	});

	// Update user savings tracking after withdrawal
	await UserSavingsTracking.upsert({
		id: account,
		create: {
			frontendCode: undefined,
			currentBalance: amountSaved,
			lastUpdateTicks: event.block.timestamp,
			accruedInterest: 0n,
			lastCalculated: event.block.timestamp,
		},
		update: () => ({
			currentBalance: amountSaved,
			lastUpdateTicks: event.block.timestamp,
		}),
	});
});
