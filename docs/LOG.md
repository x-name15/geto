# Engineering Log

## 2026-09-17: Stale entity snapshot bug — first test run

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
