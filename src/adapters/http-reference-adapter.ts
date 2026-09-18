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
   * HTTP redirect handling policy.
   * Defaults to `'error'` when `allowedOrigins` is specified to prevent open redirect SSRF bypasses.
   * Defaults to `'follow'` when no origin restrictions are present.
   */
  redirect?: 'follow' | 'error' | 'manual';
  /**
   * Request timeout in milliseconds to prevent Slowloris hangs.
   * Defaults to 30,000ms (30 seconds). Set to 0 to disable timeout.
   */
  timeoutMs?: number;
  /**
   * Maximum allowed response size in bytes to guard against denial-of-service decompression bombs.
   * If unset or undefined, no size budget is enforced.
   */
  maxBytes?: number;
  /**
   * Whether to reject URLs resolving to localhost, private RFC1918 IPv4 ranges,
   * link-local/cloud metadata addresses (`169.254.169.254`), or loopback IPv6 (CWE-918).
   * Defaults to `false` for backwards compatibility unless explicitly enabled.
   */
  blockPrivateIPs?: boolean;
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
  private readonly redirect: 'follow' | 'error' | 'manual';
  private readonly timeoutMs: number;
  private readonly maxBytes?: number;
  private readonly blockPrivateIPs: boolean;
  private readonly fetchFn: typeof fetch;

  /**
   * Initializes a new {@link HttpReferenceAdapter}.
   *
   * @param options - Configuration options including allowed origins, timeout, size limits and optional fetch provider.
   */
  constructor(options?: IHttpReferenceAdapterOptions) {
    if (options?.allowedOrigins) {
      const normalizedOrigins = options.allowedOrigins.map((orig) => {
        try {
          return new URL(orig).origin;
        } catch {
          return orig;
        }
      });
      this.allowedOrigins = new Set(normalizedOrigins);
    } else {
      this.allowedOrigins = undefined;
    }

    this.redirect = options?.redirect ?? (this.allowedOrigins && this.allowedOrigins.size > 0 ? 'error' : 'follow');
    this.timeoutMs = options?.timeoutMs !== undefined ? options.timeoutMs : 30000;
    this.maxBytes = options?.maxBytes;
    this.blockPrivateIPs = options?.blockPrivateIPs ?? false;
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
  }

  /**
   * Checks whether a hostname or IP address represents a private, loopback or link-local address.
   */
  private isPrivateHost(hostname: string): boolean {
    const lower = hostname.toLowerCase();

    // Loopback / localhost names
    if (lower === 'localhost' || lower === '0.0.0.0' || lower === '::1' || lower === '[::1]') {
      return true;
    }

    // Strips brackets for IPv6 if present
    const cleanHost = lower.startsWith('[') && lower.endsWith(']') ? lower.slice(1, -1) : lower;

    // IPv4 check
    const ipv4Match = cleanHost.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4Match) {
      const b0 = parseInt(ipv4Match[1], 10);
      const b1 = parseInt(ipv4Match[2], 10);

      // Loopback: 127.0.0.0/8
      if (b0 === 127) return true;
      // Current network: 0.0.0.0/8
      if (b0 === 0) return true;
      // Private RFC1918: 10.0.0.0/8
      if (b0 === 10) return true;
      // Private RFC1918: 172.16.0.0/12
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
      // Private RFC1918: 192.168.0.0/16
      if (b0 === 192 && b1 === 168) return true;
      // Link-local / Cloud metadata (AWS, GCP, Azure): 169.254.0.0/16
      if (b0 === 169 && b1 === 254) return true;
    }

    // Local / private domain suffixes
    if (lower.endsWith('.local') || lower.endsWith('.internal') || lower.endsWith('.localhost')) {
      return true;
    }

    return false;
  }

  /**
   * Validates the provided URL against supported schemes and origin allowlists.
   *
   * @param url - URL string to validate.
   * @throws {AdapterError} If the URL is malformed, scheme is unsupported, or its origin is not allowed.
   */
  private validateUrl(url: string): URL {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      throw new AdapterError(`Invalid URL provided to HttpReferenceAdapter: '${url}'`, { cause: error });
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new AdapterError(
        `Unsupported protocol '${parsedUrl.protocol}' in URL '${url}'. Only 'http:' and 'https:' are supported.`
      );
    }

    if (this.allowedOrigins && !this.allowedOrigins.has(parsedUrl.origin)) {
      throw new AdapterError(
        `URL origin '${parsedUrl.origin}' is not permitted by HttpReferenceAdapter security policy`
      );
    }

    if (this.blockPrivateIPs && this.isPrivateHost(parsedUrl.hostname)) {
      throw new AdapterError(
        `URL host '${parsedUrl.hostname}' is a private or loopback address blocked by HttpReferenceAdapter security policy`
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

    const controller = this.timeoutMs > 0 ? new AbortController() : undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    if (controller && this.timeoutMs > 0) {
      timerId = setTimeout(() => {
        controller.abort(new Error(`HTTP request timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
    }

    try {
      const fetchInit: RequestInit = {
        redirect: this.redirect,
        signal: controller?.signal,
      };

      const response = await this.fetchFn(data, fetchInit);

      // If fetch followed a redirect, verify that the final destination conforms to security policy
      if (response.redirected && response.url) {
        this.validateUrl(response.url);
      }

      if (!response.ok) {
        throw new Error(`HTTP request failed with status ${response.status}: ${response.statusText}`);
      }

      // Check Content-Length header against maxBytes budget if present
      if (this.maxBytes !== undefined) {
        const contentLength = response.headers.get('content-length');
        if (contentLength !== null) {
          const parsedLength = parseInt(contentLength, 10);
          if (!isNaN(parsedLength) && parsedLength > this.maxBytes) {
            throw new AdapterError(
              `Response size ${parsedLength} bytes exceeds configured maximum allowed size of ${this.maxBytes} bytes`
            );
          }
        }
      }

      // If maxBytes is configured and streaming body is available, enforce size limit while reading chunks
      if (this.maxBytes !== undefined && response.body && typeof response.body.getReader === 'function') {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let totalBytes = 0;
        let resultText = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            totalBytes += value.byteLength;
            if (totalBytes > this.maxBytes) {
              await reader.cancel();
              throw new AdapterError(
                `Response body stream exceeded configured maximum allowed size of ${this.maxBytes} bytes`
              );
            }
            resultText += decoder.decode(value, { stream: true });
          }
          resultText += decoder.decode();
          return resultText;
        } finally {
          reader.releaseLock();
        }
      }

      const text = await response.text();
      if (this.maxBytes !== undefined && Buffer.byteLength(text, 'utf-8') > this.maxBytes) {
        throw new AdapterError(
          `Response body size exceeded configured maximum allowed size of ${this.maxBytes} bytes`
        );
      }
      return text;
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      throw new AdapterError(`HttpReferenceAdapter failed to fetch resource from '${data}'`, { cause: error });
    } finally {
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
    }
  }
}
