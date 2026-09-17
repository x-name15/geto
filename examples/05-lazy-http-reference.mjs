/**
 * Example 05: Lazy Network Locator with SSRF Protection (REGISTER Semantic)
 * 
 * Demonstrates registering external network locators without fetching them
 * during consume(). Network requests are deferred until restore(), protected
 * by an allowedOrigins domain whitelist.
 * 
 * Run: node examples/05-lazy-http-reference.mjs
 */

import { GetoGateway, MemoryStorage, HttpReferenceAdapter } from '../dist/index.js';
import * as http from 'node:http';

async function main() {
  console.log('=== Example 05: Lazy HTTP Reference (REGISTER Semantic) ===\n');

  let requestCount = 0;

  // 1. Create local mock HTTP server
  const server = http.createServer((req, res) => {
    requestCount++;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', hits: requestCount, timestamp: Date.now() }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetUrl = `${baseUrl}/api/v1/metrics`;

  try {
    const gateway = new GetoGateway({ storage: new MemoryStorage() });

    // 2. Configure adapter with strict origin allowlist
    const adapter = new HttpReferenceAdapter({
      allowedOrigins: [baseUrl]
    });

    console.log('1. Consuming target URL locator into gateway...');
    const entity = await gateway.consume(targetUrl, adapter, {
      metadata: { endpoint: 'metrics' }
    });
    console.log('   Entity ID:', entity.id);
    console.log('   Server request count immediately after consume:', requestCount);
    console.log('   Zero-network registration verified:', requestCount === 0 ? 'PASSED' : 'FAILED');

    // 3. Deferred restoration (hits server on-demand)
    console.log('\n2. First restore() call (fetches live HTTP resource)...');
    const responseBody1 = await gateway.restore(entity, adapter);
    console.log('   Received:', responseBody1);
    console.log('   Server request count:', requestCount);

    // 4. Second restore() call
    console.log('\n3. Second restore() call...');
    const responseBody2 = await gateway.restore(entity, adapter);
    console.log('   Received:', responseBody2);
    console.log('   Server request count:', requestCount);

    // 5. SSRF Security check: Attempting to register an unwhitelisted origin
    console.log('\n4. SSRF Defense Check: Attempting to register an untrusted origin...');
    try {
      await gateway.consume('https://malicious-internal-metadata.aws/secret', adapter);
      console.error('   SSRF check FAILED: Should have rejected untrusted origin!');
    } catch (err) {
      console.log('   SSRF check PASSED: Gateway rejected untrusted origin:', err.message);
    }
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('Example failed:', err);
  process.exit(1);
});
