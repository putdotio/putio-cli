import { ConfigProvider, Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { makeCliAppLayer } from "./app-layer.js";
import { resolveCliAuthFlowConfig, resolveCliRuntimeConfig } from "./config.js";
import { makeCliRuntime } from "./runtime.js";

const withRuntime = (
  effect: Effect.Effect<unknown, unknown, never>,
  env: ReadonlyArray<readonly [string, string]>,
  runtime = makeCliRuntime({
    homeDirectory: "/Users/tester",
    hostName: "putio-host",
  }),
) =>
  effect.pipe(
    Effect.withConfigProvider(ConfigProvider.fromMap(new Map(env))),
    Effect.provide(makeCliAppLayer(runtime)),
  );

describe("CliConfig", () => {
  it("resolves runtime config through the config service", async () => {
    const result = await Effect.runPromise(
      withRuntime(resolveCliRuntimeConfig(), [
        ["PUTIO_CLI_TOKEN", "secret-token"],
        ["XDG_CONFIG_HOME", "/tmp/xdg"],
      ]),
    );

    expect(result).toEqual({
      apiBaseUrl: "https://api.put.io",
      configPath: "/tmp/xdg/putio/config.json",
      token: "secret-token",
    });
  });

  it("resolves auth flow config through the config service", async () => {
    const result = await Effect.runPromise(
      withRuntime(resolveCliAuthFlowConfig(), [
        ["PUTIO_CLI_CLIENT_NAME", "putio-cli-test"],
        ["PUTIO_CLI_WEB_APP_URL", "https://app.put.io/custom"],
      ]),
    );

    expect(result).toEqual({
      appId: "8993",
      clientName: "putio-cli-test",
      webAppUrl: "https://app.put.io/custom",
    });
  });

  it("falls back to host-derived defaults when auth flow env is missing", async () => {
    const result = await Effect.runPromise(withRuntime(resolveCliAuthFlowConfig(), []));

    expect(result).toEqual({
      appId: "8993",
      clientName: "putio-cli@putio-host",
      webAppUrl: "https://app.put.io",
    });
  });

  it("fails with a tagged config error when the API base URL is invalid", async () => {
    await expect(
      Effect.runPromise(
        withRuntime(resolveCliRuntimeConfig(), [["PUTIO_CLI_API_BASE_URL", "not-a-url"]]),
      ),
    ).rejects.toThrow("Unable to resolve the CLI runtime configuration.");
  });

  it("fails with a tagged config error when the web app URL is invalid", async () => {
    await expect(
      Effect.runPromise(
        withRuntime(resolveCliAuthFlowConfig(), [["PUTIO_CLI_WEB_APP_URL", "bad-url"]]),
      ),
    ).rejects.toThrow("Unable to resolve the CLI auth flow configuration.");
  });
});
