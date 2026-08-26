import { ConfigProvider, Effect, Redacted } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { makeCliAppLayer } from "./app-layer.js";
import {
  resolveCliAuthFlowConfig,
  resolveCliCredentialAuthConfig,
  resolveCliRuntimeConfig,
} from "./config.js";
import { makeCliRuntime } from "./runtime.js";

const withRuntime = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  env: ReadonlyArray<readonly [string, string]>,
  runtime = makeCliRuntime({
    homeDirectory: "/Users/tester",
    hostName: "putio-host",
  }),
) =>
  effect.pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromUnknown(Object.fromEntries(env)),
    ),
    Effect.provide(makeCliAppLayer(runtime)),
  );

describe("CliConfig", () => {
  it("resolves runtime config through the config service", async () => {
    const result = await Effect.runPromise(
      withRuntime(resolveCliRuntimeConfig(), [
        ["PUTIO_CLI_PROFILE", "devs-fe-auto"],
        ["PUTIO_CLI_TOKEN", "secret-token"],
        ["XDG_CONFIG_HOME", "/tmp/xdg"],
      ]),
    );

    expect(result).toEqual({
      apiBaseUrl: "https://api.put.io",
      configPath: "/tmp/xdg/putio/config.json",
      profile: "devs-fe-auto",
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

  it("resolves credential login config as redacted values", async () => {
    const result = await Effect.runPromise(
      withRuntime(resolveCliCredentialAuthConfig(), [
        ["PUTIO_CLI_LOGIN_CLIENT_ID", "1234"],
        ["PUTIO_CLI_LOGIN_CLIENT_SECRET", "client-secret"],
        ["PUTIO_CLI_LOGIN_PASSWORD", "password"],
        ["PUTIO_CLI_LOGIN_TOTP_SECRET", "JBSWY3DPEHPK3PXP"],
        ["PUTIO_CLI_LOGIN_USERNAME", "devs-fe-auto"],
      ]),
    );

    expect(Redacted.value(result.clientId)).toBe("1234");
    expect(Redacted.value(result.clientSecret)).toBe("client-secret");
    expect(Redacted.value(result.password)).toBe("password");
    expect(Redacted.value(result.totpSecret)).toBe("JBSWY3DPEHPK3PXP");
    expect(Redacted.value(result.username)).toBe("devs-fe-auto");
    expect(String(result.password)).toBe("<redacted>");
  });

  it("fails closed when credential login config is incomplete", async () => {
    await expect(
      Effect.runPromise(
        withRuntime(resolveCliCredentialAuthConfig(), [["PUTIO_CLI_LOGIN_CLIENT_ID", "1234"]]),
      ),
    ).rejects.toThrow("Unable to resolve credential login configuration.");
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
