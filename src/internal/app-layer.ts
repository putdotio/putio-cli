import { NodeServices } from "@effect/platform-node";
import { Layer } from "effect";

import { CliConfigLive } from "./config.js";
import {
  CliCrashReporter,
  makeCrashReporter,
  type CrashReporterService,
} from "./crash-reporting.js";
import { CliOutputLive } from "./output-service.js";
import { CliRuntime, CliRuntimeLive, type CliRuntimeService } from "./runtime.js";
import { CliSdkLive } from "./sdk.js";
import { CliStateLive } from "./state.js";

export const makeCliAppLayer = (
  runtime?: CliRuntimeService,
  crashReporter: CrashReporterService = makeCrashReporter({
    preference: { disabled: true, reason: "configuration_unavailable" },
  }),
) => {
  const runtimeLayer = runtime ? Layer.succeed(CliRuntime, runtime) : CliRuntimeLive;

  return Layer.mergeAll(
    NodeServices.layer,
    runtimeLayer,
    Layer.succeed(CliCrashReporter, crashReporter),
    CliOutputLive.pipe(Layer.provide(runtimeLayer)),
    CliConfigLive.pipe(Layer.provide(runtimeLayer)),
    CliSdkLive,
    CliStateLive,
  );
};
