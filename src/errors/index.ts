import { EEntityState } from '../models/index.js';

export class GetoError extends Error {
  cause?: unknown;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = this.constructor.name;
    this.cause = options?.cause;
  }
}

export class EntityNotFoundError extends GetoError {
  constructor(id: string, options?: { cause?: unknown }) {
    super(`Entity '${id}' not found`, options);
  }
}

export class EntityStateError extends GetoError {
  constructor(id: string, state: EEntityState, operation: string, options?: { cause?: unknown }) {
    super(`Cannot perform '${operation}' on entity '${id}' in state '${state}'`, options);
  }
}

export class AdapterError extends GetoError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

export class StorageError extends GetoError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}
