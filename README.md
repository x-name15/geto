<p align="center">
  <img src=".github/images/geto-ascii.png" width="120" height="120" alt="geto logo">
</p>

<h1 align="center">geto</h1>

<p align="center">
  <strong>Consume anything. Use it later.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@mrjacket/geto">
    <img src="https://img.shields.io/npm/v/@mrjacket/geto.svg?color=success" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/@mrjacket/geto">
    <img src="https://img.shields.io/npm/dm/@mrjacket/geto.svg" alt="npm downloads">
  </a>
  <a href="https://www.npmjs.com/package/@mrjacket/geto">
    <img src="https://img.shields.io/node/v/@mrjacket/geto.svg" alt="node">
  </a>
  <a href="https://github.com/x-name15/geto/actions/workflows/ci.yml">
    <img src="https://github.com/x-name15/geto/actions/workflows/ci.yml/badge.svg" alt="ci">
  </a>
  <a href="https://www.npmjs.com/package/@mrjacket/geto">
    <img src="https://img.shields.io/npm/types/@mrjacket/geto.svg" alt="types">
  </a>
  <a href="https://github.com/x-name15/geto/blob/main/LICENSE">
    <img src="https://img.shields.io/npm/l/@mrjacket/geto.svg" alt="license">
  </a>
</p>

---

<p align="center">
  <em>"Exorcise and absorb. Exorcise and absorb. The world just keeps repeating that cycle."</em><br>
  — <strong>Suguru Geto, Jujutsu Kaisen</strong>
</p>

---

**geto** is an extensible resource consumption and entity lifecycle gateway for Node.js.

You define what consuming a resource means.  
geto handles everything that comes after.

Buffer. File. Stream. Process. HTTP resource. Custom object.  
If you can write an adapter for it, geto can manage it.

---

## How it works

```
Resource
  │
  ▼
Adapter          ← you define this
  │
  ▼
GetoGateway      ← geto owns this
  ├── identity
  ├── storage
  ├── lifecycle
  └── metadata
  │
  ▼
Entity
```

The gateway does not know what a file is. It does not know what a stream is.  
It knows how to manage what your adapter gives it.

---

## Installation

```bash
npm install @mrjacket/geto
```

**Requirements:** Node.js >= 22.12.0

---

## Documentation

Explore the full documentation portal in the [`docs/`](./docs/README.md) directory:

- [Getting Started](./docs/guides/getting-started.md)
- [Library API Reference](./docs/guides/library.md)
- [Production Recipes & Patterns](./docs/guides/recipes.md)
- [Adapters & The 5 Semantics](./docs/adapters/overview.md)
- [Storage Providers Guide](./docs/storage/overview.md)
- [Developer Manual](./docs/guides/DEVELOPER_GUIDE.md)
- [CI/CD & DevOps](./docs/guides/ci-cd.md)
- [Runnable Examples Suite](./examples/README.md)


---

## Quick start

```typescript
import { GetoGateway, MemoryStorage, BufferAdapter } from '@mrjacket/geto';

const gateway = new GetoGateway({ storage: new MemoryStorage() });
const adapter = new BufferAdapter();

// Consume a resource — geto stores it and gives you an entity
const entity = await gateway.consume(Buffer.from('Hello, geto'), adapter);

console.log(entity.id);        // "3f2504e0-4f89-..."
console.log(entity.adapterId); // "buffer"
console.log(entity.state);     // "stored"

// Restore the original resource from storage
const buffer = await gateway.restore(entity, adapter);
console.log(buffer.toString()); // "Hello, geto"
```

---

## Gateway API

### `consume(resource, adapter, options?)`

Consumes a resource through the adapter and stores its representation.  
Returns an `IEntity` descriptor. The entity is the managed handle — not the data itself.

```typescript
const entity = await gateway.consume(resource, adapter);
const entity = await gateway.consume(resource, adapter, {
  metadata: { label: 'my-resource' }
});
```

### `get(id)`

Retrieves the entity descriptor by ID. Throws `EntityNotFoundError` if not found,  
`EntityStateError` if the entity has been deleted.

```typescript
const entity = await gateway.get('3f2504e0-...');
```

### `restore(entity, adapter)`

Loads the stored representation and returns the original resource type.  
Does not change the entity's state — an entity can be restored multiple times.

```typescript
const resource = await gateway.restore(entity, adapter);
```

### `release(entity, adapter)`

Calls `adapter.release()` on the resource if the adapter defines it.  
Marks the entity as `RELEASED`. The entity remains in storage.

```typescript
await gateway.release(entity, adapter);
```

> **`release` ≠ `delete`**  
> Release is a resource lifecycle operation (close a stream, detach a process).  
> Delete is a storage operation (remove the entity entirely).

### `delete(id)`

Removes the entity's representation from storage and marks it `DELETED`.  
`DELETED` is a terminal state — no further operations are allowed.

```typescript
await gateway.delete(entity.id);
```

### `exists(id)`

Returns `true` if the entity exists and has not been deleted.

```typescript
const alive = await gateway.exists(entity.id);
```

### `inspect(id)`

Returns the entity's metadata.

```typescript
const metadata = await gateway.inspect(entity.id);
// { id, adapterId, createdAt, updatedAt, custom: { ... } }
```

---

## Entity lifecycle

```
consume()
    │
    ▼
 STORED ──────────────────────── restore() [no state change, repeatable]
    │
    ├── release() ──▶ RELEASED ── restore() [adapter-defined]
    │
    └── delete()  ──▶ DELETED  ── [terminal — all further operations throw]
```

---

## Adapters

Adapters define the consumption semantic. They know how to turn a resource into  
a storable representation, and how to turn it back.

```typescript
interface IGetoAdapter<T, R> {
  readonly adapterId: string;
  readonly semantic: EConsumptionSemantic | EConsumptionSemantic[];
  consume(resource: T): Promise<R>;
  restore(data: R): Promise<T>;
  release?(resource: T): Promise<void>;
}
```

### Built-in adapters

| Adapter | Semantic | Description |
|---|---|---|
| `BufferAdapter` | `COPY` | Copies a Buffer into an independent representation |
| `JsonAdapter` | `SERIALIZE` | Serializes arbitrary JavaScript objects/values to JSON strings |
| `StreamAdapter` | `CAPTURE` | Drains a readable stream and restores fresh, replayable streams |
| `ProcessAdapter` | `WRAP` | Wraps active ChildProcess instances with supervised termination on release |
| `HttpReferenceAdapter` | `REGISTER` | Registers remote URL resource references and lazily resolves them on restore |

### Custom adapters

```typescript
import { IGetoAdapter, EConsumptionSemantic } from '@mrjacket/geto';

class MyAdapter implements IGetoAdapter<MyResource, MyStoredForm> {
  readonly adapterId = 'my-resource';
  readonly semantic  = EConsumptionSemantic.SERIALIZE;

  async consume(resource: MyResource): Promise<MyStoredForm> {
    return { data: resource.serialize() };
  }

  async restore(stored: MyStoredForm): Promise<MyResource> {
    return MyResource.from(stored.data);
  }
}

const entity = await gateway.consume(resource, new MyAdapter());
```

geto does not need to know anything about `MyResource`.

---

## Storage

Storage backends persist the representations. Swapping storage does not change  
any other part of your code.

```typescript
interface IGetoStorage {
  save(id: string, data: unknown): Promise<void>;
  load(id: string): Promise<unknown>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}
```

### Built-in storage

| Storage | Description |
|---|---|
| `MemoryStorage` | In-memory transient storage using JavaScript `Map`. No persistence across restarts. |
| `FileStorage` | Persistent local filesystem storage in a designated directory. |

### Custom storage

```typescript
import { IGetoStorage } from '@mrjacket/geto';

class RedisStorage implements IGetoStorage {
  async save(id: string, data: unknown): Promise<void> { /* ... */ }
  async load(id: string): Promise<unknown>              { /* ... */ }
  async delete(id: string): Promise<void>               { /* ... */ }
  async exists(id: string): Promise<boolean>            { /* ... */ }
}

const gateway = new GetoGateway({ storage: new RedisStorage() });
```

---

## Five consumption semantics

Every adapter declares which consumption semantic it implements via `adapter.semantic`.  
This is observable metadata — the gateway does not behave differently based on it.

| Semantic | Meaning | Built-in Adapter |
|---|---|---|
| `COPY` | Create an independent copy of the resource | `BufferAdapter` |
| `SERIALIZE` | Transform a resource into a persistable representation | `JsonAdapter` |
| `CAPTURE` | Take ownership/control of a single-use resource | `StreamAdapter` |
| `WRAP` | Manage an active live resource without serializing it | `ProcessAdapter` |
| `REGISTER` | Store a reference locator; lazily resolve on restore | `HttpReferenceAdapter` |

### 1. `COPY` — Independent Data Duplication
```typescript
const adapter = new BufferAdapter();
const entity = await gateway.consume(Buffer.from('hello'), adapter);
const copy = await gateway.restore(entity, adapter);
```

### 2. `SERIALIZE` — Transforming Objects into Persistent State
```typescript
const adapter = new JsonAdapter<{ id: number; name: string }>();
const entity = await gateway.consume({ id: 1, name: 'Item' }, adapter);
const parsed = await gateway.restore(entity, adapter);
```

### 3. `CAPTURE` — Replaying Single-Use Resources
```typescript
import { Readable } from 'stream';
// Optional maxBytes guards against unbounded stream memory exhaustion (DoS)
const adapter = new StreamAdapter({ maxBytes: 50 * 1024 * 1024 });

// Drains a single-use Node.js stream and stores it
const entity = await gateway.consume(Readable.from(['Chunk 1', 'Chunk 2']), adapter);

// Restore can be called multiple times, generating fresh Readable streams each time!
const stream1 = await gateway.restore(entity, adapter);
const stream2 = await gateway.restore(entity, adapter);
```

### 4. `WRAP` — Supervising Live Running Resources
```typescript
import { spawn } from 'child_process';
const adapter = new ProcessAdapter();

// Wraps an active live process
const proc = spawn('node', ['worker.js']);
const entity = await gateway.consume(proc, adapter);

// Releasing the entity terminates the underlying process cleanly (SIGTERM)
await gateway.release(entity, adapter);
```

### 5. `REGISTER` — Deferred / Lazy Network Resolution
```typescript
const adapter = new HttpReferenceAdapter({
  allowedOrigins: ['https://api.github.com']
});

// Consumes the URL immediately — 0 network requests made
const entity = await gateway.consume('https://api.github.com/zen', adapter);

// Network fetch is triggered only when restore() is explicitly invoked
const body = await gateway.restore(entity, adapter);
```

---

## Errors

All errors extend `GetoError` and preserve the original `cause` where available.

| Error | When |
|---|---|
| `GetoError` | Base class |
| `EntityNotFoundError` | Entity ID does not exist |
| `EntityStateError` | Operation is invalid for the entity's current state |
| `AdapterError` | Adapter threw during consume / restore / release |
| `StorageError` | Storage threw during save / load / delete / exists |

```typescript
import { EntityNotFoundError, EntityStateError } from '@mrjacket/geto';

try {
  await gateway.restore(entity, adapter);
} catch (err) {
  if (err instanceof EntityStateError) {
    console.error('Entity is in an invalid state:', err.message);
  }
}
```

---

## License

This project is licensed under the **GPL-3.0 License**. See the [LICENSE](./LICENSE) file for details.

### Credits
**Author:** Mr Jacket / Felix Manrique / x-name15 (we are all the same person)
