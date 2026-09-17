export enum EEntityState {
  STORED = 'stored',
  RELEASED = 'released',
  DELETED = 'deleted'
}

export enum EConsumptionSemantic {
  COPY = 'copy',
  CAPTURE = 'capture',
  SERIALIZE = 'serialize',
  WRAP = 'wrap',
  REGISTER = 'register'
}

export interface IEntityMetadata {
  id: string;
  adapterId: string;
  createdAt: Date;
  updatedAt: Date;
  size?: number;
  custom?: Record<string, unknown>;
}

export interface IEntity {
  readonly id: string;
  readonly adapterId: string;
  readonly state: EEntityState;
  readonly metadata: IEntityMetadata;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface IGetoAdapter<T, R> {
  readonly adapterId: string;
  readonly semantic: EConsumptionSemantic | EConsumptionSemantic[];
  consume(resource: T): Promise<R>;
  restore(data: R): Promise<T>;
  release?(resource: T): Promise<void>;
}

export interface IGetoStorage {
  save(id: string, data: unknown): Promise<void>;
  load(id: string): Promise<unknown>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

export interface IConsumeOptions {
  metadata?: Record<string, unknown>;
}

export interface IGatewayOptions {
  storage: IGetoStorage;
}
