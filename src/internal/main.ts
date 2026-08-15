import { Cause, Effect } from "effect";

import { CliCrashReporter } from "./crash-reporting.js";
import { CliOutput, detectOutputModeFromArgv } from "./output-service.js";
import { CliRuntime } from "./runtime.js";

export const handleCliCause = (cause: Cause.Cause<unknown>) => {
  if (Cause.hasInterruptsOnly(cause)) {
    return Effect.failCause(cause);
  }

  return Effect.gen(function* () {
    const cliOutput = yield* CliOutput;
    const runtime = yield* CliRuntime;
    const outputMode = detectOutputModeFromArgv(runtime.argv, runtime.isInteractiveTerminal);

    yield* cliOutput.error(cliOutput.formatError(Cause.squash(cause), outputMode));
    yield* runtime.setExitCode(1);

    if (Cause.hasDies(cause)) {
      const crashReporter = yield* CliCrashReporter;
      yield* Effect.promise(() => crashReporter.capture("effect_defect"));
    }
  });
};
