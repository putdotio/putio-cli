import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NodeContext } from "@effect/platform-node";
import * as NodeTerminal from "@effect/platform-node/NodeTerminal";
import { ConfigProvider, Effect, Layer } from "effect";

import { runCli as executeCli } from "../cli.js";
import { CliOutputLive } from "../internal/output-service.js";
import { CliRuntime, makeCliRuntime } from "../internal/runtime.js";

export const runCliInTest = async (argv: ReadonlyArray<string>) => {
  const processArgv = ["node", "putio", ...argv.slice(1)];
  const configDir = await mkdtemp(join(tmpdir(), "putio-cli-test-"));
  const configPath = join(configDir, "config.json");

  return Effect.runPromise(
    Effect.scoped(
      executeCli(processArgv).pipe(
        Effect.withConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["PUTIO_CLI_CONFIG_PATH", configPath],
              ["XDG_CONFIG_HOME", configDir],
            ]),
          ),
        ),
        Effect.provideService(
          CliRuntime,
          makeCliRuntime({
            argv: processArgv,
            homeDirectory: configDir,
          }),
        ),
        Effect.provide(Layer.mergeAll(NodeContext.layer, NodeTerminal.layer, CliOutputLive)),
      ),
    ),
  );
};
