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

  it('faithfully preserves binary Buffer representations', async () => {
    const id = 'binary-buffer-id';
    const binaryData = Buffer.from([0x00, 0xff, 0xca, 0xfe, 0xba, 0xbe]);

    await storage.save(id, binaryData);
    const loaded = await storage.load(id);

    expect(Buffer.isBuffer(loaded)).toBe(true);
    expect(loaded).toEqual(binaryData);
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

  it('rejects dangerous identifiers (dots, colons, null bytes, special chars)', async () => {
    const dangerousIds = [
      '..',
      '.',
      'id/with/slash',
      'id\\with\\backslash',
      'id:stream',
      'id\0null',
      'id with spaces',
      'id*wildcard',
      'id?question',
      '',
    ];

    for (const badId of dangerousIds) {
      await expect(storage.save(badId, 'payload')).rejects.toThrow(StorageError);
      await expect(storage.load(badId)).rejects.toThrow(StorageError);
      await expect(storage.delete(badId)).rejects.toThrow(StorageError);
      await expect(storage.exists(badId)).rejects.toThrow(StorageError);
    }
  });

  it('accepts valid UUIDs and alphanumeric slugs', async () => {
    const validIds = [
      '4f8b92c8-1a2e-4d3b-8c7f-1a0e8d2c4b6a',
      'entity_123',
      'custom-slug-abc-XYZ-99',
    ];

    for (const validId of validIds) {
      await expect(storage.save(validId, 'valid-data')).resolves.toBeUndefined();
      expect(await storage.exists(validId)).toBe(true);
      expect(await storage.load(validId)).toBe('valid-data');
    }
  });
});
