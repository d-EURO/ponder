import { ponder } from 'ponder:registry';
import { PositionV2ABI } from '@deuro/eurocoin';
import {
	frontendCodeRegistered,
	frontendCodeMapping,
	investRewardAdded,
	redeemRewardAdded,
	unwrapAndSellRewardAdded,
	savingsRewardAdded,
	positionRewardAdded,
	frontendRewardsMapping,
	frontendRewardsVolumeMapping,
	frontendBonusHistoryMapping,
} from '../ponder.schema';

ponder.on('FrontendGateway:FrontendCodeRegistered', async ({ event, context }) => {
	const { db } = context;
	const { owner, frontendCode } = event.args;

	await db.insert(frontendCodeRegistered).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		owner,
		frontendCode,
		txHash: event.transaction.hash,
		created: event.block.timestamp,
	});

	await db
		.insert(frontendCodeMapping)
		.values({ id: owner, frontendCodes: [frontendCode] })
		.onConflictDoUpdate((row) => ({ frontendCodes: [...row.frontendCodes, frontendCode] }));
});

ponder.on('FrontendGateway:FrontendCodeTransferred', async ({ event, context }) => {
	const { db } = context;
	const { from, to, frontendCode } = event.args;

	await db.insert(frontendCodeRegistered).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		created: event.block.timestamp,
		owner: to,
		frontendCode,
		txHash: event.transaction.hash,
	});

	await db
		.insert(frontendCodeMapping)
		.values({ id: from, frontendCodes: [] })
		.onConflictDoUpdate((row) => ({ frontendCodes: row.frontendCodes.filter((code) => code !== frontendCode) }));

	await db
		.insert(frontendCodeMapping)
		.values({ id: to, frontendCodes: [frontendCode] })
		.onConflictDoUpdate((row) => ({ frontendCodes: [...row.frontendCodes, frontendCode] }));
});

ponder.on('FrontendGateway:InvestRewardAdded', async ({ event, context }) => {
	const { db } = context;
	const { user, amount, reward, frontendCode } = event.args;

	await db.insert(investRewardAdded).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		user,
		frontendCode,
		amount,
		reward,
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});

	await db
		.insert(frontendRewardsMapping)
		.values({
			id: frontendCode,
			totalReffered: 1,
			referred: [user.toLowerCase()],
			totalVolume: reward,
			loansVolume: 0n,
			investVolume: 0n,
			savingsVolume: 0n,
		})
		.onConflictDoUpdate((row) => {
			const referred = row.referred.includes(user.toLowerCase()) ? row.referred : [...row.referred, user.toLowerCase()];
			return {
				totalReffered: referred.length,
				referred,
				totalVolume: row.totalVolume + reward,
				investVolume: row.investVolume + reward,
			};
		});

	await db
		.insert(frontendRewardsVolumeMapping)
		.values({
			id: `${frontendCode.toLowerCase()}-${user.toLowerCase()}`,
			frontendCode,
			referred: user.toLowerCase(),
			volume: reward,
			timestamp: event.block.timestamp,
		})
		.onConflictDoUpdate((row) => ({ volume: row.volume + reward, timestamp: event.block.timestamp }));

	await db.insert(frontendBonusHistoryMapping).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		frontendCode,
		payout: reward,
		source: 'InvestRewardAdded',
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});
});

ponder.on('FrontendGateway:RedeemRewardAdded', async ({ event, context }) => {
	const { db } = context;
	const { user, amount, reward, frontendCode } = event.args;

	await db.insert(redeemRewardAdded).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		user,
		amount,
		reward,
		frontendCode,
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});

	await db
		.insert(frontendRewardsMapping)
		.values({
			id: frontendCode,
			totalReffered: 1,
			referred: [user.toLowerCase()],
			totalVolume: reward,
			loansVolume: 0n,
			investVolume: 0n,
			savingsVolume: 0n,
		})
		.onConflictDoUpdate((row) => {
			const referred = row.referred.includes(user.toLowerCase()) ? row.referred : [...row.referred, user.toLowerCase()];
			return {
				totalReffered: referred.length,
				referred,
				totalVolume: row.totalVolume + reward,
				investVolume: row.investVolume + reward,
			};
		});

	await db
		.insert(frontendRewardsVolumeMapping)
		.values({
			id: `${frontendCode.toLowerCase()}-${user.toLowerCase()}`,
			frontendCode,
			referred: user.toLowerCase(),
			volume: reward,
			timestamp: event.block.timestamp,
		})
		.onConflictDoUpdate((row) => ({ volume: row.volume + reward, timestamp: event.block.timestamp }));

	await db.insert(frontendBonusHistoryMapping).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		frontendCode,
		payout: reward,
		source: 'RedeemRewardAdded',
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});
});

ponder.on('FrontendGateway:UnwrapAndSellRewardAdded', async ({ event, context }) => {
	const { db } = context;
	const { user, amount, reward, frontendCode } = event.args;

	await db.insert(unwrapAndSellRewardAdded).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		user,
		amount,
		reward,
		frontendCode,
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});

	await db
		.insert(frontendRewardsMapping)
		.values({
			id: frontendCode,
			totalReffered: 1,
			referred: [user.toLowerCase()],
			totalVolume: reward,
			loansVolume: 0n,
			investVolume: 0n,
			savingsVolume: 0n,
		})
		.onConflictDoUpdate((row) => {
			const referred = row.referred.includes(user.toLowerCase()) ? row.referred : [...row.referred, user.toLowerCase()];
			return {
				totalReffered: referred.length,
				referred,
				totalVolume: row.totalVolume + reward,
				investVolume: row.investVolume + reward,
			};
		});

	await db
		.insert(frontendRewardsVolumeMapping)
		.values({
			id: `${frontendCode.toLowerCase()}-${user.toLowerCase()}`,
			frontendCode,
			referred: user.toLowerCase(),
			volume: reward,
			timestamp: event.block.timestamp,
		})
		.onConflictDoUpdate((row) => ({ volume: row.volume + reward, timestamp: event.block.timestamp }));

	await db.insert(frontendBonusHistoryMapping).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		frontendCode,
		payout: reward,
		source: 'UnwrapAndSellRewardAdded',
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});
});

ponder.on('FrontendGateway:SavingsRewardAdded', async ({ event, context }) => {
	const { db } = context;
	const { saver, interest, reward, frontendCode } = event.args;

	await db.insert(savingsRewardAdded).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		user: saver,
		interest,
		reward,
		frontendCode,
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});

	await db
		.insert(frontendRewardsMapping)
		.values({
			id: frontendCode,
			totalReffered: 1,
			referred: [saver.toLowerCase()],
			totalVolume: reward,
			loansVolume: 0n,
			investVolume: 0n,
			savingsVolume: 0n,
		})
		.onConflictDoUpdate((row) => {
			const referred = row.referred.includes(saver.toLowerCase()) ? row.referred : [...row.referred, saver.toLowerCase()];
			return {
				totalReffered: referred.length,
				referred,
				totalVolume: row.totalVolume + reward,
				savingsVolume: row.savingsVolume + reward,
			};
		});

	await db
		.insert(frontendRewardsVolumeMapping)
		.values({
			id: `${frontendCode.toLowerCase()}-${saver.toLowerCase()}`,
			frontendCode,
			referred: saver,
			volume: reward,
			timestamp: event.block.timestamp,
		})
		.onConflictDoUpdate((row) => ({ volume: row.volume + reward, timestamp: event.block.timestamp }));

	await db.insert(frontendBonusHistoryMapping).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		frontendCode,
		payout: reward,
		source: 'SavingsRewardAdded',
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});
});

ponder.on('FrontendGateway:PositionRewardAdded', async ({ event, context }) => {
	const { db, client } = context;
	const { amount, reward, frontendCode, position } = event.args;

	const owner = await client.readContract({
		abi: PositionV2ABI,
		address: position,
		functionName: 'owner',
	});

	if (!owner) {
		return;
	}

	await db.insert(positionRewardAdded).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		user: owner.toLowerCase(),
		position: position.toLowerCase(),
		amount,
		reward,
		frontendCode: frontendCode.toLowerCase(),
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});

	await db
		.insert(frontendRewardsMapping)
		.values({
			id: frontendCode.toLowerCase(),
			referred: [owner.toLowerCase()],
			totalReffered: 1,
			totalVolume: reward,
			loansVolume: 0n,
			investVolume: 0n,
			savingsVolume: 0n,
		})
		.onConflictDoUpdate((row) => {
			const referred = row.referred.includes(owner.toLowerCase()) ? row.referred : [...row.referred, owner.toLowerCase()];
			return {
				referred,
				totalReffered: referred.length,
				totalVolume: row.totalVolume + reward,
				loansVolume: row.loansVolume + reward,
			};
		});

	await db
		.insert(frontendRewardsVolumeMapping)
		.values({
			id: `${frontendCode.toLowerCase()}-${owner.toLowerCase()}`,
			frontendCode: frontendCode.toLowerCase(),
			referred: owner.toLowerCase(),
			volume: reward,
			timestamp: event.block.timestamp,
		})
		.onConflictDoUpdate((row) => ({ volume: row.volume + reward, timestamp: event.block.timestamp }));

	await db.insert(frontendBonusHistoryMapping).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		frontendCode: frontendCode.toLowerCase(),
		payout: reward,
		source: 'PositionRewardAdded',
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});
});
