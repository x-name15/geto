# Developer Guide & API Manual: Building with geto

> **Philosophy:** *Consume anything. Use it later.*  
> `geto` is a resource consumption and lifecycle gateway for Node.js and TypeScript.

---

## 1. Architecture & Mental Model

In traditional software, libraries often bind resource types tightly to their storage mechanisms (e.g., caching streams requires a stream caching library, storing objects requires a database client, tracking processes requires a daemon manager).

`geto` decouples this entirely by splitting responsibility into three distinct, interchangeable layers:

```
┌────────────────────────────────────────────────────────┐
│ 1. ADAPTER (Domain Layer)                             │
│    Transforms Resource (T) <---> Representation (R)    │
│    Optionally handles cleanup on release()            │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. GATEWAY (Orchestration Layer)                       │
│    Assigns UUID identity, tracks entity lifecycle,     │
│    coordinates storage, enforces state transitions     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. STORAGE (Persistence Layer)                         │
│    Persists & loads arbitrary representations by ID    │
│    (Memory, Filesystem, Redis, S3, Database)           │
└────────────────────────────────────────────────────────┘
```

### Key Principles

1. **The Gateway is resource-agnostic:** `GetoGateway` never inspects whether something is a buffer, stream, process, or URL. It only coordinates `consume()`, `restore()`, `release()`, and `delete()`.
2. **Entities are descriptors, not containers:** An `IEntity` holds identity, timestamp, state, and metadata. The actual payload ($R$) lives strictly in `IGetoStorage`.
3. **Storage is swappable:** Changing from `MemoryStorage` to `FileStorage` requires zero code changes to your adapters or application logic.

---

## 2. Core API Reference

### Initializing the Gateway

```typescript
import { GetoGateway, MemoryStorage, FileStorage } from '@mrjacket/geto';

// In-memory (fast, transient, great for tests or live handles)
const gateway = new GetoGateway({
  storage: new MemoryStorage()
});

// Disk-based (persistent across process restarts)
const persistentGateway = new GetoGateway({
  storage: new FileStorage('./.geto-storage')
});
```

### Gateway Methods

#### `consume<T, R>(resource: T, adapter: IGetoAdapter<T, R>, options?: IConsumeOptions): Promise<IEntity>`
Transforms the resource via `adapter.consume()` and saves the representation to storage under a freshly generated UUID.
```typescript
const entity = await gateway.consume(Buffer.from('hello'), bufferAdapter, {
  metadata: { origin: 'network-packet', priority: 1 }
});
```

#### `get(id: string): Promise<IEntity>`
Fetches the immutable entity descriptor from the gateway's registry.
```typescript
const entity = await gateway.get('b5e90d23-2615-4673-8ca1-689b02ff63fa');
console.log(entity.state); // 'stored' | 'released'
```

#### `restore<T, R>(entity: IEntity, adapter: IGetoAdapter<T, R>): Promise<T>`
Loads the stored representation from storage and reconstructs the original resource type $T$ using `adapter.restore()`.
- **Note:** `restore()` is a non-destructive read operation. It does not alter entity state and can be called repeatedly.
```typescript
const original = await gateway.restore(entity, bufferAdapter);
```

#### `release<T, R>(entity: IEntity, adapter: IGetoAdapter<T, R>): Promise<void>`
Invokes the optional `adapter.release()` lifecycle hook on the resource (e.g. closing a file descriptor, terminating a process) and marks the entity state as `RELEASED`. The representation remains in storage.
```typescript
await gateway.release(entity, processAdapter);
```

#### `delete(id: string): Promise<void>`
Removes the representation from storage and marks the entity as `DELETED`.
- **Terminal State:** Any subsequent operation (`get`, `restore`, `release`, or `delete`) on a deleted entity throws `EntityStateError`.
```typescript
await gateway.delete(entity.id);
```

#### `exists(id: string): Promise<boolean>`
Returns `true` if the entity exists in the gateway and has not been deleted.
```typescript
const isActive = await gateway.exists(entity.id);
```

#### `inspect(id: string): Promise<IEntityMetadata>`
Returns the entity's metadata without requiring the adapter.
```typescript
const meta = await gateway.inspect(entity.id);
console.log(meta.createdAt, meta.custom);
```

---

## 3. How to Create Custom Adapters

An adapter implements `IGetoAdapter<T, R>`:

```typescript
import { IGetoAdapter, EConsumptionSemantic } from '@mrjacket/geto';

export interface IGetoAdapter<T, R> {
  readonly adapterId: string;
  readonly semantic: EConsumptionSemantic | EConsumptionSemantic[];
  consume(resource: T): Promise<R>;
  restore(data: R): Promise<T>;
  release?(resource: T): Promise<void>;
}
```

### Step-by-Step: Writing a Compressed String Adapter

Let's write a custom adapter that consumes raw text, compresses it into Gzip binary data, and uncompresses it upon restore:

```typescript
import * as zlib from 'zlib';
import { promisify } from 'util';
import { IGetoAdapter, EConsumptionSemantic, AdapterError } from '@mrjacket/geto';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class CompressedStringAdapter implements IGetoAdapter<string, Buffer> {
  readonly adapterId = 'compressed-string';
  readonly semantic = EConsumptionSemantic.SERIALIZE;

  async consume(resource: string): Promise<Buffer> {
    try {
      return await gzip(Buffer.from(resource, 'utf-8'));
    } catch (error) {
      throw new AdapterError('Failed to compress string resource', { cause: error });
    }
  }

  async restore(data: Buffer): Promise<string> {
    try {
      const decompressed = await gunzip(data);
      return decompressed.toString('utf-8');
    } catch (error) {
      throw new AdapterError('Failed to decompress buffer representation', { cause: error });
    }
  }
}
```

### Usage with the Gateway:

```typescript
const gateway = new GetoGateway({ storage: new FileStorage('./archive') });
const adapter = new CompressedStringAdapter();

// Consumes text -> compresses to Gzip -> saves .bin file to disk
const entity = await gateway.consume("A very long text document...", adapter);

// Restores -> reads .bin from disk -> decompresses -> delivers original string
const originalText = await gateway.restore(entity, adapter);
```

---

## 4. How to Create Custom Storage Providers

A storage provider implements `IGetoStorage`:

```typescript
import { IGetoStorage } from '@mrjacket/geto';

export interface IGetoStorage {
  save(id: string, data: unknown): Promise<void>;
  load(id: string): Promise<unknown>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}
```

### Step-by-Step: Writing a Redis Storage Provider

```typescript
import { IGetoStorage, StorageError } from '@mrjacket/geto';
import type { RedisClientType } from 'redis';

export class RedisStorage implements IGetoStorage {
  private client: RedisClientType;
  private prefix: string;

  constructor(client: RedisClientType, prefix = 'geto:') {
    this.client = client;
    this.prefix = prefix;
  }

  private key(id: string): string {
    return `${this.prefix}${id}`;
  }

  async save(id: string, data: unknown): Promise<void> {
    try {
      const payload = Buffer.isBuffer(data)
        ? JSON.stringify({ type: 'buffer', val: data.toString('base64') })
        : JSON.stringify({ type: 'json', val: data });

      await this.client.set(this.key(id), payload);
    } catch (error) {
      throw new StorageError(`RedisStorage failed to save id '${id}'`, { cause: error });
    }
  }

  async load(id: string): Promise<unknown> {
    try {
      const raw = await this.client.get(this.key(id));
      if (!raw) {
        throw new StorageError(`No data found for id '${id}'`);
      }
      const envelope = JSON.parse(raw);
      if (envelope.type === 'buffer') {
        return Buffer.from(envelope.val, 'base64');
      }
      return envelope.val;
    } catch (error) {
      throw new StorageError(`RedisStorage failed to load id '${id}'`, { cause: error });
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.client.del(this.key(id));
    } catch (error) {
      throw new StorageError(`RedisStorage failed to delete id '${id}'`, { cause: error });
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.client.exists(this.key(id));
      return count > 0;
    } catch {
      return false;
    }
  }
}
```

---

## 5. The Five Consumption Semantics in Practice

When designing an adapter, identify which semantic matches your problem:

| Semantic | Problem Solved | Real-World Use Case |
|---|---|---|
| **`COPY`** | Protects caller data from subsequent modification. | High-frequency telemetry buffers, cryptographic keys. |
| **`SERIALIZE`** | Transforms structured objects into persistent disk or database formats. | Application state snapshots, session data, user profiles. |
| **`CAPTURE`** | Drains single-use resources into replayable storage. | Incoming HTTP request bodies, upload streams, multipart files. |
| **`WRAP`** | Supervises live resources without freezing or serializing them. | Worker child processes, WebSocket connections, database pool handles. |
| **`REGISTER`** | Stores references or locators; defers expensive network fetching. | S3 object keys, CDN assets, webhook triggers, external URLs. |

---

## 6. Error Handling

All library exceptions inherit from `GetoError` and include the original `.cause` property:

```typescript
import {
  GetoError,
  EntityNotFoundError,
  EntityStateError,
  AdapterError,
  StorageError
} from '@mrjacket/geto';

try {
  await gateway.restore(entity, adapter);
} catch (error) {
  if (error instanceof EntityStateError) {
    // Attempted an operation on a DELETED entity
    console.error(`Invalid state transition: ${error.message}`);
  } else if (error instanceof EntityNotFoundError) {
    // ID does not exist in gateway map
    console.error(`Missing entity handle: ${error.message}`);
  } else if (error instanceof AdapterError) {
    // Adapter threw during consume(), restore(), or release()
    console.error(`Adapter failed: ${error.message}`, error.cause);
  } else if (error instanceof StorageError) {
    // Storage provider failed (e.g. disk full, redis disconnected)
    console.error(`Storage failure: ${error.message}`, error.cause);
  }
}
```
