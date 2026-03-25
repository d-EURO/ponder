import { ponder } from 'ponder:registry';
import { PositionV2ABI as PositionABI } from '@deuro/eurocoin';
import { positionV2, mintingUpdateV2, ecosystem, activeUser } from '../ponder.schema';

ponder.on('PositionV2:MintingUpdate', async ({ event, context }) => {
	const { client, db } = context;
	const { Savings } = context.contracts;

	const { collateral, price } = event.args;
	const positionAddress = event.log.address;

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

	const virtualPrice = await client.readContract({
		abi: PositionABI,
		address: positionAddress,
		functionName: 'virtualPrice',
	});

	const collateralRequirement = await client.readContract({
		abi: PositionABI,
		address: positionAddress,
		functionName: 'getCollateralRequirement',
	});

	const actualVirtualPrice = collateral > 0n ? (collateralRequirement * 10n ** 18n) / collateral : price;

	const position = await db.find(positionV2, { id: positionAddress.toLowerCase() });

	if (!position) throw new Error('PositionV2 unknown in MintingUpdate');

	await db.update(positionV2, { id: positionAddress.toLowerCase() }).set({
		collateralBalance: collateral,
		price,
		availableForMinting,
		availableForClones,
		cooldown: BigInt(cooldown),
		closed: collateral == 0n,
		principal,
		virtualPrice,
		actualVirtualPrice,
	});

	const idEco = `PositionMintingUpdates:${positionAddress.toLowerCase()}`;
	await db
		.insert(ecosystem)
		.values({ id: idEco, value: '', amount: 1n })
		.onConflictDoUpdate((row) => ({ amount: row.amount + 1n }));

	const ecoRow = await db.find(ecosystem, { id: idEco });
	const mintingCounter = ecoRow?.amount;
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
		await db.insert(mintingUpdateV2).values({
			id: idMinting(1),
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
		});
	} else {
		const prev = await db.find(mintingUpdateV2, { id: idMinting(mintingCounter - 1n) });
		if (prev == null) throw new Error(`previous minting update not found.`);

		const sizeAdjusted = collateral - prev.size;
		const priceAdjusted = price - prev.price;
		const mintedAdjusted = BigInt(0) - prev.minted;

		await db.insert(mintingUpdateV2).values({
			id: idMinting(mintingCounter),
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
		});
	}

	await db
		.insert(activeUser)
		.values({ id: event.transaction.from.toLowerCase(), lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
});

ponder.on('PositionV2:PositionDenied', async ({ event, context }) => {
	const { client, db } = context;

	const position = await db.find(positionV2, { id: event.log.address.toLowerCase() });

	const cooldown = await client.readContract({
		abi: PositionABI,
		address: event.log.address,
		functionName: 'cooldown',
	});

	if (position) {
		await db.update(positionV2, { id: event.log.address.toLowerCase() }).set({
			cooldown: BigInt(cooldown),
			denied: true,
		});
	}

	await db
		.insert(activeUser)
		.values({ id: event.transaction.from.toLowerCase(), lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
});

ponder.on('PositionV2:OwnershipTransferred', async ({ event, context }) => {
	const { db } = context;

	const position = await db.find(positionV2, { id: event.log.address.toLowerCase() });
	if (position) {
		await db.update(positionV2, { id: event.log.address.toLowerCase() }).set({
			owner: event.args.newOwner.toLowerCase(),
		});
	}

	await db
		.insert(activeUser)
		.values({ id: event.transaction.from.toLowerCase(), lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
});
