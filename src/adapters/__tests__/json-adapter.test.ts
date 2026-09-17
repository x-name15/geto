import { describe, it, expect } from 'vitest';
import { JsonAdapter } from '../json-adapter.js';
import { EConsumptionSemantic } from '../../models/index.js';
import { AdapterError } from '../../errors/index.js';

describe('JsonAdapter', () => {
  const adapter = new JsonAdapter();

  it('has correct adapterId and semantic properties', () => {
    expect(adapter.adapterId).toBe('json');
    expect(adapter.semantic).toBe(EConsumptionSemantic.SERIALIZE);
  });

  it('serializes an object into a JSON string and restores it cleanly', async () => {
    interface IUserPayload {
      name: string;
      roles: string[];
      active: boolean;
      score: number;
    }

    const payload: IUserPayload = {
      name: 'Suguru Geto',
      roles: ['special-grade', 'sorcerer'],
      active: true,
      score: 100,
    };

    const serialized = await adapter.consume(payload);
    expect(typeof serialized).toBe('string');
    expect(JSON.parse(serialized)).toEqual(payload);

    const restored = await adapter.restore(serialized);
    expect(restored).toEqual(payload);
  });

  it('serializes primitives and arrays correctly', async () => {
    const list = [1, 'two', { three: 3 }, null, false];
    const serialized = await adapter.consume(list);
    const restored = await adapter.restore(serialized);
    expect(restored).toEqual(list);
  });

  it('throws AdapterError when serializing circular references', async () => {
    const circular: Record<string, unknown> = { key: 'value' };
    circular.self = circular;

    await expect(adapter.consume(circular)).rejects.toThrow(AdapterError);
  });

  it('throws AdapterError when deserializing invalid JSON', async () => {
    await expect(adapter.restore('{ broken json')).rejects.toThrow(AdapterError);
  });
});
