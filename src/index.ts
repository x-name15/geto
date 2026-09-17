export { GetoGateway } from './core/gateway.js';
export { MemoryStorage } from './storage/memory-storage.js';
export { FileStorage } from './storage/file-storage.js';
export { BufferAdapter } from './adapters/buffer-adapter.js';
export { JsonAdapter } from './adapters/json-adapter.js';
export { GetoError, EntityNotFoundError, EntityStateError, AdapterError, StorageError } from './errors/index.js';
export type { IEntity, IGetoAdapter, IGetoStorage, IConsumeOptions, IGatewayOptions, IEntityMetadata } from './models/index.js';
export { EEntityState, EConsumptionSemantic } from './models/index.js';
export { VERSION } from './version.js';
