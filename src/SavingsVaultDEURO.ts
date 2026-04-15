import { ponder } from 'ponder:registry';
import { getAddress, zeroAddress } from 'viem';
import { savingsVaultDeposit, savingsVaultWithdraw, savingsVaultInterestClaimed } from '../ponder.schema';
import { normalizeSavingsAccount, syncSavingsUserAggregate } from './utils/savings';

const depositHandler = async ({ event, context }: any) => {
	const { client, db } = context;
	const owner = normalizeSavingsAccount(event.args.owner);

	await db.insert(savingsVaultDeposit).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		vault: getAddress(event.log.address),
		sender: getAddress(event.args.sender),
		owner,
		assets: event.args.assets,
		shares: event.args.shares,
		blockheight: event.block.number,
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});

	await syncSavingsUserAggregate(db, client, owner, event.block.number, event.block.timestamp);
};

const withdrawHandler = async ({ event, context }: any) => {
	const { client, db } = context;
	const owner = normalizeSavingsAccount(event.args.owner);

	await db.insert(savingsVaultWithdraw).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		vault: getAddress(event.log.address),
		sender: getAddress(event.args.sender),
		receiver: getAddress(event.args.receiver),
		owner,
		assets: event.args.assets,
		shares: event.args.shares,
		blockheight: event.block.number,
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});

	await syncSavingsUserAggregate(db, client, owner, event.block.number, event.block.timestamp);
};

const interestClaimedHandler = async ({ event, context }: any) => {
	const { db } = context;
	await db.insert(savingsVaultInterestClaimed).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		vault: getAddress(event.log.address),
		interest: event.args.interest,
		totalClaimed: event.args.totalClaimed,
		blockheight: event.block.number,
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});
};

// Peer-to-peer share transfers bypass Deposit/Withdraw — resync both sides so amountSaved stays correct.
// Mint (from=0) is already handled by Deposit; burn (to=0) by Withdraw.
const transferHandler = async ({ event, context }: any) => {
	const { client, db } = context;
	const { from, to, value } = event.args;

	if (value === 0n) return;
	if (from === zeroAddress || to === zeroAddress) return;

	await syncSavingsUserAggregate(db, client, from, event.block.number, event.block.timestamp);
	await syncSavingsUserAggregate(db, client, to, event.block.number, event.block.timestamp);
};

ponder.on('SavingsVaultV2:Deposit', depositHandler);
ponder.on('SavingsVaultV3:Deposit', depositHandler);
ponder.on('SavingsVaultV2:Withdraw', withdrawHandler);
ponder.on('SavingsVaultV3:Withdraw', withdrawHandler);
ponder.on('SavingsVaultV2:InterestClaimed', interestClaimedHandler);
ponder.on('SavingsVaultV3:InterestClaimed', interestClaimedHandler);
ponder.on('SavingsVaultV2:Transfer', transferHandler);
ponder.on('SavingsVaultV3:Transfer', transferHandler);
