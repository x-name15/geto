import { IGetoAdapter, EConsumptionSemantic } from '../models/index.js';

/**
 * Built-in adapter for Node.js `Buffer` resources implementing the `COPY` semantic.
 *
 * Each consume and restore operation creates a distinct, detached Buffer copy
 * to guarantee data isolation between the caller and the storage backend.
 */
export class BufferAdapter implements IGetoAdapter<Buffer, Buffer> {
  /** Unique identifier for this adapter. */
  readonly adapterId = 'buffer';
  /** The consumption semantic: COPY. */
  readonly semantic = EConsumptionSemantic.COPY;

  /**
   * Consumes a Buffer by returning an independent clone of its memory.
   *
   * @param resource - Source Buffer to copy.
   * @returns A new Buffer instance containing the copied bytes.
   */
  async consume(resource: Buffer): Promise<Buffer> {
    return Buffer.from(resource);
  }

  /**
   * Restores a stored Buffer by creating an independent copy.
   *
   * @param data - Stored Buffer representation.
   * @returns A new Buffer instance.
   */
  async restore(data: Buffer): Promise<Buffer> {
    return Buffer.from(data);
  }
}
