import { IGetoAdapter, EConsumptionSemantic } from '../models/index.js';
import { AdapterError } from '../errors/index.js';

/**
 * Built-in adapter for serializable JavaScript values and objects implementing the `SERIALIZE` semantic.
 *
 * Transforms any JSON-serializable resource `T` into a string representation `R = string`,
 * and restores it via `JSON.parse()`.
 *
 * @typeParam T - The JavaScript object or value type. Defaults to `unknown`.
 */
export class JsonAdapter<T = unknown> implements IGetoAdapter<T, string> {
  /** Unique identifier for this adapter. */
  readonly adapterId = 'json';
  /** The consumption semantic: SERIALIZE. */
  readonly semantic = EConsumptionSemantic.SERIALIZE;

  /**
   * Consumes an object by serializing it to a JSON formatted string.
   *
   * @param resource - The data or object to serialize.
   * @returns A promise resolving to the serialized JSON string.
   * @throws {AdapterError} If JSON serialization fails (e.g. circular references or BigInt).
   */
  async consume(resource: T): Promise<string> {
    try {
      const serialized = JSON.stringify(resource);
      if (serialized === undefined) {
        throw new Error('JSON.stringify returned undefined (unsupported value such as undefined or function)');
      }
      return serialized;
    } catch (error) {
      throw new AdapterError(`JsonAdapter failed to serialize resource`, { cause: error });
    }
  }

  /**
   * Restores a serialized JSON string back into its original JavaScript representation.
   *
   * @param data - The JSON string representation.
   * @returns A promise resolving to the parsed object of type `T`.
   * @throws {AdapterError} If parsing fails due to malformed JSON.
   */
  async restore(data: string): Promise<T> {
    try {
      return JSON.parse(data) as T;
    } catch (error) {
      throw new AdapterError(`JsonAdapter failed to deserialize JSON data`, { cause: error });
    }
  }
}
