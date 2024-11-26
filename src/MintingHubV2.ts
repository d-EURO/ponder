import { ponder } from '@/generated';
import { PositionV2ABI as PositionABI, ERC20ABI } from '@deuro/eurocoin';

// event PositionOpened(address indexed owner, address indexed position, address original, address collateral);
ponder.on('MintingHubV2:PositionOpened', async ({ event, context }) => {
	const { client } = context;
	const { PositionV2, ActiveUser, Ecosystem } = context.db;

	// ------------------------------------------------------------------
	// FROM EVENT & TRANSACTION
	const { owner, position, original, collateral } = event.args;

	const created: bigint = event.block.timestamp;

	const isOriginal: boolean = original.toLowerCase() === position.toLowerCase();
	const isClone: boolean = !isOriginal;
	const closed: boolean = false;
	const denied: boolean = false;

	// ------------------------------------------------------------------
	// CONST
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

	// ------------------------------------------------------------------
	// dEURO ERC20
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
		args: [position],
	});

	// ------------------------------------------------------------------
	// CHANGEABLE
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

	const minted = await client.readContract({
		abi: PositionABI,
		address: position,
		functionName: 'minted',
	});

	const cooldown = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'cooldown',
	});

	// ------------------------------------------------------------------
	// CALC VALUES
	// const priceAdjusted = price / BigInt(10 ** (36 - collateralDecimals));
	const limitForPosition = (collateralBalance * price) / BigInt(10 ** deuroDecimals);
	const availableForPosition = limitForPosition - minted;

	// ------------------------------------------------------------------
	// ------------------------------------------------------------------
	// ------------------------------------------------------------------
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

		await PositionV2.update({
			id: original.toLowerCase(),
			data: {
				availableForClones: originalAvailableForClones,
				availableForMinting: originalAvailableForMinting,
			},
		});
	}

	// ------------------------------------------------------------------
	// ------------------------------------------------------------------
	// ------------------------------------------------------------------
	// Create position entry for DB
	await PositionV2.create({
		id: position.toLowerCase(),
		data: {
			position,
			owner,
			deuro,
			collateral,
			price,

			created,
			isOriginal,
			isClone,
			denied,
			closed,
			original,

			minimumCollateral,
			riskPremiumPPM,
			reserveContribution,
			start,
			cooldown: BigInt(cooldown),
			expiration,
			challengePeriod,

			deuroName: deuroName,
			deuroSymbol: deuroSymbol,
			deuroDecimals: deuroDecimals,

			collateralName,
			collateralSymbol,
			collateralDecimals,
			collateralBalance,

			limitForClones,
			availableForClones,
			availableForMinting,
			minted,
		},
	});

	// ------------------------------------------------------------------
	// COMMON

	await Ecosystem.upsert({
		id: 'MintingHubV2:TotalPositions',
		create: {
			value: '',
			amount: 1n,
		},
		update: ({ current }) => ({
			amount: current.amount + 1n,
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

ponder.on('MintingHubV2:ChallengeStarted', async ({ event, context }) => {
	const { client } = context;
	const { ChallengeV2, ActiveUser, Ecosystem } = context.db;
	const { MintingHubV2 } = context.contracts;

	const challenges = await client.readContract({
		abi: MintingHubV2.abi,
		address: MintingHubV2.address,
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

	await ChallengeV2.create({
		id: getChallengeId(event.args.position, event.args.number),
		data: {
			position: event.args.position,
			number: event.args.number,

			challenger: event.args.challenger,
			start: challenges[1],
			created: event.block.timestamp,
			duration: period,
			size: event.args.size,
			liqPrice,

			bids: 0n,
			filledSize: 0n,
			acquiredCollateral: 0n,
			status: 'Active',
		},
	});

	// ------------------------------------------------------------------
	// COMMON
	await Ecosystem.upsert({
		id: 'MintingHubV2:TotalChallenges',
		create: {
			value: '',
			amount: 1n,
		},
		update: ({ current }) => ({
			amount: current.amount + 1n,
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

// event ChallengeAverted(address indexed position, uint256 number, uint256 size);
ponder.on('MintingHubV2:ChallengeAverted', async ({ event, context }) => {
	const { client } = context;
	const { PositionV2, ChallengeV2, ChallengeBidV2, ActiveUser, Ecosystem } = context.db;
	const { MintingHubV2 } = context.contracts;

	// console.log('ChallengeAverted', event.args);

	const challenges = await client.readContract({
		abi: MintingHubV2.abi,
		address: MintingHubV2.address,
		functionName: 'challenges',
		args: [event.args.number],
	});

	// console.log('ChallengeAverted:challenges', challenges);

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
	const challenge = await ChallengeV2.findUnique({
		id: challengeId,
	});

	if (!challenge) throw new Error('ChallengeV1 not found');

	const challengeBidId = getChallengeBidId(event.args.position, event.args.number, challenge.bids);

	const _price: number = parseInt(liqPrice.toString());
	const _size: number = parseInt(event.args.size.toString());
	const _amount: number = (_price / 1e18) * _size;

	// create ChallengeBidV2 entry
	await ChallengeBidV2.create({
		id: challengeBidId,
		data: {
			position: event.args.position,
			number: event.args.number,
			numberBid: challenge.bids,
			bidder: event.transaction.from,
			created: event.block.timestamp,
			bidType: 'Averted',
			bid: BigInt(_amount),
			price: liqPrice,
			filledSize: event.args.size,
			acquiredCollateral: 0n,
			challengeSize: challenge.size,
		},
	});

	// update ChallengeV2 related changes
	await ChallengeV2.update({
		id: challengeId,
		data: ({ current }) => ({
			bids: current.bids + 1n,
			filledSize: current.filledSize + event.args.size,
			status: challenges[3] === 0n ? 'Success' : current.status,
		}),
	});

	// update PositionV2 related changes
	await PositionV2.update({
		id: event.args.position.toLowerCase(),
		data: { cooldown: BigInt(cooldown) },
	});

	// ------------------------------------------------------------------
	// COMMON
	await Ecosystem.upsert({
		id: 'MintingHubV2:TotalAvertedBids',
		create: {
			value: '',
			amount: 1n,
		},
		update: ({ current }) => ({
			amount: current.amount + 1n,
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

// event ChallengeSucceeded(
// 	address indexed position,
// 	uint256 number,
// 	uint256 bid,
// 	uint256 acquiredCollateral,
// 	uint256 challengeSize
// );
// emit ChallengeSucceeded(address(_challenge.position), _challengeNumber, offer, transferredCollateral, size);
ponder.on('MintingHubV2:ChallengeSucceeded', async ({ event, context }) => {
	const { client } = context;
	const { PositionV2, ChallengeV2, ChallengeBidV2, ActiveUser, Ecosystem } = context.db;
	const { MintingHubV2 } = context.contracts;

	// console.log('ChallengeSucceeded', event.args);

	const challenges = await client.readContract({
		abi: MintingHubV2.abi,
		address: MintingHubV2.address,
		functionName: 'challenges',
		args: [event.args.number],
	});

	// console.log('ChallengeSucceeded:challenges', challenges);

	const cooldown = await client.readContract({
		abi: PositionABI,
		address: event.args.position,
		functionName: 'cooldown',
	});

	const challengeId = getChallengeId(event.args.position, event.args.number);
	const challenge = await ChallengeV2.findUnique({
		id: challengeId,
	});

	if (!challenge) throw new Error('ChallengeV1 not found');

	const challengeBidId = getChallengeBidId(event.args.position, event.args.number, challenge.bids);

	const _bid: number = parseInt(event.args.bid.toString());
	const _size: number = parseInt(event.args.challengeSize.toString());
	const _price: number = (_bid * 10 ** 18) / _size;

	// create ChallengeBidV1 entry
	await ChallengeBidV2.create({
		id: challengeBidId,
		data: {
			position: event.args.position,
			number: event.args.number,
			numberBid: challenge.bids,
			bidder: event.transaction.from,
			created: event.block.timestamp,
			bidType: 'Succeeded',
			bid: event.args.bid,
			price: BigInt(_price),
			filledSize: event.args.challengeSize,
			acquiredCollateral: event.args.acquiredCollateral,
			challengeSize: challenge.size,
		},
	});

	await ChallengeV2.update({
		id: challengeId,
		data: ({ current }) => ({
			bids: current.bids + 1n,
			acquiredCollateral: current.acquiredCollateral + event.args.acquiredCollateral,
			filledSize: current.filledSize + event.args.challengeSize,
			status: challenges[3] === 0n ? 'Success' : current.status,
		}),
	});

	await PositionV2.update({
		id: event.args.position.toLowerCase(),
		data: { cooldown: BigInt(cooldown) },
	});

	// ------------------------------------------------------------------
	// COMMON
	await Ecosystem.upsert({
		id: 'MintingHubV2:TotalSucceededBids',
		create: {
			value: '',
			amount: 1n,
		},
		update: ({ current }) => ({
			amount: current.amount + 1n,
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
	return `${position.toLowerCase()}-challenge-${number}`;
};

const getChallengeBidId = (position: string, number: bigint, bid: bigint) => {
	return `${position.toLowerCase()}-challenge-${number}-bid-${bid}`;
};
