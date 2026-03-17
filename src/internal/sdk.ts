import { FetchHttpClient } from "@effect/platform";
import { createPutioSdkEffectClient, makePutioSdkLayer } from "@putdotio/sdk";
import { Context, Effect, Layer } from "effect";

export type CliSdkClient = ReturnType<typeof createPutioSdkEffectClient>;

export const sdk = createPutioSdkEffectClient();

export type CliSdkService = {
  readonly client: CliSdkClient;
  readonly provide: <A, E, R>(
    config: {
      readonly token?: string;
      readonly apiBaseUrl?: string;
    },
    program: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>;
};

export class CliSdk extends Context.Tag("@putdotio/cli/CliSdk")<CliSdk, CliSdkService>() {}

const makeCliSdk = (): CliSdkService => ({
  client: sdk,
  provide: (config, program) =>
    program.pipe(
      Effect.provide(
        makePutioSdkLayer({
          accessToken: config.token,
          baseUrl: config.apiBaseUrl,
        }),
      ),
    ),
});

export const CliSdkLive = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(CliSdk, makeCliSdk()),
);

export const provideSdk = <A, E, R>(
  config: {
    readonly token?: string;
    readonly apiBaseUrl?: string;
  },
  program: Effect.Effect<A, E, R>,
) => Effect.flatMap(CliSdk, (cliSdk) => cliSdk.provide(config, program));
