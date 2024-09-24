import { createSchema } from '@ponder/core';

export default createSchema((p) => ({
	// -------------------------------------------------------------------------
	// MINTINGHUB
	Position: p.createTable({
		id: p.string(),
		position: p.string(),
		owner: p.string(),
		zchf: p.string(),
		collateral: p.string(),
		price: p.bigint(),
		created: p.bigint(), // block timestamp when position was created
		isOriginal: p.boolean(),
		isClone: p.boolean(),
		denied: p.boolean(),
		closed: p.boolean(),
		original: p.string(),
		minimumCollateral: p.bigint(),
		annualInterestPPM: p.int(),
		reserveContribution: p.int(),
		start: p.bigint(),
		cooldown: p.bigint(),
		expiration: p.bigint(),
		challengePeriod: p.bigint(),
		zchfName: p.string(),
		zchfSymbol: p.string(),
		zchfDecimals: p.int(),
		collateralName: p.string(),
		collateralSymbol: p.string(),
		collateralDecimals: p.int(),
		collateralBalance: p.bigint(),
		limitForPosition: p.bigint(),
		limitForClones: p.bigint(),
		availableForPosition: p.bigint(),
		availableForClones: p.bigint(),
		minted: p.bigint(),
	}),

	MintingUpdate: p.createTable({
		id: p.string(),
		txHash: p.string(),
		created: p.bigint(),
		position: p.string(),
		owner: p.string(),
		isClone: p.boolean(),
		collateral: p.string(),
		collateralName: p.string(),
		collateralSymbol: p.string(),
		collateralDecimals: p.int(),
		size: p.bigint(),
		price: p.bigint(),
		minted: p.bigint(),
		sizeAdjusted: p.bigint(),
		priceAdjusted: p.bigint(),
		mintedAdjusted: p.bigint(),
		annualInterestPPM: p.int(),
		reserveContribution: p.int(),
		feeTimeframe: p.int(),
		feePPM: p.int(),
		feePaid: p.bigint(),
	}),

	Challenge: p.createTable({
		id: p.string(), // e.g. 0x5d0e66DC411FEfBE9cAe9CE56dA9BCE8C027f492-challenge-2
		position: p.string(), // position being challenged
		number: p.bigint(), // number of the challenge in minting hub
		challenger: p.string(),
		start: p.bigint(), // timestamp for start of challenge
		created: p.bigint(), // block timestamp when challenge was created
		duration: p.bigint(),
		size: p.bigint(), // size of the challenge, set by the challenger
		liqPrice: p.bigint(), // trigger price for challenge
		bids: p.bigint(), // number of bids, starting with 0
		filledSize: p.bigint(), // accumulated bids amounts, set by the bidders
		acquiredCollateral: p.bigint(), // total amount of collateral acquired, set by the bidders
		status: p.string(), // status: "Active" | "Success"
	}),

	ChallengeBid: p.createTable({
		id: p.string(), // e.g. 0x5d0e66DC411FEfBE9cAe9CE56dA9BCE8C027f492-challenge-2-bid-0
		position: p.string(),
		number: p.bigint(),
		numberBid: p.bigint(),
		bidder: p.string(),
		created: p.bigint(), // block timestamp when bid was created
		bidType: p.string(), // "Averted" | "Succeeded"
		bid: p.bigint(), // bid amount
		price: p.bigint(), // bid price
		filledSize: p.bigint(),
		acquiredCollateral: p.bigint(),
		challengeSize: p.bigint(),
	}),

	// -------------------------------------------------------------------------
	// FRANKENCOIN
	Mint: p.createTable({
		id: p.string(),
		to: p.string(),
		value: p.bigint(),
		blockheight: p.bigint(),
		timestamp: p.bigint(),
	}),

	Burn: p.createTable({
		id: p.string(),
		from: p.string(),
		value: p.bigint(),
		blockheight: p.bigint(),
		timestamp: p.bigint(),
	}),

	MintBurnAddressMapper: p.createTable({
		id: p.string(),
		mint: p.bigint(),
		burn: p.bigint(),
	}),

	Minter: p.createTable({
		id: p.string(),
		txHash: p.string(),
		minter: p.string(),
		applicationPeriod: p.bigint(),
		applicationFee: p.bigint(),
		applyMessage: p.string(),
		applyDate: p.bigint(),
		suggestor: p.string(),
		denyMessage: p.string().optional(),
		denyDate: p.bigint().optional(),
		denyTxHash: p.string().optional(),
		vetor: p.string().optional(),
	}),

	// -------------------------------------------------------------------------
	// FPS
	VotingPower: p.createTable({
		id: p.string(),
		address: p.string(),
		votingPower: p.bigint(),
	}),

	FPS: p.createTable({
		id: p.string(),
		profits: p.bigint(),
		loss: p.bigint(),
		reserve: p.bigint(),
	}),

	Delegation: p.createTable({
		id: p.string(),
		owner: p.string(),
		delegatedTo: p.string(),
	}),

	Trade: p.createTable({
		id: p.string(),
		trader: p.string(),
		amount: p.bigint(),
		shares: p.bigint(),
		price: p.bigint(),
		time: p.bigint(),
	}),

	TradeChart: p.createTable({
		id: p.string(),
		time: p.bigint(),
		lastPrice: p.bigint(),
	}),

	// -------------------------------------------------------------------------
	// COMMON
	ActiveUser: p.createTable({
		id: p.string(),
		lastActiveTime: p.bigint(),
	}),

	Ecosystem: p.createTable({
		id: p.string(),
		value: p.string(),
		amount: p.bigint(),
	}),
}));
