# Library API Reference

This document provides a comprehensive programmatic reference for **`@mrjacket/geto`**.

---

## Exports Overview

```typescript
import {
  // Orchestrator
  GetoGateway,

  // Storage Providers
  MemoryStorage,
  FileStorage,

  // Built-in Adapters
  BufferAdapter,
  JsonAdapter,
  StreamAdapter,
  ProcessAdapter,
  HttpReferenceAdapter,

  // Enums & Models
  EEntityState,
  EConsumptionSemantic,

  // Errors
  GetoError,
  EntityNotFoundError,
  EntityStateError,
  AdapterError,
  StorageError,

  // Version
  VERSION,
} from '@mrjacket/geto';

// Interfaces & Types
import type {
  IEntity,
  IEntityMetadata,
  IGetoAdapter,
  IGetoStorage,
  IConsumeOptions,
  IGatewayOptions,
  IProcessHandle,
  IStreamAdapterOptions,
  IHttpReferenceAdapterOptions,
} from '@mrjacket/geto';
```

---

## `GetoGateway`

The central coordinator of the library.

### Constructor
```typescript
constructor(options: IGatewayOptions)
```
- `options.storage`: An instance of `IGetoStorage` responsible for persisting resource representations.

---

### Methods

#### `consume<T, R>(resource: T, adapter: IGetoAdapter<T, R>, options?: IConsumeOptions): Promise<IEntity>`
Transforms the resource via `adapter.consume()` and saves the resulting representation `R` in storage under a fresh UUID.
- **Parameters:**
  - `resource`: Input resource of type `T`.
  - `adapter`: Adapter implementing the contract for type `T` and representation `R`.
  - `options.metadata`: Optional key-value dictionary attached to `entity.metadata.custom`.
- **Returns:** Frozen, immutable `IEntity` descriptor.
- **Throws:**
  - `AdapterError`: If `adapter.consume()` fails.
  - `StorageError`: If `storage.save()` fails.

#### `get(id: string): Promise<IEntity>`
Retrieves the entity descriptor by its UUID.
- **Throws:**
  - `EntityNotFoundError`: If the entity ID is not recognized.
  - `EntityStateError`: If the entity is in a `DELETED` state.

#### `restore<T, R>(entity: IEntity, adapter: IGetoAdapter<T, R>): Promise<T>`
Reconstructs the original resource from storage.
- **Note:** Does **not** change entity lifecycle state. Can be executed multiple times.
- **Throws:**
  - `EntityNotFoundError`: If the entity ID does not exist.
  - `EntityStateError`: If the entity is in a `DELETED` state.
  - `StorageError`: If `storage.load()` fails.
  - `AdapterError`: If `adapter.restore()` fails.

#### `release<T, R>(entity: IEntity, adapter: IGetoAdapter<T, R>): Promise<void>`
Executes `adapter.release()` (if implemented by the adapter) to cleanup or terminate external resources, then updates the entity state to `RELEASED`.
- **Throws:**
  - `EntityNotFoundError`: If the entity ID does not exist.
  - `EntityStateError`: If the entity is in a `DELETED` state.
  - `AdapterError`: If `adapter.release()` throws.

#### `delete(id: string): Promise<void>`
Deletes the representation from storage and transitions the entity to the terminal `DELETED` state.
- **Throws:**
  - `EntityNotFoundError`: If the entity ID is not found.
  - `EntityStateError`: If the entity has already been deleted.
  - `StorageError`: If `storage.delete()` fails.

#### `exists(id: string): Promise<boolean>`
Checks if an entity is currently registered and active (returns `false` if nonexistent or `DELETED`).

#### `inspect(id: string): Promise<IEntityMetadata>`
Returns the metadata associated with the entity without requiring an adapter.

---

## Models & Interfaces

### `IEntity`
```typescript
interface IEntity {
  readonly id: string;
  readonly adapterId: string;
  readonly state: EEntityState;
  readonly metadata: IEntityMetadata;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

### `EEntityState`
```typescript
enum EEntityState {
  STORED = 'stored',
  RELEASED = 'released',
  DELETED = 'deleted',
}
```

### `EConsumptionSemantic`
```typescript
enum EConsumptionSemantic {
  COPY = 'copy',
  CAPTURE = 'capture',
  SERIALIZE = 'serialize',
  WRAP = 'wrap',
  REGISTER = 'register',
}
```

---

## Error Hierarchy

All errors extend `GetoError` and preserve the underlying `cause` if available:

```
GetoError (base)
 ├── EntityNotFoundError
 ├── EntityStateError
 ├── AdapterError
 └── StorageError
```
