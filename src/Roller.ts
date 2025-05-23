import { ponder } from '@/generated';
import { getRandomHex } from './utils/randomString';

ponder.on('Roller:Roll', async ({ event, context }) => {
	const { RollerRolled } = context.db;
	const { source, collWithdraw, repay, target, collDeposit, mint } = event.args;

	// flat indexing
	await RollerRolled.create({
		id: `${source.toLowerCase()}-${target.toLowerCase()}-${event.block.number.toString()}-${event.log.logIndex}-${getRandomHex()}`,
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
