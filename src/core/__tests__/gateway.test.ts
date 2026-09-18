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
        adapterId: 'buffer',
        semantic: EConsumptionSemantic.COPY,
        consume: async () => 'test',
        restore: async () => { throw new Error('adapter fail'); }
      };
      await expect(gateway.restore(entity, badAdapter)).rejects.toThrow(AdapterError);
    });

    it('rejects restore with AdapterError when adapterId mismatches originating adapter', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter);
      const mismatchedAdapter: IGetoAdapter<any, any> = {
        adapterId: 'different-adapter',
        semantic: EConsumptionSemantic.COPY,
        consume: async (b) => b,
        restore: async (b) => b,
      };

      await expect(gateway.restore(entity, mismatchedAdapter)).rejects.toThrow(AdapterError);
      await expect(gateway.restore(entity, mismatchedAdapter)).rejects.toThrow(/Adapter mismatch/);
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

    it('does not overwrite DELETED state if entity was deleted concurrently during release', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter);

      let releaseResolve: () => void = () => {};
      const releasePromise = new Promise<void>((resolve) => {
        releaseResolve = resolve;
      });

      const slowReleasableAdapter: IGetoAdapter<Buffer, Buffer> = {
        adapterId: 'buffer',
        semantic: EConsumptionSemantic.WRAP,
        consume: async (b) => b,
        restore: async (b) => b,
        release: async () => {
          await releasePromise;
        },
      };

      // Start release in background
      const releaseOp = gateway.release(entity, slowReleasableAdapter);

      // Concurrently delete the entity while release() is in-flight
      await gateway.delete(entity.id);

      // Now complete the adapter release hook
      releaseResolve();

      // The releaseOp must reject with EntityStateError and NOT overwrite state to RELEASED
      await expect(releaseOp).rejects.toThrow(EntityStateError);

      expect(await gateway.exists(entity.id)).toBe(false);
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

  describe('defensive hardening (1.1.1)', () => {
    it('rolls back and invokes adapter.release when storage.save fails during consume', async () => {
      let released = false;
      const releasableAdapter: IGetoAdapter<string, string> = {
        adapterId: 'releasable-test',
        semantic: EConsumptionSemantic.WRAP,
        consume: async (res) => res,
        restore: async (data) => data,
        release: async () => {
          released = true;
        },
      };

      vi.spyOn(storage, 'save').mockRejectedValueOnce(new Error('Disk write failed'));

      await expect(gateway.consume('resource', releasableAdapter)).rejects.toThrow(StorageError);
      // Critical check: release() was triggered to prevent handle leak
      expect(released).toBe(true);
    });

    it('rejects release with AdapterError when adapterId mismatches', async () => {
      const entity = await gateway.consume(Buffer.from('test'), adapter);
      const wrongAdapter: IGetoAdapter<any, any> = {
        adapterId: 'wrong-id',
        semantic: EConsumptionSemantic.COPY,
        consume: async (b) => b,
        restore: async (b) => b,
      };

      await expect(gateway.release(entity, wrongAdapter)).rejects.toThrow(AdapterError);
      await expect(gateway.release(entity, wrongAdapter)).rejects.toThrow(/Adapter mismatch/);
    });

    it('exposes typed properties on EntityNotFoundError and EntityStateError', async () => {
      const missingId = '00000000-0000-0000-0000-000000000000';
      try {
        await gateway.get(missingId);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(EntityNotFoundError);
        expect((err as EntityNotFoundError).id).toBe(missingId);
      }

      const entity = await gateway.consume(Buffer.from('test'), adapter);
      await gateway.delete(entity.id);

      try {
        await gateway.get(entity.id);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(EntityStateError);
        const stateErr = err as EntityStateError;
        expect(stateErr.id).toBe(entity.id);
        expect(stateErr.state).toBe(EEntityState.DELETED);
        expect(stateErr.operation).toBe('get');
      }
    });

    it('guarantees immutability of entity metadata and prevents external mutations', async () => {
      const externalMeta: Record<string, unknown> = { role: 'analyst', level: 1 };
      const entity = await gateway.consume(Buffer.from('test'), adapter, { metadata: externalMeta });

      // Mutating external source object should NOT mutate internal entity metadata
      externalMeta.role = 'superuser';
      expect(entity.metadata.custom?.role).toBe('analyst');

      // Mutating entity custom metadata directly should fail (frozen)
      expect(() => {
        (entity.metadata.custom as any).role = 'hacked';
      }).toThrow();

      // Mutating Date objects should not alter the entity's stored dates
      const originalTime = entity.createdAt.getTime();
      entity.createdAt.setFullYear(1990);
      const inspected = await gateway.inspect(entity.id);
      expect(inspected.createdAt.getTime()).toBe(originalTime);
    });
  });

  describe('defensive hardening (1.1.2)', () => {
    it('throws StorageError if constructor is called without valid storage', () => {
      // @ts-expect-error test missing options
      expect(() => new GetoGateway()).toThrow(StorageError);
      // @ts-expect-error test null storage
      expect(() => new GetoGateway({ storage: null })).toThrow(StorageError);
      // @ts-expect-error test invalid storage object
      expect(() => new GetoGateway({ storage: {} })).toThrow(StorageError);
    });

    it('validates IDs in get, delete, inspect and exists', async () => {
      await expect(gateway.get('')).rejects.toThrow(EntityNotFoundError);
      await expect(gateway.delete('')).rejects.toThrow(EntityNotFoundError);
      await expect(gateway.inspect('')).rejects.toThrow(EntityNotFoundError);
      expect(await gateway.exists('')).toBe(false);
      expect(await gateway.exists('   ')).toBe(false);
    });

    it('enforces maxTombstones eviction policy upon entity deletion', async () => {
      const limitedGateway = new GetoGateway({ storage, maxTombstones: 2 });

      const e1 = await limitedGateway.consume(Buffer.from('1'), adapter);
      const e2 = await limitedGateway.consume(Buffer.from('2'), adapter);
      const e3 = await limitedGateway.consume(Buffer.from('3'), adapter);

      await limitedGateway.delete(e1.id);
      await limitedGateway.delete(e2.id);
      // At this point, e1 and e2 are DELETED tombstones (count = 2 <= maxTombstones)
      await expect(limitedGateway.get(e1.id)).rejects.toThrow(EntityStateError);
      await expect(limitedGateway.get(e2.id)).rejects.toThrow(EntityStateError);

      // Deleting e3 pushes tombstones to 3 > 2; e1 (oldest) should be evicted from memory
      await limitedGateway.delete(e3.id);

      // e1 was evicted: get(e1.id) throws EntityNotFoundError (instead of EntityStateError)
      await expect(limitedGateway.get(e1.id)).rejects.toThrow(EntityNotFoundError);
      // e2 and e3 are still tombstones
      await expect(limitedGateway.get(e2.id)).rejects.toThrow(EntityStateError);
      await expect(limitedGateway.get(e3.id)).rejects.toThrow(EntityStateError);
    });

    it('prunes tombstones via pruneDeleted()', async () => {
      const e1 = await gateway.consume(Buffer.from('1'), adapter);
      const e2 = await gateway.consume(Buffer.from('2'), adapter);
      const e3 = await gateway.consume(Buffer.from('3'), adapter);

      await gateway.delete(e1.id);
      await gateway.delete(e2.id);

      // Pruning with future age (maxAgeMs: 100000) should prune 0 recently deleted items
      const prunedRecent = gateway.pruneDeleted(100000);
      expect(prunedRecent).toBe(0);

      // Pruning without arguments should prune all DELETED tombstones immediately
      const prunedAll = gateway.pruneDeleted();
      expect(prunedAll).toBe(2);

      // e1 and e2 are completely evicted from gateway
      await expect(gateway.get(e1.id)).rejects.toThrow(EntityNotFoundError);
      await expect(gateway.get(e2.id)).rejects.toThrow(EntityNotFoundError);
      // e3 is still alive
      expect(await gateway.exists(e3.id)).toBe(true);
    });
  });
});
