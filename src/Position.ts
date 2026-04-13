import { ponder } from 'ponder:registry';
import { getAddress } from 'viem';
import { PositionV2ABI as PositionABI } from '@deuro/eurocoin';
import { positionV2, mintingUpdateV2, ecosystem, activeUser } from '../ponder.schema';

ponder.on('Position:MintingUpdate', async ({ event, context }) => {
	const { client, db } = context;

	const { collateral, price } = event.args;
	const positionAddress = event.log.address;

	const [availableForClones, availableForMinting, cooldown, fixedAnnualRatePPM, principal, virtualPrice, collateralRequirement] =
		await Promise.all([
			client.readContract({
				abi: PositionABI,
				address: positionAddress,
				functionName: 'availableForClones',
			}),
			client.readContract({
				abi: PositionABI,
				address: positionAddress,
				functionName: 'availableForMinting',
			}),
			client.readContract({
				abi: PositionABI,
				address: positionAddress,
				functionName: 'cooldown',
			}),
			client.readContract({
				abi: PositionABI,
				address: positionAddress,
				functionName: 'fixedAnnualRatePPM',
			}),
			client.readContract({
				abi: PositionABI,
				address: positionAddress,
				functionName: 'principal',
			}),
			client.readContract({
				abi: PositionABI,
				address: positionAddress,
				functionName: 'virtualPrice',
			}),
			client.readContract({
				abi: PositionABI,
				address: positionAddress,
				functionName: 'getCollateralRequirement',
			}),
		]);

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
		fixedAnnualRatePPM: Number(fixedAnnualRatePPM),
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

	const idMinting = (cnt: number | bigint) => `${positionAddress.toLowerCase()}-${cnt}`;
	const annualInterestPPM = Number(fixedAnnualRatePPM);
	const riskPremiumPPM = Number(position.riskPremiumPPM);
	if (annualInterestPPM < riskPremiumPPM) throw new Error('fixedAnnualRatePPM below risk premium');
	const baseRatePPM = annualInterestPPM - riskPremiumPPM;

	const getFeeTimeframe = (): number => {
		const oneMonth = 60 * 60 * 24 * 30;
		const secToExp = Math.floor(parseInt(position.expiration.toString()) - parseInt(event.block.timestamp.toString()));
		return Math.max(oneMonth, secToExp);
	};

	const getFeePPM = (): number => {
		const oneYear = 60 * 60 * 24 * 365;
		return Math.floor((getFeeTimeframe() * annualInterestPPM) / oneYear);
	};

	if (mintingCounter === 1n) {
		await db.insert(mintingUpdateV2).values({
			id: idMinting(1),
			txHash: event.transaction.hash,
			created: event.block.timestamp,
			position: getAddress(position.position),
			owner: getAddress(position.owner),
			isClone: position.original.toLowerCase() != position.position.toLowerCase(),
			collateral: getAddress(position.collateral),
			collateralName: position.collateralName,
			collateralSymbol: position.collateralSymbol,
			collateralDecimals: position.collateralDecimals,
			size: collateral,
			price: price,
			minted: 0n,
			sizeAdjusted: collateral,
			priceAdjusted: price,
			mintedAdjusted: 0n,
			annualInterestPPM,
			basePremiumPPM: baseRatePPM,
			riskPremiumPPM,
			reserveContribution: position.reserveContribution,
			feeTimeframe: getFeeTimeframe(),
			feePPM: getFeePPM(),
			feePaid: 0n,
			cooldown: BigInt(cooldown),
			mintingHubAddress: position.mintingHubAddress,
		});
	} else {
		const prev = await db.find(mintingUpdateV2, { id: idMinting(mintingCounter - 1n) });
		if (prev == null) throw new Error('previous minting update not found.');

		const sizeAdjusted = collateral - prev.size;
		const priceAdjusted = price - prev.price;
		const mintedAdjusted = 0n - prev.minted;

		await db.insert(mintingUpdateV2).values({
			id: idMinting(mintingCounter),
			txHash: event.transaction.hash,
			created: event.block.timestamp,
			position: getAddress(position.position),
			owner: getAddress(position.owner),
			isClone: position.original.toLowerCase() != position.position.toLowerCase(),
			collateral: getAddress(position.collateral),
			collateralName: position.collateralName,
			collateralSymbol: position.collateralSymbol,
			collateralDecimals: position.collateralDecimals,
			size: collateral,
			price: price,
			minted: 0n,
			sizeAdjusted,
			priceAdjusted,
			mintedAdjusted,
			annualInterestPPM,
			basePremiumPPM: baseRatePPM,
			riskPremiumPPM,
			reserveContribution: position.reserveContribution,
			feeTimeframe: getFeeTimeframe(),
			feePPM: getFeePPM(),
			feePaid: 0n,
			cooldown: BigInt(cooldown),
			mintingHubAddress: position.mintingHubAddress,
		});
	}

	await db
		.insert(activeUser)
		.values({ id: getAddress(event.transaction.from), lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
});

ponder.on('Position:PositionDenied', async ({ event, context }) => {
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
		.values({ id: getAddress(event.transaction.from), lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
});

ponder.on('Position:OwnershipTransferred', async ({ event, context }) => {
	const { db } = context;

	const position = await db.find(positionV2, { id: event.log.address.toLowerCase() });
	if (position) {
		await db.update(positionV2, { id: event.log.address.toLowerCase() }).set({
			owner: getAddress(event.args.newOwner),
		});
	}

	await db
		.insert(activeUser)
		.values({ id: getAddress(event.transaction.from), lastActiveTime: event.block.timestamp })
		.onConflictDoUpdate(() => ({ lastActiveTime: event.block.timestamp }));
});
