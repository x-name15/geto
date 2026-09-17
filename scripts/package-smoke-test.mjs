import {
  GetoGateway,
  MemoryStorage,
  BufferAdapter,
  GetoError,
  EntityNotFoundError
} from '../dist/index.js';

if (!GetoGateway || !MemoryStorage || !BufferAdapter || !GetoError || !EntityNotFoundError) {
  throw new Error("Missing required exports from package.");
}

console.log('Package smoke test passed');
