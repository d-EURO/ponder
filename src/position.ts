import { ponder } from '@/generated';
import { Position as PositionABI } from '../abis/Position';

ponder.on('Position:MintingUpdate', async ({ event, context }) => {
	const { client } = context;
	const { Position, ActiveUser } = context.db;

	// event MintingUpdate(uint256 collateral, uint256 price, uint256 minted, uint256 limit);
	const { collateral, price, minted, limit } = event.args;
	const positionAddress = event.log.address;

	const availableForClones = await client.readContract({
		abi: PositionABI,
		address: positionAddress,
		functionName: 'limitForClones',
	});

	const cooldown = await client.readContract({
		abi: PositionABI,
		address: positionAddress,
		functionName: 'cooldown',
	});

	const position = await Position.findUnique({
		id: event.log.address.toLowerCase(),
	});

	if (position) {
		const limitForPosition = (collateral * price) / BigInt(10 ** position.zchfDecimals);
		const availableForPosition = limitForPosition - minted;

		await Position.update({
			id: event.log.address.toLowerCase(),
			data: {
				collateralBalance: collateral,
				price,
				minted,
				limitForPosition,
				limitForClones: limit,
				availableForPosition,
				availableForClones,
				cooldown,
				closed: collateral == 0n,
			},
		});
	}
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

ponder.on('Position:PositionDenied', async ({ event, context }) => {
	const { Position, ActiveUser } = context.db;
	const { client } = context;

	const position = await Position.findUnique({
		id: event.log.address.toLowerCase(),
	});

	const cooldown = await client.readContract({
		abi: PositionABI,
		address: event.log.address,
		functionName: 'cooldown',
	});

	if (position) {
		await Position.update({
			id: event.log.address.toLowerCase(),
			data: {
				cooldown,
				denied: true,
			},
		});
	}
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

ponder.on('Position:OwnershipTransferred', async ({ event, context }) => {
	const { Position, ActiveUser } = context.db;

	const position = await Position.findUnique({
		id: event.log.address.toLowerCase(),
	});
	if (position) {
		await Position.update({
			id: event.log.address.toLowerCase(),
			data: {
				owner: event.args.newOwner,
			},
		});
	}
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
