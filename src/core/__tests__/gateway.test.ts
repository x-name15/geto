import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetoGateway } from '../../core/gateway.js';
import { MemoryStorage } from '../../storage/memory-storage.js';
import { BufferAdapter } from '../../adapters/buffer-adapter.js';
import { EEntityState, IGetoAdapter, EConsumptionSemantic, IGetoStorage } from '../../models/index.js';
import { EntityNotFoundError, EntityStateError, AdapterError, StorageError } from '../../errors/index.js';

describe('GetoGateway', () => {
  let gateway: GetoGateway;
  let storage: MemoryStorage;
  let adapter: BufferAdapter;

  beforeEach(() => {
    storage = new MemoryStorage();
    gateway = new GetoGateway({ storage });
    adapter = new BufferAdapter();
  });

  describe('consume', () => {
    it('returns entity with id, adapterId, STORED state, correct metadata, createdAt set', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter, { metadata: { tag: 'test' } });
      expect(entity.id).toBeDefined();
      expect(entity.adapterId).toBe('buffer');
      expect(entity.state).toBe(EEntityState.STORED);
      expect(entity.metadata.custom).toEqual({ tag: 'test' });
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
    });

    it('wraps adapter errors as AdapterError', async () => {
      const badAdapter: IGetoAdapter<any, any> = {
        adapterId: 'bad',
        semantic: EConsumptionSemantic.COPY,
        consume: async () => { throw new Error('adapter fail'); },
        restore: async () => 'test'
      };
      await expect(gateway.consume('test', badAdapter)).rejects.toThrow(AdapterError);
    });

    it('wraps storage errors as StorageError', async () => {
      const badStorage: IGetoStorage = {
        save: async () => { throw new Error('storage fail'); },
        load: async () => null,
        delete: async () => {},
        exists: async () => true
      };
      const badGateway = new GetoGateway({ storage: badStorage });
      await expect(badGateway.consume(Buffer.from('test'), adapter)).rejects.toThrow(StorageError);
    });
  });

  describe('get', () => {
    it('returns entity by id', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter);
      const fetched = await gateway.get(entity.id);
      expect(fetched.id).toBe(entity.id);
    });

    it('throws EntityNotFoundError for unknown id', async () => {
      await expect(gateway.get('unknown')).rejects.toThrow(EntityNotFoundError);
    });

    it('throws EntityStateError for DELETED entity', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter);
      await gateway.delete(entity.id);
      await expect(gateway.get(entity.id)).rejects.toThrow(EntityStateError);
    });
  });

  describe('restore', () => {
    it('returns correct resource', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter);
      const restored = await gateway.restore(entity, adapter);
      expect(restored.toString()).toBe('test');
    });

    it('throws EntityStateError for DELETED entity', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter);
      await gateway.delete(entity.id);
      await expect(gateway.restore(entity, adapter)).rejects.toThrow(EntityStateError);
    });

    it('wraps adapter errors as AdapterError', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter);
      const badAdapter: IGetoAdapter<any, any> = {
        adapterId: 'bad',
        semantic: EConsumptionSemantic.COPY,
        consume: async () => 'test',
        restore: async () => { throw new Error('adapter fail'); }
      };
      await expect(gateway.restore(entity, badAdapter)).rejects.toThrow(AdapterError);
    });

    it('wraps storage errors as StorageError', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter);
      vi.spyOn(storage, 'load').mockRejectedValueOnce(new Error('storage fail'));
      await expect(gateway.restore(entity, adapter)).rejects.toThrow(StorageError);
    });
  });

  describe('release', () => {
    it('sets entity state to RELEASED', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter);
      
      const releasableAdapter: IGetoAdapter<Buffer, Buffer> = {
        adapterId: 'buffer',
        semantic: EConsumptionSemantic.WRAP,
        consume: async (b) => b,
        restore: async (b) => b,
        release: async () => {}
      };

      await gateway.release(entity, releasableAdapter);
      const fetched = await gateway.get(entity.id);
      expect(fetched.state).toBe(EEntityState.RELEASED);
    });

    it('throws EntityStateError for DELETED entity', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter);
      await gateway.delete(entity.id);
      await expect(gateway.release(entity, adapter)).rejects.toThrow(EntityStateError);
    });
  });

  describe('delete', () => {
    it('removes entity from storage', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter);
      await gateway.delete(entity.id);
      expect(await storage.exists(entity.id)).toBe(false);
    });

    it('throws EntityNotFoundError for unknown id', async () => {
      await expect(gateway.delete('unknown')).rejects.toThrow(EntityNotFoundError);
    });

    it('throws EntityStateError if already DELETED', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter);
      await gateway.delete(entity.id);
      await expect(gateway.delete(entity.id)).rejects.toThrow(EntityStateError);
    });
  });

  describe('exists', () => {
    it('returns true for existing entity', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter);
      expect(await gateway.exists(entity.id)).toBe(true);
    });

    it('returns false for nonexistent', async () => {
      expect(await gateway.exists('unknown')).toBe(false);
    });

    it('returns false for DELETED entity', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter);
      await gateway.delete(entity.id);
      expect(await gateway.exists(entity.id)).toBe(false);
    });
  });

  describe('inspect', () => {
    it('returns metadata', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter, { metadata: { val: 42 } });
      const meta = await gateway.inspect(entity.id);
      expect(meta.custom).toEqual({ val: 42 });
    });

    it('throws EntityNotFoundError for unknown id', async () => {
      await expect(gateway.inspect('unknown')).rejects.toThrow(EntityNotFoundError);
    });
  });

  it('IDs are unique across multiple consume calls', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const entity = await gateway.consume(Buffer.from(`test${i}`), adapter);
      ids.add(entity.id);
    }
    expect(ids.size).toBe(100);
  });
});
