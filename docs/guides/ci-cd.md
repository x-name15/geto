# CI/CD, DevOps & Quality Gates

This guide outlines the automated testing, security scanning, packaging validation, and release pipelines configured for **`@mrjacket/geto`**.

---

## 1. Quality Gate Standards

Before any code is merged to `main` or published to registries, it must pass the unified local verification gate:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:package
```

### Explanation of Pipeline Steps
1. **`npm run typecheck` (`tsc --noEmit`):** Strict TypeScript type validation.
2. **`npm test` (`vitest run`):** Runs all unit and integration test suites in non-interactive CI mode.
3. **`npm run build`:** Compiles ES Modules (`dist/index.js`), CommonJS (`dist/index.cjs`), and isolated TypeScript type declarations (`dist/index.d.ts` via `tsconfig.build.json`).
4. **`npm run test:package`:** Real consumer smoke test validating that all expected public exports exist on the bundled package.

---

## 2. GitHub Actions Workflows

All workflows are maintained in `.github/workflows/`:

| Workflow | File | Trigger | Responsibility |
|---|---|---|---|
| **CI Gate** | `ci.yml` | Push & PR to `main` | Runs the full verification gate on Node.js 22. |
| **Release Pipeline** | `release.yml` | CI passing on `main` | Extracts version from `CHANGELOG.md`, tags, packages source zip, and publishes to NPM and GitHub Packages with provenance. |
| **CodeQL Security** | `codeql.yml` | Push, PR & Weekly cron | Static code analysis with `security-extended` queries. |
| **Semantic PRs** | `semantic-pr.yml` | PR open/sync | Enforces Conventional Commit PR titles (`feat:`, `fix:`, etc.). |

---

## 3. Automated Release Process

`geto` uses `CHANGELOG.md` as the **single source of truth for versioning**.

1. When ready to release, add the new version entry at the top of `CHANGELOG.md`:
   ```markdown
   ## [1.0.0] - 2026-09-17 — Release Title
   ### Added
   - ...
   ```
2. Open PR with title `feat: release 1.0.0` or merge directly to `main`.
3. `release.yml` triggers automatically:
   - Reads `1.0.0` via regex.
   - Synchronizes `src/version.ts` and `package.json`.
   - Creates Git tag `v1.0.0`.
   - Publishes to **npm** with `--access public --provenance`.
   - Publishes to **GitHub Packages** (`npm.pkg.github.com`).
