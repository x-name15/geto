# Engineering Log

## 2026-09-17: Milestone 0.5.0 — REGISTER Semantic (HttpReferenceAdapter)

**Context:** Prove the final fundamental consumption semantic: `REGISTER`. Demonstrates that consuming does not require materializing or fetching a resource immediately. A locator or reference is consumed, and the actual resource is resolved lazily on demand upon `restore()`.

**Implementation details:**
- `HttpReferenceAdapter`: consumes URL strings (`URL string (T) -> stored URL (R)`).
- `consume()`: validates the URL and stores the locator. **0 network requests are dispatched**.
- `restore()`: dispatches the HTTP GET request using `fetch` and resolves the response body.
- **Security precaution:** Origin whitelist support (`allowedOrigins`) protects against Server-Side Request Forgery (SSRF) and untrusted internal network targets.
- **Core verification:** The baseline `GetoGateway` orchestrator successfully handled lazy reference-based entities across both `MemoryStorage` and `FileStorage` without any core API modifications. All 5 fundamental consumption semantics are now proven.

---

**Context:** Resolve the architectural debate around WRAP vs CAPTURE. Unlike CAPTURE (which drena or snapshots a resource into inert data), WRAP retains an active, living handle to the running resource while providing supervision and lifecycle management.

**Implementation details:**
- `ProcessAdapter`: wraps active Node.js `ChildProcess` instances (`ChildProcess (T) -> IProcessHandle (R)`).
- `IProcessHandle`: wraps the process without muting or freezing its execution. Exposes live status (`isAlive()`), process identifier (`pid`), and safe termination (`kill()`).
- **Clear separation of `release()` vs `delete()`:**
  - `gateway.release(entity, processAdapter)` terminates the operating system process (`kill('SIGTERM')`), keeping the entity descriptor marked as `RELEASED`.
  - `gateway.delete(id)` removes the entity representation from storage and sets its state to `DELETED`.
- **Core verification:** The baseline `GetoGateway` orchestrator handled live process handles through `MemoryStorage` without changing any gateway signatures.

---

**Context:** Node.js `Readable` streams are single-use resources. Once drained, they cannot be read again. The `CAPTURE` semantic demonstrates taking control of a resource whose lifecycle is transient or destructive upon consumption.

**Implementation details:**
- `StreamAdapter`: drains the readable stream until the `end` event and captures all binary chunks into a single `Buffer` (`Readable (T) -> Buffer (R)`).
- `restore()`: instantiates a fresh `Readable.from(buffer)` on every invocation.
- **Value provided by geto:** A stream consumed once can now be restored and replayed multiple times from storage, solving the common Node.js problem of stream consumption irrevocability.
- **Core verification:** The baseline `GetoGateway` contract and lifecycle remained 100% unchanged.

---

**Context:** Prove that geto supports transformations where the stored representation $R$ is of a different type than the input resource $T$ ($R \neq T$), and prove storage swappability using a disk-based backend.

**Implementation details:**
- `JsonAdapter<T>`: transforms arbitrary objects into `string` representations via JSON serialization.
- `FileStorage`: persists representations directly onto the local filesystem in `.bin` files under a designated root directory.
- **Security precaution:** `FileStorage` sanitizes entity IDs to protect against path traversal attempts (`../`), raising typed `StorageError`.
- **Core verification:** The core `GetoGateway` coordinated `FileStorage` and `JsonAdapter` without modifying a single line of the core lifecycle orchestration.

---

**Found during:** first `vitest run` after initial build. 2 of 36 tests failed.

**Symptom:** `restore(entity, adapter)` and `release(entity, adapter)` were not throwing
`EntityStateError` when called after `delete()` on the same entity.

**Root cause:** Both methods checked `entity.state` from the **caller-supplied entity object**,
which is a snapshot frozen at the moment of `consume()`. After `delete()` mutates the
internal Map, the caller's snapshot still shows `STORED`. The canonical state lives in
the gateway's internal `Map<string, GetoEntity>` — not in the object held by the caller.

**Fix:** Both `restore()` and `release()` now look up the canonical entity from the Map
first (`this.entities.get(entity.id)`), throwing `EntityNotFoundError` if absent and
`EntityStateError` if DELETED. The caller-supplied object is used only for the ID.

**Lesson:** Any gateway method that takes an `IEntity` parameter and needs to act on
current state MUST read state from the internal Map. The parameter is a locator, not
the source of truth.

---

## 2026-09-17: Initial Architecture Decisions
- **EEntityState choices**: STORED, RELEASED, DELETED.
- **Why RESTORED is not a state**: restore() is a read operation; it doesn't change the lifecycle of the entity.
- **Why restore() takes entity object vs just ID**: Requires entity context to validate state and safely handle the representation.
- **Why release ≠ delete**: Release frees the resource via the adapter without deleting the entity descriptor; delete removes the descriptor.
- **Ownership semantics**: Defined by the adapter.
- **Why zero runtime deps**: Keep the library lightweight and dependency-free.
