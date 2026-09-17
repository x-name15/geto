import { EEntityState } from '../models/index.js';

/**
 * Base error class for all geto gateway exceptions.
 */
export class GetoError extends Error {
  /** Optional underlying cause of this error. */
  cause?: unknown;

  /**
   * Initializes a new {@link GetoError}.
   *
   * @param message - Human-readable error description.
   * @param options - Error options containing optional cause.
   */
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = this.constructor.name;
    this.cause = options?.cause;
  }
}

/**
 * Thrown when an entity ID is not found in the gateway or storage backend.
 */
export class EntityNotFoundError extends GetoError {
  /**
   * @param id - The ID that could not be located.
   * @param options - Error options.
   */
  constructor(id: string, options?: { cause?: unknown }) {
    super(`Entity '${id}' not found`, options);
  }
}

/**
 * Thrown when an operation is invalid for an entity's current lifecycle state.
 */
export class EntityStateError extends GetoError {
  /**
   * @param id - Entity identifier.
   * @param state - The entity state that prohibited the operation.
   * @param operation - The operation name that was attempted (e.g. 'restore', 'delete').
   * @param options - Error options.
   */
  constructor(id: string, state: EEntityState, operation: string, options?: { cause?: unknown }) {
    super(`Cannot perform '${operation}' on entity '${id}' in state '${state}'`, options);
  }
}

/**
 * Thrown when an adapter encounters an unhandled exception during consume, restore, or release.
 */
export class AdapterError extends GetoError {
  /**
   * @param message - Error details.
   * @param options - Error options.
   */
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

/**
 * Thrown when a storage provider fails to save, load, check, or delete representations.
 */
export class StorageError extends GetoError {
  /**
   * @param message - Storage error message.
   * @param options - Error options.
   */
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}
