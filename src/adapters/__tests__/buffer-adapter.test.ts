import { describe, it, expect } from 'vitest';
import { BufferAdapter } from '../../adapters/buffer-adapter.js';
import { EConsumptionSemantic } from '../../models/index.js';

describe('BufferAdapter', () => {
  const adapter = new BufferAdapter();

  it('should have correct adapterId and semantic', () => {
    expect(adapter.adapterId).toBe('buffer');
    expect(adapter.semantic).toBe(EConsumptionSemantic.COPY);
  });

  it('should return a copy of the buffer on consume', async () => {
    const original = Buffer.from('hello');
    const consumed = await adapter.consume(original);
    
    expect(consumed).not.toBe(original);
    expect(consumed.toString()).toBe(original.toString());
  });

  it('should return a copy of the buffer on restore', async () => {
    const original = Buffer.from('hello');
    const restored = await adapter.restore(original);
    
    expect(restored).not.toBe(original);
    expect(restored.toString()).toBe(original.toString());
  });

  it('should work with empty buffers', async () => {
    const original = Buffer.from('');
    const consumed = await adapter.consume(original);
    expect(consumed.length).toBe(0);
    
    const restored = await adapter.restore(consumed);
    expect(restored.length).toBe(0);
  });

  it('should preserve data integrity through consume and restore', async () => {
    const original = Buffer.from('data integrity');
    const consumed = await adapter.consume(original);
    const restored = await adapter.restore(consumed);
    
    expect(restored.toString()).toBe('data integrity');
  });

  it('rejects non-buffer resources in consume with AdapterError', async () => {
    // @ts-expect-error test non-buffer
    await expect(adapter.consume('not-a-buffer')).rejects.toThrow();
    // @ts-expect-error test object
    await expect(adapter.consume({ type: 'Buffer' })).rejects.toThrow();
    // @ts-expect-error test null
    await expect(adapter.consume(null)).rejects.toThrow();
  });

  it('rejects non-buffer representations in restore with AdapterError', async () => {
    // @ts-expect-error test non-buffer
    await expect(adapter.restore('not-a-buffer')).rejects.toThrow();
    // @ts-expect-error test number
    await expect(adapter.restore(1234)).rejects.toThrow();
    // @ts-expect-error test null
    await expect(adapter.restore(null)).rejects.toThrow();
  });
});
