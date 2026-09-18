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

  it('throws AdapterError when restore input is not a string', async () => {
    // @ts-expect-error test non-string input
    await expect(adapter.restore(12345)).rejects.toThrow(AdapterError);
    // @ts-expect-error test null input
    await expect(adapter.restore(null)).rejects.toThrow(AdapterError);
  });

  it('prevents prototype pollution by default', async () => {
    const maliciousJson = '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted2":"yes"}},"safeKey":"safeValue"}';
    const restored = await adapter.restore(maliciousJson) as Record<string, unknown>;

    expect(restored.safeKey).toBe('safeValue');
    // Ensure own properties '__proto__' and 'constructor' were stripped
    expect(Object.prototype.hasOwnProperty.call(restored, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(restored, 'constructor')).toBe(false);
    // Verify global Object prototype was not polluted
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted2).toBeUndefined();
  });

  it('allows disabling prototype pollution guard when explicitly requested', async () => {
    const permissiveAdapter = new JsonAdapter({ preventPrototypePollution: false });
    const payload = '{"customProp":"val"}';
    const restored = await permissiveAdapter.restore(payload) as Record<string, unknown>;
    expect(restored.customProp).toBe('val');
  });

  it('enforces maxBytes limit on consume and restore', async () => {
    const boundedAdapter = new JsonAdapter({ maxBytes: 15 });

    // Object serializes to '{"key":"0123456789"}' which is 20 bytes > 15 bytes
    await expect(boundedAdapter.consume({ key: '0123456789' })).rejects.toThrow(AdapterError);
    await expect(boundedAdapter.consume({ key: '0123456789' })).rejects.toThrow(/exceeded configured maximum allowed size/);

    // Valid small object passes
    const smallSerialized = await boundedAdapter.consume({ a: 1 });
    expect(smallSerialized).toBe('{"a":1}');

    // Restore rejects oversized input string
    const oversizedString = '{"longContent":"this string is way too long for twenty bytes"}';
    await expect(boundedAdapter.restore(oversizedString)).rejects.toThrow(AdapterError);
    await expect(boundedAdapter.restore(oversizedString)).rejects.toThrow(/exceeds configured maximum allowed size/);
  });
});
