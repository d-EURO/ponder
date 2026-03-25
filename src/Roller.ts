import { ponder } from 'ponder:registry';
import { rollerRolled } from '../ponder.schema';

ponder.on('Roller:Roll', async ({ event, context }) => {
	const { db } = context;
	const { source, collWithdraw, repay, target, collDeposit, mint } = event.args;

	await db.insert(rollerRolled).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		created: event.block.timestamp,
		blockheight: event.block.number,
		owner: event.transaction.from,
		source,
		collWithdraw,
		repay,
		target,
		collDeposit,
		mint,
	});
});
