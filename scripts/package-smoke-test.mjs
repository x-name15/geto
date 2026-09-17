import * as geto from '../dist/index.js';

const requiredExports = [
  'GetoGateway',
  'MemoryStorage',
  'FileStorage',
  'BufferAdapter',
  'JsonAdapter',
  'StreamAdapter',
  'ProcessAdapter',
  'HttpReferenceAdapter',
  'GetoError',
  'EntityNotFoundError',
  'EntityStateError',
  'AdapterError',
  'StorageError',
  'EEntityState',
  'EConsumptionSemantic',
  'VERSION'
];

const missing = requiredExports.filter((name) => typeof geto[name] === 'undefined');
if (missing.length > 0) {
  throw new Error(`Missing required exports from package: ${missing.join(', ')}`);
}

console.log('Package smoke test passed');

