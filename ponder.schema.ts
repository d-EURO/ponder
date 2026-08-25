import { onchainTable } from 'ponder';

// -------------------------------------------------------------------------
// Stablecoin
// -------------------------------------------------------------------------
export const mint = onchainTable('mint', (t) => ({
	id: t.text().primaryKey(),
	to: t.text().notNull(),
	value: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	timestamp: t.bigint().notNull(),
	txHash: t.text().notNull(),
}));

export const burn = onchainTable('burn', (t) => ({
	id: t.text().primaryKey(),
	from: t.text().notNull(),
	value: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	timestamp: t.bigint().notNull(),
	txHash: t.text().notNull(),
}));

export const mintBurnAddressMapper = onchainTable('mint_burn_address_mapper', (t) => ({
	id: t.text().primaryKey(),
	mint: t.bigint().notNull(),
	burn: t.bigint().notNull(),
}));

export const minter = onchainTable('minter', (t) => ({
	id: t.text().primaryKey(),
	txHash: t.text().notNull(),
	minter: t.text().notNull(),
	applicationPeriod: t.bigint().notNull(),
	applicationFee: t.bigint().notNull(),
	applyMessage: t.text().notNull(),
	applyDate: t.bigint().notNull(),
	suggestor: t.text().notNull(),
	denyMessage: t.text(),
	denyDate: t.bigint(),
	denyTxHash: t.text(),
	vetor: t.text(),
}));

// -------------------------------------------------------------------------
// DEPS
// -------------------------------------------------------------------------
export const votingPower = onchainTable('voting_power', (t) => ({
	id: t.text().primaryKey(),
	address: t.text().notNull(),
	votingPower: t.bigint().notNull(),
}));

export const deps = onchainTable('deps', (t) => ({
	id: t.text().primaryKey(),
	profits: t.bigint().notNull(),
	loss: t.bigint().notNull(),
	reserve: t.bigint().notNull(),
}));

export const delegation = onchainTable('delegation', (t) => ({
	id: t.text().primaryKey(),
	owner: t.text().notNull(),
	delegatedTo: t.text().notNull(),
}));

export const trade = onchainTable('trade', (t) => ({
	id: t.text().primaryKey(),
	trader: t.text().notNull(),
	amount: t.bigint().notNull(),
	shares: t.bigint().notNull(),
	price: t.bigint().notNull(),
	time: t.bigint().notNull(),
	txHash: t.text().notNull(),
	frontendCode: t.text(),
}));

export const tradeChart = onchainTable('trade_chart', (t) => ({
	id: t.text().primaryKey(),
	time: t.bigint().notNull(),
	lastPrice: t.bigint().notNull(),
}));

// -------------------------------------------------------------------------
// SAVINGS AND ROLLER
// -------------------------------------------------------------------------
export const savingsRateProposed = onchainTable('savings_rate_proposed', (t) => ({
	id: t.text().primaryKey(),
	created: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	txHash: t.text().notNull(),
	proposer: t.text().notNull(),
	nextRate: t.integer().notNull(),
	nextChange: t.integer().notNull(),
	source: t.text().notNull(),
}));

export const savingsRateChanged = onchainTable('savings_rate_changed', (t) => ({
	id: t.text().primaryKey(),
	created: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	txHash: t.text().notNull(),
	approvedRate: t.integer().notNull(),
	source: t.text().notNull(),
}));

export const savingsSaved = onchainTable('savings_saved', (t) => ({
	id: t.text().primaryKey(),
	created: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	txHash: t.text().notNull(),
	account: t.text().notNull(),
	amount: t.bigint().notNull(),
	rate: t.integer().notNull(),
	total: t.bigint().notNull(),
	balance: t.bigint().notNull(),
	frontendCode: t.text(),
}));

export const savingsSavedMapping = onchainTable('savings_saved_mapping', (t) => ({
	id: t.text().primaryKey(),
	created: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	updated: t.bigint().notNull(),
	amount: t.bigint().notNull(),
}));

export const savingsInterest = onchainTable('savings_interest', (t) => ({
	id: t.text().primaryKey(),
	created: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	txHash: t.text().notNull(),
	account: t.text().notNull(),
	amount: t.bigint().notNull(),
	rate: t.integer().notNull(),
	total: t.bigint().notNull(),
	balance: t.bigint().notNull(),
	compounded: t.boolean(),
}));

export const savingsInterestMapping = onchainTable('savings_interest_mapping', (t) => ({
	id: t.text().primaryKey(),
	created: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	updated: t.bigint().notNull(),
	amount: t.bigint().notNull(),
}));

export const savingsWithdrawn = onchainTable('savings_withdrawn', (t) => ({
	id: t.text().primaryKey(),
	created: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	txHash: t.text().notNull(),
	account: t.text().notNull(),
	amount: t.bigint().notNull(),
	rate: t.integer().notNull(),
	total: t.bigint().notNull(),
	balance: t.bigint().notNull(),
}));

export const savingsWithdrawnMapping = onchainTable('savings_withdrawn_mapping', (t) => ({
	id: t.text().primaryKey(),
	created: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	updated: t.bigint().notNull(),
	amount: t.bigint().notNull(),
}));

export const savingsUserLeaderboard = onchainTable('savings_user_leaderboard', (t) => ({
	id: t.text().primaryKey(),
	amountSaved: t.bigint().notNull(),
	interestReceived: t.bigint().notNull(),
}));

export const savingsVaultHolder = onchainTable('savings_vault_holder', (t) => ({
	id: t.text().primaryKey(),
	vault: t.text().notNull(),
	owner: t.text().notNull(),
	shares: t.bigint().notNull(),
}));

export const savingsStats = onchainTable('savings_stats', (t) => ({
	id: t.text().primaryKey(),
	totalUsers: t.integer().notNull(),
	lastUpdated: t.bigint().notNull(),
}));

export const savingsTotalHistory = onchainTable('savings_total_history', (t) => ({
	id: t.text().primaryKey(),
	time: t.bigint().notNull(),
	total: t.bigint().notNull(),
}));

export const rollerRolled = onchainTable('roller_rolled', (t) => ({
	id: t.text().primaryKey(),
	created: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	owner: t.text().notNull(),
	source: t.text().notNull(),
	collWithdraw: t.bigint().notNull(),
	repay: t.bigint().notNull(),
	target: t.text().notNull(),
	collDeposit: t.bigint().notNull(),
	mint: t.bigint().notNull(),
	rollerAddress: t.text().notNull(),
}));

// -------------------------------------------------------------------------
// MINTINGHUB V2
// -------------------------------------------------------------------------
export const positionV2 = onchainTable('position_v2', (t) => ({
	id: t.text().primaryKey(),
	position: t.text().notNull(),
	owner: t.text().notNull(),
	deuro: t.text().notNull(),
	collateral: t.text().notNull(),
	price: t.bigint().notNull(),
	created: t.bigint().notNull(),
	isOriginal: t.boolean().notNull(),
	isClone: t.boolean().notNull(),
	denied: t.boolean().notNull(),
	closed: t.boolean().notNull(),
	original: t.text().notNull(),
	minimumCollateral: t.bigint().notNull(),
	riskPremiumPPM: t.integer().notNull(),
	reserveContribution: t.integer().notNull(),
	start: t.integer().notNull(),
	cooldown: t.bigint().notNull(),
	expiration: t.integer().notNull(),
	challengePeriod: t.bigint().notNull(),
	deuroName: t.text().notNull(),
	deuroSymbol: t.text().notNull(),
	deuroDecimals: t.integer().notNull(),
	collateralName: t.text().notNull(),
	collateralSymbol: t.text().notNull(),
	collateralDecimals: t.integer().notNull(),
	collateralBalance: t.bigint().notNull(),
	limitForClones: t.bigint().notNull(),
	availableForClones: t.bigint().notNull(),
	availableForMinting: t.bigint().notNull(),
	fixedAnnualRatePPM: t.integer().notNull(),
	principal: t.bigint().notNull(),
	virtualPrice: t.bigint().notNull(),
	actualVirtualPrice: t.bigint().notNull(),
	mintingHubAddress: t.text().notNull(),
}));

export const mintingUpdateV2 = onchainTable('minting_update_v2', (t) => ({
	id: t.text().primaryKey(),
	txHash: t.text().notNull(),
	created: t.bigint().notNull(),
	position: t.text().notNull(),
	owner: t.text().notNull(),
	isClone: t.boolean().notNull(),
	collateral: t.text().notNull(),
	collateralName: t.text().notNull(),
	collateralSymbol: t.text().notNull(),
	collateralDecimals: t.integer().notNull(),
	size: t.bigint().notNull(),
	price: t.bigint().notNull(),
	minted: t.bigint().notNull(),
	sizeAdjusted: t.bigint().notNull(),
	priceAdjusted: t.bigint().notNull(),
	mintedAdjusted: t.bigint().notNull(),
	annualInterestPPM: t.integer().notNull(),
	basePremiumPPM: t.integer().notNull(),
	riskPremiumPPM: t.integer().notNull(),
	reserveContribution: t.integer().notNull(),
	feeTimeframe: t.integer().notNull(),
	feePPM: t.integer().notNull(),
	feePaid: t.bigint().notNull(),
	cooldown: t.bigint().notNull(),
	mintingHubAddress: t.text().notNull(),
}));

export const challengeV2 = onchainTable('challenge_v2', (t) => ({
	id: t.text().primaryKey(),
	txHash: t.text().notNull(),
	position: t.text().notNull(),
	number: t.bigint().notNull(),
	challenger: t.text().notNull(),
	start: t.integer().notNull(),
	created: t.bigint().notNull(),
	duration: t.bigint().notNull(),
	size: t.bigint().notNull(),
	liqPrice: t.bigint().notNull(),
	bids: t.bigint().notNull(),
	filledSize: t.bigint().notNull(),
	acquiredCollateral: t.bigint().notNull(),
	status: t.text().notNull(),
	mintingHubAddress: t.text().notNull(),
}));

export const challengeBidV2 = onchainTable('challenge_bid_v2', (t) => ({
	id: t.text().primaryKey(),
	txHash: t.text().notNull(),
	position: t.text().notNull(),
	number: t.bigint().notNull(),
	numberBid: t.bigint().notNull(),
	bidder: t.text().notNull(),
	created: t.bigint().notNull(),
	bidType: t.text().notNull(),
	bid: t.bigint().notNull(),
	price: t.bigint().notNull(),
	filledSize: t.bigint().notNull(),
	acquiredCollateral: t.bigint().notNull(),
	challengeSize: t.bigint().notNull(),
	mintingHubAddress: t.text().notNull(),
}));

export const positionMint = onchainTable('position_mint', (t) => ({
	id: t.text().primaryKey(),
	positionAddress: t.text(),
	to: t.text().notNull(),
	value: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	timestamp: t.bigint().notNull(),
	txHash: t.text().notNull(),
	mintingHubAddress: t.text().notNull(),
}));

// -------------------------------------------------------------------------
// MINTINGHUB LEADRATE (V3)
// -------------------------------------------------------------------------
export const mintingHubRateProposed = onchainTable('minting_hub_rate_proposed', (t) => ({
	id: t.text().primaryKey(),
	created: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	txHash: t.text().notNull(),
	proposer: t.text().notNull(),
	nextRate: t.integer().notNull(),
	nextChange: t.integer().notNull(),
}));

export const mintingHubRateChanged = onchainTable('minting_hub_rate_changed', (t) => ({
	id: t.text().primaryKey(),
	created: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	txHash: t.text().notNull(),
	approvedRate: t.integer().notNull(),
}));

// -------------------------------------------------------------------------
// MINTINGHUB GOVERNANCE EVENTS (V3)
// -------------------------------------------------------------------------
export const forcedSale = onchainTable('forced_sale', (t) => ({
	id: t.text().primaryKey(),
	position: t.text().notNull(),
	amount: t.bigint().notNull(),
	priceE36MinusDecimals: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	timestamp: t.bigint().notNull(),
	txHash: t.text().notNull(),
}));

export const postponedReturn = onchainTable('postponed_return', (t) => ({
	id: t.text().primaryKey(),
	collateral: t.text().notNull(),
	beneficiary: t.text().notNull(),
	amount: t.bigint().notNull(),
	mintingHubAddress: t.text().notNull(),
	blockheight: t.bigint().notNull(),
	created: t.bigint().notNull(),
	txHash: t.text().notNull(),
}));

export const positionDeniedByGovernance = onchainTable('position_denied_by_governance', (t) => ({
	id: t.text().primaryKey(),
	position: t.text().notNull(),
	denier: t.text().notNull(),
	message: t.text().notNull(),
	blockheight: t.bigint().notNull(),
	timestamp: t.bigint().notNull(),
	txHash: t.text().notNull(),
}));

// -------------------------------------------------------------------------
// SAVINGS VAULT (V2 + V3)
// -------------------------------------------------------------------------
export const savingsVaultDeposit = onchainTable('savings_vault_deposit', (t) => ({
	id: t.text().primaryKey(),
	vault: t.text().notNull(),
	sender: t.text().notNull(),
	owner: t.text().notNull(),
	assets: t.bigint().notNull(),
	shares: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	timestamp: t.bigint().notNull(),
	txHash: t.text().notNull(),
}));

export const savingsVaultWithdraw = onchainTable('savings_vault_withdraw', (t) => ({
	id: t.text().primaryKey(),
	vault: t.text().notNull(),
	sender: t.text().notNull(),
	receiver: t.text().notNull(),
	owner: t.text().notNull(),
	assets: t.bigint().notNull(),
	shares: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	timestamp: t.bigint().notNull(),
	txHash: t.text().notNull(),
}));

export const savingsVaultInterestClaimed = onchainTable('savings_vault_interest_claimed', (t) => ({
	id: t.text().primaryKey(),
	vault: t.text().notNull(),
	interest: t.bigint().notNull(),
	totalClaimed: t.bigint().notNull(),
	blockheight: t.bigint().notNull(),
	timestamp: t.bigint().notNull(),
	txHash: t.text().notNull(),
}));

// -------------------------------------------------------------------------
// FRONTEND GATEWAY
// -------------------------------------------------------------------------
export const frontendCodeRegistered = onchainTable('frontend_code_registered', (t) => ({
	id: t.text().primaryKey(),
	created: t.bigint().notNull(),
	owner: t.text().notNull(),
	frontendCode: t.text().notNull(),
	txHash: t.text().notNull(),
}));

export const frontendCodeMapping = onchainTable('frontend_code_mapping', (t) => ({
	id: t.text().primaryKey(),
	frontendCodes: t.text().array().notNull(),
}));

export const investRewardAdded = onchainTable('invest_reward_added', (t) => ({
	id: t.text().primaryKey(),
	frontendCode: t.text().notNull(),
	user: t.text().notNull(),
	amount: t.bigint().notNull(),
	reward: t.bigint().notNull(),
	timestamp: t.bigint().notNull(),
	txHash: t.text().notNull(),
}));

export const redeemRewardAdded = onchainTable('redeem_reward_added', (t) => ({
	id: t.text().primaryKey(),
	frontendCode: t.text().notNull(),
	user: t.text().notNull(),
	amount: t.bigint().notNull(),
	reward: t.bigint().notNull(),
	timestamp: t.bigint().notNull(),
	txHash: t.text().notNull(),
}));

export const unwrapAndSellRewardAdded = onchainTable('unwrap_and_sell_reward_added', (t) => ({
	id: t.text().primaryKey(),
	frontendCode: t.text().notNull(),
	user: t.text().notNull(),
	amount: t.bigint().notNull(),
	reward: t.bigint().notNull(),
	timestamp: t.bigint().notNull(),
	txHash: t.text().notNull(),
}));

export const savingsRewardAdded = onchainTable('savings_reward_added', (t) => ({
	id: t.text().primaryKey(),
	frontendCode: t.text().notNull(),
	user: t.text().notNull(),
	interest: t.bigint().notNull(),
	reward: t.bigint().notNull(),
	timestamp: t.bigint().notNull(),
	txHash: t.text().notNull(),
}));

export const positionRewardAdded = onchainTable('position_reward_added', (t) => ({
	id: t.text().primaryKey(),
	frontendCode: t.text().notNull(),
	user: t.text().notNull(),
	position: t.text().notNull(),
	amount: t.bigint().notNull(),
	reward: t.bigint().notNull(),
	timestamp: t.bigint().notNull(),
	txHash: t.text().notNull(),
}));

export const frontendRewardsMapping = onchainTable('frontend_rewards_mapping', (t) => ({
	id: t.text().primaryKey(),
	totalReffered: t.integer().notNull(),
	referred: t.text().array().notNull(),
	loansVolume: t.bigint().notNull(),
	investVolume: t.bigint().notNull(),
	savingsVolume: t.bigint().notNull(),
	totalVolume: t.bigint().notNull(),
}));

export const frontendRewardsVolumeMapping = onchainTable('frontend_rewards_volume_mapping', (t) => ({
	id: t.text().primaryKey(),
	frontendCode: t.text().notNull(),
	referred: t.text().notNull(),
	volume: t.bigint().notNull(),
	timestamp: t.bigint().notNull(),
}));

export const frontendBonusHistoryMapping = onchainTable('frontend_bonus_history_mapping', (t) => ({
	id: t.text().primaryKey(),
	frontendCode: t.text().notNull(),
	payout: t.bigint().notNull(),
	source: t.text().notNull(),
	timestamp: t.bigint().notNull(),
	txHash: t.text().notNull(),
}));

// -------------------------------------------------------------------------
// BRIDGES
// -------------------------------------------------------------------------
export const bridgeEURS = onchainTable('bridge_eurs', (t) => ({
	id: t.text().primaryKey(),
	swapper: t.text().notNull(),
	txHash: t.text().notNull(),
	amount: t.bigint().notNull(),
	isMint: t.boolean().notNull(),
	timestamp: t.bigint().notNull(),
}));

export const bridgeVEUR = onchainTable('bridge_veur', (t) => ({
	id: t.text().primaryKey(),
	swapper: t.text().notNull(),
	txHash: t.text().notNull(),
	amount: t.bigint().notNull(),
	isMint: t.boolean().notNull(),
	timestamp: t.bigint().notNull(),
}));

export const bridgeEURC = onchainTable('bridge_eurc', (t) => ({
	id: t.text().primaryKey(),
	swapper: t.text().notNull(),
	txHash: t.text().notNull(),
	amount: t.bigint().notNull(),
	isMint: t.boolean().notNull(),
	timestamp: t.bigint().notNull(),
}));

export const bridgeEURR = onchainTable('bridge_eurr', (t) => ({
	id: t.text().primaryKey(),
	swapper: t.text().notNull(),
	txHash: t.text().notNull(),
	amount: t.bigint().notNull(),
	isMint: t.boolean().notNull(),
	timestamp: t.bigint().notNull(),
}));

export const bridgeEUROP = onchainTable('bridge_europ', (t) => ({
	id: t.text().primaryKey(),
	swapper: t.text().notNull(),
	txHash: t.text().notNull(),
	amount: t.bigint().notNull(),
	isMint: t.boolean().notNull(),
	timestamp: t.bigint().notNull(),
}));

export const bridgeEURI = onchainTable('bridge_euri', (t) => ({
	id: t.text().primaryKey(),
	swapper: t.text().notNull(),
	txHash: t.text().notNull(),
	amount: t.bigint().notNull(),
	isMint: t.boolean().notNull(),
	timestamp: t.bigint().notNull(),
}));

export const bridgeEURE = onchainTable('bridge_eure', (t) => ({
	id: t.text().primaryKey(),
	swapper: t.text().notNull(),
	txHash: t.text().notNull(),
	amount: t.bigint().notNull(),
	isMint: t.boolean().notNull(),
	timestamp: t.bigint().notNull(),
}));

// -------------------------------------------------------------------------
// COMMON
// -------------------------------------------------------------------------
export const activeUser = onchainTable('active_user', (t) => ({
	id: t.text().primaryKey(),
	lastActiveTime: t.bigint().notNull(),
}));

export const ecosystem = onchainTable('ecosystem', (t) => ({
	id: t.text().primaryKey(),
	value: t.text().notNull(),
	amount: t.bigint().notNull(),
}));

export const stablecoinTransferHistory = onchainTable('stablecoin_transfer_history', (t) => ({
	id: t.text().primaryKey(),
	from: t.text().notNull(),
	to: t.text().notNull(),
	amount: t.bigint().notNull(),
	timestamp: t.bigint().notNull(),
	txHash: t.text().notNull(),
	blockheight: t.bigint().notNull(),
	transactionTo: t.text(),
}));
