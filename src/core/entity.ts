import { IEntity, EEntityState, IEntityMetadata } from '../models/index.js';

/**
 * Recursively freezes an object and all its nested properties.
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== null && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return obj;
}

/**
 * Creates a defensive deep clone of a plain object or array.
 */
function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return new Date(value.getTime()) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as unknown as T;
  }
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    copy[key] = deepClone((value as Record<string, unknown>)[key]);
  }
  return copy as T;
}

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

    // Defensive deep freezing of metadata and nested custom properties
    if (metadata.custom && typeof metadata.custom === 'object') {
      deepFreeze(metadata.custom);
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
    const clonedCustom =
      metadata && typeof metadata === 'object' ? deepFreeze(deepClone(metadata)) : undefined;
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
