# Migration Proposal: Vereinigung Mint Tabellen

## Ziel
Vereinigung der `Mint` und `MintFromTransfer` Tabellen zu einer einzigen, erweiterten `Mint` Tabelle.

## Aktuelle Situation
- **Mint Tabelle**: Basis-Informationen über Mints
- **MintFromTransfer Tabelle**: Erweiterte Informationen für besseres Tracking
- **Redundanz**: Beide Tabellen speichern die gleichen Events

## Vorgeschlagene Lösung

### 1. Erweitere die bestehende `Mint` Tabelle:

```typescript
Mint: p.createTable({
  id: p.string(),
  // Bestehende Felder
  to: p.string(),              // Empfänger der geminteten Tokens
  value: p.bigint(),           // Menge
  blockheight: p.bigint(),
  timestamp: p.bigint(),
  txHash: p.string(),
  
  // NEUE Felder für besseres Tracking
  source: p.string().optional(),     // Contract der den Mint durchgeführt hat
  initiator: p.string().optional(),  // Ursprünglicher Transaction Sender
  logIndex: p.int().optional(),      // Log Index für eindeutige Identifikation
  mintType: p.string().optional(),   // "direct" | "cow" | "bridge" | "other"
}),
```

### 2. Aktualisiere den Event Handler:

```typescript
// In stablecoin.ts
if (event.args.from === zeroAddress) {
  // Bestimme Mint-Typ
  let mintType = "other";
  const txTo = event.transaction.to?.toLowerCase();
  
  if (txTo === ADDR.mintingHubGateway.toLowerCase()) {
    mintType = "direct";
  } else if (txTo === "0x9008d19f58aabd9ed0d60971565aa8510560ab41") { // CoW Protocol
    mintType = "cow";
  } else if (Object.values(ADDR).some(addr => 
    addr.toLowerCase().startsWith("bridge") && 
    addr.toLowerCase() === txTo
  )) {
    mintType = "bridge";
  }

  await Mint.create({
    id: `${event.args.to}-mint-${event.transaction.hash}-${event.log.logIndex}`,
    data: {
      to: event.args.to,
      value: event.args.value,
      blockheight: event.block.number,
      timestamp: event.block.timestamp,
      txHash: event.transaction.hash,
      // Neue Felder
      source: event.transaction.to || undefined,
      initiator: event.transaction.from,
      logIndex: Number(event.log.logIndex),
      mintType: mintType,
    },
  });
}
```

### 3. Lösche `MintFromTransfer` Tabelle
- Nicht mehr benötigt nach Migration

## Vorteile

1. **Keine Redundanz**: Eine Tabelle statt zwei
2. **Rückwärtskompatibel**: Alte Felder bleiben erhalten
3. **Besseres Tracking**: Neue Felder ermöglichen detaillierte Analyse
4. **Performance**: Weniger Schreiboperationen (1 statt 2 pro Mint)

## Migration Steps

1. Deploy neue Schema-Version mit erweiterten Feldern
2. Update Event Handler
3. Backfill historische Daten (optional)
4. Entferne MintFromTransfer Tabelle in nächster Version

## API Anpassungen

Die API muss minimal angepasst werden:
- Neue GraphQL Query für erweiterte Mint-Daten
- Filter für `mintType` ermöglichen
- Social Media Notifications basierend auf allen Mint-Typen