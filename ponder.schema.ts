import { createSchema } from '@ponder/core';

export default createSchema((p) => ({
	Position: p.createTable({
		id: p.string(),
		position: p.string(),
		owner: p.string(),
		zchf: p.string(),
		collateral: p.string(),
		price: p.bigint(),
		created: p.bigint(),
		isOriginal: p.boolean(),
		isClone: p.boolean(),
		denied: p.boolean(),
		closed: p.boolean(),
		original: p.string(),
		minimumCollateral: p.bigint(),
		annualInterestPPM: p.int(),
		reserveContribution: p.int(),
		start: p.bigint(),
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

	Challenge: p.createTable({
		id: p.string(),
		challenger: p.string(),
		position: p.string(),
		start: p.bigint(),
		duration: p.bigint(),
		size: p.bigint(),
		filledSize: p.bigint(),
		acquiredCollateral: p.bigint(),
		number: p.bigint(),
		bid: p.bigint(),
		status: p.string(),
	}),

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

	Minter: p.createTable({
		id: p.string(),
		minter: p.string(),
		applicationPeriod: p.bigint(),
		applicationFee: p.bigint(),
		applyMessage: p.string(),
		applyDate: p.bigint(),
		suggestor: p.string(),
		denyMessage: p.string().optional(),
		denyDate: p.bigint().optional(),
		vetor: p.string().optional(),
	}),

	Delegation: p.createTable({
		id: p.string(),
		owner: p.string(),
		pureDelegatedFrom: p.string().list(),
		delegatedTo: p.string().optional(),
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

	ActiveUser: p.createTable({
		id: p.string(),
		lastActiveTime: p.bigint(),
	}),
}));
