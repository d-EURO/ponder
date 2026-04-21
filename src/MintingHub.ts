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
		args: [position],
	});

	const price = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'price',
	});

	const availableForClones = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'availableForClones',
	});

	const availableForMinting = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'availableForMinting',
	});

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

	const virtualPrice = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'virtualPrice',
	});

	const collateralRequirement = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'getCollateralRequirement',
	});

	const actualVirtualPrice = collateralBalance > 0n ? (collateralRequirement * 10n ** 18n) / collateralBalance : price;

	// If clone, update original position
	if (isClone) {
		const originalAvailableForClones = await client.readContract({
			abi: PositionABI,
			address: original,
			functionName: 'availableForClones',
		});

		const originalAvailableForMinting = await client.readContract({
			abi: PositionABI,
			address: original,
			functionName: 'availableForMinting',
		});

		await db.update(positionV2, { id: originalId }).set({
			availableForClones: originalAvailableForClones,
			availableForMinting: originalAvailableForMinting,
		});
	}

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
		start,
		cooldown: BigInt(cooldown),
		expiration,
		challengePeriod,
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
		duration: period,
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

	const _price: number = parseInt(liqPrice.toString());
	const _size: number = parseInt(event.args.size.toString());
	const _amount: number = (_price / 1e18) * _size;

	await db.insert(challengeBidV2).values({
		id: challengeBidId,
		txHash: event.transaction.hash,
		position: getAddress(event.args.position),
		number: event.args.number,
		numberBid: challenge.bids,
		bidder: getAddress(event.transaction.from),
		created: event.block.timestamp,
		bidType: 'Averted',
		bid: BigInt(_amount * 1e18),
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
