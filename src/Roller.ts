import { ponder } from 'ponder:registry';
import { getAddress } from 'viem';
import { rollerRolled } from '../ponder.schema';

const rollHandler = async ({ event, context }: any) => {
	const { db } = context;
	const { source, collWithdraw, repay, target, collDeposit, mint } = event.args;

	await db.insert(rollerRolled).values({
		id: `${event.transaction.hash}-${event.log.logIndex}`,
		created: event.block.timestamp,
		blockheight: event.block.number,
		owner: getAddress(event.transaction.from),
		source: getAddress(source),
		collWithdraw,
		repay,
		target: getAddress(target),
		collDeposit,
		mint,
		rollerAddress: getAddress(event.log.address),
	});
};

ponder.on('RollerV2:Roll', rollHandler);
ponder.on('RollerV3:Roll', rollHandler);
