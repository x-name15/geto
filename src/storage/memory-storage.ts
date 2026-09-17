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
   * Persists data in the in-memory map.
   *
   * @param id - Entity identifier.
   * @param data - Raw representation data.
   */
  async save(id: string, data: unknown): Promise<void> {
    this.map.set(id, data);
  }

  /**
   * Retrieves data by ID.
   *
   * @param id - Entity identifier.
   * @returns The raw representation previously saved.
   * @throws {StorageError} If the identifier is not found in memory.
   */
  async load(id: string): Promise<unknown> {
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
    this.map.delete(id);
  }

  /**
   * Checks whether the identifier exists in memory.
   *
   * @param id - Entity identifier.
   */
  async exists(id: string): Promise<boolean> {
    return this.map.has(id);
  }
}
