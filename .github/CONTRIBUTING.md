# Contributing to geto

Thank you for your interest in contributing to **`geto`**!

---

## ⚠️ A Note on Maintenance: Solo-Developer Project

`geto` is an open-source project conceived, architected, and maintained primarily by a **single developer** ([@x-name15](https://github.com/x-name15)).

Because there is no large corporate team or full-time committee behind this repository, **every contribution makes a massive difference**:
- Filing clear bug reports with reproducible steps saves hours of triage.
- Writing unit tests for edge cases gives peace of mind when releasing new versions.
- Improving documentation or writing custom adapters helps the entire community.
- Reviewing pull requests and suggesting performance optimizations is deeply appreciated.

If you find this project helpful, your contributions, feedback, and stars mean the world! ❤️

---

## Project Philosophy & Architecture

`geto` is built on a strict separation of concerns:

1. **The Gateway is resource-agnostic:**
   - `GetoGateway` orchestrates lifecycle, state transitions (`STORED`, `RELEASED`, `DELETED`), and storage coordination.
   - It **must never** import or become aware of specific resource types (no `Buffer`, `ChildProcess`, or `fetch` in the core engine).
2. **Adapters own domain logic:**
   - Adapters declare one or more of the 5 consumption semantics (`COPY`, `SERIALIZE`, `CAPTURE`, `WRAP`, `REGISTER`).
   - All transformations ($T \leftrightarrow R$) and cleanup logic (`release()`) belong inside adapters.
3. **Storage is strictly swappable:**
   - Storage providers persist and retrieve arbitrary payloads without knowing anything about entities or adapters.
4. **Zero Runtime Dependencies:**
   - `geto` core must remain completely dependency-free. Do not add runtime dependencies to `package.json`.

Any contribution that introduces resource coupling to the gateway or adds unnecessary runtime bloat will be asked to restructure.

---

## Development Setup & Workflow

### Prerequisites
- Node.js `>= 22.12.0`
- npm `>= 10.0.0`

### Step-by-Step
1. Fork the repository on GitHub and clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/geto.git
   cd geto
   ```
2. Install development dependencies:
   ```bash
   npm install
   ```
3. Create a descriptive feature branch:
   ```bash
   git checkout -b feat/custom-socket-adapter
   ```
4. Make your code changes following TypeScript strict mode and Hungarian notation standards.
5. Verify the entire local quality gate:
   ```bash
   npm run typecheck
   npm test
   npm run build
   npm run test:package
   ```
6. Commit using **Conventional Commits** and open a Pull Request against `main`.

---

## Available npm Scripts

| Script | Purpose |
|---|---|
| `npm run typecheck` | Validates TypeScript types without emitting code (`tsc --noEmit`). |
| `npm test` | Runs the full Vitest suite in CI mode. |
| `npm run test:watch` | Runs Vitest in interactive watch mode for TDD. |
| `npm run build` | Compiles ESM (`tsup`), CommonJS (`tsup`), and type declarations (`tsc`). |
| `npm run test:package` | Executes a real smoke test importing the packaged `dist/` distribution. |

---

## Pull Request Checklist

Before opening your pull request, please verify:

- [ ] All 64+ automated tests pass (`npm test`).
- [ ] TypeScript compiles cleanly with zero lint or type errors (`npm run typecheck`).
- [ ] Code is documented with complete **TSDoc** comments (`/** ... */`).
- [ ] No runtime dependencies have been added (`dependencies` in `package.json` remains empty).
- [ ] PR title follows Conventional Commits (e.g., `feat: ...`, `fix: ...`, `docs: ...`).
- [ ] If introducing a new feature or adapter, accompanying unit tests and documentation are included.
