# Changelog

All notable changes to this project will be documented in this file.

## [1.1.4] - 2026-09-22 — Revamped Readme

### Documentation
- Refactored README header layout using standard HTML tags for badge alignment.
- Fixed broken Markdown parsing inside center blocks for npm page rendering.

## [1.1.3] - 2026-09-18 — Crash Prevention, TOCTOU Race & SSRF Hardening

### Security & Reliability
- **CWE-754 Fatal Process Crash Prevention (`StreamAdapter`)**: Handled chunk conversion inside the `'data'` event listener with explicit `try/catch`. Streams emitting invalid non-buffer / non-string chunks now cleanly abort, destroy the stream, and reject with `AdapterError` instead of throwing an unhandled `TypeError` that crashes the entire Node.js runtime process.
- **CWE-362 TOCTOU Race & ESRCH Tolerance (`ProcessHandle.kill`)**: In `ProcessHandle.kill()`, wrapped `process.kill(signal)` in a `try/catch` block catching `ESRCH`. If a child process terminates between the `isAlive()` check and the signal delivery, `handle.kill()` returns `false` safely without throwing an unhandled synchronous exception.
- **CWE-471 Deep Recursive Immutability (`GetoEntity`)**: Implemented recursive `deepFreeze` and `deepClone` across arbitrary nested custom metadata objects and arrays. Mutations to deeply nested configuration properties or arrays outside or inside the entity descriptor fail immediately in strict mode.
- **CWE-732 Secure File & Directory Permissions (`FileStorage`)**: Restricted filesystem permissions to the executing user only (`0o700` for storage base directories, `0o600` for representation `.bin` files), preventing unauthorized local users from accessing sensitive cached data in shared multi-user environments.
- **CWE-918 SSRF Private IP Range Defense (`HttpReferenceAdapter`)**: Introduced `blockPrivateIPs?: boolean` option. Rejects requests targeting loopback (`127.0.0.0/8`, `localhost`, `::1`), private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), cloud metadata services (`169.254.169.254`), and local domains (`.local`, `.internal`).
- **Allowed Origins Normalization (`HttpReferenceAdapter`)**: Normalized `allowedOrigins` in constructor via WHATWG URL parsing, ensuring that trailing slashes or subpaths (`https://api.github.com/v1/`) do not cause false-positive rejection of valid origin endpoints.
- **CWE-400 JSON Memory Budget Limit (`JsonAdapter`)**: Added `maxBytes?: number` in `IJsonAdapterOptions` to reject oversized payloads during both `consume()` serialization and `restore()` deserialization, protecting against heap exhaustion attacks.
- **State Machine Double-Release Prevention (`GetoGateway`)**: Calling `gateway.release()` on an entity that is already in `RELEASED` state now strictly throws `EntityStateError`, preventing double-invocation of cleanup hooks or unexpected OS signal duplication.
- **Metadata Type Validation (`GetoGateway`)**: `gateway.consume()` verifies that `options.metadata` is a valid plain key-value object (rejecting primitives and arrays with `AdapterError`).

## [1.1.2] - 2026-09-18 — DoS Defense, Prototype Pollution & Reliability Hardening

### Security & Reliability
- **CWE-400 Slowloris Request Timeout (`HttpReferenceAdapter`)**: Introduced configurable `timeoutMs` option (defaults to 30,000ms / 30 seconds). Slow or hanging remote endpoints are aborted via `AbortController` and `AbortSignal`, throwing a clean `AdapterError` instead of leaving event loop connections hanging indefinitely.
- **CWE-400 Decompression / Download Bomb Defense (`HttpReferenceAdapter`)**: Added `maxBytes` response budget option. Pre-checks `Content-Length` headers before body download and incrementally counts byte consumption during stream parsing (`ReadableStreamDefaultReader`), safely cancelling the stream and throwing `AdapterError` if the threshold is exceeded.
- **CWE-1321 Prototype Pollution Defense (`JsonAdapter`)**: Introduced `IJsonAdapterOptions` with `preventPrototypePollution` (enabled by default). Deserialization strips dangerous keys (`__proto__`, `constructor`, `prototype`) through a reviver during `JSON.parse()`, preventing object prototype poisoning attacks.
- **CWE-400 Unbounded Memory / Tombstone Pruning (`GetoGateway`)**: Introduced `maxTombstones` in `IGatewayOptions` and a public `gateway.pruneDeleted(maxAgeMs?: number)` method. Long-running production servers can evict old `DELETED` entity descriptors to keep gateway memory footprint bounded.
- **Strict Input Validation (`BufferAdapter`)**: `BufferAdapter.consume()` and `restore()` now enforce `Buffer.isBuffer()`, rejecting invalid types with an `AdapterError` instead of crashing unpredictably downstream.
- **Storage Constructor Validation (`GetoGateway`)**: Constructor verifies that `options.storage` is provided and implements `save()`, throwing an immediate, informative `StorageError`.
- **Corrupted Envelope Defense (`FileStorage`)**: `FileStorage.load()` strictly validates the shape and payload types of deserialized disk envelopes, raising `StorageError` on truncated, null, or corrupted data.
- **Enhanced `MemoryStorage`**: Added `size` getter and `clear()` method, alongside non-empty identifier validation across all storage operations.

## [1.1.1] - 2026-09-17 — Failsafe Rollbacks, Type Safety & Immutability Hardening

### Security & Reliability
- **CWE-404 / CWE-775 Resource Leak Rollback (`GetoGateway`)**: If `storage.save()` fails during `consume()`, `gateway.consume()` now automatically triggers a defensive rollback by calling `adapter.release(resource)` before propagating the `StorageError`. This guarantees that unpersisted processes, sockets, or open handles are never leaked as orphaned zombies.
- **CWE-843 Adapter Type Confusion Defense (`GetoGateway`)**: `gateway.restore()` and `gateway.release()` now verify that the provided adapter's `adapterId` strictly matches the originating `canonical.adapterId`. Attempting to restore an entity with an incompatible adapter immediately throws `AdapterError`.
- **CWE-471 / CWE-374 Deep Immutability (`GetoEntity`)**: Implemented deep freezing and defensive cloning for `entity.metadata.custom` and `Date` properties (`createdAt`, `updatedAt`), preventing external caller mutations from altering internal entity states.
- **CWE-362 Atomic Disk Writes (`FileStorage`)**: `FileStorage.save()` now uses an atomic temporary file write and atomic rename pattern (`fs.rename`), ensuring that interrupted writes, abrupt power loss, or process crashes never leave partially written or corrupted `.bin` files on disk.
- **ESRCH Signal Tolerance (`ProcessAdapter`)**: `ProcessAdapter.release()` safely catches and ignores `ESRCH` (process already reaped by the OS kernel) instead of throwing an unhandled `AdapterError`.

### Developer Experience
- **Typed Error Properties**: `EntityNotFoundError` now exposes public property `readonly id: string`, and `EntityStateError` exposes `readonly id: string`, `readonly state: EEntityState`, and `readonly operation: string`.

## [1.1.0] - 2026-09-17 — Security Hardening, DoS Defenses, and Concurrency Resilience

### Security
- **SSRF Open Redirect Defense (`HttpReferenceAdapter`)**: Enforced `redirect: 'error'` default policy whenever `allowedOrigins` is specified, preventing attackers from pivoting to internal metadata IP addresses (`169.254.169.254`) via open redirects. Added post-redirect origin destination verification even if `redirect: 'follow'` is explicitly chosen.
- **Strict Protocol Validation (`HttpReferenceAdapter`)**: Exclusively permits `http:` and `https:` schemes, rejecting dangerous schemes (`file:`, `javascript:`, `data:`, `ftp:`) with typed `AdapterError`.
- **Stream Memory Bounds / DoS Defense (`StreamAdapter`)**: Added `maxBytes` threshold option in `IStreamAdapterOptions` to abort and destroy streams that exceed memory budgets before causing Out-Of-Memory (OOM) process crashes.
- **Path Traversal & Device Name Neutralization (`FileStorage`)**: Replaced permissive path sanitization with strict alphanumeric/UUID regex (`/^[a-zA-Z0-9_-]{1,128}$/`), completely blocking directory traversal (`..`), Windows reserved devices (`CON`, `PRN`, `AUX`, `NUL`), and NTFS Alternate Data Streams (`:stream`).

### Fixed
- **Deadlock Prevention (`StreamAdapter`)**: Streams that have already emitted `'end'` or been destroyed prior to consumption are immediately rejected with an `AdapterError` rather than leaving the Promise in an eternal unresolvable hang state.
- **Race Condition in Lifecycle State (`GetoGateway`)**: Fixed a race condition where a concurrent `delete()` call while an asynchronous `adapter.release()` was in-flight would get overwritten with `RELEASED`. The gateway now validates that the entity is not `DELETED` before finalizing state transitions.

## [1.0.0] - 2026-09-17 — First stable milestone: All 5 semantics proven & complete developer manual

### Added
- Comprehensive Developer Guide & Manual (`docs/DEVELOPER_GUIDE.md`) with end-to-end tutorials for custom adapters and custom storage engines.
- Production Recipes & Architectural Patterns guide (`docs/guides/recipes.md`) covering process supervisors, stream replay buffers, SSRF-safe lazy ingestion, and two-tier storage.
- In-depth technical specifications with Mermaid sequence diagrams for all five consumption semantics (`docs/adapters/semantics/{copy,serialize,capture,wrap,register}.md`).
- Standalone, zero-dependency runnable examples suite (`examples/`) covering each semantic plus custom compression adapters, with `npm run test:examples` CI runner.
- CodeQL automated security analysis workflow (`.github/workflows/codeql.yml`).
- Semantic PR title validation workflow (`.github/workflows/semantic-pr.yml`).
- Repository `.editorconfig` enforcing uniform LF newlines and 2-space indentation.
- Typed representation envelope in `FileStorage` to guarantee binary Buffer fidelity.
- Stable, frozen Core Gateway contract supporting all 5 fundamental consumption semantics (`COPY`, `SERIALIZE`, `CAPTURE`, `WRAP`, `REGISTER`).

### Fixed
- Fixed binary buffer truncation in `FileStorage` by introducing typed base64 envelope storage.
- Fixed CodeQL `js/useless-conditional` alerts in package smoke test via dynamic namespace inspection.
- Fixed TypeScript IDE `@types/node` Buffer resolution in unit and integration test files.
- Fixed broken relative navigation links and `FileSnapshotAdapter` generic typing in documentation.


## [0.5.0] - 2026-09-17 — REGISTER semantic: HttpReferenceAdapter

### Added
- `HttpReferenceAdapter` implementing the `REGISTER` consumption semantic (`URL string (T) -> stored URL (R)`).
- Zero-network consumption where URL locators are validated and registered without initiating HTTP calls.
- Lazy resolution upon `restore()`, dispatching the HTTP GET request and returning the body payload.
- SSRF mitigation policy with configurable `allowedOrigins` whitelist support.
- Unit and integration tests demonstrating locator registration, deferred network fetching, and origin security enforcement.
- Package smoke test coverage for `HttpReferenceAdapter`.

## [0.4.0] - 2026-09-17 — WRAP semantic: ProcessAdapter, IProcessHandle

### Added
- `ProcessAdapter` implementing the `WRAP` consumption semantic (`ChildProcess (T) -> IProcessHandle (R)`).
- `IProcessHandle` controller interface providing real-time liveness checking (`isAlive()`), process ID inspection, and targeted signal dispatch.
- Supervised cleanup where `gateway.release()` guarantees safe process termination (`SIGTERM`).
- Unit and integration tests demonstrating live process wrapping, execution retention, and termination on release.
- Package smoke test coverage for `ProcessAdapter`.

## [0.3.0] - 2026-09-17 — CAPTURE semantic: StreamAdapter

### Added
- `StreamAdapter` implementing the `CAPTURE` consumption semantic (`Readable (T) -> Buffer (R)`).
- Repeatable restoration support for single-use streams via fresh `Readable` instances.
- Comprehensive unit and integration tests covering stream error wrapping, empty streams, and lifecycle release.
- Package smoke test coverage for `StreamAdapter`.

## [0.2.0] - 2026-09-17 — SERIALIZE semantic: JsonAdapter, FileStorage

### Added
- `JsonAdapter` implementing the `SERIALIZE` consumption semantic (`Object (T) -> string (R)`).
- `FileStorage` backend for persistent disk-based entity storage with directory traversal prevention.
- End-to-end integration tests proving persistent serialization across different storage engines.
- Package smoke test coverage for `JsonAdapter` and `FileStorage`.

## [0.1.0] - 2026-09-17 — COPY semantic: core gateway, MemoryStorage, BufferAdapter

### Added
- Core Gateway implementation
- MemoryStorage implementation
- BufferAdapter with COPY semantic
- IEntity interface and implementation
- GetoError classes
