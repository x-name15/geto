# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-09-17 — First stable milestone: All 5 semantics proven & complete developer manual

### Added
- Comprehensive Developer Guide & Manual (`docs/DEVELOPER_GUIDE.md`) with end-to-end tutorials for custom adapters and custom storage engines.
- CodeQL automated security analysis workflow (`.github/workflows/codeql.yml`).
- Semantic PR title validation workflow (`.github/workflows/semantic-pr.yml`).
- Typed representation envelope in `FileStorage` to guarantee binary Buffer fidelity.
- Stable, frozen Core Gateway contract supporting all 5 fundamental consumption semantics (`COPY`, `SERIALIZE`, `CAPTURE`, `WRAP`, `REGISTER`).

### Fixed
- Fixed binary buffer truncation in `FileStorage` by introducing typed base64 envelope storage.

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
