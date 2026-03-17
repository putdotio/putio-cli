import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ConfigProvider, Effect } from "effect";

import { runCli as executeCli } from "../cli.js";
import { makeCliAppLayer } from "../internal/app-layer.js";
import { makeCliRuntime } from "../internal/runtime.js";

export const runCliInTest = async (
  argv: ReadonlyArray<string>,
  options: {
    readonly isInteractiveTerminal?: boolean;
  } = {},
) => {
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
        Effect.provide(
          makeCliAppLayer(
            makeCliRuntime({
              argv: processArgv,
              homeDirectory: configDir,
              isInteractiveTerminal: options.isInteractiveTerminal,
            }),
          ),
        ),
      ),
    ),
  );
};
