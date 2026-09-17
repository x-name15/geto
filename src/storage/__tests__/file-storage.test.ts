import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FileStorage } from '../file-storage.js';
import { StorageError } from '../../errors/index.js';

describe('FileStorage', () => {
  let tempDir: string;
  let storage: FileStorage;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'geto-filestorage-test-'));
    storage = new FileStorage(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('saves and loads string representations', async () => {
    const id = 'entity-string-123';
    const payload = JSON.stringify({ message: 'Hello disk storage' });

    await storage.save(id, payload);
    const exists = await storage.exists(id);
    expect(exists).toBe(true);

    const loaded = await storage.load(id);
    expect(loaded).toBe(payload);
  });

  it('deletes stored representation cleanly', async () => {
    const id = 'entity-to-delete-456';
    await storage.save(id, 'temporary content');
    expect(await storage.exists(id)).toBe(true);

    await storage.delete(id);
    expect(await storage.exists(id)).toBe(false);

    // Deleting again should be idempotent and not throw
    await expect(storage.delete(id)).resolves.toBeUndefined();
  });

  it('throws StorageError when loading nonexistent id', async () => {
    await expect(storage.load('non-existent-id')).rejects.toThrow(StorageError);
  });

  it('rejects path traversal attempts in ID', async () => {
    const maliciousId = '../malicious-entry';
    await expect(storage.save(maliciousId, 'attack payload')).rejects.toThrow(StorageError);
  });
});
