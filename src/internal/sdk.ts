import {
  createPutioSdkEffectClient,
  makePutioSdkLiveLayer,
  type PutioSdkContext,
} from "@putdotio/sdk";
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
  ) => Effect.Effect<A, E, Exclude<R, PutioSdkContext>>;
};

export class CliSdk extends Context.Service<CliSdk, CliSdkService>()("@putdotio/cli/CliSdk") {}

const makeCliSdk = (): CliSdkService => ({
  client: sdk,
  provide: (config, program) =>
    program.pipe(
      Effect.provide(
        makePutioSdkLiveLayer({
          accessToken: config.token,
          baseUrl: config.apiBaseUrl,
        }),
      ),
    ),
});

export const CliSdkLive = Layer.succeed(CliSdk, makeCliSdk());

export const provideSdk = <A, E, R>(
  config: {
    readonly token?: string;
    readonly apiBaseUrl?: string;
  },
  program: Effect.Effect<A, E, R>,
) => Effect.flatMap(CliSdk, (cliSdk) => cliSdk.provide(config, program));
