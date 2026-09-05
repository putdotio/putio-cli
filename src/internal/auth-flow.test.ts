import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

import { makeCliAppLayer } from "./app-layer.js";
import { PUTIO_CLI_APP_ID } from "./constants.js";
import {
  buildDeviceLinkUrl,
  openBrowser,
  resolveAuthFlowConfig,
  waitForDeviceToken,
} from "./auth-flow.js";
import { CliRuntime, makeCliRuntime, type CliRuntimeService } from "./runtime.js";

const mockRuntime: CliRuntimeService = {
  argv: ["node", "putio"],
  dirname: (path) => path,
  getHomeDirectory: Effect.succeed("/tmp"),
  getHostname: Effect.succeed("putio-host"),
  isInteractiveTerminal: false,
  joinPath: (...segments) => segments.join("/"),
  openExternal: (_url) => Effect.succeed(true),
  setExitCode: (_code) => Effect.void,
  writeStdout: (_message) => Effect.void,
  writeStderr: (_message) => Effect.void,
  startSpinner: (_message) =>
    Effect.succeed({
      stop: Effect.void,
    }),
};

describe("resolveAuthFlowConfig", () => {
  it.effect("uses the built-in CLI app id and sensible defaults", () =>
    Effect.gen(function* () {
      const result = yield* resolveAuthFlowConfig().pipe(
        Effect.provide(makeCliAppLayer(makeCliRuntime({ hostName: "cli-test-host" }))),
      );

      assert.strictEqual(result.appId, PUTIO_CLI_APP_ID);
      assert.isAbove(result.clientName.length, 0);
      assert.strictEqual(result.webAppUrl, "https://app.put.io");
    }),
  );

  it.effect("uses env overrides for client name and web app url", () =>
    Effect.gen(function* () {
      const result = yield* resolveAuthFlowConfig().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            PUTIO_CLI_CLIENT_NAME: "putio-cli-test",
            PUTIO_CLI_WEB_APP_URL: "https://app.put.io",
          }),
        ),
        Effect.provide(makeCliAppLayer(makeCliRuntime({ hostName: "cli-test-host" }))),
      );

      assert.strictEqual(result.appId, PUTIO_CLI_APP_ID);
      assert.strictEqual(result.clientName, "putio-cli-test");
      assert.strictEqual(result.webAppUrl, "https://app.put.io");
    }),
  );
});

describe("buildDeviceLinkUrl", () => {
  it("builds a put.io link URL with the device code", () => {
    assert.strictEqual(buildDeviceLinkUrl("ABCD1234"), "https://app.put.io/link?code=ABCD1234");
  });
});

describe("openBrowser", () => {
  it.effect("delegates to the runtime service", () =>
    Effect.gen(function* () {
      const opened = yield* openBrowser("https://app.put.io/link?code=ABCD1234").pipe(
        Effect.provideService(CliRuntime, mockRuntime),
      );

      assert.isTrue(opened);
    }),
  );
});

describe("waitForDeviceToken", () => {
  it.effect("returns the token once polling succeeds", () =>
    Effect.gen(function* () {
      let attempts = 0;

      const fiber = yield* Effect.forkChild(
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

      yield* Effect.yieldNow;
      yield* TestClock.adjust(1_000);

      assert.strictEqual(yield* Fiber.join(fiber), "token-123");
      assert.strictEqual(attempts, 2);
    }),
  );

  it.effect("fails with a timeout error when authorization never completes", () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        Effect.result(
          waitForDeviceToken({
            code: "ABCD1234",
            pollIntervalMs: 1_000,
            timeoutMs: 2_000,
            checkCodeMatch: () => Effect.succeed(null),
          }),
        ),
      );

      yield* Effect.yieldNow;
      yield* TestClock.adjust(3_000);

      const result = yield* Fiber.join(fiber);

      assert.strictEqual(result._tag, "Failure");
      if (result._tag === "Failure") {
        assert.strictEqual(
          result.failure.message,
          "Timed out waiting for device authorization to complete.",
        );
      }
    }),
  );

  it.effect("interrupts a pending poll when the deadline expires", () =>
    Effect.gen(function* () {
      let interrupted = false;
      const fiber = yield* Effect.forkChild(
        Effect.result(
          waitForDeviceToken({
            code: "fixture-code",
            timeoutMs: 100,
            checkCodeMatch: () =>
              Effect.never.pipe(
                Effect.onInterrupt(() =>
                  Effect.sync(() => {
                    interrupted = true;
                  }),
                ),
              ),
          }),
        ),
      );
      yield* TestClock.adjust(100);
      assert.isDefined(fiber.pollUnsafe());
      const result = yield* Fiber.join(fiber);
      assert.isTrue(interrupted);
      assert.strictEqual(result._tag, "Failure");
      if (result._tag === "Failure")
        assert.strictEqual(
          result.failure.message,
          "Timed out waiting for device authorization to complete.",
        );
    }),
  );

  it.effect("does not wait out a polling interval beyond the deadline", () =>
    Effect.gen(function* () {
      let attempts = 0;
      const fiber = yield* Effect.forkChild(
        Effect.result(
          waitForDeviceToken({
            code: "fixture-code",
            timeoutMs: 100,
            pollIntervalMs: 5_000,
            checkCodeMatch: () =>
              Effect.sync(() => {
                attempts++;
                return null;
              }),
          }),
        ),
      );
      yield* TestClock.adjust(100);
      assert.isDefined(fiber.pollUnsafe());
      const result = yield* Fiber.join(fiber);
      assert.strictEqual(attempts, 1);
      assert.strictEqual(result._tag, "Failure");
    }),
  );

  it.effect("fails with a polling error when the backend check fails", () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(
        waitForDeviceToken({
          code: "ABCD1234",
          checkCodeMatch: () => Effect.fail(new Error("boom")),
        }),
      );

      assert.strictEqual(result._tag, "Failure");
      if (result._tag === "Failure") {
        assert.strictEqual(
          result.failure.message,
          "Unable to poll put.io for the device authorization result.",
        );
      }
    }),
  );
});
