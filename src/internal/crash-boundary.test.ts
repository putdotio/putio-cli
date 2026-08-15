import { describe, expect, it, vi } from "vite-plus/test";

import { installCrashBoundary, type CrashBoundaryRuntime } from "./crash-boundary.js";
import type { CrashKind, CrashReporterService } from "./crash-reporting.js";

const makeRuntime = () => {
  let uncaughtExceptionHandler: ((error: Error) => void) | undefined;
  let unhandledRejectionHandler: ((reason: unknown) => void) | undefined;

  const runtime: CrashBoundaryRuntime = {
    addUncaughtExceptionHandler: (handler) => {
      uncaughtExceptionHandler = handler;
    },
    addUnhandledRejectionHandler: (handler) => {
      unhandledRejectionHandler = handler;
    },
    removeUncaughtExceptionHandler: (handler) => {
      if (uncaughtExceptionHandler === handler) {
        uncaughtExceptionHandler = undefined;
      }
    },
    removeUnhandledRejectionHandler: (handler) => {
      if (unhandledRejectionHandler === handler) {
        unhandledRejectionHandler = undefined;
      }
    },
  };

  return {
    getUncaughtExceptionHandler: () => uncaughtExceptionHandler,
    getUnhandledRejectionHandler: () => unhandledRejectionHandler,
    runtime,
  };
};

describe("installCrashBoundary", () => {
  it("does not install handlers when reporting is disabled", () => {
    const runtime = makeRuntime();
    const reporter: CrashReporterService = {
      capture: vi.fn(() => Promise.resolve()),
      decision: { enabled: false, reason: "persisted_opt_out" },
    };

    installCrashBoundary(reporter, { runtime: runtime.runtime });

    expect(runtime.getUncaughtExceptionHandler()).toBeUndefined();
    expect(runtime.getUnhandledRejectionHandler()).toBeUndefined();
  });

  it.each([
    ["uncaught_exception", "getUncaughtExceptionHandler", new Error("boom")],
    ["unhandled_rejection", "getUnhandledRejectionHandler", new Error("rejected")],
  ] as const)("captures and replays %s once", async (kind, handlerName, reason) => {
    const runtime = makeRuntime();
    const capture = vi.fn((_kind: CrashKind) => Promise.resolve());
    const replayFatal = vi.fn();
    const reporter: CrashReporterService = {
      capture,
      decision: { enabled: true },
    };

    installCrashBoundary(reporter, { replayFatal, runtime: runtime.runtime });
    const handler = runtime[handlerName]();
    expect(handler).toBeDefined();

    handler?.(reason);
    await Promise.resolve();

    expect(capture).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledWith(kind);
    expect(replayFatal).toHaveBeenCalledWith(kind, reason);
    expect(runtime.getUncaughtExceptionHandler()).toBeUndefined();
    expect(runtime.getUnhandledRejectionHandler()).toBeUndefined();
  });
});
