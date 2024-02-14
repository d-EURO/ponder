import { ponder } from "@/generated";

ponder.on("Equity:Trade", async ({ event, context }) => {
  const { Trade } = context.db;

  await Trade.create({
    id: event.args.who + "_" + event.block.timestamp.toString(),
    data: {
      trader: event.args.who,
      amount: event.args.totPrice,
      shares: event.args.amount,
      price: event.args.newprice,
      time: event.block.timestamp,
    },
  });
});
