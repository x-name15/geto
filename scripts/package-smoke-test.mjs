import {
  GetoGateway,
  MemoryStorage,
  FileStorage,
  BufferAdapter,
  JsonAdapter,
  GetoError,
  EntityNotFoundError
} from '../dist/index.js';

if (
  !GetoGateway ||
  !MemoryStorage ||
  !FileStorage ||
  !BufferAdapter ||
  !JsonAdapter ||
  !GetoError ||
  !EntityNotFoundError
) {
  throw new Error("Missing required exports from package.");
}

console.log('Package smoke test passed');
