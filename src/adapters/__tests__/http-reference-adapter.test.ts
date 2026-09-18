import { describe, it, expect, vi } from 'vitest';
import { HttpReferenceAdapter } from '../http-reference-adapter.js';
import { EConsumptionSemantic } from '../../models/index.js';
import { AdapterError } from '../../errors/index.js';

describe('HttpReferenceAdapter', () => {
  it('has correct adapterId and semantic properties', () => {
    const adapter = new HttpReferenceAdapter();
    expect(adapter.adapterId).toBe('http-reference');
    expect(adapter.semantic).toBe(EConsumptionSemantic.REGISTER);
  });

  it('consumes a URL by registering it without calling fetch', async () => {
    const mockFetch = vi.fn();
    const adapter = new HttpReferenceAdapter({ fetchFn: mockFetch });

    const targetUrl = 'https://api.example.com/curse/sukuna';
    const registered = await adapter.consume(targetUrl);

    expect(registered).toBe(targetUrl);
    // Crucial check: consume does NOT initiate any HTTP network request
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('restores the URL by fetching its remote contents', async () => {
    const targetUrl = 'https://api.example.com/spells';
    const expectedContent = 'Infinity and Hollow Purple';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => expectedContent,
    });

    const adapter = new HttpReferenceAdapter({ fetchFn: mockFetch });
    await adapter.consume(targetUrl);

    const result = await adapter.restore(targetUrl);
    expect(mockFetch).toHaveBeenCalledWith(targetUrl, expect.objectContaining({ redirect: 'follow' }));
    expect(result).toBe(expectedContent);
  });

  it('enforces allowedOrigins whitelist policy and defaults redirect to error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      redirected: false,
      text: async () => 'ok',
    });

    const adapter = new HttpReferenceAdapter({
      allowedOrigins: ['https://trusted.jujutsu.ac.jp'],
      fetchFn: mockFetch,
    });

    // Allowed origin passes
    await expect(adapter.consume('https://trusted.jujutsu.ac.jp/scrolls')).resolves.toBeDefined();

    // Untrusted origin throws AdapterError (SSRF mitigation)
    await expect(adapter.consume('https://malicious.domain.com/leak')).rejects.toThrow(AdapterError);

    // Verify redirect: 'error' is passed to fetch by default when allowedOrigins is configured
    await adapter.restore('https://trusted.jujutsu.ac.jp/scrolls');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://trusted.jujutsu.ac.jp/scrolls',
      expect.objectContaining({ redirect: 'error' })
    );
  });

  it('rejects unsupported protocols (file, javascript, data, ftp)', async () => {
    const adapter = new HttpReferenceAdapter();
    await expect(adapter.consume('file:///etc/passwd')).rejects.toThrow(AdapterError);
    await expect(adapter.consume('file:///etc/passwd')).rejects.toThrow(/Unsupported protocol 'file:'/);
    await expect(adapter.consume('data:text/plain;base64,SGVsbG8=')).rejects.toThrow(AdapterError);
    await expect(adapter.consume('javascript:alert(1)')).rejects.toThrow(AdapterError);
    await expect(adapter.consume('ftp://ftp.example.com/file')).rejects.toThrow(AdapterError);
  });

  it('intercepts open redirect SSRF bypass when fetch redirected to untrusted origin', async () => {
    const redirectingFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      redirected: true,
      url: 'http://169.254.169.254/latest/meta-data',
      text: async () => 'AWS_SECRET_KEY=leak',
    });

    const adapter = new HttpReferenceAdapter({
      allowedOrigins: ['https://trusted.com'],
      redirect: 'follow', // explicitly allowing follow
      fetchFn: redirectingFetch,
    });

    // Even if follow was set, the final destination URL is re-validated against allowedOrigins!
    await expect(adapter.restore('https://trusted.com/redirect')).rejects.toThrow(AdapterError);
    await expect(adapter.restore('https://trusted.com/redirect')).rejects.toThrow(/not permitted/);
  });

  it('throws AdapterError on invalid URLs or HTTP errors', async () => {
    const adapter = new HttpReferenceAdapter();
    await expect(adapter.consume('not-a-valid-url')).rejects.toThrow(AdapterError);

    const failingFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const failingAdapter = new HttpReferenceAdapter({ fetchFn: failingFetch });
    await expect(failingAdapter.restore('https://example.com/missing')).rejects.toThrow(AdapterError);
  });

  it('aborts and throws AdapterError on request timeout', async () => {
    const hangingFetch = vi.fn().mockImplementation((_url, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('The operation was aborted due to timeout'));
        });
      });
    });

    const adapter = new HttpReferenceAdapter({
      timeoutMs: 50,
      fetchFn: hangingFetch,
    });

    await expect(adapter.restore('https://example.com/slow')).rejects.toThrow(AdapterError);
    await expect(adapter.restore('https://example.com/slow')).rejects.toThrow(/HttpReferenceAdapter failed to fetch resource/);
  });

  it('rejects response when Content-Length exceeds maxBytes', async () => {
    const mockHeaders = new Map([['content-length', '5000']]);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => mockHeaders.get(name.toLowerCase()) ?? null,
      },
      text: async () => 'huge payload',
    });

    const adapter = new HttpReferenceAdapter({
      maxBytes: 1024,
      fetchFn: mockFetch,
    });

    await expect(adapter.restore('https://example.com/bomb')).rejects.toThrow(AdapterError);
    await expect(adapter.restore('https://example.com/bomb')).rejects.toThrow(/exceeds configured maximum allowed size of 1024 bytes/);
  });

  it('rejects response when streaming body exceeds maxBytes', async () => {
    const chunk1 = new TextEncoder().encode('12345');
    const chunk2 = new TextEncoder().encode('67890');
    let chunkIndex = 0;
    const chunks = [chunk1, chunk2];

    const mockReader = {
      read: vi.fn().mockImplementation(async () => {
        if (chunkIndex < chunks.length) {
          return { done: false, value: chunks[chunkIndex++] };
        }
        return { done: true, value: undefined };
      }),
      cancel: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn(),
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      body: {
        getReader: () => mockReader,
      },
      text: async () => '1234567890',
    });

    const adapter = new HttpReferenceAdapter({
      maxBytes: 8, // limit is 8 bytes, stream sends 10 bytes
      fetchFn: mockFetch,
    });

    await expect(adapter.restore('https://example.com/stream-bomb')).rejects.toThrow(
      /exceeded configured maximum allowed size of 8 bytes/
    );
    expect(mockReader.cancel).toHaveBeenCalled();
  });

  it('normalizes allowedOrigins with trailing slashes or subpaths', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      redirected: false,
      text: async () => 'ok',
    });

    const adapter = new HttpReferenceAdapter({
      allowedOrigins: ['https://api.github.com/v1/'],
      fetchFn: mockFetch,
    });

    // Successfully consumes and restores because origin was normalized to 'https://api.github.com'
    await expect(adapter.consume('https://api.github.com/users/octocat')).resolves.toBeDefined();
    await expect(adapter.restore('https://api.github.com/users/octocat')).resolves.toBe('ok');
  });

  it('blocks private and loopback IPs when blockPrivateIPs is enabled', async () => {
    const adapter = new HttpReferenceAdapter({ blockPrivateIPs: true });

    const blockedHosts = [
      'http://127.0.0.1:8080/admin',
      'http://localhost/secret',
      'http://10.0.1.50/dashboard',
      'http://172.16.0.1/status',
      'http://192.168.1.1/router',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/internal',
      'http://service.internal/config',
      'http://printer.local/print',
    ];

    for (const url of blockedHosts) {
      await expect(adapter.consume(url)).rejects.toThrow(AdapterError);
      await expect(adapter.consume(url)).rejects.toThrow(/private or loopback address/);
    }

    // Public host passes
    await expect(adapter.consume('https://example.com/public')).resolves.toBe('https://example.com/public');
  });
});
