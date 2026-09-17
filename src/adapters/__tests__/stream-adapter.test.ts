import { describe, it, expect } from 'vitest';
import { Readable } from 'stream';
import { StreamAdapter } from '../stream-adapter.js';
import { EConsumptionSemantic } from '../../models/index.js';
import { AdapterError } from '../../errors/index.js';

describe('StreamAdapter', () => {
  const adapter = new StreamAdapter();

  it('has correct adapterId and semantic properties', () => {
    expect(adapter.adapterId).toBe('stream');
    expect(adapter.semantic).toBe(EConsumptionSemantic.CAPTURE);
  });

  it('consumes a readable stream into a Buffer and restores it as a new stream', async () => {
    const originalText = 'Domain Expansion: Malevolent Shrine';
    const sourceStream = Readable.from(Buffer.from(originalText));

    const consumedBuffer = await adapter.consume(sourceStream);
    expect(Buffer.isBuffer(consumedBuffer)).toBe(true);
    expect(consumedBuffer.toString()).toBe(originalText);

    // Source stream is drained and ended
    expect(sourceStream.readableEnded).toBe(true);

    // Restore creates a new readable stream
    const restoredStream = await adapter.restore(consumedBuffer);
    expect(restoredStream).toBeInstanceOf(Readable);

    // Verify content by reading restored stream
    const chunks: Buffer[] = [];
    for await (const chunk of restoredStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString()).toBe(originalText);
  });

  it('handles empty streams gracefully', async () => {
    const emptyStream = Readable.from([]);
    const buffer = await adapter.consume(emptyStream);
    expect(buffer.length).toBe(0);

    const restoredStream = await adapter.restore(buffer);
    const chunks: Buffer[] = [];
    for await (const chunk of restoredStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).length).toBe(0);
  });

  it('wraps stream errors into AdapterError during consume', async () => {
    const failingStream = new Readable({
      read() {
        this.destroy(new Error('Stream failure simulation'));
      },
    });

    await expect(adapter.consume(failingStream)).rejects.toThrow(AdapterError);
  });

  it('releases an active stream by destroying it', async () => {
    const activeStream = new Readable({
      read() {
        // keep open
      },
    });

    expect(activeStream.destroyed).toBe(false);
    await adapter.release(activeStream);
    expect(activeStream.destroyed).toBe(true);
  });
});
