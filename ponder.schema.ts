import { createSchema } from '@ponder/core';

export default createSchema((p) => ({
	// -------------------------------------------------------------------------
	// Stablecoin
	// -------------------------------------------------------------------------
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
	// -------------------------------------------------------------------------
	VotingPower: p.createTable({
		id: p.string(),
		address: p.string(),
		votingPower: p.bigint(),
	}),

	DEPS: p.createTable({
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
	// -------------------------------------------------------------------------
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
