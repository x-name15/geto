/**
 * Example 06: Custom Adapter (Gzip Compression)
 * 
 * Demonstrates how developers can extend geto by writing a custom adapter.
 * This adapter consumes raw text strings, compresses them with Node's zlib.gzip,
 * and decompresses them back into strings upon restore().
 * 
 * Run: node examples/06-custom-compression-adapter.mjs
 */

import { GetoGateway, MemoryStorage, EConsumptionSemantic, AdapterError } from '../dist/index.js';
import * as zlib from 'node:zlib';
import { promisify } from 'node:util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class GzipStringAdapter {
  constructor() {
    this.adapterId = 'gzip-string';
    this.semantic = EConsumptionSemantic.SERIALIZE;
  }

  async consume(resource) {
    if (typeof resource !== 'string') {
      throw new AdapterError('Resource must be a string');
    }
    try {
      const buffer = Buffer.from(resource, 'utf-8');
      return await gzip(buffer);
    } catch (err) {
      throw new AdapterError('Failed to compress string', { cause: err });
    }
  }

  async restore(data) {
    if (!Buffer.isBuffer(data)) {
      throw new AdapterError('Stored data must be a Buffer');
    }
    try {
      const decompressed = await gunzip(data);
      return decompressed.toString('utf-8');
    } catch (err) {
      throw new AdapterError('Failed to decompress buffer', { cause: err });
    }
  }
}

async function main() {
  console.log('=== Example 06: Custom Gzip Compression Adapter ===\n');

  const gateway = new GetoGateway({ storage: new MemoryStorage() });
  const adapter = new GzipStringAdapter();

  // 1. Create large repetitive text that compresses well
  const originalText = 'Geto resource lifecycle gateway. '.repeat(100);
  const uncompressedBytes = Buffer.byteLength(originalText);
  console.log('1. Original text length:', uncompressedBytes, 'bytes');

  // 2. Consume text via Gzip adapter
  const entity = await gateway.consume(originalText, adapter, {
    metadata: { compression: 'gzip', originalSize: uncompressedBytes }
  });
  console.log('2. Consumed into gateway:');
  console.log('   Entity ID:', entity.id);
  console.log('   Adapter:  ', entity.adapterId);

  // 3. Inspect raw stored data size in storage
  const compressedBuffer = await gateway.storage.load(entity.id);
  console.log('   Stored compressed size:', compressedBuffer.length, 'bytes');
  console.log('   Compression ratio:', `${Math.round((1 - compressedBuffer.length / uncompressedBytes) * 100)}% space saved`);

  // 4. Restore and verify text identity
  const restoredText = await gateway.restore(entity, adapter);
  console.log('\n3. Restored text from gateway:');
  console.log('   Length matches:', restoredText.length === originalText.length);
  console.log('   Content integrity check:', restoredText === originalText ? 'PASSED' : 'FAILED');
}

main().catch((err) => {
  console.error('Example failed:', err);
  process.exit(1);
});
