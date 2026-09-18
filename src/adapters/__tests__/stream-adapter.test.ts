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

  it('rejects an already ended stream immediately to prevent hanging', async () => {
    const stream = Readable.from(['drained']);
    for await (const _ of stream) {
      // drain
    }
    expect(stream.readableEnded).toBe(true);

    await expect(adapter.consume(stream)).rejects.toThrow(AdapterError);
    await expect(adapter.consume(stream)).rejects.toThrow(/already ended/);
  });

  it('rejects a destroyed stream immediately', async () => {
    const stream = new Readable({ read() {} });
    stream.destroy();
    expect(stream.destroyed).toBe(true);

    await expect(adapter.consume(stream)).rejects.toThrow(AdapterError);
    await expect(adapter.consume(stream)).rejects.toThrow(/destroyed/);
  });

  it('rejects invalid resource type', async () => {
    await expect((adapter as any).consume(null)).rejects.toThrow(AdapterError);
    await expect((adapter as any).consume({})).rejects.toThrow(AdapterError);
  });

  it('enforces maxBytes limit and destroys stream when exceeded', async () => {
    const boundedAdapter = new StreamAdapter({ maxBytes: 10 });
    const largeStream = Readable.from(['Chunk 1 (8B)', 'Chunk 2 (8B)']);

    await expect(boundedAdapter.consume(largeStream)).rejects.toThrow(AdapterError);
    await expect(boundedAdapter.consume(Readable.from(['Chunk 1 (8B)', 'Chunk 2 (8B)']))).rejects.toThrow(
      /exceeded maximum allowed size of 10 bytes/
    );
  });

  it('allows streams within maxBytes limit', async () => {
    const boundedAdapter = new StreamAdapter({ maxBytes: 50 });
    const smallStream = Readable.from(['Small data']);
    const result = await boundedAdapter.consume(smallStream);
    expect(result.toString()).toBe('Small data');
  });

  it('throws when maxBytes option is invalid', () => {
    expect(() => new StreamAdapter({ maxBytes: -1 })).toThrow(AdapterError);
    expect(() => new StreamAdapter({ maxBytes: NaN })).toThrow(AdapterError);
  });

  it('rejects streams emitting non-buffer, non-string chunks with AdapterError', async () => {
    const objectStream = Readable.from([{ id: 1, name: 'Satoru' }]);

    await expect(adapter.consume(objectStream)).rejects.toThrow(AdapterError);
    await expect(
      adapter.consume(Readable.from([{ id: 2 }]))
    ).rejects.toThrow(/Failed to process stream chunk into Buffer/);
  });
});
