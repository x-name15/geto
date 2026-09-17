import { IEntity, EEntityState, IEntityMetadata } from '../models/index.js';

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
    this.metadata = metadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    Object.freeze(this.metadata);
    Object.freeze(this);
  }

  static create(id: string, adapterId: string, metadata?: Record<string, unknown>): GetoEntity {
    const now = new Date();
    const entityMetadata: IEntityMetadata = {
      id,
      adapterId,
      createdAt: now,
      updatedAt: now,
      custom: metadata
    };
    return new GetoEntity(id, adapterId, EEntityState.STORED, entityMetadata, now, now);
  }

  withState(state: EEntityState): GetoEntity {
    return new GetoEntity(this.id, this.adapterId, state, this.metadata, this.createdAt, this.updatedAt);
  }

  withUpdatedAt(date: Date): GetoEntity {
    const newMetadata = { ...this.metadata, updatedAt: date };
    return new GetoEntity(this.id, this.adapterId, this.state, newMetadata, this.createdAt, date);
  }
}
