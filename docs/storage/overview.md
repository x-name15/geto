# Storage Providers Guide

Storage providers decouple **where data is persisted** from **how resources are consumed**.

Any storage backend that implements the `IGetoStorage` interface can be plugged into `GetoGateway` without altering your adapters.

---

## The `IGetoStorage` Interface

```typescript
export interface IGetoStorage {
  /** Saves representation payload under the given entity ID. */
  save(id: string, data: unknown): Promise<void>;

  /** Retrieves the stored representation by entity ID. */
  load(id: string): Promise<unknown>;

  /** Deletes the representation from storage. */
  delete(id: string): Promise<void>;

  /** Checks if a representation exists. */
  exists(id: string): Promise<boolean>;
}
```

---

## Built-in Storage Providers

### 1. `MemoryStorage`
- **Location:** In-memory native JavaScript `Map`.
- **Performance:** Instantaneous memory operations.
- **Persistence:** **None**. Wiped when the Node.js process exits.
- **Best for:**
  - Automated tests (Vitest/Jest).
  - Short-lived scripts or caching layers.
  - Live handles and process supervision (`WRAP` semantic).

```typescript
import { GetoGateway, MemoryStorage } from '@mrjacket/geto';

const gateway = new GetoGateway({
  storage: new MemoryStorage()
});
```

---

### 2. `FileStorage`
- **Location:** Dedicated local filesystem directory.
- **Performance:** High-speed local disk I/O.
- **Persistence:** **Durable**. Survives process restarts and system reboots.
- **Security:** Sanitizes entity IDs to strictly prevent directory traversal attacks (`../`).
- **Data Fidelity:** Encapsulates representations in typed envelopes (`buffer` in base64, `string`, or `json`), preventing binary corruption.
- **Best for:**
  - CLI utilities.
  - Background workers.
  - Local caching between executions.

```typescript
import { GetoGateway, FileStorage } from '@mrjacket/geto';

const gateway = new GetoGateway({
  storage: new FileStorage('./.geto-data')
});
```

---

## Implementing a Custom Storage Provider (S3 Example)

Below is a complete implementation of an AWS S3 / Cloudflare R2 storage backend for `geto`:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { IGetoStorage, StorageError } from '@mrjacket/geto';

export class S3Storage implements IGetoStorage {
  private s3: S3Client;
  private bucket: string;

  constructor(bucket: string, s3Client?: S3Client) {
    this.bucket = bucket;
    this.s3 = s3Client ?? new S3Client({});
  }

  async save(id: string, data: unknown): Promise<void> {
    try {
      const body = Buffer.isBuffer(data) ? data : JSON.stringify(data);
      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: `entities/${id}.bin`,
        Body: body,
      }));
    } catch (error) {
      throw new StorageError(`S3Storage failed to save id '${id}'`, { cause: error });
    }
  }

  async load(id: string): Promise<unknown> {
    try {
      const response = await this.s3.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: `entities/${id}.bin`,
      }));

      const bytes = await response.Body?.transformToByteArray();
      if (!bytes) {
        throw new StorageError(`No data returned for id '${id}'`);
      }
      return Buffer.from(bytes);
    } catch (error) {
      throw new StorageError(`S3Storage failed to load id '${id}'`, { cause: error });
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.s3.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: `entities/${id}.bin`,
      }));
    } catch (error) {
      throw new StorageError(`S3Storage failed to delete id '${id}'`, { cause: error });
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: `entities/${id}.bin`,
      }));
      return true;
    } catch {
      return false;
    }
  }
}
```
