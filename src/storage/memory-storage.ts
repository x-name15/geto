import { IGetoStorage } from '../models/index.js';
import { StorageError } from '../errors/index.js';

export class MemoryStorage implements IGetoStorage {
  private map = new Map<string, unknown>();

  async save(id: string, data: unknown): Promise<void> {
    this.map.set(id, data);
  }

  async load(id: string): Promise<unknown> {
    if (!this.map.has(id)) {
      throw new StorageError(`No data found for id '${id}'`);
    }
    return this.map.get(id);
  }

  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    return this.map.has(id);
  }
}
