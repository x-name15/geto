# geto Examples

This directory contains standalone, runnable Node.js ESM examples demonstrating every aspect of **`@mrjacket/geto`**.

All examples use zero external dependencies and run natively on Node.js `>= 22.12.0`.

---

## Running the Examples

Make sure the project is built first:

```bash
npm run build
```

Then run any example directly with `node`:

```bash
# 01. In-memory buffer isolation (COPY semantic)
node examples/01-buffer-copy.mjs

# 02. JSON serialization and disk persistence (SERIALIZE semantic)
node examples/02-json-file-persistence.mjs

# 03. Single-use stream capture & replay (CAPTURE semantic)
node examples/03-stream-capture-replay.mjs

# 04. Child process supervision & safe SIGTERM cleanup (WRAP semantic)
node examples/04-process-supervision.mjs

# 05. Lazy network reference & SSRF origin allowlisting (REGISTER semantic)
node examples/05-lazy-http-reference.mjs

# 06. Writing an end-to-end custom adapter (Gzip compression)
node examples/06-custom-compression-adapter.mjs
```

---

## Example Index

| File | Semantic / Feature | Key Concepts Illustrated |
|---|---|---|
| [`01-buffer-copy.mjs`](./01-buffer-copy.mjs) | `COPY` | In-memory buffer isolation, mutation resistance. |
| [`02-json-file-persistence.mjs`](./02-json-file-persistence.mjs) | `SERIALIZE` | `FileStorage`, structured object persistence, restart survival. |
| [`03-stream-capture-replay.mjs`](./03-stream-capture-replay.mjs) | `CAPTURE` | Replaying single-use `Readable` streams to multiple destinations. |
| [`04-process-supervision.mjs`](./04-process-supervision.mjs) | `WRAP` | `IProcessHandle`, PID inspection, guaranteed `SIGTERM` cleanup on `release()`. |
| [`05-lazy-http-reference.mjs`](./05-lazy-http-reference.mjs) | `REGISTER` | Zero-network consumption, SSRF prevention, deferred HTTP fetch. |
| [`06-custom-compression-adapter.mjs`](./06-custom-compression-adapter.mjs) | Custom Adapter | Implementing `IGetoAdapter<T, R>` with Node's native `zlib`. |
