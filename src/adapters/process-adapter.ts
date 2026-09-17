import { ChildProcess } from 'child_process';
import { IGetoAdapter, EConsumptionSemantic } from '../models/index.js';
import { AdapterError } from '../errors/index.js';

/**
 * Controller interface providing managed status and control over a wrapped `ChildProcess`.
 */
export interface IProcessHandle {
  /** The underlying Node.js ChildProcess instance. */
  readonly process: ChildProcess;
  /** Process identifier assigned by the operating system, if available. */
  readonly pid?: number;
  /**
   * Checks whether the underlying process is currently running and active.
   */
  isAlive(): boolean;
  /**
   * Sends a termination signal to the wrapped child process.
   *
   * @param signal - OS termination signal, defaults to 'SIGTERM'.
   * @returns `true` if the signal was successfully sent, otherwise `false`.
   */
  kill(signal?: NodeJS.Signals | number): boolean;
}

/**
 * Managed wrapper implementation around an active `ChildProcess`.
 */
class ProcessHandle implements IProcessHandle {
  readonly process: ChildProcess;
  readonly pid?: number;

  constructor(process: ChildProcess) {
    this.process = process;
    this.pid = process.pid;
  }

  isAlive(): boolean {
    return this.process.exitCode === null && !this.process.killed;
  }

  kill(signal: NodeJS.Signals | number = 'SIGTERM'): boolean {
    if (this.isAlive()) {
      return this.process.kill(signal);
    }
    return false;
  }
}

/**
 * Built-in adapter for Node.js `ChildProcess` resources implementing the `WRAP` semantic.
 *
 * Wraps an active, running child process without serializing it into static data.
 * The wrapped representation provides real-time lifecycle inspection via {@link IProcessHandle},
 * and invoking `gateway.release()` guarantees safe process termination.
 */
export class ProcessAdapter implements IGetoAdapter<ChildProcess, IProcessHandle> {
  /** Unique identifier for this adapter. */
  readonly adapterId = 'process';
  /** The consumption semantic: WRAP. */
  readonly semantic = EConsumptionSemantic.WRAP;

  /**
   * Wraps an active `ChildProcess` into an {@link IProcessHandle}.
   *
   * @param resource - The active ChildProcess to wrap.
   * @returns A promise resolving to the managed process handle.
   * @throws {AdapterError} If the process resource is invalid.
   */
  async consume(resource: ChildProcess): Promise<IProcessHandle> {
    if (!resource || typeof resource.kill !== 'function') {
      throw new AdapterError('ProcessAdapter requires a valid ChildProcess instance');
    }
    return new ProcessHandle(resource);
  }

  /**
   * Restores the live child process from the active handle.
   *
   * @param data - The active {@link IProcessHandle}.
   * @returns A promise resolving to the underlying ChildProcess.
   */
  async restore(data: IProcessHandle): Promise<ChildProcess> {
    if (!data || !data.process) {
      throw new AdapterError('ProcessAdapter requires an active IProcessHandle representation to restore');
    }
    return data.process;
  }

  /**
   * Safely terminates the child process when the entity is released.
   *
   * @param resource - The live ChildProcess to release/kill.
   */
  async release(resource: ChildProcess): Promise<void> {
    if (resource.exitCode === null && !resource.killed) {
      try {
        resource.kill('SIGTERM');
      } catch (error: unknown) {
        // If process was already reaped by the operating system kernel, ESRCH is expected and safe
        if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'ESRCH') {
          return;
        }
        throw new AdapterError(`Failed to terminate process ${resource.pid}`, { cause: error });
      }
    }
  }
}
