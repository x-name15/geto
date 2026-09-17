# Contributing to geto

Thank you for your interest in contributing to geto!

## Architecture
geto uses a gateway/adapter/storage separation.
- GetoGateway: Manages entity lifecycles.
- Adapters: Manage resource consumption and restoration.
- Storage: Handles saving and loading of representations.

## Workflow
1. `npm install`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

## Commit Conventions
We use Conventional Commits (e.g. `feat: ...`, `fix: ...`, `chore: ...`). All commits and code must be in English.

## PR Checklist
- [ ] Tests pass
- [ ] Types are strict
- [ ] Zero runtime dependencies
