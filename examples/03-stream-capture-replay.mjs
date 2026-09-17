/**
 * Example 03: Replaying Single-Use Streams (CAPTURE Semantic)
 * 
 * In Node.js, a Readable stream can only be read once. When it ends, it cannot
 * be rewound or piped again. StreamAdapter captures the entire stream into a
 * durable binary representation, allowing gateway.restore() to spawn fresh,
 * fully replayable Readable streams as many times as needed.
 * 
 * Run: node examples/03-stream-capture-replay.mjs
 */

import { GetoGateway, MemoryStorage, StreamAdapter } from '../dist/index.js';
import { Readable } from 'node:stream';

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function main() {
  console.log('=== Example 03: Stream Capture & Multi-Replay (CAPTURE Semantic) ===\n');

  const gateway = new GetoGateway({ storage: new MemoryStorage() });
  const adapter = new StreamAdapter();

  // 1. Create a single-use stream (simulating an incoming HTTP request or multipart chunk)
  const incomingStream = Readable.from(['Chunk 1: Hello ', 'Chunk 2: from ', 'Chunk 3: Captured Stream!']);
  console.log('1. Consuming ephemeral single-use Readable stream...');

  const entity = await gateway.consume(incomingStream, adapter, {
    metadata: { mimeType: 'text/plain', source: 'http-inbound' }
  });
  console.log('   Entity ID:', entity.id);
  console.log('   Stream successfully captured and drained.');

  // 2. First replay (e.g. pipe to an audit logger or hash validator)
  console.log('\n2. Replaying stream to Destination A (Audit Logger)...');
  const streamA = await gateway.restore(entity, adapter);
  const contentA = await streamToString(streamA);
  console.log('   Destination A received:', contentA);

  // 3. Second replay (e.g. pipe to S3 uploader or parser)
  console.log('\n3. Replaying stream to Destination B (Cloud Uploader)...');
  const streamB = await gateway.restore(entity, adapter);
  const contentB = await streamToString(streamB);
  console.log('   Destination B received:', contentB);

  // 4. Verify identical content across distinct stream instances
  console.log('\n4. Multi-replay equality check:', contentA === contentB ? 'PASSED' : 'FAILED');
}

main().catch((err) => {
  console.error('Example failed:', err);
  process.exit(1);
});
