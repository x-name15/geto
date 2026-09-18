import * as crypto from 'crypto';
import {
  IEntity,
  IGetoAdapter,
  IGetoStorage,
  IConsumeOptions,
  IGatewayOptions,
  EEntityState,
  IEntityMetadata,
} from '../models/index.js';
import { GetoEntity } from './entity.js';
import {
  EntityNotFoundError,
  EntityStateError,
  AdapterError,
  StorageError,
} from '../errors/index.js';

/**
 * Orchestrator for resource consumption and entity lifecycle.
 *
 * The gateway coordinates adapter transformation, representation storage,
 * and lifecycle states without needing specific knowledge of the underlying resource type.
 */
export class GetoGateway {
  private readonly storage: IGetoStorage;
  private readonly maxTombstones?: number;
  private readonly entities: Map<string, GetoEntity>;

  /**
   * Creates a new instance of {@link GetoGateway}.
   *
   * @param options - Configuration options including the storage provider.
   * @throws {StorageError} If no valid storage provider is provided.
   */
  constructor(options: IGatewayOptions) {
    if (!options || !options.storage || typeof options.storage.save !== 'function') {
      throw new StorageError('A valid storage provider is required to initialize GetoGateway');
    }
    this.storage = options.storage;
    this.maxTombstones = options.maxTombstones;
    this.entities = new Map<string, GetoEntity>();
  }

  /**
   * Consumes a resource using the specified adapter and persists its representation in storage.
   *
   * @param resource - The resource to consume.
   * @param adapter - The adapter implementing consumption semantics for this resource.
   * @param options - Optional consumption settings, including custom metadata.
   * @returns A frozen {@link IEntity} representing the consumed resource handle.
   *
   * @throws {AdapterError} If the adapter fails during the consumption phase.
   * @throws {StorageError} If the storage backend fails to persist the representation.
   *
   * @example
   * ```typescript
   * const entity = await gateway.consume(Buffer.from('data'), new BufferAdapter());
   * console.log(entity.id);
   * ```
   */
  async consume<T, R>(resource: T, adapter: IGetoAdapter<T, R>, options?: IConsumeOptions): Promise<IEntity> {
    if (!adapter || typeof adapter.consume !== 'function') {
      throw new AdapterError('A valid adapter implementing consume() is required');
    }

    const id = crypto.randomUUID();
    let representation: R;

    try {
      representation = await adapter.consume(resource);
    } catch (error) {
      throw new AdapterError(`Failed to consume resource with adapter '${adapter.adapterId}'`, { cause: error });
    }

    try {
      await this.storage.save(id, representation);
    } catch (error) {
      // Rollback: if storage fails, ensure acquired resource handles are freed immediately
      if (typeof adapter.release === 'function') {
        try {
          await adapter.release(resource);
        } catch {
          // Suppress secondary release failure to preserve the original StorageError cause
        }
      }
      throw new StorageError(`Failed to save representation for id '${id}'`, { cause: error });
    }

    const entity = GetoEntity.create(id, adapter.adapterId, options?.metadata);
    this.entities.set(id, entity);
    return entity;
  }

  private validateId(id: string): void {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new EntityNotFoundError(String(id));
    }
  }

  /**
   * Retrieves an entity descriptor by its unique identifier.
   *
   * @param id - The unique UUID of the entity.
   * @returns The immutable {@link IEntity} descriptor.
   *
   * @throws {EntityNotFoundError} If no entity with this ID exists.
   * @throws {EntityStateError} If the entity was marked as DELETED.
   */
  async get(id: string): Promise<IEntity> {
    this.validateId(id);
    const entity = this.entities.get(id);
    if (!entity) {
      throw new EntityNotFoundError(id);
    }
    if (entity.state === EEntityState.DELETED) {
      throw new EntityStateError(id, entity.state, 'get');
    }
    return entity;
  }

  /**
   * Restores a previously consumed resource representation into its live resource instance.
   *
   * @param entity - The entity descriptor representing the consumed resource.
   * @param adapter - The adapter that knows how to convert the stored representation back to type `T`.
   * @returns The reconstructed resource instance.
   *
   * @throws {EntityNotFoundError} If the entity does not exist in the gateway.
   * @throws {EntityStateError} If the entity is in a DELETED state.
   * @throws {AdapterError} If the provided adapter does not match the originating adapter or fails to restore.
   * @throws {StorageError} If the storage backend fails to load the representation.
   */
  async restore<T, R>(entity: IEntity, adapter: IGetoAdapter<T, R>): Promise<T> {
    if (!entity || !entity.id || typeof entity.id !== 'string') {
      throw new EntityNotFoundError(String(entity?.id ?? 'undefined'));
    }
    if (!adapter || typeof adapter.restore !== 'function') {
      throw new AdapterError('A valid adapter implementing restore() is required');
    }

    // Always read canonical state from internal Map — caller's entity object may be a stale snapshot.
    const canonical = this.entities.get(entity.id);
    if (!canonical) {
      throw new EntityNotFoundError(entity.id);
    }
    if (canonical.state === EEntityState.DELETED) {
      throw new EntityStateError(entity.id, canonical.state, 'restore');
    }

    if (adapter.adapterId !== canonical.adapterId) {
      throw new AdapterError(
        `Adapter mismatch: entity '${entity.id}' was created with adapter '${canonical.adapterId}', but adapter '${adapter.adapterId}' was provided`
      );
    }

    let representation: unknown;
    try {
      representation = await this.storage.load(entity.id);
    } catch (error) {
      throw new StorageError(`Failed to load representation for id '${entity.id}'`, { cause: error });
    }

    try {
      return await adapter.restore(representation as R);
    } catch (error) {
      throw new AdapterError(`Failed to restore resource with adapter '${adapter.adapterId}'`, { cause: error });
    }
  }

  /**
   * Triggers cleanup/release logic on the underlying resource if defined by the adapter,
   * transitioning the entity state to RELEASED.
   *
   * @param entity - The entity descriptor to release.
   * @param adapter - The adapter handling the release lifecycle.
   *
   * @throws {EntityNotFoundError} If the entity does not exist in the gateway.
   * @throws {EntityStateError} If the entity is in a DELETED state.
   * @throws {AdapterError} If the provided adapter does not match the originating adapter or fails during release.
   * @throws {StorageError} If loading from storage fails.
   */
  async release<T, R>(entity: IEntity, adapter: IGetoAdapter<T, R>): Promise<void> {
    if (!entity || !entity.id || typeof entity.id !== 'string') {
      throw new EntityNotFoundError(String(entity?.id ?? 'undefined'));
    }
    if (!adapter) {
      throw new AdapterError('A valid adapter is required for release()');
    }

    // Always read canonical state from internal Map — caller's entity object may be a stale snapshot.
    const canonical = this.entities.get(entity.id);
    if (!canonical) {
      throw new EntityNotFoundError(entity.id);
    }
    if (canonical.state === EEntityState.DELETED) {
      throw new EntityStateError(entity.id, canonical.state, 'release');
    }

    if (adapter.adapterId !== canonical.adapterId) {
      throw new AdapterError(
        `Adapter mismatch: entity '${entity.id}' was created with adapter '${canonical.adapterId}', but adapter '${adapter.adapterId}' was provided`
      );
    }

    if (adapter.release) {
      let representation: unknown;
      try {
        representation = await this.storage.load(entity.id);
      } catch (error) {
        throw new StorageError(`Failed to load representation for id '${entity.id}'`, { cause: error });
      }

      let resource: T;
      try {
        resource = await adapter.restore(representation as R);
      } catch (error) {
        throw new AdapterError(`Failed to restore resource during release with adapter '${adapter.adapterId}'`, { cause: error });
      }

      try {
        await adapter.release(resource);
      } catch (error) {
        throw new AdapterError(`Failed to release resource with adapter '${adapter.adapterId}'`, { cause: error });
      }
    }

    // Verify entity was not concurrently deleted while awaiting adapter.release()
    const latest = this.entities.get(entity.id);
    if (!latest || latest.state === EEntityState.DELETED) {
      throw new EntityStateError(entity.id, EEntityState.DELETED, 'release');
    }

    const updatedEntity = latest.withState(EEntityState.RELEASED).withUpdatedAt(new Date());
    this.entities.set(entity.id, updatedEntity);
  }

  /**
   * Deletes an entity from storage and transitions its lifecycle state to DELETED (terminal).
   *
   * @param id - The unique UUID of the entity to delete.
   *
   * @throws {EntityNotFoundError} If the entity does not exist in the gateway.
   * @throws {EntityStateError} If the entity has already been deleted.
   * @throws {StorageError} If the storage backend fails to remove the representation.
   */
  async delete(id: string): Promise<void> {
    this.validateId(id);
    const entity = this.entities.get(id);
    if (!entity) {
      throw new EntityNotFoundError(id);
    }
    if (entity.state === EEntityState.DELETED) {
      throw new EntityStateError(id, entity.state, 'delete');
    }

    try {
      await this.storage.delete(id);
    } catch (error) {
      throw new StorageError(`Failed to delete representation for id '${id}'`, { cause: error });
    }

    const updatedEntity = entity.withState(EEntityState.DELETED).withUpdatedAt(new Date());
    this.entities.set(id, updatedEntity);

    // Evict oldest tombstones if maxTombstones budget is exceeded
    if (this.maxTombstones !== undefined && this.maxTombstones >= 0) {
      let tombstoneCount = 0;
      for (const item of this.entities.values()) {
        if (item.state === EEntityState.DELETED) {
          tombstoneCount++;
        }
      }

      if (tombstoneCount > this.maxTombstones) {
        // Evict oldest deleted entities (Map iteration maintains insertion order)
        for (const [key, item] of this.entities.entries()) {
          if (item.state === EEntityState.DELETED) {
            this.entities.delete(key);
            tombstoneCount--;
            if (tombstoneCount <= this.maxTombstones) {
              break;
            }
          }
        }
      }
    }
  }

  /**
   * Cleans up retained DELETED entity tombstones from internal gateway memory.
   *
   * @param maxAgeMs - Optional threshold in milliseconds. If specified, only tombstones
   * whose last updated date is older than `Date.now() - maxAgeMs` will be evicted.
   * If omitted, all tombstones are pruned immediately.
   * @returns The total number of evicted tombstones.
   */
  pruneDeleted(maxAgeMs?: number): number {
    let pruned = 0;
    const now = Date.now();

    for (const [id, entity] of this.entities.entries()) {
      if (entity.state === EEntityState.DELETED) {
        if (maxAgeMs === undefined || now - entity.updatedAt.getTime() >= maxAgeMs) {
          this.entities.delete(id);
          pruned++;
        }
      }
    }

    return pruned;
  }

  /**
   * Checks whether an entity exists and is not in a DELETED state.
   *
   * @param id - The unique UUID of the entity.
   * @returns A promise that resolves to `true` if active, otherwise `false`.
   */
  async exists(id: string): Promise<boolean> {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return false;
    }
    const entity = this.entities.get(id);
    if (!entity) return false;
    return entity.state !== EEntityState.DELETED;
  }

  /**
   * Returns metadata inspection for a managed entity.
   *
   * @param id - The unique UUID of the entity.
   * @returns A promise resolving to the {@link IEntityMetadata}.
   *
   * @throws {EntityNotFoundError} If the entity is not found or has been deleted.
   */
  async inspect(id: string): Promise<IEntityMetadata> {
    this.validateId(id);
    const entity = await this.get(id);
    return entity.metadata;
  }
}
