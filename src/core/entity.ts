import { IEntity, EEntityState, IEntityMetadata } from '../models/index.js';

/**
 * Internal immutable representation of an entity descriptor.
 */
export class GetoEntity implements IEntity {
  readonly id: string;
  readonly adapterId: string;
  readonly state: EEntityState;
  readonly metadata: IEntityMetadata;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(
    id: string,
    adapterId: string,
    state: EEntityState,
    metadata: IEntityMetadata,
    createdAt: Date,
    updatedAt: Date
  ) {
    this.id = id;
    this.adapterId = adapterId;
    this.state = state;
    this.createdAt = new Date(createdAt.getTime());
    this.updatedAt = new Date(updatedAt.getTime());

    // Defensive freezing of metadata and nested custom properties
    if (metadata.custom && typeof metadata.custom === 'object') {
      Object.freeze(metadata.custom);
    }
    this.metadata = Object.freeze({
      ...metadata,
      createdAt: new Date(this.createdAt.getTime()),
      updatedAt: new Date(this.updatedAt.getTime()),
    });

    Object.freeze(this);
  }

  static create(id: string, adapterId: string, metadata?: Record<string, unknown>): GetoEntity {
    const now = new Date();
    const clonedCustom = metadata && typeof metadata === 'object' ? Object.freeze({ ...metadata }) : undefined;
    const entityMetadata: IEntityMetadata = {
      id,
      adapterId,
      createdAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime()),
      custom: clonedCustom,
    };
    return new GetoEntity(id, adapterId, EEntityState.STORED, entityMetadata, now, now);
  }

  withState(state: EEntityState): GetoEntity {
    return new GetoEntity(this.id, this.adapterId, state, this.metadata, this.createdAt, this.updatedAt);
  }

  withUpdatedAt(date: Date): GetoEntity {
    const newDate = new Date(date.getTime());
    const newMetadata: IEntityMetadata = {
      ...this.metadata,
      updatedAt: newDate,
    };
    return new GetoEntity(this.id, this.adapterId, this.state, newMetadata, this.createdAt, newDate);
  }
}
