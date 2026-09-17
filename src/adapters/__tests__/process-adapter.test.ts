import { describe, it, expect, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { ProcessAdapter } from '../process-adapter.js';
import { EConsumptionSemantic } from '../../models/index.js';
import { AdapterError } from '../../errors/index.js';

describe('ProcessAdapter', () => {
  const adapter = new ProcessAdapter();
  const spawnedProcesses: ChildProcess[] = [];

  afterEach(() => {
    // Ensure all spawned test processes are killed
    for (const proc of spawnedProcesses) {
      if (proc.exitCode === null && !proc.killed) {
        proc.kill('SIGKILL');
      }
    }
  });

  it('has correct adapterId and semantic properties', () => {
    expect(adapter.adapterId).toBe('process');
    expect(adapter.semantic).toBe(EConsumptionSemantic.WRAP);
  });

  it('wraps a live process into an IProcessHandle without altering process flow', async () => {
    // Spawn a long-running sleep process in node
    const proc = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
    spawnedProcesses.push(proc);

    const handle = await adapter.consume(proc);
    expect(handle.pid).toBe(proc.pid);
    expect(handle.isAlive()).toBe(true);
    expect(handle.process).toBe(proc);

    // Restore returns the identical running child process
    const restoredProc = await adapter.restore(handle);
    expect(restoredProc).toBe(proc);
    expect(restoredProc.pid).toBe(proc.pid);

    // Release terminates the process
    await adapter.release(restoredProc);
    
    // Wait for the exit event
    await new Promise<void>((resolve) => {
      if (restoredProc.exitCode !== null || restoredProc.killed) {
        resolve();
      } else {
        restoredProc.on('exit', () => resolve());
      }
    });

    expect(handle.isAlive()).toBe(false);
  });

  it('throws AdapterError when attempting to wrap invalid process resources', async () => {
    // @ts-expect-error testing invalid input
    await expect(adapter.consume(null)).rejects.toThrow(AdapterError);
    // @ts-expect-error testing invalid input
    await expect(adapter.consume({})).rejects.toThrow(AdapterError);
  });

  it('kill method on IProcessHandle safely terminates process', async () => {
    const proc = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
    spawnedProcesses.push(proc);

    const handle = await adapter.consume(proc);
    expect(handle.isAlive()).toBe(true);

    const killed = handle.kill();
    expect(killed).toBe(true);

    // Wait for process death
    await new Promise<void>((resolve) => {
      proc.on('exit', () => resolve());
    });

    expect(handle.isAlive()).toBe(false);
  });

  it('handles ESRCH error gracefully during release without throwing', async () => {
    const fakeProc = {
      exitCode: null,
      killed: false,
      pid: 12345,
      kill: () => {
        const err = new Error('Process not found');
        (err as any).code = 'ESRCH';
        throw err;
      },
    } as unknown as ChildProcess;

    await expect(adapter.release(fakeProc)).resolves.toBeUndefined();
  });

  it('rejects invalid handle in restore', async () => {
    await expect((adapter as any).restore(null)).rejects.toThrow(AdapterError);
    await expect((adapter as any).restore({})).rejects.toThrow(AdapterError);
  });
});
