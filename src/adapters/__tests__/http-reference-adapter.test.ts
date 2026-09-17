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
    expect(mockFetch).toHaveBeenCalledWith(targetUrl, { redirect: 'follow' });
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
    expect(mockFetch).toHaveBeenCalledWith('https://trusted.jujutsu.ac.jp/scrolls', { redirect: 'error' });
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
});
