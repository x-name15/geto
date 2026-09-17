# geto — Architecture & Scope Definition

> Consume anything. Use it later.

This document defines exactly what **geto** is, what it is not, and what V1 must contain.
It exists to prevent scope creep. If a feature is not listed here, it does not belong in V1.

---

## What geto is

`geto` is a **resource consumption and entity lifecycle gateway** for Node.js.

The developer defines what "consuming" a resource means (via an adapter).
`geto` takes care of everything that happens after consumption:
identity, storage, retrieval, restoration, release, and deletion.

```
Resource
  │
  ▼
Adapter          ← developer defines this
  │
  ▼
Gateway          ← geto owns this
  ├── identity
  ├── storage
  ├── lifecycle
  └── metadata
  │
  ▼
Entity
```

The central proof of the project is:

> The gateway must remain completely indifferent to the type of resource being consumed.
> Swapping the adapter changes what gets consumed.
> Swapping the storage changes where it lives.
> Neither change touches the gateway.

---

## What geto is NOT

- Not an event bus.
- Not a message queue.
- Not a task runner.
- Not a DI container.
- Not a serialization library.
- Not a state machine framework.
- Not a plugin system.
- Not a file manager.
- Not an HTTP client.
- Not a process manager.

Those responsibilities may appear **inside adapters**. They do not belong in the core.

---

## Five consumption semantics

These are not examples. They are the fundamental consumption models the architecture must support.
Every adapter must declare which semantic it implements.

| Semantic | Meaning | Example adapter |
|---|---|---|
| `COPY` | Create an independent representation of the resource | `BufferAdapter` |
| `CAPTURE` | Take temporary ownership/control of a resource's lifecycle | `StreamAdapter`, `ProcessAdapter` |
| `SERIALIZE` | Transform a resource into a persistable representation | `JsonAdapter` |
| `WRAP` | Manage a live resource without necessarily copying it | `ProcessAdapter`, `SocketAdapter` |
| `REGISTER` | Consume a reference or locator; resolve the resource later | `HttpReferenceAdapter` |

An adapter may combine semantics. For example:
- `ProcessAdapter` → `CAPTURE + WRAP`
- `HttpReferenceAdapter` → `REGISTER`
- `BufferAdapter` → `COPY`

These semantics are made explicit through the `semantic` property on `IGetoAdapter`.
The gateway does not act differently based on the semantic — it is metadata for the developer and for introspection.

```typescript
// Example
class BufferAdapter implements IGetoAdapter<Buffer, Buffer> {
  readonly adapterId = "buffer";
  readonly semantic  = EConsumptionSemantic.COPY;
  // ...
}
```

An adapter that combines semantics:
```typescript
class ProcessAdapter implements IGetoAdapter<ChildProcess, IProcessSnapshot> {
  readonly adapterId = "process";
  readonly semantic  = [EConsumptionSemantic.CAPTURE, EConsumptionSemantic.WRAP];
  // ...
}
```

---

## Core abstractions (V1 only)

### 1. `IGetoAdapter<T, R>`

Defines how a resource of type `T` is consumed into a representation of type `R`.

```typescript
interface IGetoAdapter<T, R> {
  readonly adapterId: string;
  readonly semantic: EConsumptionSemantic | EConsumptionSemantic[];
  consume(resource: T): Promise<R>;
  restore(data: R): Promise<T>;
  release?(resource: T): Promise<void>;
}
```

**Responsibilities:**
- Know how to turn `T` into `R` (`consume`).
- Know how to turn `R` back into `T` (`restore`).
- Optionally know how to release the original resource (`release`).

**Not responsible for:**
- Generating entity IDs.
- Knowing how storage works.
- Managing lifecycle state.

---

### 2. `IGetoStorage`

Defines how representations are persisted.

```typescript
interface IGetoStorage {
  save(id: string, data: unknown): Promise<void>;
  load(id: string): Promise<unknown>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}
```

**Responsibilities:**
- Persist and retrieve arbitrary data by ID.

**Not responsible for:**
- Knowing what a resource is.
- Knowing what an adapter is.
- Managing entity lifecycle.

---

### 3. `IEntity`

The object `geto` creates after consuming a resource.
It is the managed handle — not the data container.

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

The actual representation lives **in storage**, not in the entity object.
The entity is the descriptor. Storage is the container.

---

### 4. `EEntityState`

```typescript
enum EEntityState {
  STORED   = "stored",    // consumed and persisted — this is the baseline state
  RELEASED = "released",  // adapter.release() was called on the original resource
  DELETED  = "deleted",   // removed from storage — terminal state
}
```

**Decisions:**
- `CONSUMED` and `STORED` are collapsed into one state (`STORED`).
  By the time the developer receives the entity, it is already stored. A transient "consumed but not yet stored" state has no value to expose publicly.
- `RESTORED` is **not** a state. Restoration is a read operation; it does not mutate the entity's state.
  An entity can be restored multiple times without changing what it fundamentally is.
- `RELEASED` means the adapter ran its release logic on the original resource.
  The entity remains in storage. It can potentially still be restored (adapter-defined behavior).
- `DELETED` is terminal. Any operation on a deleted entity throws `EntityStateError`.

---

### 5. `GetoGateway`

The main class. Owns orchestration. Knows nothing about specific resources.

```typescript
class GetoGateway {
  constructor(options: IGatewayOptions)

  consume<T, R>(resource: T, adapter: IGetoAdapter<T, R>, options?: IConsumeOptions): Promise<IEntity>
  get(id: string): Promise<IEntity>
  restore<T, R>(entity: IEntity, adapter: IGetoAdapter<T, R>): Promise<T>
  release<T, R>(entity: IEntity, adapter: IGetoAdapter<T, R>): Promise<void>
  delete(id: string): Promise<void>
  exists(id: string): Promise<boolean>
  inspect(id: string): Promise<IEntityMetadata>
}
```

**Responsibilities:**
- Generate entity IDs (one place, `crypto.randomUUID()`).
- Orchestrate adapter + storage calls.
- Track entity state.
- Enforce state rules (e.g. block operations on `DELETED` entities).
- Wrap errors into typed `GetoError` subclasses.

**Not responsible for:**
- Knowing what any resource type is.
- Serialization details.
- Network, filesystem, or I/O specifics.

---

## Data flow

### consume

```
resource (T)
  │
  ▼ adapter.consume(resource)
representation (R)
  │
  ▼ storage.save(id, representation)
Entity { id, adapterId, state: STORED, ... }
```

### restore

```
storage.load(id)
  │
  ▼ adapter.restore(representation)
resource (T)
```

### release

```
storage.load(id)         ← load the representation
  │
  ▼ adapter.restore(representation)   ← reconstruct the resource if needed
  │
  ▼ adapter.release(resource)         ← let the adapter clean up
entity.state = RELEASED
```

### delete

```
storage.delete(id)
entity.state = DELETED
```

---

## Error hierarchy

```
GetoError (base)
  ├── EntityNotFoundError    entity ID does not exist in storage
  ├── EntityStateError       operation is invalid for the entity's current state
  ├── AdapterError           adapter threw during consume / restore / release
  └── StorageError           storage threw during save / load / delete / exists
```

All errors preserve the original `cause` where available.
No raw implementation errors are exposed at the public API boundary.

---

## Type safety note

`restore<T, R>(entity, adapter)` requires the caller to pass the correct adapter.
This is intentional. The gateway has no way to infer `T` from an entity ID at compile time.
The entity stores `adapterId` (a string) as a runtime hint — not a type constraint.

If a developer retrieves an entity via `get(id)` and wants to restore it,
they are responsible for providing the right adapter. This is honest behavior.
It mirrors the reality that the gateway does not know what type of resource was consumed.

---

## V1 scope — what gets built

| Item | Status |
|---|---|
| `IGetoAdapter<T, R>` interface | ✅ V1 |
| `IGetoStorage` interface | ✅ V1 |
| `IEntity` + `EEntityState` | ✅ V1 |
| `GetoGateway` | ✅ V1 |
| `MemoryStorage` | ✅ V1 |
| `BufferAdapter` | ✅ V1 |
| Error hierarchy | ✅ V1 |
| Unit tests | ✅ V1 |
| Integration tests | ✅ V1 |
| `FileStorage` | ⏳ V2 |
| `FileAdapter` | ⏳ V2 |
| `StreamAdapter` | ⏳ V2 |
| `HttpAdapter` | ⏳ V2 |
| Adapter registration on gateway | ⏳ V2 |
| Event system | ⏳ future |
| CLI | ⏳ future (only if it makes sense) |
| Redis / DB / S3 storage | ⏳ future |

---

## What does NOT belong in geto core, ever

- Resource-specific logic (files, streams, HTTP, processes).
  → That belongs in adapters.
- Serialization format decisions.
  → Each storage implementation decides how to persist `unknown`.
- Global singleton state.
- Auto-detection of resource types.
- Event-driven architecture as a core pattern.
- Decorators.
- A DI container.
- More than ~8 public methods on the gateway.

---

## The anti-bloat rule

Before adding anything to the core, answer:

1. Does the gateway become impossible to use without this?
2. Does this belong to the gateway, or to an adapter / storage / the caller?
3. Does this make the core aware of a specific resource type?

If the answer to (1) is no, or (2) says adapter/storage/caller, or (3) is yes → it does not belong in core.
