# Changelog

All notable changes to this project will be documented in this file.

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
