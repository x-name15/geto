# Production Recipes & Architectural Patterns

This guide presents battle-tested architectural patterns demonstrating how **`@mrjacket/geto`** solves real-world backend engineering challenges.

---

## Table of Contents

1. [Recipe 1: Graceful Child Process Supervisor (Zero Zombie Processes)](#recipe-1-graceful-child-process-supervisor)
2. [Recipe 2: Resilient Multi-Destination Stream Dispatcher](#recipe-2-resilient-multi-destination-stream-dispatcher)
3. [Recipe 3: Secure Lazy Asset Ingestion with SSRF Protection](#recipe-3-secure-lazy-asset-ingestion)
4. [Recipe 4: Two-Tier Storage (Memory L1 + Disk L2)](#recipe-4-two-tier-storage)

---

## Recipe 1: Graceful Child Process Supervisor

### The Real-World Problem
When Node.js applications spawn background CLI workers (such as `ffmpeg` video transcoders, Puppeteer browser instances, or Python ML scripts), an uncaught exception, a graceful shutdown signal (`SIGTERM`, `SIGINT`), or an early client disconnect can easily leave orphan child processes running forever in the operating system, eating CPU and memory.

### The geto Solution
Wrap active `ChildProcess` instances using `ProcessAdapter`. On shutdown or when an operation finishes, invoke `gateway.release()`, which safely sends `SIGTERM` and updates the entity state.

```typescript
import { spawn, ChildProcess } from 'node:child_process';
import { GetoGateway, MemoryStorage, ProcessAdapter, IEntity } from '@mrjacket/geto';

export class WorkerSupervisor {
  private readonly gateway: GetoGateway;
  private readonly adapter: ProcessAdapter;
  private readonly managedEntities: Set<IEntity> = new Set();

  constructor() {
    this.gateway = new GetoGateway({ storage: new MemoryStorage() });
    this.adapter = new ProcessAdapter();

    // Hook OS termination signals for clean shutdown
    process.once('SIGINT', () => this.shutdownAll('SIGINT'));
    process.once('SIGTERM', () => this.shutdownAll('SIGTERM'));
  }

  async spawnWorker(command: string, args: string[]): Promise<IEntity> {
    const child = spawn(command, args, { stdio: 'pipe' });

    const entity = await this.gateway.consume(child, this.adapter, {
      metadata: { command, spawnedAt: Date.now() }
    });

    this.managedEntities.add(entity);

    // Auto-remove upon natural termination
    child.once('exit', () => {
      this.managedEntities.delete(entity);
    });

    return entity;
  }

  async terminate(entity: IEntity): Promise<void> {
    if (this.managedEntities.has(entity)) {
      await this.gateway.release(entity, this.adapter);
      this.managedEntities.delete(entity);
    }
  }

  async shutdownAll(signal: string): Promise<void> {
    console.log(`[Supervisor] Received ${signal}. Releasing all live processes...`);
    for (const entity of this.managedEntities) {
      try {
        await this.gateway.release(entity, this.adapter);
      } catch (err) {
        console.error(`Failed to release process entity ${entity.id}:`, err);
      }
    }
    this.managedEntities.clear();
  }
}
```

---

## Recipe 2: Resilient Multi-Destination Stream Dispatcher

### The Real-World Problem
In Node.js, an incoming `Readable` stream (e.g. from an HTTP multipart upload or gRPC request) can **only be read once**. If you pipe it to an AWS S3 bucket and the network disconnects halfway through, you cannot retry because the stream is already drained. Similarly, you cannot easily pipe the exact same raw stream simultaneously to:
1. An S3 bucket.
2. A cryptographic SHA-256 integrity verifier.
3. An antivirus scanning pipeline.

### The geto Solution
Use `StreamAdapter` (which fulfills the `CAPTURE` semantic). The incoming stream is drained into a managed binary buffer representation in storage. Then, calling `gateway.restore()` returns a **fresh, independent `Readable` stream** every single time, enabling retry loops and multiple consumers.

```typescript
import { Readable } from 'node:stream';
import * as crypto from 'node:crypto';
import { GetoGateway, MemoryStorage, StreamAdapter, IEntity } from '@mrjacket/geto';

export class ResilientUploadService {
  private readonly gateway = new GetoGateway({ storage: new MemoryStorage() });
  private readonly streamAdapter = new StreamAdapter();

  async processIncomingUpload(uploadStream: Readable, filename: string): Promise<void> {
    // 1. Capture the single-use stream into geto
    const entity = await this.gateway.consume(uploadStream, this.streamAdapter, {
      metadata: { filename, uploadedAt: Date.now() }
    });

    try {
      // 2. Compute SHA-256 checksum using first replay
      const hashStream = await this.gateway.restore(entity, this.streamAdapter);
      const checksum = await this.calculateSha256(hashStream);
      console.log(`Payload checksum: ${checksum}`);

      // 3. Upload with automatic retry using independent replay streams
      await this.uploadWithRetry(entity, 3);
    } finally {
      // 4. Free storage memory once upload and verification are complete
      await this.gateway.delete(entity.id);
    }
  }

  private async calculateSha256(stream: Readable): Promise<string> {
    const hash = crypto.createHash('sha256');
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    return hash.digest('hex');
  }

  private async uploadWithRetry(entity: IEntity, maxAttempts: number): Promise<void> {
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt++;
      try {
        // Spawns a pristine, unread stream instance for this upload attempt
        const stream = await this.gateway.restore(entity, this.streamAdapter);
        await this.simulateCloudUpload(stream);
        console.log(`Upload succeeded on attempt ${attempt}`);
        return;
      } catch (err) {
        console.warn(`Upload attempt ${attempt} failed. Retrying...`);
        if (attempt >= maxAttempts) throw err;
      }
    }
  }

  private async simulateCloudUpload(stream: Readable): Promise<void> {
    for await (const _ of stream) {
      // simulate network stream piping
    }
  }
}
```

---

## Recipe 3: Secure Lazy Asset Ingestion with SSRF Protection

### The Real-World Problem
An API receives batch webhook notifications containing 10,000 image or PDF URLs from external partners. 
- Immediately fetching all 10,000 URLs causes socket exhaustion and huge memory spikes.
- Fetching unvetted user-supplied URLs leaves the internal network vulnerable to **Server-Side Request Forgery (SSRF)** attacks (e.g. hitting AWS metadata at `http://169.254.169.254`).

### The geto Solution
Use `HttpReferenceAdapter` (the `REGISTER` semantic). Registration is instantaneous and executes zero HTTP calls. Whitelisted domains prevent SSRF upfront. Background workers restore payloads only when needed.

```typescript
import { GetoGateway, MemoryStorage, HttpReferenceAdapter, IEntity } from '@mrjacket/geto';

export class AssetIngestionPipeline {
  private readonly gateway = new GetoGateway({ storage: new MemoryStorage() });
  private readonly adapter = new HttpReferenceAdapter({
    allowedOrigins: [
      'https://assets.mycompany.com',
      'https://cdn.partner-network.org'
    ]
  });

  /**
   * Consumes a list of remote URLs into geto entities without firing any network requests.
   */
  async ingestWebhooks(urls: string[]): Promise<IEntity[]> {
    const entities: IEntity[] = [];

    for (const url of urls) {
      try {
        const entity = await this.gateway.consume(url, this.adapter, {
          metadata: { ingestedAt: Date.now() }
        });
        entities.push(entity);
      } catch (err) {
        console.error(`Rejected unsafe or invalid URL '${url}':`, (err as Error).message);
      }
    }

    return entities;
  }

  /**
   * Lazily resolves and downloads the payload only when an asynchronous worker is ready.
   */
  async processJob(entity: IEntity): Promise<string> {
    // Triggers the HTTP request lazily
    const rawBody = await this.gateway.restore(entity, this.adapter);
    return rawBody;
  }
}
```

---

## Recipe 4: Two-Tier Storage (Memory L1 + Disk L2)

### The Real-World Problem
You need microsecond-speed reads for hot resources in RAM (`MemoryStorage`), but also persistent storage on disk (`FileStorage`) so that critical payloads survive application restarts.

### The geto Solution
Because `GetoGateway` operates on the generic `IGetoStorage` interface, you can write a composable two-tier storage adapter without changing a single line of your adapter code.

```typescript
import { IGetoStorage, MemoryStorage, FileStorage } from '@mrjacket/geto';

export class TwoTierStorage implements IGetoStorage {
  private readonly l1: MemoryStorage;
  private readonly l2: FileStorage;

  constructor(diskDirectory: string) {
    this.l1 = new MemoryStorage();
    this.l2 = new FileStorage(diskDirectory);
  }

  async save(id: string, data: unknown): Promise<void> {
    // Write-through: save to both L1 (RAM) and L2 (Disk)
    await Promise.all([
      this.l1.save(id, data),
      this.l2.save(id, data)
    ]);
  }

  async load(id: string): Promise<unknown> {
    // Check L1 first
    if (await this.l1.exists(id)) {
      return await this.l1.load(id);
    }

    // Cache miss: fallback to L2 disk
    const data = await this.l2.load(id);
    // Populate L1 cache for future reads
    await this.l1.save(id, data);
    return data;
  }

  async delete(id: string): Promise<void> {
    await Promise.all([
      this.l1.delete(id),
      this.l2.delete(id)
    ]);
  }

  async exists(id: string): Promise<boolean> {
    return (await this.l1.exists(id)) || (await this.l2.exists(id));
  }
}
```

---

## Summary of Patterns

| Pattern | Semantic Used | Primary Advantage |
|---|---|---|
| **Process Supervisor** | `WRAP` | Prevents orphan processes and resource leaks on `SIGINT`/`SIGTERM`. |
| **Stream Dispatcher** | `CAPTURE` | Solves single-use stream exhaustion; allows unlimited retries and multi-piping. |
| **Lazy Asset Ingestion** | `REGISTER` | Eliminates memory and network spikes; enforces strict SSRF whitelist protection. |
| **Two-Tier Storage** | Any | Combines RAM latency with disk durability via storage interface polymorphism. |
