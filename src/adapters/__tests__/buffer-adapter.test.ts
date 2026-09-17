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
});
