#!/usr/bin/env node

import { NodeRuntime } from "@effect/platform-node";
import { Cause, Effect } from "effect";

import { runCli } from "./cli.js";
import { makeCliAppLayer } from "./internal/app-layer.js";
import { CliOutput, detectOutputModeFromArgv } from "./internal/output-service.js";
import { CliRuntime } from "./internal/runtime.js";

NodeRuntime.runMain(
  Effect.scoped(
    Effect.flatMap(CliRuntime, (runtime) => runCli(runtime.argv)).pipe(
      Effect.catchAllCause((cause) =>
        Effect.gen(function* () {
          const cliOutput = yield* CliOutput;
          const runtime = yield* CliRuntime;
          const outputMode = detectOutputModeFromArgv(runtime.argv);

          yield* cliOutput.error(cliOutput.formatError(Cause.squash(cause), outputMode));
          yield* runtime.setExitCode(1);
        }),
      ),
      Effect.provide(makeCliAppLayer()),
    ),
  ),
);
