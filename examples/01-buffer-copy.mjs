/**
 * Example 01: Buffer Isolation (COPY Semantic)
 * 
 * Demonstrates how geto protects in-memory buffers against caller mutations.
 * Even if the caller modifies or zeroes out the original buffer, the entity
 * stored in the gateway remains pristine and intact.
 * 
 * Run: node examples/01-buffer-copy.mjs
 */

import { GetoGateway, MemoryStorage, BufferAdapter } from '../dist/index.js';

async function main() {
  console.log('=== Example 01: Buffer Isolation (COPY Semantic) ===\n');

  const gateway = new GetoGateway({ storage: new MemoryStorage() });
  const adapter = new BufferAdapter();

  // 1. Create a buffer with initial content
  const source = Buffer.from('Confidential Key Material: 0xDEADBEEF');
  console.log('1. Original buffer created:');
  console.log('   Content:', source.toString());

  // 2. Consume into gateway
  const entity = await gateway.consume(source, adapter, {
    metadata: { classification: 'secret', originalLength: source.length }
  });
  console.log('\n2. Buffer consumed into gateway:');
  console.log('   Entity ID:', entity.id);
  console.log('   State:    ', entity.state);
  console.log('   Metadata: ', entity.metadata.custom);

  // 3. Mutate original buffer in place (e.g. accidental mutation or zeroing)
  source.fill(0);
  console.log('\n3. Original buffer mutated (zeroed out):');
  console.log('   Source after mutation:', source.toString('hex'));

  // 4. Restore from gateway - proving data isolation
  const restored = await gateway.restore(entity, adapter);
  console.log('\n4. Restored buffer from gateway:');
  console.log('   Restored content:', restored.toString());
  console.log('   Integrity check: ', restored.toString() === 'Confidential Key Material: 0xDEADBEEF' ? 'PASSED' : 'FAILED');
}

main().catch((err) => {
  console.error('Example failed:', err);
  process.exit(1);
});
