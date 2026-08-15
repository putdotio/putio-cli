import type { ChildProcess } from "node:child_process";
import process from "node:process";

type TerminationOptions = {
  readonly forceTimeoutMs?: number;
  readonly gracefulTimeoutMs?: number;
};

type LifecycleOutcome = {
  readonly cleanupErrors: ReadonlyArray<unknown>;
  readonly interruptedBy: NodeJS.Signals | undefined;
  readonly primaryError: unknown;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const hasExited = (child: ChildProcess) => child.exitCode !== null || child.signalCode !== null;

const waitForExit = (child: ChildProcess, timeoutMs: number): Promise<boolean> => {
  if (hasExited(child)) return Promise.resolve(true);

  return new Promise((resolve) => {
    const finish = (exited: boolean) => {
      clearTimeout(timer);
      child.off("exit", onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once("exit", onExit);
  });
};

export const ownedProcessExists = (child: ChildProcess) => {
  if (child.pid === undefined) return false;
  if (process.platform === "win32") return !hasExited(child);

  try {
    process.kill(-child.pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return false;
    if (code === "EPERM") return true;
    throw error;
  }
};

const waitForOwnedProcessExit = async (child: ChildProcess, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;
  while (ownedProcessExists(child)) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return false;
    await wait(Math.min(25, remainingMs));
  }

  if (hasExited(child)) return true;
  return waitForExit(child, Math.max(0, deadline - Date.now()));
};

const signalOwnedProcess = (child: ChildProcess, signal: NodeJS.Signals) => {
  if (child.pid === undefined) return;

  try {
    if (process.platform === "win32") {
      if (!hasExited(child)) child.kill(signal);
    } else {
      process.kill(-child.pid, signal);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
};

export const terminateOwnedProcess = async (
  child: ChildProcess,
  options: TerminationOptions = {},
) => {
  const gracefulTimeoutMs = options.gracefulTimeoutMs ?? 2_000;
  const forceTimeoutMs = options.forceTimeoutMs ?? 2_000;

  if (!ownedProcessExists(child)) {
    if (!hasExited(child) && !(await waitForExit(child, gracefulTimeoutMs))) {
      throw new Error(`Owned process ${child.pid ?? "unknown"} did not terminate.`);
    }
    return;
  }

  signalOwnedProcess(child, "SIGTERM");
  if (await waitForOwnedProcessExit(child, gracefulTimeoutMs)) return;

  signalOwnedProcess(child, "SIGKILL");
  if (!(await waitForOwnedProcessExit(child, forceTimeoutMs))) {
    throw new Error(`Owned process ${child.pid ?? "unknown"} did not terminate.`);
  }
};

export const createInterruptionController = () => {
  const abortController = new AbortController();
  let interruptedBy: NodeJS.Signals | undefined;
  let rejectInterruption: (error: Error) => void = () => undefined;
  const interruption = new Promise<never>((_resolve, reject) => {
    rejectInterruption = reject;
  });
  const handlers = new Map<NodeJS.Signals, () => void>();

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    const handler = () => {
      if (interruptedBy !== undefined) return;
      interruptedBy = signal;
      abortController.abort();
      rejectInterruption(new Error(`Interrupted by ${signal}.`));
    };
    handlers.set(signal, handler);
    process.on(signal, handler);
  }

  return {
    dispose: () => {
      for (const [signal, handler] of handlers) process.off(signal, handler);
    },
    interruptedBy: () => interruptedBy,
    interruption,
    signal: abortController.signal,
  } as const;
};

export const resolveLifecycleOutcome = ({
  cleanupErrors,
  interruptedBy,
  primaryError,
}: LifecycleOutcome) => {
  if (interruptedBy !== undefined) return interruptedBy === "SIGINT" ? 130 : 143;
  if (primaryError !== undefined) throw primaryError;
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "Owned process cleanup failed.");
  }
  return undefined;
};
