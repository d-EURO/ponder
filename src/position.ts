import { ponder } from "@/generated";
import { Position as PositionABI } from "../abis/Position";

ponder.on("Position:MintingUpdate", async ({ event, context }) => {
  const { client } = context;
  const { Position, ActiveUser } = context.db;

  const originalLimitForClones = await client.readContract({
    abi: PositionABI,
    address: event.log.address,
    functionName: "limitForClones",
  });

  const position = await Position.findUnique({
    id: event.log.address.toLowerCase(),
  });
  if (position) {
    await Position.update({
      id: event.log.address.toLowerCase(),
      data: {
        limitForClones: originalLimitForClones,
        price: event.args.price,
        closed: event.args.collateral == 0n,
      },
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

ponder.on("Position:PositionDenied", async ({ event, context }) => {
  const { Position, ActiveUser } = context.db;

  const position = await Position.findUnique({
    id: event.log.address.toLowerCase(),
  });
  if (position) {
    await Position.update({
      id: event.log.address.toLowerCase(),
      data: {
        denied: true,
      },
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

ponder.on("Position:OwnershipTransferred", async ({ event, context }) => {
  const { Position, ActiveUser } = context.db;

  const position = await Position.findUnique({
    id: event.log.address.toLowerCase(),
  });
  if (position) {
    await Position.update({
      id: event.log.address.toLowerCase(),
      data: {
        owner: event.args.newOwner,
      },
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
