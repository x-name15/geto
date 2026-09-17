import { Readable } from 'stream';
import { IGetoAdapter, EConsumptionSemantic } from '../models/index.js';
import { AdapterError } from '../errors/index.js';

/**
 * Built-in adapter for Node.js `Readable` streams implementing the `CAPTURE` semantic.
 *
 * Consumes a readable stream by buffering its entire payload until the 'end' event.
 * Restoration creates a fresh, fully-readable `Readable` stream instance from the stored buffer,
 * allowing single-use streams to be replayed multiple times.
 */
export class StreamAdapter implements IGetoAdapter<Readable, Buffer> {
  /** Unique identifier for this adapter. */
  readonly adapterId = 'stream';
  /** The consumption semantic: CAPTURE. */
  readonly semantic = EConsumptionSemantic.CAPTURE;

  /**
   * Consumes a readable stream by draining it and collecting all binary chunks into a single Buffer.
   *
   * @param resource - The active Node.js `Readable` stream to consume.
   * @returns A promise resolving to the concatenated Buffer of all stream data.
   * @throws {AdapterError} If the stream emits an 'error' event before ending.
   */
  async consume(resource: Readable): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      resource.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      resource.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      resource.on('error', (error: Error) => {
        reject(new AdapterError('StreamAdapter failed while reading stream', { cause: error }));
      });
    });
  }

  /**
   * Restores the captured buffer into a newly instantiated, readable stream.
   *
   * @param data - The stored Buffer representation.
   * @returns A fresh, readable stream containing the stored data.
   */
  async restore(data: Buffer): Promise<Readable> {
    return Readable.from(data);
  }

  /**
   * Optional lifecycle hook. Destroys the stream instance if it is not already destroyed.
   *
   * @param resource - The stream to release.
   */
  async release(resource: Readable): Promise<void> {
    if (!resource.destroyed) {
      resource.destroy();
    }
  }
}
