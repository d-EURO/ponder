import { ponder } from '@/generated';

ponder.on('Roller:Roll', async ({ event, context }) => {
	const { RollerRolled } = context.db;
	const { source, collWithdraw, repay, target, collDeposit, mint } = event.args;

	// flat indexing
	await RollerRolled.create({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		data: {
			created: event.block.timestamp,
			blockheight: event.block.number,
			owner: event.transaction.from,
			source,
			collWithdraw,
			repay,
			target,
			collDeposit,
			mint,
		},
	});
});
