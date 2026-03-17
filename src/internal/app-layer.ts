import { NodeContext } from "@effect/platform-node";
import * as NodeTerminal from "@effect/platform-node/NodeTerminal";
import { Layer } from "effect";

import { CliConfigLive } from "./config.js";
import { CliOutputLive } from "./output-service.js";
import { CliRuntime, CliRuntimeLive, type CliRuntimeService } from "./runtime.js";
import { CliSdkLive } from "./sdk.js";

export const makeCliAppLayer = (runtime?: CliRuntimeService) => {
  const runtimeLayer = runtime ? Layer.succeed(CliRuntime, runtime) : CliRuntimeLive;

  return Layer.mergeAll(
    NodeContext.layer,
    NodeTerminal.layer,
    runtimeLayer,
    CliOutputLive.pipe(Layer.provide(runtimeLayer)),
    CliConfigLive.pipe(Layer.provide(runtimeLayer)),
    CliSdkLive,
  );
};
