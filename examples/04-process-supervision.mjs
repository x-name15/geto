/**
 * Example 04: Process Supervision & Safe Cleanup (WRAP Semantic)
 * 
 * Demonstrates supervising an active operating system child process.
 * ProcessAdapter wraps the live ChildProcess into an IProcessHandle without
 * serializing it, and gateway.release() guarantees clean termination (SIGTERM).
 * 
 * Run: node examples/04-process-supervision.mjs
 */

import { GetoGateway, MemoryStorage, ProcessAdapter } from '../dist/index.js';
import { spawn } from 'node:child_process';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== Example 04: OS Process Supervision (WRAP Semantic) ===\n');

  const gateway = new GetoGateway({ storage: new MemoryStorage() });
  const adapter = new ProcessAdapter();

  // 1. Spawn a background process that stays alive (e.g. simulated worker daemon)
  console.log('1. Spawning long-running child worker process...');
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    stdio: 'ignore'
  });

  // 2. Wrap into gateway
  const entity = await gateway.consume(child, adapter, {
    metadata: { job: 'background-indexer', spawnedAt: Date.now() }
  });
  console.log('   Entity ID:', entity.id);
  console.log('   Entity State:', entity.state);

  // 3. Inspect restored process (type T = ChildProcess) and stored representation (type R = IProcessHandle)
  const restoredProcess = await gateway.restore(entity, adapter);
  const handle = await gateway.storage.load(entity.id);
  console.log('\n2. Restored live process & handle:');
  console.log('   ChildProcess PID:    ', restoredProcess.pid);
  console.log('   Handle isAlive() ?   ', handle.isAlive());
  console.log('   Process exitCode:    ', restoredProcess.exitCode);

  // 4. Release entity (triggers adapter.release() -> sends SIGTERM to child)
  console.log('\n3. Releasing entity via gateway.release()...');
  await gateway.release(entity, adapter);

  // Wait a moment for OS process table to reap
  await sleep(150);

  console.log('\n4. Post-release status:');
  const updatedEntity = await gateway.get(entity.id);
  console.log('   Entity State:        ', updatedEntity.state);
  console.log('   Handle isAlive() ?   ', handle.isAlive());
  console.log('   Process killed:      ', restoredProcess.killed);
  console.log('   Clean termination verified:', (!handle.isAlive() && updatedEntity.state === 'released') ? 'PASSED' : 'FAILED');
}

main().catch((err) => {
  console.error('Example failed:', err);
  process.exit(1);
});
