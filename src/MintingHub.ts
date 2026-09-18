import { ponder } from 'ponder:registry';
import { getAddress } from 'viem';
import { PositionV2ABI as PositionABI, ERC20ABI, MintingHubV3ABI } from '@deuro/eurocoin';
import {
	positionV2,
	challengeV2,
	challengeBidV2,
	activeUser,
	ecosystem,
	forcedSale,
	postponedReturn,
	positionDeniedByGovernance,
	mintingHubRateProposed,
	mintingHubRateChanged,
} from '../ponder.schema';
import { sanitizeDecimals, sanitizeText } from './utils/format';
import { readWithFallback } from './utils/rpc';

// Largest value a ponder bigint column (Postgres numeric(78, 0)) can hold.
const MAX_NUMERIC_78 = 10n ** 78n - 1n;

// Largest value a ponder integer column (Postgres int4) can hold.
const MAX_INT4 = 2_147_483_647;

const positionOpenedHandler = async ({ event, context }: any) => {
	const { client, db } = context;

	const { owner, position, original, collateral } = event.args;
	const positionId = position.toLowerCase();
	const originalId = original.toLowerCase();

	const created: bigint = event.block.timestamp;

	const isOriginal: boolean = originalId === positionId;
	const isClone: boolean = !isOriginal;
	const closed: boolean = false;
	const denied: boolean = false;

	const deuro = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'deuro',
	});

	const minimumCollateral = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'minimumCollateral',
	});

	const riskPremiumPPM = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'riskPremiumPPM',
	});

	const reserveContribution = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'reserveContribution',
	});

	const start = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'start',
	});

	const expiration = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'expiration',
	});

	const challengePeriod = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'challengePeriod',
	});

	const limitForClones = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'limit',
	});

	const fixedAnnualRatePPM = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'fixedAnnualRatePPM',
	});

	const deuroName = await client.readContract({
		abi: ERC20ABI,
		address: deuro,
		functionName: 'name',
	});

	const deuroSymbol = await client.readContract({
		abi: ERC20ABI,
		address: deuro,
		functionName: 'symbol',
	});

	const deuroDecimals = await client.readContract({
		abi: ERC20ABI,
		address: deuro,
		functionName: 'decimals',
	});

	// Collateral is an arbitrary untrusted ERC20, so its reads use the permanent-error handling in utils/rpc.ts.
	const collateralName =
		sanitizeText(
			await readWithFallback<string>(
				() =>
					client.readContract({
						abi: ERC20ABI,
						address: collateral,
						functionName: 'name',
					}),
				'Unreadable',
				'collateral.name'
			)
		) || 'Unreadable';

	const collateralSymbol =
		sanitizeText(
			await readWithFallback<string>(
				() =>
					client.readContract({
						abi: ERC20ABI,
						address: collateral,
						functionName: 'symbol',
					}),
				'???',
				'collateral.symbol'
			)
		) || '???';

	const collateralDecimals = sanitizeDecimals(
		await readWithFallback<number>(
			() =>
				client.readContract({
					abi: ERC20ABI,
					address: collateral,
					functionName: 'decimals',
				}),
			18,
			'collateral.decimals'
		)
	);

	const collateralBalance = await readWithFallback<bigint>(
		() =>
			client.readContract({
				abi: ERC20ABI,
				address: collateral,
				functionName: 'balanceOf',
				args: [position],
			}),
		0n,
		'collateral.balanceOf'
	);

	const price = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'price',
	});

	// availableForClones() and virtualPrice() call collateral.balanceOf() internally. availableForMinting() does so only on a
	// clone, where it delegates to the original's availableForClones(); it is storage-only on an original, so wrap it for clones only.
	const availableForClones = await readWithFallback<bigint>(
		() =>
			client.readContract({
				abi: PositionABI,
				address: position,
				functionName: 'availableForClones',
			}),
		0n,
		'position.availableForClones'
	);

	const readAvailableForMinting = () =>
		client.readContract({
			abi: PositionABI,
			address: position,
			functionName: 'availableForMinting',
		});
	const availableForMinting = isClone
		? await readWithFallback<bigint>(readAvailableForMinting, 0n, 'position.availableForMinting')
		: await readAvailableForMinting();

	const cooldown = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'cooldown',
	});

	const principal = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'principal',
	});

	const virtualPrice = await readWithFallback<bigint>(
		() =>
			client.readContract({
				abi: PositionABI,
				address: position,
				functionName: 'virtualPrice',
			}),
		price,
		'position.virtualPrice'
	);

	const collateralRequirement = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'getCollateralRequirement',
	});

	const actualVirtualPrice = collateralBalance > 0n ? (collateralRequirement * 10n ** 18n) / collateralBalance : price;

	// If clone, update original position
	if (isClone) {
		const originalAvailableForClones = await readWithFallback<bigint>(
			() =>
				client.readContract({
					abi: PositionABI,
					address: original,
					functionName: 'availableForClones',
				}),
			0n,
			'original.availableForClones'
		);

		// The hub emits the clone's parent as `original`, and a parent may itself be a clone. availableForMinting() is storage-only only
		// on a position that is its own original; on a clone it reaches the collateral. Read it directly only when the stored parent row
		// is an original, so that a real bug there still surfaces.
		const parentRow = await db.find(positionV2, { id: originalId });
		const readOriginalAvailableForMinting = () =>
			client.readContract({
				abi: PositionABI,
				address: original,
				functionName: 'availableForMinting',
			});
		const originalAvailableForMinting = parentRow?.isOriginal
			? await readOriginalAvailableForMinting()
			: await readWithFallback<bigint>(readOriginalAvailableForMinting, 0n, 'original.availableForMinting');

		await db.update(positionV2, { id: originalId }).set({
			availableForClones: originalAvailableForClones,
			availableForMinting: originalAvailableForMinting,
		});
	}

	// start and expiration are uint40 on-chain and the hub sets no upper bound, while their columns are int4.
	// Clamp them so a position that starts or expires after 2038-01-19 cannot make this insert fail.
	await db.insert(positionV2).values({
		id: positionId,
		position: getAddress(position),
		owner: getAddress(owner),
		deuro: getAddress(deuro),
		collateral: getAddress(collateral),
		price,
		created,
		isOriginal,
		isClone,
		denied,
		closed,
		original: getAddress(original),
		minimumCollateral,
		riskPremiumPPM,
		reserveContribution,
		start: Math.min(Number(start), MAX_INT4),
		cooldown: BigInt(cooldown),
		expiration: Math.min(Number(expiration), MAX_INT4),
		challengePeriod: BigInt(challengePeriod),
		deuroName,
		deuroSymbol,
		deuroDecimals,
		collateralName,
		collateralSymbol,
		collateralDecimals,
		collateralBalance,
		limitForClones,
		availableForClones,
		availableForMinting,
		fixedAnnualRatePPM,
		principal,
		virtualPrice,
		actualVirtualPrice,
		mintingHubAddress: getAddress(event.log.address),
	});

	await db
		.insert(ecosystem)
		.values({ id: 'MintingHub:TotalPositions', value: '', amount: 1n })
		.onConflictDoUpdate((row: any) => ({ amount: row.amount + 1n }));

	await db
		.insert(activeUser)
		.values({ id: getAddress(event.transaction.from), lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
};

const challengeStartedHandler = async ({ event, context }: any) => {
	const { client, db } = context;

	const challenges = await client.readContract({
		abi: MintingHubV3ABI,
		address: event.log.address,
		functionName: 'challenges',
		args: [event.args.number],
	});

	const period = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'challengePeriod',
	});

	const liqPrice = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'price',
	});

	await db.insert(challengeV2).values({
		id: getChallengeId(event.args.position, event.args.number),
		txHash: event.transaction.hash,
		position: getAddress(event.args.position),
		number: event.args.number,
		challenger: getAddress(event.args.challenger),
		start: challenges[1],
		created: event.block.timestamp,
		duration: BigInt(period),
		size: event.args.size,
		liqPrice,
		bids: 0n,
		filledSize: 0n,
		acquiredCollateral: 0n,
		status: 'Active',
		mintingHubAddress: getAddress(event.log.address),
	});

	await db
		.insert(ecosystem)
		.values({ id: 'MintingHub:TotalChallenges', value: '', amount: 1n })
		.onConflictDoUpdate((row: any) => ({ amount: row.amount + 1n }));

	await db
		.insert(activeUser)
		.values({ id: getAddress(event.transaction.from), lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
};

const challengeAvertedHandler = async ({ event, context }: any) => {
	const { client, db } = context;

	const challenges = await client.readContract({
		abi: MintingHubV3ABI,
		address: event.log.address,
		functionName: 'challenges',
		args: [event.args.number],
	});

	const cooldown = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'cooldown',
	});

	const liqPrice = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'price',
	});

	const challengeId = getChallengeId(event.args.position, event.args.number);
	const challenge = await db.find(challengeV2, { id: challengeId });

	if (!challenge) throw new Error('ChallengeV2 not found');

	const challengeBidId = getChallengeBidId(event.args.position, event.args.number, challenge.bids);

	// Use an exact bigint product instead of the former floating point computation, which made BigInt() throw a RangeError for small
	// non-round price/size pairs. Clamp it because hostile position prices and challenge sizes are unbounded, while the database column
	// holds only 78 digits.
	const avertedBid = liqPrice * event.args.size;
	await db.insert(challengeBidV2).values({
		id: challengeBidId,
		txHash: event.transaction.hash,
		position: getAddress(event.args.position),
		number: event.args.number,
		numberBid: challenge.bids,
		bidder: getAddress(event.transaction.from),
		created: event.block.timestamp,
		bidType: 'Averted',
		bid: avertedBid > MAX_NUMERIC_78 ? MAX_NUMERIC_78 : avertedBid,
		price: liqPrice,
		filledSize: event.args.size,
		acquiredCollateral: 0n,
		challengeSize: challenge.size,
		mintingHubAddress: getAddress(event.log.address),
	});

	await db
		.update(challengeV2, { id: challengeId })
		.set((row: any) => ({
			bids: row.bids + 1n,
			filledSize: row.filledSize + event.args.size,
			status: challenges[3] === 0n ? 'Success' : row.status,
		}));

	await db.update(positionV2, { id: event.args.position.toLowerCase() }).set({ cooldown: BigInt(cooldown) });

	await db
		.insert(ecosystem)
		.values({ id: 'MintingHub:TotalAvertedBids', value: '', amount: 1n })
		.onConflictDoUpdate((row: any) => ({ amount: row.amount + 1n }));

	await db
		.insert(activeUser)
		.values({ id: getAddress(event.transaction.from), lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
};

const challengeSucceededHandler = async ({ event, context }: any) => {
	const { client, db } = context;

	const challenges = await client.readContract({
		abi: MintingHubV3ABI,
		address: event.log.address,
		functionName: 'challenges',
		args: [event.args.number],
	});

	const cooldown = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'cooldown',
	});

	const challengeId = getChallengeId(event.args.position, event.args.number);
	const challenge = await db.find(challengeV2, { id: challengeId });

	if (!challenge) throw new Error('ChallengeV2 not found');

	const challengeBidId = getChallengeBidId(event.args.position, event.args.number, challenge.bids);
	const price = event.args.challengeSize === 0n ? 0n : (event.args.bid * 10n ** 18n) / event.args.challengeSize;

	await db.insert(challengeBidV2).values({
		id: challengeBidId,
		txHash: event.transaction.hash,
		position: getAddress(event.args.position),
		number: event.args.number,
		numberBid: challenge.bids,
		bidder: getAddress(event.transaction.from),
		created: event.block.timestamp,
		bidType: 'Succeeded',
		bid: event.args.bid,
		price,
		filledSize: event.args.challengeSize,
		acquiredCollateral: event.args.acquiredCollateral,
		challengeSize: challenge.size,
		mintingHubAddress: getAddress(event.log.address),
	});

	await db
		.update(challengeV2, { id: challengeId })
		.set((row: any) => ({
			bids: row.bids + 1n,
			acquiredCollateral: row.acquiredCollateral + event.args.acquiredCollateral,
			filledSize: row.filledSize + event.args.challengeSize,
			status: challenges[3] === 0n ? 'Success' : row.status,
		}));

	await db.update(positionV2, { id: event.args.position.toLowerCase() }).set({ cooldown: BigInt(cooldown) });

	await db
		.insert(ecosystem)
		.values({ id: 'MintingHub:TotalSucceededBids', value: '', amount: 1n })
		.onConflictDoUpdate((row: any) => ({ amount: row.amount + 1n }));

	await db
		.insert(activeUser)
		.values({ id: getAddress(event.transaction.from), lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
};

const forcedSaleHandler = async ({ event, context }: any) => {
	const { db } = context;
	await db.insert(forcedSale).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		position: getAddress(event.args.pos),
		amount: event.args.amount,
		priceE36MinusDecimals: event.args.priceE36MinusDecimals,
		blockheight: event.block.number,
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});
};

const postponedReturnHandler = async ({ event, context }: any) => {
	const { db } = context;
	await db.insert(postponedReturn).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		collateral: getAddress(event.args.collateral),
		beneficiary: getAddress(event.args.beneficiary),
		amount: event.args.amount,
		mintingHubAddress: getAddress(event.log.address),
		blockheight: event.block.number,
		created: event.block.timestamp,
		txHash: event.transaction.hash,
	});
};

// V3-only
ponder.on('MintingHubV3:PositionDeniedByGovernance', async ({ event, context }) => {
	const { db } = context;
	await db.insert(positionDeniedByGovernance).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		position: getAddress(event.args.position),
		denier: getAddress(event.args.denier),
		message: event.args.message,
		blockheight: event.block.number,
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});
});

// V3-only (Leadrate events are inherited by MintingHub V3, not by V2 gateway)
ponder.on('MintingHubV3:RateProposed', async ({ event, context }) => {
	const { db } = context;
	const { who, nextChange, nextRate } = event.args;

	await db.insert(mintingHubRateProposed).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		created: event.block.timestamp,
		blockheight: event.block.number,
		txHash: event.transaction.hash,
		proposer: getAddress(who),
		nextRate: nextRate,
		nextChange: nextChange,
	});
});

ponder.on('MintingHubV3:RateChanged', async ({ event, context }) => {
	const { db } = context;
	const { newRate } = event.args;

	await db.insert(mintingHubRateChanged).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		created: event.block.timestamp,
		blockheight: event.block.number,
		txHash: event.transaction.hash,
		approvedRate: newRate,
	});
});

ponder.on('MintingHubV2:PositionOpened', positionOpenedHandler);
ponder.on('MintingHubV3:PositionOpened', positionOpenedHandler);
ponder.on('MintingHubV2:ChallengeStarted', challengeStartedHandler);
ponder.on('MintingHubV3:ChallengeStarted', challengeStartedHandler);
ponder.on('MintingHubV2:ChallengeAverted', challengeAvertedHandler);
ponder.on('MintingHubV3:ChallengeAverted', challengeAvertedHandler);
ponder.on('MintingHubV2:ChallengeSucceeded', challengeSucceededHandler);
ponder.on('MintingHubV3:ChallengeSucceeded', challengeSucceededHandler);
ponder.on('MintingHubV2:ForcedSale', forcedSaleHandler);
ponder.on('MintingHubV3:ForcedSale', forcedSaleHandler);
ponder.on('MintingHubV2:PostponedReturn', postponedReturnHandler);
ponder.on('MintingHubV3:PostponedReturn', postponedReturnHandler);

const getChallengeId = (position: string, number: bigint) => {
	return `${position.toLowerCase()}-challenge-${number}`;
};

const getChallengeBidId = (position: string, number: bigint, bid: bigint) => {
	return `${position.toLowerCase()}-challenge-${number}-bid-${bid}`;
};
