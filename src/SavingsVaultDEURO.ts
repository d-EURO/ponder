import { ponder } from 'ponder:registry';
import { getAddress, zeroAddress } from 'viem';
import { savingsVaultDeposit, savingsVaultWithdraw, savingsVaultInterestClaimed } from '../ponder.schema';
import { normalizeSavingsAccount, syncSavingsUserAggregate } from './utils/savings';

ponder.on('SavingsVaultDEURO:Deposit', async ({ event, context }) => {
	const { client, db } = context;
	const owner = normalizeSavingsAccount(event.args.owner);

	await db.insert(savingsVaultDeposit).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		sender: getAddress(event.args.sender),
		owner,
		assets: event.args.assets,
		shares: event.args.shares,
		blockheight: event.block.number,
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});

	await syncSavingsUserAggregate(db, client, owner, event.block.number, event.block.timestamp);
});

ponder.on('SavingsVaultDEURO:Withdraw', async ({ event, context }) => {
	const { client, db } = context;
	const owner = normalizeSavingsAccount(event.args.owner);

	await db.insert(savingsVaultWithdraw).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
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
});

ponder.on('SavingsVaultDEURO:InterestClaimed', async ({ event, context }) => {
	const { db } = context;
	await db.insert(savingsVaultInterestClaimed).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		interest: event.args.interest,
		totalClaimed: event.args.totalClaimed,
		blockheight: event.block.number,
		timestamp: event.block.timestamp,
		txHash: event.transaction.hash,
	});
});

// Share transfers bypass Deposit/Withdraw — resync both sides so amountSaved stays correct.
// Mints (from=0) and burns (to=0) are already covered by Deposit/Withdraw, so skip them here.
ponder.on('SavingsVaultDEURO:Transfer', async ({ event, context }) => {
	const { client, db } = context;
	const { from, to, value } = event.args;

	if (value === 0n) return;

	if (from !== zeroAddress) {
		await syncSavingsUserAggregate(db, client, from, event.block.number, event.block.timestamp);
	}
	if (to !== zeroAddress) {
		await syncSavingsUserAggregate(db, client, to, event.block.number, event.block.timestamp);
	}
});
