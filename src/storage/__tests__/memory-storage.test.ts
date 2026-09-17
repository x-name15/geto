import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from '../../storage/memory-storage.js';
import { StorageError } from '../../errors/index.js';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('should save and load data', async () => {
    const data = { foo: 'bar' };
    await storage.save('1', data);
    const loaded = await storage.load('1');
    expect(loaded).toBe(data);
  });

  it('should throw StorageError when loading nonexistent id', async () => {
    await expect(storage.load('missing')).rejects.toThrow(StorageError);
  });

  it('should delete data', async () => {
    await storage.save('1', 'data');
    await storage.delete('1');
    await expect(storage.load('1')).rejects.toThrow(StorageError);
  });

  it('should return true for existing data and false for non-existing', async () => {
    await storage.save('1', 'data');
    expect(await storage.exists('1')).toBe(true);
    expect(await storage.exists('2')).toBe(false);
  });

  it('should overwrite existing key', async () => {
    await storage.save('1', 'old');
    await storage.save('1', 'new');
    expect(await storage.load('1')).toBe('new');
  });
});
