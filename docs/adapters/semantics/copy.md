# `COPY` Semantic Reference

> **Adapter:** `BufferAdapter`  
> **Source:** `Buffer`  
> **Representation:** `Buffer`  
> **Lifecycle Release:** Not required (independent memory clone)

---

## Concept

The **`COPY`** semantic creates an isolated, detached representation of the input resource. 

Modifying the original resource after consumption has **zero effect** on the stored entity. Similarly, modifying a restored resource does not mutate the gateway's stored data.

```
Caller's Buffer [0xAA, 0xBB]
       │
       ▼ consume()
Clone allocated: Buffer [0xAA, 0xBB]  ── saved to storage
       │
Caller modifies original -> [0xFF, 0xFF] (Storage remains [0xAA, 0xBB])
```

---

## When to Use `COPY`

- Cryptographic tokens or keys that must not be altered in place.
- High-frequency telemetry packets where caller buffers are pooled or recycled.
- Binary blobs where reference isolation is essential for consistency.

---

## Example

```typescript
import { GetoGateway, MemoryStorage, BufferAdapter } from '@mrjacket/geto';

const gateway = new GetoGateway({ storage: new MemoryStorage() });
const adapter = new BufferAdapter();

const source = Buffer.from('Isolated Data');
const entity = await gateway.consume(source, adapter);

// Caller mutates source in-place
source.fill(0);

// Restored data is completely untouched!
const restored = await gateway.restore(entity, adapter);
console.log(restored.toString()); // "Isolated Data"
```
