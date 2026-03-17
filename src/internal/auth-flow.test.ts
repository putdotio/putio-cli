import { ConfigProvider, Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUTIO_CLI_APP_ID } from "./constants.js";
import {
  buildDeviceLinkUrl,
  openBrowser,
  resolveAuthFlowConfig,
  waitForDeviceToken,
} from "./auth-flow.js";
import type { CliRuntime as CliRuntimeService } from "./runtime.js";
import { CliRuntime, makeCliRuntime } from "./runtime.js";

const mockRuntime: CliRuntimeService = {
  argv: ["node", "putio"],
  dirname: (path) => path,
  getHomeDirectory: Effect.succeed("/tmp"),
  getHostname: Effect.succeed("putio-host"),
  isInteractiveTerminal: false,
  joinPath: (...segments) => segments.join("/"),
  openExternal: (_url) => Effect.succeed(true),
  setExitCode: (_code) => Effect.void,
  startSpinner: (_message) =>
    Effect.succeed({
      stop: Effect.void,
    }),
};

describe("resolveAuthFlowConfig", () => {
  it("uses the built-in official app id and sensible defaults", async () => {
    const result = await Effect.runPromise(
      resolveAuthFlowConfig().pipe(
        Effect.provideService(CliRuntime, makeCliRuntime({ hostName: "cli-test-host" })),
      ),
    );

    expect(result.appId).toBe(PUTIO_CLI_APP_ID);
    expect(result.clientName.length).toBeGreaterThan(0);
    expect(result.webAppUrl).toBe("https://app.put.io");
  });

  it("uses env overrides for client name and web app url", async () => {
    const result = await Effect.runPromise(
      resolveAuthFlowConfig().pipe(
        Effect.withConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["PUTIO_CLI_CLIENT_NAME", "putio-cli-test"],
              ["PUTIO_CLI_WEB_APP_URL", "https://app.put.io"],
            ]),
          ),
        ),
        Effect.provideService(CliRuntime, makeCliRuntime({ hostName: "cli-test-host" })),
      ),
    );

    expect(result.appId).toBe(PUTIO_CLI_APP_ID);
    expect(result.clientName).toBe("putio-cli-test");
    expect(result.webAppUrl).toBe("https://app.put.io");
  });
});

describe("buildDeviceLinkUrl", () => {
  it("builds a put.io link URL with the device code", () => {
    expect(buildDeviceLinkUrl("ABCD1234")).toBe("https://app.put.io/link?code=ABCD1234");
  });
});

describe("openBrowser", () => {
  it("delegates to the runtime service", async () => {
    await expect(
      Effect.runPromise(
        openBrowser("https://app.put.io/link?code=ABCD1234").pipe(
          Effect.provideService(CliRuntime, mockRuntime),
        ),
      ),
    ).resolves.toBe(true);
  });
});

describe("waitForDeviceToken", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the token once polling succeeds", async () => {
    let attempts = 0;

    const promise = Effect.runPromise(
      waitForDeviceToken({
        code: "ABCD1234",
        pollIntervalMs: 1_000,
        timeoutMs: 5_000,
        checkCodeMatch: () => {
          attempts += 1;
          return Effect.succeed(attempts >= 2 ? "token-123" : null);
        },
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(promise).resolves.toBe("token-123");
    expect(attempts).toBe(2);
  });

  it("fails with a timeout error when authorization never completes", async () => {
    const resultPromise = Effect.runPromise(
      Effect.either(
        waitForDeviceToken({
          code: "ABCD1234",
          pollIntervalMs: 1_000,
          timeoutMs: 2_000,
          checkCodeMatch: () => Effect.succeed(null),
        }),
      ),
    );

    await vi.advanceTimersByTimeAsync(3_000);

    const result = await resultPromise;

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left.message).toBe("Timed out waiting for device authorization to complete.");
    }
  });

  it("fails with a polling error when the backend check fails", async () => {
    const result = await Effect.runPromise(
      Effect.either(
        waitForDeviceToken({
          code: "ABCD1234",
          checkCodeMatch: () => Effect.fail(new Error("boom")),
        }),
      ),
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left.message).toBe(
        "Unable to poll put.io for the device authorization result.",
      );
    }
  });
});
