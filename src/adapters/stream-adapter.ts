import { Readable } from 'stream';
import { IGetoAdapter, EConsumptionSemantic } from '../models/index.js';
import { AdapterError } from '../errors/index.js';

/**
 * Configuration options for {@link StreamAdapter}.
 */
export interface IStreamAdapterOptions {
  /**
   * Maximum allowed bytes to buffer before aborting consumption.
   * If the stream produces more bytes than this limit, the stream is destroyed
   * and an {@link AdapterError} is thrown to prevent memory exhaustion (DoS).
   */
  maxBytes?: number;
}

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

  private readonly maxBytes?: number;

  /**
   * Initializes a new {@link StreamAdapter}.
   *
   * @param options - Configuration options including optional size bounds.
   */
  constructor(options?: IStreamAdapterOptions) {
    if (options?.maxBytes !== undefined && (options.maxBytes < 0 || !Number.isFinite(options.maxBytes))) {
      throw new AdapterError('StreamAdapter maxBytes option must be a non-negative finite number');
    }
    this.maxBytes = options?.maxBytes;
  }

  /**
   * Consumes a readable stream by draining it and collecting all binary chunks into a single Buffer.
   *
   * @param resource - The active Node.js `Readable` stream to consume.
   * @returns A promise resolving to the concatenated Buffer of all stream data.
   * @throws {AdapterError} If the stream is already ended, destroyed, emits an error, or exceeds maxBytes.
   */
  async consume(resource: Readable): Promise<Buffer> {
    if (!resource || typeof resource.on !== 'function') {
      throw new AdapterError('StreamAdapter requires a valid Readable stream instance');
    }
    if (resource.readableEnded) {
      throw new AdapterError('Cannot consume a stream that has already ended');
    }
    if (resource.destroyed) {
      throw new AdapterError('Cannot consume a destroyed stream');
    }

    return new Promise<Buffer>((resolve, reject) => {
      let settled = false;
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      const cleanup = () => {
        resource.removeListener('data', onData);
        resource.removeListener('end', onEnd);
        resource.removeListener('error', onError);
      };

      const onData = (chunk: Buffer | string) => {
        if (settled) return;
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buf.length;

        if (this.maxBytes !== undefined && totalBytes > this.maxBytes) {
          settled = true;
          cleanup();
          resource.destroy();
          reject(new AdapterError(`Stream exceeded maximum allowed size of ${this.maxBytes} bytes`));
          return;
        }

        chunks.push(buf);
      };

      const onEnd = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(Buffer.concat(chunks));
      };

      const onError = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new AdapterError('StreamAdapter failed while reading stream', { cause: error }));
      };

      resource.on('data', onData);
      resource.on('end', onEnd);
      resource.on('error', onError);
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
