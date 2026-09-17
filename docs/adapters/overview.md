# Adapters Guide: The Five Semantics & Custom Adapters

In `geto`, **Adapters define what "consume" and "restore" mean** for any given resource.

The core gateway knows nothing about buffers, child processes, or HTTP calls. All domain-specific transformations and cleanup logic belong exclusively to adapters.

---

## The `IGetoAdapter<T, R>` Interface

Every adapter implements the generic contract `IGetoAdapter<T, R>`:

```typescript
import { EConsumptionSemantic } from '@mrjacket/geto';

export interface IGetoAdapter<T, R> {
  /** Unique name or slug identifying this adapter (e.g. 'json', 'buffer'). */
  readonly adapterId: string;

  /** One or more semantics implemented by this adapter. */
  readonly semantic: EConsumptionSemantic | EConsumptionSemantic[];

  /** Transforms the source resource T into representation R. */
  consume(resource: T): Promise<R>;

  /** Restores the stored representation R back into resource T. */
  restore(data: R): Promise<T>;

  /** Optional lifecycle cleanup when gateway.release() is invoked. */
  release?(resource: T): Promise<void>;
}
```

---

## The Five Consumption Semantics

Adapters declare which fundamental semantic they fulfill. The gateway does not alter its internal orchestration based on this, but uses it as descriptive metadata for consumers and tooling.

### 1. `COPY` (`BufferAdapter`)
- **Mental model:** Creates an independent, detached copy of the resource.
- **Why use it:** Protects the stored resource from external mutations performed by the caller on the original object.
- **Built-in example:** [`BufferAdapter`](../src/adapters/buffer-adapter.ts) copies binary Buffers using `Buffer.from(buf)`.

### 2. `SERIALIZE` (`JsonAdapter`)
- **Mental model:** Transforms structured complex objects into persistable text/binary data ($T \neq R$).
- **Why use it:** When application state needs to be stored on disk or sent across networks.
- **Built-in example:** [`JsonAdapter`](../src/adapters/json-adapter.ts) turns objects into JSON strings and parses them back upon restore.

### 3. `CAPTURE` (`StreamAdapter`)
- **Mental model:** Takes temporary control of a single-use or ephemeral resource, draining or consuming it.
- **Why use it:** Node.js streams can only be read once. `CAPTURE` drains the stream to a persistent Buffer so `restore()` can replay it infinitely.
- **Built-in example:** [`StreamAdapter`](../src/adapters/stream-adapter.ts).

### 4. `WRAP` (`ProcessAdapter`)
- **Mental model:** Wraps an active, live operating system or network resource without serializing it into inert data.
- **Why use it:** Supervising worker processes or open sockets, ensuring cleanup on `release()`.
- **Built-in example:** [`ProcessAdapter`](../src/adapters/process-adapter.ts) wraps `ChildProcess` with real-time `isAlive()` monitoring and `SIGTERM` termination.

### 5. `REGISTER` (`HttpReferenceAdapter`)
- **Mental model:** Stores a locator or reference key without fetching or materializing the resource immediately.
- **Why use it:** Avoids premature network requests or expensive downloads. Resolution is deferred until `restore()`.
- **Built-in example:** [`HttpReferenceAdapter`](../src/adapters/http-reference-adapter.ts) stores URLs and triggers `fetch()` lazily.

---

## Writing a Custom Adapter (Tutorial)

Suppose we want an adapter that consumes a local file by path, calculates its SHA-256 hash, reads its content, and restores it.

```typescript
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { IGetoAdapter, EConsumptionSemantic, AdapterError } from '@mrjacket/geto';

interface IFileResource {
  path: string;
  bytes: Buffer;
}

interface IFileSnapshot {
  path: string;
  hash: string;
  bytes: Buffer;
}

export class FileSnapshotAdapter implements IGetoAdapter<IFileResource, IFileSnapshot> {
  readonly adapterId = 'file-snapshot';
  readonly semantic = EConsumptionSemantic.CAPTURE;

  async consume(resource: IFileResource): Promise<IFileSnapshot> {
    try {
      const hash = crypto.createHash('sha256').update(resource.bytes).digest('hex');
      return {
        path: resource.path,
        hash,
        bytes: Buffer.from(resource.bytes),
      };
    } catch (error) {
      throw new AdapterError(`Failed to snapshot file at '${resource.path}'`, { cause: error });
    }
  }

  async restore(data: IFileSnapshot): Promise<IFileResource> {
    // Verifies data integrity upon restoration
    const currentHash = crypto.createHash('sha256').update(data.bytes).digest('hex');
    if (currentHash !== data.hash) {
      throw new AdapterError(`File integrity check failed for '${data.path}'`);
    }
    return {
      path: data.path,
      bytes: Buffer.from(data.bytes),
    };
  }
}
```

### Usage:
```typescript
const adapter = new FileSnapshotAdapter();
const entity = await gateway.consume({
  path: './report.pdf',
  bytes: await fs.readFile('./report.pdf')
}, adapter);

const fileResource = await gateway.restore(entity, adapter);
console.log(`Restored ${fileResource.path} (${fileResource.bytes.length} bytes)`);
```
