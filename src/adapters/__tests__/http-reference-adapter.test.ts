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
    expect(mockFetch).toHaveBeenCalledWith(targetUrl);
    expect(result).toBe(expectedContent);
  });

  it('enforces allowedOrigins whitelist policy', async () => {
    const adapter = new HttpReferenceAdapter({
      allowedOrigins: ['https://trusted.jujutsu.ac.jp'],
    });

    // Allowed origin passes
    await expect(adapter.consume('https://trusted.jujutsu.ac.jp/scrolls')).resolves.toBeDefined();

    // Untrusted origin throws AdapterError (SSRF mitigation)
    await expect(adapter.consume('https://malicious.domain.com/leak')).rejects.toThrow(AdapterError);
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
