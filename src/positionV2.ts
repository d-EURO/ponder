import { ponder } from '@/generated';
import { PositionV2ABI as PositionABI } from '@deuro/eurocoin';

ponder.on('PositionV2:MintingUpdate', async ({ event, context }) => {
	const { client } = context;
	const { PositionV2, MintingUpdateV2, Ecosystem, ActiveUser } = context.db;
	const { Savings } = context.contracts;

	// event MintingUpdateV2(uint256 collateral, uint256 price, uint256 minted);
	const { collateral, price } = event.args;
	const positionAddress = event.log.address;

	// position updates
	const availableForClones = await client.readContract({
		abi: PositionABI,
		address: positionAddress,
		functionName: 'availableForClones',
	});

	const availableForMinting = await client.readContract({
		abi: PositionABI,
		address: positionAddress,
		functionName: 'availableForMinting',
	});

	const cooldown = await client.readContract({
		abi: PositionABI,
		address: positionAddress,
		functionName: 'cooldown',
	});

	const baseRatePPM = await client.readContract({
		abi: Savings.abi,
		address: Savings.address,
		functionName: 'currentRatePPM',
	});

	const principal = await client.readContract({
		abi: PositionABI,
		address: positionAddress,
		functionName: 'principal',
	});

	const position = await PositionV2.findUnique({
		id: positionAddress.toLowerCase(),
	});

	if (!position) throw new Error('PositionV2 unknown in MintingUpdat');

	await PositionV2.update({
		id: positionAddress.toLowerCase(),
		data: {
			collateralBalance: collateral,
			price,
			availableForMinting,
			availableForClones,
			cooldown: BigInt(cooldown),
			closed: collateral == 0n,
			principal,
		},
	});

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

	const annualInterestPPM = baseRatePPM + position.riskPremiumPPM;

	const getFeeTimeframe = function (): number {
		const OneMonth = 60 * 60 * 24 * 30;
		const secToExp = Math.floor(parseInt(position.expiration.toString()) - parseInt(event.block.timestamp.toString()));
		return Math.max(OneMonth, secToExp);
	};

	const getFeePPM = function (): bigint {
		const OneYear = 60 * 60 * 24 * 365;
		const calc: number = (getFeeTimeframe() * (baseRatePPM + position.riskPremiumPPM)) / OneYear;
		return BigInt(Math.floor(calc));
	};

	const getFeePaid = function (amount: bigint): bigint {
		return (getFeePPM() * amount) / 1_000_000n;
	};

	if (mintingCounter === 1n) {
		await MintingUpdateV2.create({
			id: idMinting(1),
			data: {
				txHash: event.transaction.hash,
				created: event.block.timestamp,
				position: position.position,
				owner: position.owner,
				isClone: position.original.toLowerCase() != position.position.toLowerCase(),
				collateral: position.collateral,
				collateralName: position.collateralName,
				collateralSymbol: position.collateralSymbol,
				collateralDecimals: position.collateralDecimals,
				size: collateral,
				price: price,
				minted: BigInt(0),
				sizeAdjusted: collateral,
				priceAdjusted: price,
				mintedAdjusted: BigInt(0),
				annualInterestPPM: annualInterestPPM,
				basePremiumPPM: baseRatePPM,
				riskPremiumPPM: position.riskPremiumPPM,
				reserveContribution: position.reserveContribution,
				feeTimeframe: getFeeTimeframe(),
				feePPM: parseInt(getFeePPM().toString()),
				feePaid: BigInt(0),
			},
		});
	} else {
		const prev = await MintingUpdateV2.findUnique({
			id: idMinting(mintingCounter - 1n),
		});
		if (prev == null) throw new Error(`previous minting update not found.`);

		const sizeAdjusted = collateral - prev.size;
		const priceAdjusted = price - prev.price;
		const mintedAdjusted = BigInt(0) - prev.minted;
		const basePremiumPPMAdjusted = baseRatePPM - prev.basePremiumPPM;

		await MintingUpdateV2.create({
			id: idMinting(mintingCounter),
			data: {
				txHash: event.transaction.hash,
				created: event.block.timestamp,
				position: position.position,
				owner: position.owner,
				isClone: position.original.toLowerCase() != position.position.toLowerCase(),
				collateral: position.collateral,
				collateralName: position.collateralName,
				collateralSymbol: position.collateralSymbol,
				collateralDecimals: position.collateralDecimals,
				size: collateral,
				price: price,
				minted: BigInt(0),
				sizeAdjusted,
				priceAdjusted,
				mintedAdjusted,
				annualInterestPPM,
				basePremiumPPM: baseRatePPM,
				riskPremiumPPM: position.riskPremiumPPM,
				reserveContribution: position.reserveContribution,
				feeTimeframe: getFeeTimeframe(),
				feePPM: parseInt(getFeePPM().toString()),
				feePaid: BigInt(0),
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

ponder.on('PositionV2:PositionDenied', async ({ event, context }) => {
	const { PositionV2, ActiveUser, Ecosystem } = context.db;
	const { client } = context;

	const position = await PositionV2.findUnique({
		id: event.log.address.toLowerCase(),
	});

	const cooldown = await client.readContract({
		abi: PositionABI,
		address: event.log.address,
		functionName: 'cooldown',
	});

	if (position) {
		await PositionV2.update({
			id: event.log.address.toLowerCase(),
			data: {
				cooldown: BigInt(cooldown),
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

ponder.on('PositionV2:OwnershipTransferred', async ({ event, context }) => {
	const { PositionV2, ActiveUser } = context.db;

	const position = await PositionV2.findUnique({
		id: event.log.address.toLowerCase(),
	});
	if (position) {
		await PositionV2.update({
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
