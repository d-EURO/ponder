# Migration Guide: Extended Mint Tracking

## Breaking Changes
None - all new fields are optional.

## Database Migration
No migration needed. Ponder will automatically handle the schema extension.

## For API Consumers

### Before (existing queries continue to work):
```graphql
query GetMints {
  mints {
    items {
      to
      value
      txHash
      timestamp
    }
  }
}
```

### After (new fields available):
```graphql
query GetMintsExtended {
  mints {
    items {
      to
      value
      txHash
      timestamp
      # New optional fields
      source
      initiator
      logIndex
      mintType
    }
  }
}
```

## Backfilling Historical Data

Historical mints will have:
- All original fields populated
- New fields will be `null`

To backfill historical data:
1. Re-index from block 0, OR
2. Accept that old mints won't have the extended data

## Monitoring

Monitor for:
- Mints with `mintType: "other"` - these are from CoW/DEX
- Increase in total mint count (now catching all mints)
- Any mints with `source: null` (edge cases)