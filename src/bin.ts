#!/usr/bin/env node

import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";

import { runCli } from "./cli.js";
import { CliAppLive } from "./internal/app-layer.js";
import { bootstrapCrashReporting, CliCrashReporter } from "./internal/crash-reporting.js";
import { handleCliCause } from "./internal/main.js";
import { CliRuntime } from "./internal/runtime.js";

const { reporter: crashReporter } = bootstrapCrashReporting();

NodeRuntime.runMain(
  Effect.scoped(
    Effect.flatMap(CliRuntime, (runtime) => runCli(runtime.argv)).pipe(
      Effect.catchCause(handleCliCause),
      Effect.provide(CliAppLive),
      Effect.provideService(CliCrashReporter, crashReporter),
    ),
  ),
);
