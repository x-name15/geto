# geto — Roadmap

> One core. Five semantics. One milestone each.

The versioning strategy is simple:
each minor version proves one consumption semantic end-to-end.
`1.0.0` is declared when all five semantics are stable and the core API is frozen.

---

## Version map

```
0.1.0  ──  COPY      ──  BufferAdapter + MemoryStorage + core gateway
0.2.0  ──  SERIALIZE ──  JsonAdapter + FileStorage
0.3.0  ──  CAPTURE   ──  StreamAdapter
0.4.0  ──  WRAP      ──  ProcessAdapter
0.5.0  ──  REGISTER  ──  HttpReferenceAdapter
─────────────────────────────────────────────
1.0.0  ──  API frozen. All five semantics proven. Public release.
```

Each version must:
1. Implement the adapter for that semantic.
2. Implement any storage required to prove the semantic works end-to-end.
3. Ship unit + integration tests for the new semantic.
4. Not break any adapter or test from a previous version.

---

## 0.1.0 — COPY

**Goal:** prove the core. The gateway must be fully functional with a trivial adapter.

**Semantic:** `COPY` — consume a resource by creating an independent representation.

**What gets built:**
- `IGetoAdapter<T, R>` interface
- `IGetoStorage` interface
- `IEntity` + `EEntityState` + `EConsumptionSemantic`
- `GetoGateway` with full lifecycle API
- `MemoryStorage`
- `BufferAdapter` (`Buffer → Buffer`, semantic `COPY`)
- Full error hierarchy
- Unit tests: gateway, MemoryStorage, BufferAdapter
- Integration test: `Buffer → consume → store → restore → Buffer`

**Done when:**
```typescript
const geto   = new GetoGateway({ storage: new MemoryStorage() });
const entity = await geto.consume(Buffer.from("hello"), new BufferAdapter());
const result = await geto.restore(entity, new BufferAdapter());
console.log(result.toString()); // "hello"
```
Works. Tests pass. Core API baseline established.

> **Note on progression:** As we progress from `COPY` to `SERIALIZE`, `CAPTURE`, `WRAP`, and `REGISTER`, each semantic stress-tests the base `IGetoAdapter<T, R>` contract. In particular, `0.4.0 (WRAP)` will clarify the distinction between snapshot-based capture and managing live references before committing to implementation details.

---

## 0.2.0 — SERIALIZE

**Goal:** prove that a resource can be transformed into a different persistent representation.

**Semantic:** `SERIALIZE` — convert a resource to a persistable form (and restore it).

**What gets built:**
- `JsonAdapter` (`object → JSON string`, semantic `SERIALIZE`)
- `FileStorage` (persists to disk, proves storage swappability)
- Tests for `JsonAdapter` and `FileStorage`
- Integration test: `object → consume → FileStorage → restore → object`

**Done when:**
The same gateway, without code changes, works with `MemoryStorage` and `FileStorage` interchangeably.

---

## 0.3.0 — CAPTURE

**Goal:** prove that geto can manage the lifecycle of a resource it does not own permanently.

**Semantic:** `CAPTURE` — temporarily take control of a resource's lifecycle.

**What gets built:**
- `StreamAdapter` (`Readable → Buffer`, semantic `CAPTURE`)
  The stream is consumed (read to completion) and stored as a `Buffer`.
  Restoration returns a new `Readable` from the stored `Buffer`.
  Release is a no-op (stream was already consumed on `consume()`).
- Tests for `StreamAdapter`
- Integration test: `Readable → consume (destroys stream) → restore → new Readable`

**Done when:**
A developer can consume a Node.js `Readable`, have it fully managed, and restore it as a new stream.

---

## 0.4.0 — WRAP

**Goal:** prove that geto can manage a live resource without fully consuming it.

**Semantic:** `WRAP` — add lifecycle management to a resource that remains live.

**What gets built:**
- `ProcessAdapter` (`ChildProcess → IProcessSnapshot`, semantic `CAPTURE + WRAP`)
  Wraps a running process. `consume()` captures a snapshot (pid, metadata).
  `release()` calls `process.kill()`.
  Restoration is not a literal resurrection — it re-provides the snapshot.
- Tests for `ProcessAdapter`
- Integration test: `ChildProcess → consume → inspect → release`

**Note:** This version validates that `release()` and `delete()` are truly separate operations.

---

## 0.5.0 — REGISTER

**Goal:** prove that geto can manage a reference to a resource without immediately fetching it.

**Semantic:** `REGISTER` — consume a locator; resolve the actual resource on restore.

**What gets built:**
- `HttpReferenceAdapter` (`URL string → stored URL`, semantic `REGISTER`)
  `consume()` stores the URL as the representation (no HTTP request yet).
  `restore()` fetches the URL and returns the response body.
  Security: no SSRF-enabling defaults; configurable allowed origins.
- Tests for `HttpReferenceAdapter`
- Integration test: `URL → consume (no fetch) → restore (fetch) → body`

---

## 1.0.0 — Public release

**Criteria:**
- All five semantics proven by their respective adapters.
- Core API (`GetoGateway`, `IGetoAdapter`, `IGetoStorage`) is stable.
- No breaking changes planned.
- README is complete with real examples for all five semantics.
- All tests pass.
- `package.json` version is `1.0.0`.

---

## What does NOT go into any version before 1.0.0

- Adapter registration system on the gateway (convenience, not core).
- Event system.
- CLI.
- Redis / database / S3 storage.
- More than the adapters listed per version.
- Breaking changes to `IGetoAdapter` or `IGetoStorage` after 0.1.0.
