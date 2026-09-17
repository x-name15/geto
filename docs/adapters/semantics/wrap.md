# `WRAP` Semantic Reference

> **Adapter:** `ProcessAdapter`  
> **Source:** `ChildProcess`  
> **Representation:** `IProcessHandle`  
> **Lifecycle Release:** Guaranteed process termination (`SIGTERM`)

---

## Concept

The **`WRAP`** semantic manages the lifecycle of an **active, running resource** without muting, freezing, or attempting to serialize it to static disk data.

Instead of snapshotting, the adapter wraps the live handle with supervision capabilities and registers guaranteed cleanup when `gateway.release()` is called.

```
Operating System ChildProcess
       │
       ▼ consume()
Wrapped in IProcessHandle (live monitoring: isAlive(), kill())
       │
       ├── restore() ──▶ Access underlying live ChildProcess (stdin, stdout)
       │
       └── release() ──▶ ChildProcess.kill('SIGTERM') terminates process cleanly
```

---

## Difference between `release()` and `delete()`

`WRAP` showcases why `release()` and `delete()` are fundamentally different operations in `geto`:

- **`gateway.release(entity, adapter)`:** Resource cleanup. Sends a termination signal to the live process. The entity descriptor remains in storage with `state = 'released'`.
- **`gateway.delete(entity.id)`:** Storage cleanup. Removes the entity representation from storage entirely, transitioning to the terminal `state = 'deleted'`.

---

## Example

```typescript
import { spawn } from 'child_process';
import { GetoGateway, MemoryStorage, ProcessAdapter } from '@mrjacket/geto';

const gateway = new GetoGateway({ storage: new MemoryStorage() });
const adapter = new ProcessAdapter();

// Spawn a worker process
const proc = spawn('node', ['-e', 'setInterval(() => {}, 1000)']);

// Wrap the running process
const entity = await gateway.consume(proc, adapter);

// Check process status in real time
const liveProc = await gateway.restore(entity, adapter);
console.log('Process PID:', liveProc.pid);

// Clean up when shutting down
await gateway.release(entity, adapter);
console.log('Process terminated cleanly.');
```
