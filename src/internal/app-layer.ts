import { NodeServices } from "@effect/platform-node";
import { Layer } from "effect";

import { CliConfigLive } from "./config.js";
import { CrashReportingDisabledLive } from "./crash-reporting.js";
import { CliOutputLive } from "./output-service.js";
import { CliRuntime, CliRuntimeLive, type CliRuntimeService } from "./runtime.js";
import { CliSdkLive } from "./sdk.js";
import { CliStateLive } from "./state.js";

export const CliServicesLive = Layer.mergeAll(
  NodeServices.layer,
  CliOutputLive,
  CliConfigLive,
  CliSdkLive,
  CliStateLive,
);

export const CliAppLive = CliServicesLive.pipe(Layer.provideMerge(CliRuntimeLive));

export const makeCliAppLayer = (runtime?: CliRuntimeService) =>
  CliServicesLive.pipe(
    Layer.provideMerge(runtime ? Layer.succeed(CliRuntime, runtime) : CliRuntimeLive),
    Layer.merge(CrashReportingDisabledLive),
  );
