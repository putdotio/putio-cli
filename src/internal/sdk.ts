import { FetchHttpClient } from "@effect/platform";
import { createPutioSdkEffectClient, makePutioSdkLayer } from "@putdotio/sdk";
import { Effect } from "effect";

export const sdk = createPutioSdkEffectClient();

export const provideSdk = <A, E, R>(
  config: {
    readonly token?: string;
    readonly apiBaseUrl?: string;
  },
  program: Effect.Effect<A, E, R>,
) =>
  program.pipe(
    Effect.provide(
      makePutioSdkLayer({
        accessToken: config.token,
        baseUrl: config.apiBaseUrl,
      }),
    ),
    Effect.provide(FetchHttpClient.layer),
  );
