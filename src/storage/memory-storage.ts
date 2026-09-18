import { IGetoStorage } from '../models/index.js';
import { StorageError } from '../errors/index.js';

/**
 * In-memory transient storage backend using a native JS `Map`.
 *
 * Useful for unit testing, scratchpad environments, or caching layers
 * where durability across process restarts is not required.
 */
export class MemoryStorage implements IGetoStorage {
  private map = new Map<string, unknown>();

  /**
   * Returns the current number of items stored in memory.
   */
  get size(): number {
    return this.map.size;
  }

  /**
   * Clears all items stored in memory.
   */
  clear(): void {
    this.map.clear();
  }

  private validateId(id: string): void {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new StorageError(`Invalid entity id '${id}' provided to MemoryStorage`);
    }
  }

  /**
   * Persists data in the in-memory map.
   *
   * @param id - Entity identifier.
   * @param data - Raw representation data.
   */
  async save(id: string, data: unknown): Promise<void> {
    this.validateId(id);
    this.map.set(id, data);
  }

  /**
   * Retrieves data by ID.
   *
   * @param id - Entity identifier.
   * @returns The raw representation previously saved.
   * @throws {StorageError} If the identifier is not found in memory or is invalid.
   */
  async load(id: string): Promise<unknown> {
    this.validateId(id);
    if (!this.map.has(id)) {
      throw new StorageError(`No data found for id '${id}'`);
    }
    return this.map.get(id);
  }

  /**
   * Deletes an entity entry from the in-memory map.
   *
   * @param id - Entity identifier.
   */
  async delete(id: string): Promise<void> {
    this.validateId(id);
    this.map.delete(id);
  }

  /**
   * Checks whether the identifier exists in memory.
   *
   * @param id - Entity identifier.
   */
  async exists(id: string): Promise<boolean> {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return false;
    }
    return this.map.has(id);
  }
}
