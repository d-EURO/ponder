import { createConfig } from "@ponder/core";
import { http, parseAbiItem } from "viem";

import { Equity } from "./abis/Equity";
import { MintingHub } from "./abis/MintingHub";
import { Frankencoin } from "./abis/Frankencoin";
import { Position } from "./abis/Position";

const transport = http(process.env.PONDER_RPC_URL_1);

const openPositionEvent = parseAbiItem(
  "event PositionOpened(address indexed owner,address indexed position,address zchf,address collateral,uint256 price)"
);

export default createConfig({
  networks: {
    mainnet: {
      chainId: 1,
      transport,
    },
  },
  contracts: {
    Frankencoin: {
      network: "mainnet",
      abi: Frankencoin,
      address: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
      startBlock: 18451518,
    },
    Equity: {
      network: "mainnet",
      abi: Equity,
      address: "0x1bA26788dfDe592fec8bcB0Eaff472a42BE341B2",
      startBlock: 18451518,
    },
    MintingHub: {
      network: "mainnet",
      abi: MintingHub,
      address: "0x7546762fdb1a6d9146b33960545C3f6394265219",
      startBlock: 18451536,
    },
    Position: {
      network: "mainnet",
      abi: Position,
      factory: {
        address: "0x7546762fdb1a6d9146b33960545C3f6394265219",
        event: openPositionEvent,
        parameter: "position",
      },
      startBlock: 18451536,
    },
  },
});
