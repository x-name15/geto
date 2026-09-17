# geto — Documentation

**`@mrjacket/geto`** is an extensible resource consumption and entity lifecycle gateway for Node.js and TypeScript.

*Consume anything. Use it later.*

---

## Documentation Structure

```
docs/
├── README.md                     <-- Master portal (you are here)
│
├── guides/                       <-- Practical Developer Guides
│   ├── getting-started.md        <-- Installation, quickstart & mental model
│   ├── library.md                <-- Programmatic API reference (methods, types, errors)
│   ├── recipes.md                <-- Production recipes & architectural patterns
│   ├── DEVELOPER_GUIDE.md        <-- Full manual (custom adapters & custom engines)
│   └── ci-cd.md                  <-- CI/CD quality gates, CodeQL & releases
│
├── adapters/                     <-- Adapters & Semantics Reference
│   ├── overview.md               <-- Adapter contract & tutorial (FileSnapshotAdapter)
│   └── semantics/                <-- Dedicated semantic specifications
│       ├── copy.md               <-- COPY semantic (BufferAdapter)
│       ├── serialize.md          <-- SERIALIZE semantic (JsonAdapter)
│       ├── capture.md            <-- CAPTURE semantic (StreamAdapter)
│       ├── wrap.md               <-- WRAP semantic (ProcessAdapter)
│       └── register.md           <-- REGISTER semantic (HttpReferenceAdapter)
│
├── storage/                      <-- Storage Providers & Engines
│   └── overview.md               <-- MemoryStorage, FileStorage & AWS S3 tutorial
│
└── architecture/                 <-- Design Decisions & Logs
    ├── ARCHITECTURE.md           <-- Core scope, what geto is and is NOT
    ├── ROADMAP.md                <-- Version progression & semantic milestones
    └── LOG.md                    <-- Engineering decision logs
```

> **Runnable Examples:** A comprehensive suite of standalone, runnable Node.js scripts is available in the [`examples/`](../examples/) folder.

---

## Guides

| Guide | Target Audience | Summary |
|---|---|---|
| [Getting Started](./guides/getting-started.md) | Everyone | Installation, 5-minute quickstart, and lifecycle basics. |
| [Library API](./guides/library.md) | Developers | Full API reference for `GetoGateway`, entities, states, and error types. |
| [Production Recipes & Patterns](./guides/recipes.md) | Backend Engineers | Battle-tested solutions: process supervisors, stream replay, SSRF protection. |
| [Developer Manual](./guides/DEVELOPER_GUIDE.md) | Developers & Architects | Comprehensive guide on writing production-ready adapters and engines. |
| [CI/CD & DevOps](./guides/ci-cd.md) | DevOps & Maintainers | Verification pipelines, packaging tests, CodeQL, and automated releases. |

---

## Adapters & The 5 Consumption Semantics

| Semantic | Specification Document | Built-in Implementation | Core Purpose |
|---|---|---|---|
| **Overview** | [adapters/overview.md](./adapters/overview.md) | — | The `IGetoAdapter<T, R>` interface and custom adapter tutorial. |
| **`COPY`** | [adapters/semantics/copy.md](./adapters/semantics/copy.md) | `BufferAdapter` | Isolated memory duplication. |
| **`SERIALIZE`** | [adapters/semantics/serialize.md](./adapters/semantics/serialize.md) | `JsonAdapter` | Complex object-to-data transformation ($T \neq R$). |
| **`CAPTURE`** | [adapters/semantics/capture.md](./adapters/semantics/capture.md) | `StreamAdapter` | Draining and replaying single-use resources. |
| **`WRAP`** | [adapters/semantics/wrap.md](./adapters/semantics/wrap.md) | `ProcessAdapter` | Supervising live handles with guaranteed cleanup on `release()`. |
| **`REGISTER`** | [adapters/semantics/register.md](./adapters/semantics/register.md) | `HttpReferenceAdapter` | Lazy locator registration with deferred HTTP resolution. |

---

## Storage Backends

| Engine | Guide | Type | Characteristics |
|---|---|---|---|
| **Storage Overview** | [storage/overview.md](./storage/overview.md) | — | Contract specification & AWS S3 custom engine tutorial. |
| **`MemoryStorage`** | [storage/overview.md#1-memorystorage](./storage/overview.md#1-memorystorage) | In-Memory | Transient, zero-latency, ideal for unit testing and live processes. |
| **`FileStorage`** | [storage/overview.md#2-filestorage](./storage/overview.md#2-filestorage) | Local Filesystem | Durable disk persistence with directory traversal protection. |

---

## Architecture & History

- [Architecture & Scope Definition](./architecture/ARCHITECTURE.md): The core definition of what geto is and explicitly what it is NOT.
- [Roadmap](./architecture/ROADMAP.md): How geto proved its architecture across 5 semantic milestones.
- [Engineering Log](./architecture/LOG.md): Architectural decisions and bug fixes documented chronologically.
