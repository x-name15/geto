# `SERIALIZE` Semantic Reference

> **Adapter:** `JsonAdapter<T>`  
> **Source:** `T` (JavaScript object, array, primitive)  
> **Representation:** `string` (JSON)  
> **Lifecycle Release:** Not required

---

## Concept

The **`SERIALIZE`** semantic transforms a structured, in-memory language construct into an inert, persistent representation format ($T \neq R$).

Upon restoration, the serialized payload is parsed and hydrated back into the original language structure.

```
JS Object { id: 1, role: 'special-grade' }
       │
       ▼ consume()
JSON String '{"id":1,"role":"special-grade"}'  ── saved to Storage/Disk
       │
       ▼ restore()
Parsed JS Object { id: 1, role: 'special-grade' }
```

---

## When to Use `SERIALIZE`

- Complex application state snapshots.
- User session stores.
- Database records or domain models persisted across process restarts.
- Binary serialization formats (Protobuf, MessagePack, BSON).

---

## Example

```typescript
import { GetoGateway, FileStorage, JsonAdapter } from '@mrjacket/geto';

interface IUserRecord {
  id: string;
  name: string;
  skills: string[];
}

const gateway = new GetoGateway({
  storage: new FileStorage('./.data')
});

const adapter = new JsonAdapter<IUserRecord>();

const user: IUserRecord = {
  id: 'u-001',
  name: 'Satoru Gojo',
  skills: ['Limitless', 'Six Eyes'],
};

// Object is serialized to JSON string and saved on disk
const entity = await gateway.consume(user, adapter);

// Disk file read, JSON parsed, and returned with full TypeScript typing
const restored = await gateway.restore(entity, adapter);
console.log(restored.name); // "Satoru Gojo"
```
