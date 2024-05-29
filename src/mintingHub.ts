import { ponder } from '@/generated';
import { Position as PositionABI } from '../abis/Position';
import { ERC20 as ERC20ABI } from '../abis/ERC20';

ponder.on('MintingHub:PositionOpened', async ({ event, context }) => {
	const { client } = context;
	const { Position, ActiveUser } = context.db;

	// ------------------------------------------------------------------
	// FROM EVENT & TRANSACTION
	const { position, owner, zchf, collateral, price } = event.args;

	const created: bigint = event.block.timestamp;

	const isOriginal: boolean = !event.transaction.input.includes('0x5cb47919');
	const isClone: boolean = !isOriginal;
	const closed: boolean = false;
	const denied: boolean = false;

	const original: `0x${string}` = isOriginal ? event.args.position : (`0x${event.transaction.input.slice(34, 74)}` as `0x${string}`);

	// ------------------------------------------------------------------
	// CONST
	const minimumCollateral = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'minimumCollateral',
	});

	const annualInterestPPM = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'annualInterestPPM',
	});

	const reserveContribution = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'reserveContribution',
	});

	const start = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'start',
	});

	const expiration = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'expiration',
	});

	const challengePeriod = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'challengePeriod',
	});

	// ------------------------------------------------------------------
	// ZCHF ERC20
	const zchfName = await client.readContract({
		abi: ERC20ABI,
		address: zchf,
		functionName: 'name',
	});

	const zchfSymbol = await client.readContract({
		abi: ERC20ABI,
		address: zchf,
		functionName: 'symbol',
	});

	const zchfDecimals = await client.readContract({
		abi: ERC20ABI,
		address: zchf,
		functionName: 'decimals',
	});

	// ------------------------------------------------------------------
	// COLLATERAL ERC20
	const collateralName = await client.readContract({
		abi: ERC20ABI,
		address: collateral,
		functionName: 'name',
	});

	const collateralSymbol = await client.readContract({
		abi: ERC20ABI,
		address: collateral,
		functionName: 'symbol',
	});

	const collateralDecimals = await client.readContract({
		abi: ERC20ABI,
		address: collateral,
		functionName: 'decimals',
	});

	const collateralBalance = await client.readContract({
		abi: ERC20ABI,
		address: collateral,
		functionName: 'balanceOf',
		args: [event.args.position],
	});

	// ------------------------------------------------------------------
	// CHANGEABLE
	const limitForClones = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'limit',
	});

	const availableForClones = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'limitForClones',
	});

	const minted = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'minted',
	});

	// ------------------------------------------------------------------
	// CALC VALUES
	// const priceAdjusted = price / BigInt(10 ** (36 - collateralDecimals));
	const limitForPosition = (collateralBalance * price) / BigInt(10 ** zchfDecimals);
	const availableForPosition = limitForPosition - minted;

	// ------------------------------------------------------------------
	// ------------------------------------------------------------------
	// ------------------------------------------------------------------
	// If clone, update original position
	if (isClone) {
		const originalLimitForClones = await client.readContract({
			abi: PositionABI,
			address: original,
			functionName: 'limit',
		});

		const originalAvailableForClones = await client.readContract({
			abi: PositionABI,
			address: original,
			functionName: 'limitForClones',
		});

		await Position.update({
			id: original.toLowerCase(),
			data: {
				limitForClones: originalLimitForClones,
				availableForClones: originalAvailableForClones,
			},
		});
	}

	// ------------------------------------------------------------------
	// ------------------------------------------------------------------
	// ------------------------------------------------------------------
	// Create position entry for DB
	await Position.create({
		id: event.args.position.toLowerCase(),
		data: {
			position,
			owner,
			zchf,
			collateral,
			price,

			created,
			isOriginal,
			isClone,
			denied,
			closed,
			original,

			minimumCollateral,
			annualInterestPPM,
			reserveContribution,
			start,
			expiration,
			challengePeriod,

			zchfName,
			zchfSymbol,
			zchfDecimals,

			collateralName,
			collateralSymbol,
			collateralDecimals,
			collateralBalance,

			limitForPosition,
			limitForClones,
			availableForPosition,
			availableForClones,
			minted,
		},
	});

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

ponder.on('MintingHub:ChallengeStarted', async ({ event, context }) => {
	const { client } = context;
	const { Challenge, ActiveUser } = context.db;
	const { MintingHub } = context.contracts;

	const challenges = await client.readContract({
		abi: MintingHub.abi,
		address: MintingHub.address,
		functionName: 'challenges',
		args: [event.args.number],
	});

	const period = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'challengePeriod',
	});

	await Challenge.create({
		id: getChallengeId(event.args.position, event.args.number),
		data: {
			position: event.args.position,
			number: event.args.number,
			challenger: event.args.challenger,
			size: event.args.size,
			start: challenges[1],
			duration: period,
			bid: 0n,
			acquiredCollateral: 0n,
			filledSize: 0n,
			status: 'Active',
		},
	});
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

ponder.on('MintingHub:ChallengeAverted', async ({ event, context }) => {
	const { client } = context;
	const { Challenge, ActiveUser } = context.db;
	const { MintingHub } = context.contracts;

	const challenges = await client.readContract({
		abi: MintingHub.abi,
		address: MintingHub.address,
		functionName: 'challenges',
		args: [event.args.number],
	});

	const challengeId = getChallengeId(event.args.position, event.args.number);

	await Challenge.update({
		id: challengeId,
		data: ({ current }) => ({
			filledSize: current.filledSize + event.args.size,
			status: challenges[3] === 0n ? 'Success' : current.status,
		}),
	});
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

ponder.on('MintingHub:ChallengeSucceeded', async ({ event, context }) => {
	const { client } = context;
	const { Challenge, ActiveUser } = context.db;
	const { MintingHub } = context.contracts;

	const challenges = await client.readContract({
		abi: MintingHub.abi,
		address: MintingHub.address,
		functionName: 'challenges',
		args: [event.args.number],
	});

	const challengeId = getChallengeId(event.args.position, event.args.number);

	await Challenge.update({
		id: challengeId,
		data: ({ current }) => ({
			bid: current.bid + event.args.bid,
			acquiredCollateral: current.acquiredCollateral + event.args.acquiredCollateral,
			filledSize: current.filledSize + event.args.challengeSize,
			status: challenges[3] === 0n ? 'Success' : current.status,
		}),
	});
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

const getChallengeId = (position: string, number: bigint) => {
	return `${position}-challenge-${number}`;
};
