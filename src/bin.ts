#!/usr/bin/env node

import { NodeContext, NodeRuntime } from "@effect/platform-node";
import * as NodeTerminal from "@effect/platform-node/NodeTerminal";
import { Cause, Effect, Layer } from "effect";

import { runCli } from "./cli.js";
import { CliOutput, CliOutputLive, detectOutputModeFromArgv } from "./internal/output-service.js";
import { CliRuntime, CliRuntimeLive } from "./internal/runtime.js";

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
      Effect.provide(
        Layer.mergeAll(NodeContext.layer, NodeTerminal.layer, CliOutputLive, CliRuntimeLive),
      ),
    ),
  ),
);
