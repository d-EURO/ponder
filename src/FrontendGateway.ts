import { ponder } from '@/generated';
import { PositionV2ABI } from '@deuro/eurocoin';

ponder.on('FrontendGateway:FrontendCodeRegistered', async ({ event, context }) => {
	const { FrontendCodeRegistered, FrontendCodeMapping } = context.db;
	const { owner, frontendCode } = event.args;

	// flat indexing
	await FrontendCodeRegistered.create({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		data: {
			owner,
			frontendCode,
			txHash: event.transaction.hash,
			created: event.block.timestamp,
		},
	});

	await FrontendCodeMapping.upsert({
		id: owner,
		create: {
			frontendCodes: [frontendCode],
		},
		update: (c) => ({
			frontendCodes: [...c.current.frontendCodes, frontendCode],
		}),
	});
});

ponder.on('FrontendGateway:FrontendCodeTransferred', async ({ event, context }) => {
	const { FrontendCodeRegistered, FrontendCodeMapping } = context.db;
	const { from, to, frontendCode } = event.args;

	// flat indexing
	await FrontendCodeRegistered.create({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		data: {
			created: event.block.timestamp,
			owner: to,
			frontendCode,
			txHash: event.transaction.hash,
		},
	});

	await FrontendCodeMapping.upsert({
		id: from,
		create: {
			frontendCodes: [],
		},
		update: (c) => ({
			frontendCodes: c.current.frontendCodes.filter((code) => code !== frontendCode),
		}),
	});

	await FrontendCodeMapping.upsert({
		id: to,
		create: {
			frontendCodes: [frontendCode],
		},
		update: (c) => ({
			frontendCodes: [...c.current.frontendCodes, frontendCode],
		}),
	});
});

ponder.on('FrontendGateway:InvestRewardAdded', async ({ event, context }) => {
	const { InvestRewardAdded, FrontendRewardsMapping, FrontendRewardsVolumeMapping, FrontendBonusHistoryMapping } = context.db;
	const { user, amount, reward, frontendCode } = event.args;

	await InvestRewardAdded.create({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		data: {
			user,
			frontendCode,
			amount,
			reward,
			timestamp: event.block.timestamp,
			txHash: event.transaction.hash,
		},
	});

	await FrontendRewardsMapping.upsert({
		id: frontendCode,
		create: {
			totalReffered: 1,
			referred: [user],
			totalVolume: reward,
			loansVolume: 0n,
			investVolume: 0n,
			savingsVolume: 0n,
		},
		update: (c) => {
			const referred = c.current.referred.includes(user) ? c.current.referred : [...c.current.referred, user];
			return {
				totalReffered: referred.length,
				referred,
				totalVolume: c.current.totalVolume + reward,
				investVolume: c.current.investVolume + reward,
			};
		},
	});

	await FrontendRewardsVolumeMapping.upsert({
		id: `${frontendCode}-${user}`,
		create: {
			frontendCode,
			referred: user,
			volume: reward,
			timestamp: event.block.timestamp,
		},
		update: (c) => ({
			volume: c.current.volume + reward,
			timestamp: event.block.timestamp,
		}),
	});

	await FrontendBonusHistoryMapping.create({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		data: {
			frontendCode,
			payout: reward,
			source: 'InvestRewardAdded',
			timestamp: event.block.timestamp,
			txHash: event.transaction.hash,
		},
	});
});

ponder.on('FrontendGateway:RedeemRewardAdded', async ({ event, context }) => {
	const { RedeemRewardAdded, FrontendRewardsMapping, FrontendRewardsVolumeMapping, FrontendBonusHistoryMapping } = context.db;
	const { user, amount, reward, frontendCode } = event.args;

	await RedeemRewardAdded.create({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		data: {
			user,
			amount,
			reward,
			frontendCode,
			timestamp: event.block.timestamp,
			txHash: event.transaction.hash,
		},
	});

	await FrontendRewardsMapping.upsert({
		id: frontendCode,
		create: {
			totalReffered: 1,
			referred: [user],
			totalVolume: reward,
			loansVolume: 0n,
			investVolume: 0n,
			savingsVolume: 0n,
		},
		update: (c) => {
			const referred = c.current.referred.includes(user) ? c.current.referred : [...c.current.referred, user];
			return {
				totalReffered: referred.length,
				referred,
				totalVolume: c.current.totalVolume + reward,
				investVolume: c.current.investVolume + reward,
			};
		},
	});

	await FrontendRewardsVolumeMapping.upsert({
		id: `${frontendCode}-${user}`,
		create: {
			frontendCode,
			referred: user,
			volume: reward,
			timestamp: event.block.timestamp,
		},
		update: (c) => ({
			volume: c.current.volume + reward,
			timestamp: event.block.timestamp,
		}),
	});

	await FrontendBonusHistoryMapping.create({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		data: {
			frontendCode,
			payout: reward,
			source: 'RedeemRewardAdded',
			timestamp: event.block.timestamp,
			txHash: event.transaction.hash,
		},
	});
});

ponder.on('FrontendGateway:UnwrapAndSellRewardAdded', async ({ event, context }) => {
	const { UnwrapAndSellRewardAdded, FrontendRewardsMapping, FrontendRewardsVolumeMapping, FrontendBonusHistoryMapping } = context.db;
	const { user, amount, reward, frontendCode } = event.args;

	await UnwrapAndSellRewardAdded.create({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		data: {
			user,
			amount,
			reward,
			frontendCode,
			timestamp: event.block.timestamp,
			txHash: event.transaction.hash,
		},
	});

	await FrontendRewardsMapping.upsert({
		id: frontendCode,
		create: {
			totalReffered: 1,
			referred: [user],
			totalVolume: reward,
			loansVolume: 0n,
			investVolume: 0n,
			savingsVolume: 0n,
		},
		update: (c) => {
			const referred = c.current.referred.includes(user) ? c.current.referred : [...c.current.referred, user];
			return {
				totalReffered: referred.length,
				referred,
				totalVolume: c.current.totalVolume + reward,
				investVolume: c.current.investVolume + reward,
			};
		},
	});

	await FrontendRewardsVolumeMapping.upsert({
		id: `${frontendCode}-${user}`,
		create: {
			frontendCode,
			referred: user,
			volume: reward,
			timestamp: event.block.timestamp,
		},
		update: (c) => ({
			volume: c.current.volume + reward,
			timestamp: event.block.timestamp,
		}),
	});

	await FrontendBonusHistoryMapping.create({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		data: {
			frontendCode,
			payout: reward,
			source: 'UnwrapAndSellRewardAdded',
			timestamp: event.block.timestamp,
			txHash: event.transaction.hash,
		},
	});
});

ponder.on('FrontendGateway:SavingsRewardAdded', async ({ event, context }) => {
	const { SavingsRewardAdded, FrontendRewardsMapping, FrontendRewardsVolumeMapping, FrontendBonusHistoryMapping } = context.db;
	const { saver, interest, reward, frontendCode } = event.args;

	await SavingsRewardAdded.create({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		data: {
			user: saver,
			interest,
			reward,
			frontendCode,
			timestamp: event.block.timestamp,
			txHash: event.transaction.hash,
		},
	});

	await FrontendRewardsMapping.upsert({
		id: frontendCode,
		create: {
			totalReffered: 1,
			referred: [saver],
			totalVolume: reward,
			loansVolume: 0n,
			investVolume: 0n,
			savingsVolume: 0n,
		},
		update: (c) => {
			const referred = c.current.referred.includes(saver) ? c.current.referred : [...c.current.referred, saver];
			return {
				totalReffered: referred.length,
				referred,
				totalVolume: c.current.totalVolume + reward,
				savingsVolume: c.current.savingsVolume + reward,
			};
		},
	});

	await FrontendRewardsVolumeMapping.upsert({
		id: `${frontendCode}-${saver}`,
		create: {
			frontendCode,
			referred: saver,
			volume: reward,
			timestamp: event.block.timestamp,
		},
		update: (c) => ({
			volume: c.current.volume + reward,
			timestamp: event.block.timestamp,
		}),
	});

	await FrontendBonusHistoryMapping.create({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		data: {
			frontendCode,
			payout: reward,
			source: 'SavingsRewardAdded',
			timestamp: event.block.timestamp,
			txHash: event.transaction.hash,
		},
	});
});

ponder.on('FrontendGateway:PositionRewardAdded', async ({ event, context }) => {
	const { PositionRewardAdded, FrontendRewardsMapping, FrontendRewardsVolumeMapping, PositionV2, FrontendBonusHistoryMapping } =
		context.db;
	const { amount, reward, frontendCode, position } = event.args;
	const { client } = context;

	const owner = await client.readContract({
		abi: PositionV2ABI,
		address: position,
		functionName: 'owner',
	});

	if (!owner) {
		return;
	}

	await PositionRewardAdded.create({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		data: {
			user: owner,
			position,
			amount,
			reward,
			frontendCode,
			timestamp: event.block.timestamp,
			txHash: event.transaction.hash,
		},
	});

	await FrontendRewardsMapping.upsert({
		id: frontendCode,
		create: {
			referred: [owner],
			totalReffered: 1,
			totalVolume: reward,
			loansVolume: 0n,
			investVolume: 0n,
			savingsVolume: 0n,
		},
		update: (c) => {
			const referred = c.current.referred.includes(owner) ? c.current.referred : [...c.current.referred, owner];
			return {
				referred,
				totalReffered: referred.length,
				totalVolume: c.current.totalVolume + reward,
				loansVolume: c.current.loansVolume + reward,
			};
		},
	});

	await FrontendRewardsVolumeMapping.upsert({
		id: `${frontendCode}-${owner}`,
		create: {
			frontendCode,
			referred: owner,
			volume: reward,
			timestamp: event.block.timestamp,
		},
		update: (c) => ({
			volume: c.current.volume + reward,
			timestamp: event.block.timestamp,
		}),
	});

	await FrontendBonusHistoryMapping.create({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		data: {
			frontendCode,
			payout: reward,
			source: 'PositionRewardAdded',
			timestamp: event.block.timestamp,
			txHash: event.transaction.hash,
		},
	});
});
