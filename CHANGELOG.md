# Changelog

All notable changes to this project will be documented in this file.

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
