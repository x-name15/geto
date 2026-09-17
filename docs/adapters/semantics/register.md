# `REGISTER` Semantic Reference

> **Adapter:** `HttpReferenceAdapter`  
> **Source:** `string` (URL locator)  
> **Representation:** `string` (Validated URL)  
> **Lifecycle Release:** Not required

---

## Concept

The **`REGISTER`** semantic proves that consuming a resource does not require materializing or fetching it immediately.

`consume()` records the locator or reference. Network fetching or expensive computation is **deferred** until `restore()` is called.

```
URL "https://api.github.com/zen"
       │
       ▼ consume()
Validated & Saved to Storage (0 network requests made!)
       │
       ▼ restore() (lazy resolution)
HTTP GET dispatched via fetch() ──▶ Returns response body
```

---

## When to Use `REGISTER`

- Remote file locators (S3 presigned URLs, CDN links).
- Lazy webhook triggers or external API endpoints.
- High-volume URL queues where only a fraction of resources will actually be read.

---

## Security (SSRF Mitigation)

Because `HttpReferenceAdapter` executes HTTP requests on `restore()`, it supports a strict `allowedOrigins` whitelist to protect against Server-Side Request Forgery (SSRF) and access to internal cloud metadata IP addresses (`169.254.169.254`):

```typescript
const adapter = new HttpReferenceAdapter({
  allowedOrigins: ['https://api.github.com', 'https://trusted-partner.com']
});

// Allowed:
await gateway.consume('https://api.github.com/zen', adapter);

// Throws AdapterError immediately:
await gateway.consume('http://169.254.169.254/latest/meta-data', adapter);
```

---

## Example

```typescript
import { GetoGateway, FileStorage, HttpReferenceAdapter } from '@mrjacket/geto';

const gateway = new GetoGateway({ storage: new FileStorage('./.data') });
const adapter = new HttpReferenceAdapter({
  allowedOrigins: ['https://api.github.com']
});

// Consumes reference immediately — instant, offline-safe
const entity = await gateway.consume('https://api.github.com/zen', adapter);

// Network fetch occurs on restore
const quote = await gateway.restore(entity, adapter);
console.log('GitHub Zen:', quote);
```
