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
  private readonly entities: Map<string, GetoEntity>;

  /**
   * Creates a new instance of {@link GetoGateway}.
   *
   * @param options - Configuration options including the storage provider.
   */
  constructor(options: IGatewayOptions) {
    this.storage = options.storage;
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
      throw new StorageError(`Failed to save representation for id '${id}'`, { cause: error });
    }

    const entity = GetoEntity.create(id, adapter.adapterId, options?.metadata);
    this.entities.set(id, entity);
    return entity;
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
   * @throws {StorageError} If the storage backend fails to load the representation.
   * @throws {AdapterError} If the adapter fails to restore the resource.
   */
  async restore<T, R>(entity: IEntity, adapter: IGetoAdapter<T, R>): Promise<T> {
    // Always read canonical state from internal Map — caller's entity object may be a stale snapshot.
    const canonical = this.entities.get(entity.id);
    if (!canonical) {
      throw new EntityNotFoundError(entity.id);
    }
    if (canonical.state === EEntityState.DELETED) {
      throw new EntityStateError(entity.id, canonical.state, 'restore');
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
   * @throws {StorageError} If loading from storage fails.
   * @throws {AdapterError} If the adapter fails during resource restoration or release.
   */
  async release<T, R>(entity: IEntity, adapter: IGetoAdapter<T, R>): Promise<void> {
    // Always read canonical state from internal Map — caller's entity object may be a stale snapshot.
    const canonical = this.entities.get(entity.id);
    if (!canonical) {
      throw new EntityNotFoundError(entity.id);
    }
    if (canonical.state === EEntityState.DELETED) {
      throw new EntityStateError(entity.id, canonical.state, 'release');
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
  }

  /**
   * Checks whether an entity exists and is not in a DELETED state.
   *
   * @param id - The unique UUID of the entity.
   * @returns A promise that resolves to `true` if active, otherwise `false`.
   */
  async exists(id: string): Promise<boolean> {
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
    const entity = await this.get(id);
    return entity.metadata;
  }
}
