import { ponder } from '@/generated';
import { Position as PositionABI } from '../abis/Position';
import { ERC20 as ERC20ABI } from '../abis/ERC20';

ponder.on('Position:MintingUpdate', async ({ event, context }) => {
	const { client } = context;
	const { Position, MintingUpdate, Ecosystem, ActiveUser } = context.db;

	// event MintingUpdate(uint256 collateral, uint256 price, uint256 minted, uint256 limit);
	const { collateral, price, minted, limit } = event.args;
	const positionAddress = event.log.address;

	// position updates
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
		id: positionAddress.toLowerCase(),
	});

	if (position) {
		const limitForPosition = (collateral * price) / BigInt(10 ** position.zchfDecimals);
		const availableForPosition = limitForPosition - minted;

		await Position.update({
			id: positionAddress.toLowerCase(),
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

	// minting updates
	const idEco = `PositionMintingUpdates:${positionAddress.toLowerCase()}`;
	await Ecosystem.upsert({
		id: idEco,
		create: {
			value: '',
			amount: 1n,
		},
		update: ({ current }) => ({
			amount: current.amount + 1n,
		}),
	});

	const mintingCounter = (
		await Ecosystem.findUnique({
			id: idEco,
		})
	)?.amount;
	if (mintingCounter === undefined) throw new Error('MintingCounter not found.');

	const idMinting = function (cnt: number | bigint) {
		return `${positionAddress.toLowerCase()}-${cnt}`;
	};

	let missingPositionData: {
		position: string;
		owner: string;
		original: string;
		expiration: bigint;
		annualInterestPPM: number;
		reserveContribution: number;
		collateral: string;
		collateralName: string;
		collateralSymbol: string;
		collateralDecimals: number;
	};

	if (position === null) {
		const owner = await client.readContract({
			abi: PositionABI,
			address: positionAddress,
			functionName: 'owner',
		});

		const original = await client.readContract({
			abi: PositionABI,
			address: positionAddress,
			functionName: 'original',
		});

		const expiration = await client.readContract({
			abi: PositionABI,
			address: positionAddress,
			functionName: 'expiration',
		});

		const annualInterestPPM = await client.readContract({
			abi: PositionABI,
			address: positionAddress,
			functionName: 'annualInterestPPM',
		});

		const reserveContribution = await client.readContract({
			abi: PositionABI,
			address: positionAddress,
			functionName: 'reserveContribution',
		});

		const collateralAddress = await client.readContract({
			abi: PositionABI,
			address: positionAddress,
			functionName: 'collateral',
		});

		const collateralName = await client.readContract({
			abi: ERC20ABI,
			address: collateralAddress,
			functionName: 'name',
		});

		const collateralSymbol = await client.readContract({
			abi: ERC20ABI,
			address: collateralAddress,
			functionName: 'symbol',
		});

		const collateralDecimals = await client.readContract({
			abi: ERC20ABI,
			address: collateralAddress,
			functionName: 'decimals',
		});

		missingPositionData = {
			position: positionAddress,
			owner,
			original,
			expiration,
			annualInterestPPM,
			reserveContribution,
			collateral: collateralAddress,
			collateralName,
			collateralSymbol,
			collateralDecimals,
		};
	} else {
		missingPositionData = {
			position: position.position,
			owner: position.owner,
			original: position.original,
			expiration: position.expiration,
			annualInterestPPM: position.annualInterestPPM,
			reserveContribution: position.reserveContribution,
			collateral: position.collateral,
			collateralName: position.collateralName,
			collateralSymbol: position.collateralSymbol,
			collateralDecimals: position.collateralDecimals,
		};
	}

	const getFeeTimeframe = function (): number {
		const OneMonth = 60 * 60 * 24 * 30;
		const secToExp = Math.floor(parseInt(missingPositionData.expiration.toString()) - parseInt(event.block.timestamp.toString()));
		return Math.max(OneMonth, secToExp);
	};

	const getFeePPM = function (): bigint {
		const OneYear = 60 * 60 * 24 * 365;
		const calc: number = (getFeeTimeframe() * missingPositionData.annualInterestPPM) / OneYear;
		return BigInt(Math.floor(calc));
	};

	const getFeePaid = function (amount: bigint): bigint {
		return (getFeePPM() * amount) / 1_000_000n;
	};

	// const get;

	if (mintingCounter === 1n) {
		await MintingUpdate.create({
			id: idMinting(1),
			data: {
				txHash: event.transaction.hash,
				created: event.block.timestamp,
				position: missingPositionData.position,
				owner: missingPositionData.owner,
				isClone: missingPositionData.original.toLowerCase() != missingPositionData.position.toLowerCase(),
				collateral: missingPositionData.collateral,
				collateralName: missingPositionData.collateralName,
				collateralSymbol: missingPositionData.collateralSymbol,
				collateralDecimals: missingPositionData.collateralDecimals,
				size: collateral,
				price: price,
				minted: minted,
				sizeAdjusted: collateral,
				priceAdjusted: price,
				mintedAdjusted: minted,
				annualInterestPPM: missingPositionData.annualInterestPPM,
				reserveContribution: missingPositionData.reserveContribution,
				feeTimeframe: getFeeTimeframe(),
				feePPM: parseInt(getFeePPM().toString()),
				feePaid: getFeePaid(minted),
			},
		});
	} else {
		const prev = await MintingUpdate.findUnique({
			id: idMinting(mintingCounter - 1n),
		});
		if (prev == null) throw new Error(`previous minting update not found.`);

		const sizeAdjusted = collateral - prev.size;
		const priceAdjusted = price - prev.price;
		const mintedAdjusted = minted - prev.minted;

		await MintingUpdate.create({
			id: idMinting(mintingCounter),
			data: {
				txHash: event.transaction.hash,
				created: event.block.timestamp,
				position: missingPositionData.position,
				owner: missingPositionData.owner,
				isClone: missingPositionData.original.toLowerCase() != missingPositionData.position.toLowerCase(),
				collateral: missingPositionData.collateral,
				collateralName: missingPositionData.collateralName,
				collateralSymbol: missingPositionData.collateralSymbol,
				collateralDecimals: missingPositionData.collateralDecimals,
				size: collateral,
				price: price,
				minted: minted,
				sizeAdjusted,
				priceAdjusted,
				mintedAdjusted,
				annualInterestPPM: missingPositionData.annualInterestPPM,
				reserveContribution: missingPositionData.reserveContribution,
				feeTimeframe: getFeeTimeframe(),
				feePPM: parseInt(getFeePPM().toString()),
				feePaid: mintedAdjusted > 0n ? getFeePaid(mintedAdjusted) : 0n,
			},
		});
	}

	// user updates
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
	const { Position, ActiveUser, Ecosystem } = context.db;
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
