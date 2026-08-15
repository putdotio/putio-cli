import { Cause, Effect } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";

import { handleCliCause } from "./main.js";
import { CliCrashReporter, type CrashReporterService } from "./crash-reporting.js";
import { CliOutput, type CliOutputService } from "./output-service.js";
import { CliRuntime, makeCliRuntime } from "./runtime.js";

describe("handleCliCause", () => {
  it("preserves interrupt-only causes for NodeRuntime signal handling", async () => {
    const exit = await Effect.runPromiseExit(handleCliCause(Cause.interrupt()));

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true);
    }
  });

  it("renders ordinary failures and sets the process exit code", async () => {
    const failure = new Error("boom");
    let exitCode: number | undefined;
    const formatError = vi.fn(() => "formatted failure");
    const writeError = vi.fn(() => Effect.void);
    const writeOutput = vi.fn(() => Effect.void);
    const capture = vi.fn(() => Promise.resolve());
    const crashReporter: CrashReporterService = {
      capture,
      decision: { enabled: true },
    };
    const cliOutput: CliOutputService = {
      error: writeError,
      formatError,
      write: writeOutput,
    };
    const runtime = {
      ...makeCliRuntime({
        argv: ["node", "putio", "whoami", "--output", "json"],
        isInteractiveTerminal: false,
      }),
      setExitCode: (code: number) =>
        Effect.sync(() => {
          exitCode = code;
        }),
    };

    await Effect.runPromise(
      handleCliCause(Cause.fail(failure)).pipe(
        Effect.provideService(CliOutput, cliOutput),
        Effect.provideService(CliCrashReporter, crashReporter),
        Effect.provideService(CliRuntime, runtime),
      ),
    );

    expect(formatError).toHaveBeenCalledWith(failure, "json");
    expect(writeError).toHaveBeenCalledWith("formatted failure");
    expect(writeError).toHaveBeenCalledTimes(1);
    expect(writeOutput).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
    expect(exitCode).toBe(1);
  });

  it("keeps unexpected defects on the same local stderr-only path when reporting fails", async () => {
    const defect = new Error("unexpected defect");
    let exitCode: number | undefined;
    const formatError = vi.fn(() => "sanitized defect");
    const writeError = vi.fn(() => Effect.void);
    const writeOutput = vi.fn(() => Effect.void);
    const capture = vi.fn(() => Promise.reject(new Error("reporting failed")));
    const crashReporter: CrashReporterService = {
      capture,
      decision: { enabled: true },
    };
    const cliOutput: CliOutputService = {
      error: writeError,
      formatError,
      write: writeOutput,
    };
    const runtime = {
      ...makeCliRuntime({
        argv: ["node", "putio", "files", "list", "--output", "ndjson"],
        isInteractiveTerminal: false,
      }),
      setExitCode: (code: number) =>
        Effect.sync(() => {
          exitCode = code;
        }),
    };

    await Effect.runPromise(
      handleCliCause(Cause.die(defect)).pipe(
        Effect.provideService(CliOutput, cliOutput),
        Effect.provideService(CliCrashReporter, crashReporter),
        Effect.provideService(CliRuntime, runtime),
      ),
    );

    expect(formatError).toHaveBeenCalledWith(defect, "ndjson");
    expect(writeError).toHaveBeenCalledWith("sanitized defect");
    expect(writeError).toHaveBeenCalledTimes(1);
    expect(writeOutput).not.toHaveBeenCalled();
    expect(capture).toHaveBeenCalledWith("effect_defect");
    expect(exitCode).toBe(1);
  });
});
