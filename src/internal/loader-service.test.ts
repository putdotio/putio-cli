import { assert, describe, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";

import { shouldUseTerminalLoader, withTerminalLoader } from "./loader-service.js";
import { CliRuntime, makeCliRuntime } from "./runtime.js";

describe("shouldUseTerminalLoader", () => {
  it("uses loaders for default terminal output on interactive terminals", () => {
    assert.isTrue(shouldUseTerminalLoader(undefined, true));
  });

  it("does not use loaders for json output", () => {
    assert.isFalse(shouldUseTerminalLoader("json", true));
  });

  it("does not use loaders on non-interactive terminals", () => {
    assert.isFalse(shouldUseTerminalLoader(undefined, false));
  });

  it.effect("releases the spinner when the wrapped effect fails", () =>
    Effect.gen(function* () {
      let stopCount = 0;
      const runtime = {
        ...makeCliRuntime({ isInteractiveTerminal: true }),
        startSpinner: (_message: string) =>
          Effect.succeed({
            stop: Effect.sync(() => {
              stopCount += 1;
            }),
          }),
      };

      const exit = yield* withTerminalLoader(
        { message: "Loading", output: "terminal" },
        Effect.fail("boom"),
      ).pipe(Effect.provideService(CliRuntime, runtime), Effect.exit);

      assert.strictEqual(exit._tag, "Failure");
      assert.strictEqual(stopCount, 1);
    }),
  );

  it.effect("releases the spinner when the wrapped effect is interrupted", () =>
    Effect.gen(function* () {
      let stopCount = 0;
      const runtime = {
        ...makeCliRuntime({ isInteractiveTerminal: true }),
        startSpinner: (_message: string) =>
          Effect.succeed({
            stop: Effect.sync(() => {
              stopCount += 1;
            }),
          }),
      };
      const fiber = yield* withTerminalLoader(
        { message: "Loading", output: "terminal" },
        Effect.never,
      ).pipe(Effect.provideService(CliRuntime, runtime), Effect.forkChild);

      yield* Effect.yieldNow;
      yield* Fiber.interrupt(fiber);

      assert.strictEqual(stopCount, 1);
    }),
  );
});
