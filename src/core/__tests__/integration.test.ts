import { describe, it, expect } from 'vitest';
import { GetoGateway } from '../../core/gateway.js';
import { MemoryStorage } from '../../storage/memory-storage.js';
import { BufferAdapter } from '../../adapters/buffer-adapter.js';
import { EEntityState, IGetoAdapter, EConsumptionSemantic, IGetoStorage } from '../../models/index.js';
import { EntityStateError } from '../../errors/index.js';

describe('Integration Tests', () => {
  it('Full flow: Buffer -> consume -> store -> get -> restore -> compare content', async () => {
    const gateway = new GetoGateway({ storage: new MemoryStorage() });
    const adapter = new BufferAdapter();
    const original = Buffer.from('hello world');

    const entity = await gateway.consume(original, adapter);
    const fetchedEntity = await gateway.get(entity.id);
    const restored = await gateway.restore(fetchedEntity, adapter);

    expect(restored.toString()).toBe('hello world');
  });

  it('Multiple entities: consume 3 different buffers, restore each by entity', async () => {
    const gateway = new GetoGateway({ storage: new MemoryStorage() });
    const adapter = new BufferAdapter();

    const e1 = await gateway.consume(Buffer.from('one'), adapter);
    const e2 = await gateway.consume(Buffer.from('two'), adapter);
    const e3 = await gateway.consume(Buffer.from('three'), adapter);

    expect((await gateway.restore(e1, adapter)).toString()).toBe('one');
    expect((await gateway.restore(e2, adapter)).toString()).toBe('two');
    expect((await gateway.restore(e3, adapter)).toString()).toBe('three');
  });

  it('Lifecycle: consume -> release -> delete -> get throws', async () => {
    const gateway = new GetoGateway({ storage: new MemoryStorage() });
    
    let released = false;
    const releaseAdapter: IGetoAdapter<Buffer, Buffer> = {
      adapterId: 'buffer-release',
      semantic: EConsumptionSemantic.WRAP,
      consume: async b => b,
      restore: async b => b,
      release: async () => { released = true; }
    };

    const entity = await gateway.consume(Buffer.from('test'), releaseAdapter);
    await gateway.release(entity, releaseAdapter);
    
    expect(released).toBe(true);
    const afterRelease = await gateway.get(entity.id);
    expect(afterRelease.state).toBe(EEntityState.RELEASED);

    await gateway.delete(entity.id);
    await expect(gateway.get(entity.id)).rejects.toThrow(EntityStateError);
  });

  it('Storage swappability', async () => {
    class MockStorage implements IGetoStorage {
      data = new Map<string, unknown>();
      async save(id: string, d: unknown) { this.data.set(id, d); }
      async load(id: string) { return this.data.get(id); }
      async delete(id: string) { this.data.delete(id); }
      async exists(id: string) { return this.data.has(id); }
    }

    const gateway = new GetoGateway({ storage: new MockStorage() });
    const adapter = new BufferAdapter();

    const entity = await gateway.consume(Buffer.from('test'), adapter);
    const restored = await gateway.restore(entity, adapter);
    expect(restored.toString()).toBe('test');
  });

  it('Custom adapter: string -> length -> string', async () => {
    const gateway = new GetoGateway({ storage: new MemoryStorage() });
    
    const lengthAdapter: IGetoAdapter<string, number> = {
      adapterId: 'string-length',
      semantic: EConsumptionSemantic.COPY,
      consume: async str => str.length,
      restore: async num => Buffer.alloc(num, 'a').toString()
    };

    const entity = await gateway.consume('test', lengthAdapter);
    const restored = await gateway.restore(entity, lengthAdapter);
    
    expect(restored).toBe('aaaa'); // length of 'test' is 4
  });

  it('SERIALIZE semantic: JsonAdapter + FileStorage end-to-end persistence', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    const { FileStorage } = await import('../../storage/file-storage.js');
    const { JsonAdapter } = await import('../../adapters/json-adapter.js');

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'geto-serialize-test-'));
    try {
      const fileStorage = new FileStorage(tempDir);
      const gateway = new GetoGateway({ storage: fileStorage });
      const jsonAdapter = new JsonAdapter<{ id: number; title: string; tags: string[] }>();

      const input = { id: 42, title: 'Cursed Object', tags: ['special-grade', 'sealed'] };

      // Consume transforms Object (T) -> string (R), and stores on disk
      const entity = await gateway.consume(input, jsonAdapter, {
        metadata: { category: 'curse' }
      });

      expect(entity.adapterId).toBe('json');
      expect(await fileStorage.exists(entity.id)).toBe(true);

      // Restore loads string from disk and deserializes back into Object (T)
      const restored = await gateway.restore(entity, jsonAdapter);
      expect(restored).toEqual(input);

      // Verify clean deletion from disk
      await gateway.delete(entity.id);
      expect(await fileStorage.exists(entity.id)).toBe(false);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
