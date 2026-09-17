# Security Policy

## Supported Versions

Security patches and vulnerability remediation are applied exclusively to the **latest published minor/patch release** of `@mrjacket/geto`.

| Version | Supported |
|---|---|
| Latest release (`1.0.x`) | ✅ |
| Older releases (`< 1.0.0`) | ❌ |

If you are using an older version, please update to the latest release before submitting a security vulnerability report.

---

## Reporting a Vulnerability

If you discover a security vulnerability in `geto`, **please do not open a public GitHub Issue**.

Report vulnerabilities privately via **GitHub Security Advisories**:
> Repository → Security tab → Report a vulnerability

Please include detailed information:
- Package version (`@mrjacket/geto@x.y.z`)
- Node.js runtime environment (e.g., Node 22.12.0 on Linux / Windows)
- Minimal reproducible code or exploit proof-of-concept
- Analysis of the potential impact (e.g. denial of service, resource leak, directory traversal)

---

## Response Process

1. **Initial Acknowledgment:** Within **72 hours** of report receipt.
2. **Triage & Reproduction:** Verification of the vulnerability in an isolated test harness.
3. **Patch Development:** Developing, testing, and reviewing the fix in a private advisory fork.
4. **Coordinated Disclosure:** Release of the patched version on npm with accompanying CVE / GitHub Security Advisory credit.

---

## Scope & Security Posture

`geto` is a resource consumption and lifecycle gateway. Because it manages handles, processes, disk files, and network requests, its security posture addresses several concrete surfaces:

### 1. Filesystem Traversal (`FileStorage`)
- **Threat:** Malicious entity IDs containing path traversal characters (`../` or absolute paths) attempting to write outside the base directory.
- **Mitigation:** `FileStorage` strictly checks and sanitizes identifiers via `path.basename(id) === id`. Any path separator triggers a typed `StorageError`.

### 2. Server-Side Request Forgery (`HttpReferenceAdapter`)
- **Threat:** Consuming untrusted URLs leading to internal cloud metadata endpoints (e.g. `http://169.254.169.254`) or loopback networks.
- **Mitigation:** Configurable `allowedOrigins` whitelist policy. Requests to unauthorized hosts are rejected immediately with an `AdapterError`.

### 3. Resource Exhaustion (`StreamAdapter` / `ProcessAdapter`)
- **Threat:** Unbounded memory consumption when buffering massive streams or leaking child processes.
- **Mitigation:** Safe drain handling and explicit lifecycle cleanup via `gateway.release()` which dispatches `SIGTERM` signals and stream destruction hooks.

---

## CodeQL Analysis

`geto` is continuously scanned on every commit and pull request using GitHub CodeQL with the `security-extended` and `security-and-quality` suites to prevent vulnerabilities before they reach distribution.
