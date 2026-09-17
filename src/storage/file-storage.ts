import * as fs from 'fs/promises';
import * as path from 'path';
import { IGetoStorage } from '../models/index.js';
import { StorageError } from '../errors/index.js';

/**
 * Filesystem persistent storage backend.
 *
 * Persists entity representations onto the local disk in a dedicated directory.
 * Data is safely formatted and sanitized to prevent directory traversal attacks.
 */
export class FileStorage implements IGetoStorage {
  private readonly baseDir: string;

  /**
   * Initializes a new {@link FileStorage} instance.
   *
   * @param baseDir - Directory path where entity files will be stored.
   */
  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
  }

  /**
   * Ensures the target base directory exists before writing.
   */
  private async ensureBaseDir(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      throw new StorageError(`FileStorage failed to initialize directory '${this.baseDir}'`, { cause: error });
    }
  }

  private static readonly SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

  /**
   * Resolves the secure absolute path for an entity ID, guarding against directory traversal.
   *
   * @param id - Entity identifier.
   */
  private getFilePath(id: string): string {
    if (!id || typeof id !== 'string' || !FileStorage.SAFE_ID_PATTERN.test(id)) {
      throw new StorageError(`Invalid entity id '${id}' detected for filesystem storage`);
    }
    return path.join(this.baseDir, `${id}.bin`);
  }

  /**
   * Serializes arbitrary representation data to disk.
   *
   * - Buffers are stored directly.
   * - Strings are stored as UTF-8 encoded text.
   * - Objects and other JSON-compatible values are stored as formatted JSON.
   *
   * @param id - Entity identifier.
   * @param data - The representation payload.
   */
  async save(id: string, data: unknown): Promise<void> {
    await this.ensureBaseDir();
    const filePath = this.getFilePath(id);
    const tempFilePath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

    try {
      let envelope: { type: 'buffer' | 'string' | 'json'; payload: string };

      if (Buffer.isBuffer(data)) {
        envelope = { type: 'buffer', payload: data.toString('base64') };
      } else if (typeof data === 'string') {
        envelope = { type: 'string', payload: data };
      } else {
        envelope = { type: 'json', payload: JSON.stringify(data) };
      }

      // Atomic write: write to isolated temporary file, then rename atomically
      await fs.writeFile(tempFilePath, JSON.stringify(envelope), 'utf-8');
      await fs.rename(tempFilePath, filePath);
    } catch (error) {
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // Ignore temp file cleanup failure
      }
      throw new StorageError(`FileStorage failed to save representation for id '${id}'`, { cause: error });
    }
  }

  /**
   * Loads the representation from disk, faithfully restoring Buffers, strings, or parsed JSON.
   *
   * @param id - Entity identifier.
   * @returns The restored representation.
   */
  async load(id: string): Promise<unknown> {
    const filePath = this.getFilePath(id);

    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const envelope = JSON.parse(raw) as { type: string; payload: string };

      if (envelope.type === 'buffer') {
        return Buffer.from(envelope.payload, 'base64');
      }
      if (envelope.type === 'string') {
        return envelope.payload;
      }
      if (envelope.type === 'json') {
        return JSON.parse(envelope.payload);
      }
      return envelope.payload;
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'ENOENT') {
        throw new StorageError(`No data found for id '${id}'`, { cause: error });
      }
      throw new StorageError(`FileStorage failed to load representation for id '${id}'`, { cause: error });
    }
  }

  /**
   * Deletes the representation file corresponding to the entity ID.
   *
   * @param id - Entity identifier.
   */
  async delete(id: string): Promise<void> {
    const filePath = this.getFilePath(id);

    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'ENOENT') {
        // Idempotent deletion if already gone
        return;
      }
      throw new StorageError(`FileStorage failed to delete representation for id '${id}'`, { cause: error });
    }
  }

  /**
   * Checks if the entity file exists on disk.
   *
   * @param id - Entity identifier.
   */
  async exists(id: string): Promise<boolean> {
    const filePath = this.getFilePath(id);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
