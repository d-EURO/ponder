import { ponder } from 'ponder:registry';
import { getAddress } from 'viem';
import { PositionV2ABI as PositionABI, SavingsV2ABI } from '@deuro/eurocoin';
import { ADDR } from '../ponder.config';
import { positionV2, mintingUpdateV2, ecosystem, activeUser } from '../ponder.schema';

/** Resolve the Savings contract address for a position by reading its hub. */
async function getSavingsAddress(
	client: Parameters<Parameters<typeof ponder.on>[1]>[0]['context']['client'],
	positionAddress: `0x${string}`
): Promise<`0x${string}`> {
	const hubAddress = await client.readContract({
		abi: PositionABI,
		address: positionAddress,
		functionName: 'hub',
	});
	return hubAddress.toLowerCase() === ADDR.mintingHub?.toLowerCase() ? ADDR.savings : ADDR.savingsGateway;
}

ponder.on('Position:MintingUpdate', async ({ event, context }) => {
	const { client, db } = context;

	const { collateral, price } = event.args;
	const positionAddress = event.log.address;

	const [availableForClones, availableForMinting, cooldown, savingsAddress] = await Promise.all([
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
		getSavingsAddress(client, positionAddress),
	]);

	const baseRatePPM = await client.readContract({
		abi: SavingsV2ABI,
		address: savingsAddress,
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

	const idMinting = (cnt: number | bigint) => `${positionAddress.toLowerCase()}-${cnt}`;
	const annualInterestPPM = baseRatePPM + position.riskPremiumPPM;

	const getFeeTimeframe = (): number => {
		const oneMonth = 60 * 60 * 24 * 30;
		const secToExp = Math.floor(parseInt(position.expiration.toString()) - parseInt(event.block.timestamp.toString()));
		return Math.max(oneMonth, secToExp);
	};

	const getFeePPM = (): bigint => {
		const oneYear = 60 * 60 * 24 * 365;
		const calc: number = (getFeeTimeframe() * (baseRatePPM + position.riskPremiumPPM)) / oneYear;
		return BigInt(Math.floor(calc));
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
			annualInterestPPM: annualInterestPPM,
			basePremiumPPM: baseRatePPM,
			riskPremiumPPM: position.riskPremiumPPM,
			reserveContribution: position.reserveContribution,
			feeTimeframe: getFeeTimeframe(),
			feePPM: parseInt(getFeePPM().toString()),
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
			riskPremiumPPM: position.riskPremiumPPM,
			reserveContribution: position.reserveContribution,
			feeTimeframe: getFeeTimeframe(),
			feePPM: parseInt(getFeePPM().toString()),
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
