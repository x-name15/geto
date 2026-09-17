# Engineering Log

## 2026-09-17: Milestone 0.2.0 — SERIALIZE Semantic & Storage Swappability

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
