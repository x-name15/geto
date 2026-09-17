import * as crypto from 'crypto';
import { IEntity, IGetoAdapter, IGetoStorage, IConsumeOptions, IGatewayOptions, EEntityState, IEntityMetadata } from '../models/index.js';
import { GetoEntity } from './entity.js';
import { EntityNotFoundError, EntityStateError, AdapterError, StorageError } from '../errors/index.js';

export class GetoGateway {
  private readonly storage: IGetoStorage;
  private readonly entities: Map<string, GetoEntity>;

  constructor(options: IGatewayOptions) {
    this.storage = options.storage;
    this.entities = new Map<string, GetoEntity>();
  }

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

    const updatedEntity = canonical.withState(EEntityState.RELEASED).withUpdatedAt(new Date());
    this.entities.set(entity.id, updatedEntity);
  }

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

  async exists(id: string): Promise<boolean> {
    const entity = this.entities.get(id);
    if (!entity) return false;
    return entity.state !== EEntityState.DELETED;
  }

  async inspect(id: string): Promise<IEntityMetadata> {
    const entity = await this.get(id);
    return entity.metadata;
  }
}
