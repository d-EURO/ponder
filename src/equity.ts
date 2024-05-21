import { Context, ponder } from '@/generated';
import { zeroAddress } from 'viem';

ponder.on('Equity:Trade', async ({ event, context }) => {
	const { Trade, VotingPower, TradeChart, ActiveUser } = context.db;

	await Trade.create({
		id: event.args.who + '_' + event.block.timestamp.toString(),
		data: {
			trader: event.args.who,
			amount: event.args.totPrice,
			shares: event.args.amount,
			price: event.args.newprice,
			time: event.block.timestamp,
		},
	});

	await VotingPower.upsert({
		id: event.args.who,
		create: {
			address: event.args.who,
			votingPower: event.args.amount,
		},
		update: ({ current }) => ({
			votingPower: current.votingPower + event.args.amount,
		}),
	});

	const startTime = (event.block.timestamp / 86400n) * 86400n;
	await TradeChart.upsert({
		id: startTime.toString(),
		create: {
			time: startTime,
			lastPrice: event.args.newprice,
		},
		update: ({ current }) => ({
			lastPrice: event.args.newprice,
		}),
	});

	await ActiveUser.upsert({
		id: event.args.who,
		create: {
			lastActiveTime: event.block.timestamp,
		},
		update: () => ({
			lastActiveTime: event.block.timestamp,
		}),
	});
});

ponder.on('Equity:Transfer', async ({ event, context }) => {
	const { VotingPower, ActiveUser } = context.db;

	if (event.args.from == zeroAddress || event.args.to == zeroAddress) return;

	await VotingPower.update({
		id: event.args.from,
		data: ({ current }) => ({
			votingPower: current.votingPower - event.args.value,
		}),
	});

	await VotingPower.upsert({
		id: event.args.to,
		create: {
			address: event.args.to,
			votingPower: event.args.value,
		},
		update: ({ current }) => ({
			votingPower: current.votingPower + event.args.value,
		}),
	});

	await ActiveUser.upsert({
		id: event.args.from,
		create: {
			lastActiveTime: event.block.timestamp,
		},
		update: () => ({
			lastActiveTime: event.block.timestamp,
		}),
	});
	await ActiveUser.upsert({
		id: event.args.to,
		create: {
			lastActiveTime: event.block.timestamp,
		},
		update: () => ({
			lastActiveTime: event.block.timestamp,
		}),
	});
});

ponder.on('Equity:Delegation', async ({ event, context }) => {
	const { Delegation, ActiveUser } = context.db;

	await Delegation.upsert({
		id: event.args.from,
		create: {
			owner: event.args.from,
			delegatedTo: event.args.to,
		},
		update: {
			delegatedTo: event.args.to,
		},
	});

	await ActiveUser.upsert({
		id: event.args.from,
		create: {
			lastActiveTime: event.block.timestamp,
		},
		update: () => ({
			lastActiveTime: event.block.timestamp,
		}),
	});
});
