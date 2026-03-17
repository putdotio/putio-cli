import { Effect } from "effect";

import { CliRuntime } from "./runtime.js";
import { normalizeOutputMode } from "./output-service.js";

export const shouldUseTerminalLoader = (
  output: string | undefined,
  isInteractiveTerminal: boolean,
) => normalizeOutputMode(output) === "terminal" && isInteractiveTerminal;

export const withTerminalLoader = <A, E, R>(
  options: {
    readonly message: string;
    readonly output: string | undefined;
  },
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R | CliRuntime> =>
  Effect.flatMap(CliRuntime, (runtime) => {
    if (!shouldUseTerminalLoader(options.output, runtime.isInteractiveTerminal)) {
      return effect;
    }

    return Effect.acquireUseRelease(
      runtime.startSpinner(options.message),
      () => effect,
      (spinner) => spinner.stop,
    );
  });
