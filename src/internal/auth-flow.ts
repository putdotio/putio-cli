import { DEFAULT_PUTIO_WEB_APP_URL } from "@putdotio/sdk";
import { Clock, Data, Duration, Effect } from "effect";

export { resolveCliAuthFlowConfig as resolveAuthFlowConfig } from "./config.js";
import { CliRuntime } from "./runtime.js";

class PutioCliAuthFlowError extends Data.TaggedError("PutioCliAuthFlowError")<{
  readonly message: string;
}> {}

export const buildDeviceLinkUrl = (code: string, webAppUrl: string = DEFAULT_PUTIO_WEB_APP_URL) => {
  const url = new URL("/link", webAppUrl);
  url.searchParams.set("code", code);

  return url.toString();
};

export const openBrowser = (url: string): Effect.Effect<boolean, never, CliRuntime> =>
  Effect.flatMap(CliRuntime, (runtime) => runtime.openExternal(url));

export const waitForDeviceToken = (options: {
  readonly code: string;
  readonly checkCodeMatch: (code: string) => Effect.Effect<string | null, unknown, never>;
  readonly pollIntervalMs?: number;
  readonly timeoutMs?: number;
}): Effect.Effect<string, PutioCliAuthFlowError, never> =>
  Effect.gen(function* () {
    const pollIntervalMs = options.pollIntervalMs ?? 2_000;
    const timeoutMs = options.timeoutMs ?? 120_000;
    const startedAt = yield* Clock.currentTimeMillis;
    const deadline = startedAt + timeoutMs;

    while (true) {
      const token = yield* options.checkCodeMatch(options.code).pipe(
        Effect.mapError(
          () =>
            new PutioCliAuthFlowError({
              message: "Unable to poll put.io for the device authorization result.",
            }),
        ),
      );

      if (typeof token === "string" && token.length > 0) {
        return token;
      }

      if ((yield* Clock.currentTimeMillis) >= deadline) {
        return yield* Effect.fail(
          new PutioCliAuthFlowError({
            message: "Timed out waiting for device authorization to complete.",
          }),
        );
      }

      yield* Effect.sleep(Duration.millis(pollIntervalMs));
    }
  });
