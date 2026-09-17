import { IGetoAdapter, EConsumptionSemantic } from '../models/index.js';
import { AdapterError } from '../errors/index.js';

/**
 * Configuration options for {@link HttpReferenceAdapter}.
 */
export interface IHttpReferenceAdapterOptions {
  /**
   * Optional whitelist of allowed origins (e.g. `['https://api.github.com']`).
   * If provided, attempts to consume or restore URLs from other origins throw an {@link AdapterError}
   * to mitigate SSRF risks.
   */
  allowedOrigins?: string[];
  /**
   * Optional custom fetch implementation, defaults to native global `fetch`.
   */
  fetchFn?: typeof fetch;
}

/**
 * Built-in adapter implementing the `REGISTER` semantic for HTTP web resources.
 *
 * `consume(url)` stores the URL locator reference without dispatching any network request.
 * `restore(url)` executes the HTTP GET request and resolves the response body as a UTF-8 string.
 */
export class HttpReferenceAdapter implements IGetoAdapter<string, string> {
  /** Unique identifier for this adapter. */
  readonly adapterId = 'http-reference';
  /** The consumption semantic: REGISTER. */
  readonly semantic = EConsumptionSemantic.REGISTER;

  private readonly allowedOrigins?: Set<string>;
  private readonly fetchFn: typeof fetch;

  /**
   * Initializes a new {@link HttpReferenceAdapter}.
   *
   * @param options - Configuration options including allowed origins and optional fetch provider.
   */
  constructor(options?: IHttpReferenceAdapterOptions) {
    this.allowedOrigins = options?.allowedOrigins ? new Set(options.allowedOrigins) : undefined;
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
  }

  /**
   * Validates the provided URL against the allowed origins whitelist.
   *
   * @param url - URL string to validate.
   * @throws {AdapterError} If the URL is malformed or its origin is not allowed.
   */
  private validateUrl(url: string): URL {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      throw new AdapterError(`Invalid URL provided to HttpReferenceAdapter: '${url}'`, { cause: error });
    }

    if (this.allowedOrigins && !this.allowedOrigins.has(parsedUrl.origin)) {
      throw new AdapterError(
        `URL origin '${parsedUrl.origin}' is not permitted by HttpReferenceAdapter security policy`
      );
    }

    return parsedUrl;
  }

  /**
   * Consumes an HTTP resource by registering its URL reference without fetching it.
   *
   * @param resource - Valid URL string to register.
   * @returns A promise resolving to the validated URL representation string.
   * @throws {AdapterError} If the URL is invalid or blocked by origin policy.
   */
  async consume(resource: string): Promise<string> {
    const parsed = this.validateUrl(resource);
    return parsed.toString();
  }

  /**
   * Restores the resource by dispatching an HTTP GET request to the registered URL.
   *
   * @param data - The stored URL representation.
   * @returns A promise resolving to the response text body.
   * @throws {AdapterError} If the HTTP request fails or returns an error status code.
   */
  async restore(data: string): Promise<string> {
    this.validateUrl(data);

    try {
      const response = await this.fetchFn(data);
      if (!response.ok) {
        throw new Error(`HTTP request failed with status ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      throw new AdapterError(`HttpReferenceAdapter failed to fetch resource from '${data}'`, { cause: error });
    }
  }
}
