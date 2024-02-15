import { ponder } from "@/generated";
import { Position } from "../abis/Position";

ponder.on("MintingHub:PositionOpened", async ({ event, context }) => {
  const { Position } = context.db;

  await Position.create({
    id: event.log.id,
    data: {
      position: event.args.position,
      owner: event.args.owner,
      zchf: event.args.zchf,
      collateral: event.args.collateral,
      price: event.args.price,
      created: event.block.timestamp,
    },
  });
});

ponder.on("MintingHub:ChallengeStarted", async ({ event, context }) => {
  const { client } = context;
  const { Challenge } = context.db;
  const { MintingHub } = context.contracts;

  const challenges = await client.readContract({
    abi: MintingHub.abi,
    address: MintingHub.address,
    functionName: "challenges",
    args: [event.args.number],
  });

  const period = await client.readContract({
    abi: Position,
    address: event.args.position,
    functionName: "challengePeriod",
  });

  await Challenge.create({
    id: getChallengeId(event.args.position, event.args.number),
    data: {
      position: event.args.position,
      number: event.args.number,
      challenger: event.args.challenger,
      size: event.args.size,
      start: challenges[1],
      duration: period,
      bid: 0n,
      acquiredCollateral: 0n,
      filledSize: 0n,
      status: "Active",
    },
  });
});

ponder.on("MintingHub:ChallengeAverted", async ({ event, context }) => {
  const { client } = context;
  const { Challenge } = context.db;
  const { MintingHub } = context.contracts;

  const challenges = await client.readContract({
    abi: MintingHub.abi,
    address: MintingHub.address,
    functionName: "challenges",
    args: [event.args.number],
  });

  const challengeId = getChallengeId(event.args.position, event.args.number);

  await Challenge.update({
    id: challengeId,
    data: ({ current }) => ({
      filledSize: current.filledSize + event.args.size,
      status: challenges[3] === 0n ? "Success" : current.status,
    }),
  });
});

ponder.on("MintingHub:ChallengeSucceeded", async ({ event, context }) => {
  const { client } = context;
  const { Challenge } = context.db;
  const { MintingHub } = context.contracts;

  const challenges = await client.readContract({
    abi: MintingHub.abi,
    address: MintingHub.address,
    functionName: "challenges",
    args: [event.args.number],
  });

  const challengeId = getChallengeId(event.args.position, event.args.number);

  await Challenge.update({
    id: challengeId,
    data: ({ current }) => ({
      bid: current.bid + event.args.bid,
      acquiredCollateral:
        current.acquiredCollateral + event.args.acquiredCollateral,
      filledSize: current.filledSize + event.args.challengeSize,
      status: challenges[3] === 0n ? "Success" : current.status,
    }),
  });
});

const getChallengeId = (position: string, number: bigint) => {
  return `${position}-challenge-${number}`;
};
