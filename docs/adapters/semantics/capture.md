# `CAPTURE` Semantic Reference

> **Adapter:** `StreamAdapter`  
> **Source:** `Readable` stream  
> **Representation:** `Buffer`  
> **Lifecycle Release:** Destroys stream if active

---

## Concept

The **`CAPTURE`** semantic takes temporary ownership or control over an ephemeral, single-use, or destructive resource. 

In Node.js, `Readable` streams cannot be re-read once they reach the `'end'` event. `StreamAdapter` captures the stream by draining its chunks into a persistent Buffer, enabling **repeatable replay** upon restoration.

```
Incoming Single-Use Stream (e.g. HTTP Upload)
       │
       ▼ consume() (Stream is drained & ended)
All chunks concatenated into Buffer  ── saved to Storage
       │
       ├── restore() ──▶ Fresh Readable Stream #1 (replayed from start)
       └── restore() ──▶ Fresh Readable Stream #2 (replayed from start)
```

---

## When to Use `CAPTURE`

- HTTP request bodies that need to be passed to multiple inspection middlewares.
- Streaming file uploads that must be archived and re-transmitted.
- Generator functions or iterables that are exhausted upon consumption.

---

## Example

```typescript
import { Readable } from 'stream';
import { GetoGateway, MemoryStorage, StreamAdapter } from '@mrjacket/geto';

const gateway = new GetoGateway({ storage: new MemoryStorage() });
const adapter = new StreamAdapter();

// Stream with multiple binary chunks
const originalStream = Readable.from(['Chunk A, ', 'Chunk B, ', 'Chunk C']);

// Stream is drained on consume()
const entity = await gateway.consume(originalStream, adapter);
console.log(originalStream.readableEnded); // true

// Stream is replayed on demand
const replayedStream = await gateway.restore(entity, adapter);
for await (const chunk of replayedStream) {
  process.stdout.write(chunk.toString());
}
// Outputs: "Chunk A, Chunk B, Chunk C"
```
