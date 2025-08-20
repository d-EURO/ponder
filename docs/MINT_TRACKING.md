# Mint Tracking Enhancement

## Overview
Extended the `Mint` table to track ALL mints from Transfer events, including those from CoW Protocol and other automated systems.

## New Fields

### `source` (optional)
- The contract address that performed the mint (transaction.to)
- Helps identify which system initiated the mint

### `initiator` (optional)  
- The EOA or contract that initiated the transaction (transaction.from)
- Useful for tracking the original requester

### `logIndex` (optional)
- The log index within the transaction
- Ensures unique identification when multiple mints occur in one transaction

### `mintType` (optional)
- Categorization of the mint source:
  - `"direct"` - Mints from MintingHub (position-based mints)
  - `"bridge"` - Mints from bridge contracts (EURC, EURS, etc.)
  - `"other"` - All other sources (CoW Protocol, DEX aggregators, etc.)

## Usage in API

Query the extended Mint table to get all mints:

```graphql
query GetMints {
  mints(orderBy: "timestamp", orderDirection: "desc") {
    items {
      to
      value
      txHash
      timestamp
      source
      initiator
      mintType
    }
  }
}
```

Filter by mintType to get specific categories:
- Get only CoW/automated mints: `mintType: "other"`
- Get only direct position mints: `mintType: "direct"`

## Benefits

1. **Complete Coverage**: Captures ALL mints, not just those with MintingUpdateV2 events
2. **Better Analytics**: Can analyze mint patterns by type and source
3. **Social Media Notifications**: Enables notifications for all mint types
4. **Backward Compatible**: Existing queries continue to work