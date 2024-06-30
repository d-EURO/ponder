import { ponder } from '@/generated';
import { zeroAddress } from 'viem';

ponder.on('Frankencoin:Profit', async ({ event, context }) => {
	const { FPS, ActiveUser } = context.db;

	await FPS.upsert({
		id: event.log.address,
		create: {
			profits: event.args.amount,
			loss: 0n,
			reserve: 0n,
		},
		update: ({ current }) => ({
			profits: current.profits + event.args.amount,
		}),
	});

	await ActiveUser.upsert({
		id: event.transaction.from,
		create: {
			lastActiveTime: event.block.timestamp,
		},
		update: () => ({
			lastActiveTime: event.block.timestamp,
		}),
	});
});

ponder.on('Frankencoin:Loss', async ({ event, context }) => {
	const { FPS, ActiveUser } = context.db;

	await FPS.upsert({
		id: event.log.address,
		create: {
			profits: 0n,
			loss: event.args.amount,
			reserve: 0n,
		},
		update: ({ current }) => ({
			loss: current.profits + event.args.amount,
		}),
	});

	await ActiveUser.upsert({
		id: event.transaction.from,
		create: {
			lastActiveTime: event.block.timestamp,
		},
		update: () => ({
			lastActiveTime: event.block.timestamp,
		}),
	});
});

ponder.on('Frankencoin:MinterApplied', async ({ event, context }) => {
	const { Minter, ActiveUser } = context.db;

	await Minter.create({
		id: event.args.minter,
		data: {
			minter: event.args.minter,
			applicationPeriod: event.args.applicationPeriod,
			applicationFee: event.args.applicationFee,
			applyMessage: event.args.message,
			applyDate: event.block.timestamp,
			suggestor: event.transaction.from,
		},
	});

	await ActiveUser.upsert({
		id: event.transaction.from,
		create: {
			lastActiveTime: event.block.timestamp,
		},
		update: () => ({
			lastActiveTime: event.block.timestamp,
		}),
	});
});

ponder.on('Frankencoin:MinterDenied', async ({ event, context }) => {
	const { Minter, ActiveUser } = context.db;

	await Minter.update({
		id: event.args.minter,
		data: {
			denyMessage: event.args.message,
			denyDate: event.block.timestamp,
			vetor: event.transaction.from,
		},
	});

	await ActiveUser.upsert({
		id: event.transaction.from,
		create: {
			lastActiveTime: event.block.timestamp,
		},
		update: () => ({
			lastActiveTime: event.block.timestamp,
		}),
	});
});

ponder.on('Frankencoin:Transfer', async ({ event, context }) => {
	const { Mint, Burn, ActiveUser, Ecosystem } = context.db;

	// emit Transfer(address(0), recipient, amount);
	if (event.args.from === zeroAddress) {
		await Mint.create({
			id: `${event.args.to}-mint-${event.block.number}`,
			data: {
				to: event.args.to,
				value: event.args.value,
				blockheight: event.block.number,
				timestamp: event.block.timestamp,
			},
		});

		await Ecosystem.upsert({
			id: 'Frankencoin:Mint',
			create: {
				value: '',
				amount: event.args.value,
			},
			update: ({ current }) => ({
				amount: current.amount + event.args.value,
			}),
		});
	}

	// emit Transfer(account, address(0), amount);
	if (event.args.to === zeroAddress) {
		await Burn.create({
			id: `${event.args.to}-burn-${event.block.number}`,
			data: {
				from: event.args.from,
				value: event.args.value,
				blockheight: event.block.number,
				timestamp: event.block.timestamp,
			},
		});

		await Ecosystem.upsert({
			id: 'Frankencoin:Burn',
			create: {
				value: '',
				amount: event.args.value,
			},
			update: ({ current }) => ({
				amount: current.amount + event.args.value,
			}),
		});
	}

	await ActiveUser.upsert({
		id: event.transaction.from,
		create: {
			lastActiveTime: event.block.timestamp,
		},
		update: () => ({
			lastActiveTime: event.block.timestamp,
		}),
	});
});
