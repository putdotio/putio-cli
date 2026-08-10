import { Cause, Effect } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";

import { handleCliCause } from "./main.js";
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
    const cliOutput: CliOutputService = {
      error: writeError,
      formatError,
      write: () => Effect.void,
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
        Effect.provideService(CliRuntime, runtime),
      ),
    );

    expect(formatError).toHaveBeenCalledWith(failure, "json");
    expect(writeError).toHaveBeenCalledWith("formatted failure");
    expect(exitCode).toBe(1);
  });
});
