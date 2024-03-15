import { createSchema } from "@ponder/core";

export default createSchema((p) => ({
  Position: p.createTable({
    id: p.string(),
    position: p.string(),
    owner: p.string(),
    zchf: p.string(),
    collateral: p.string(),
    price: p.bigint(),
    created: p.bigint(),
    limitForClones: p.bigint(),
  }),

  Challenge: p.createTable({
    id: p.string(),
    challenger: p.string(),
    position: p.string(),
    start: p.bigint(),
    duration: p.bigint(),
    size: p.bigint(),
    filledSize: p.bigint(),
    acquiredCollateral: p.bigint(),
    number: p.bigint(),
    bid: p.bigint(),
    status: p.string(),
  }),

  VotingPower: p.createTable({
    id: p.string(),
    address: p.string(),
    votingPower: p.bigint(),
  }),

  FPS: p.createTable({
    id: p.string(),
    profits: p.bigint(),
    loss: p.bigint(),
    reserve: p.bigint(),
  }),

  Minter: p.createTable({
    id: p.string(),
    minter: p.string(),
    applicationPeriod: p.bigint(),
    applicationFee: p.bigint(),
    applyMessage: p.string(),
    applyDate: p.bigint(),
    suggestor: p.string(),
    denyMessage: p.string().optional(),
    denyDate: p.bigint().optional(),
    vetor: p.string().optional(),
  }),

  Delegation: p.createTable({
    id: p.string(),
    owner: p.string(),
    pureDelegatedFrom: p.string().list(),
    delegatedTo: p.string().optional(),
  }),

  Trade: p.createTable({
    id: p.string(),
    trader: p.string(),
    amount: p.bigint(),
    shares: p.bigint(),
    price: p.bigint(),
    time: p.bigint(),
  }),

  TradeChart: p.createTable({
    id: p.string(),
    time: p.bigint(),
    lastPrice: p.bigint(),
  }),
}));
