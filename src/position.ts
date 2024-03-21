import { ponder } from "@/generated";
import { Position as PositionABI } from "../abis/Position";

ponder.on("Position:MintingUpdate", async ({ event, context }) => {
  const { client } = context;
  const { Position } = context.db;

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
      },
    });
  }
});

ponder.on("Position:PositionDenied", async ({ event, context }) => {
  const { Position } = context.db;

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
});

ponder.on("Position:OwnershipTransferred", async ({ event, context }) => {
  const { Position } = context.db;

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
});
