import { DEFAULT_PUTIO_API_BASE_URL, DEFAULT_PUTIO_WEB_APP_URL } from "@putdotio/sdk";
import { Config, Context, Effect, Layer, Option, Schema } from "effect";

import { PUTIO_CLI_APP_ID } from "./constants.js";
import {
  ENV_API_BASE_URL,
  ENV_CLI_CLIENT_NAME,
  ENV_CLI_CONFIG_PATH,
  ENV_CLI_TOKEN,
  ENV_CLI_WEB_APP_URL,
  ENV_XDG_CONFIG_HOME,
} from "./env.js";
import { CliRuntime, type CliRuntimeService } from "./runtime.js";

const NonEmptyStringSchema = Schema.String.pipe(
  Schema.filter((value): value is string => value.length > 0, {
    message: () => "Expected a non-empty string",
  }),
);

const PutioCliAuthFlowConfigSchema = Schema.Struct({
  appId: NonEmptyStringSchema,
  clientName: NonEmptyStringSchema,
  webAppUrl: NonEmptyStringSchema,
});

type PutioCliAuthFlowConfig = Schema.Schema.Type<typeof PutioCliAuthFlowConfigSchema>;

export type CliRuntimeConfig = {
  readonly apiBaseUrl: string;
  readonly configPath: string;
  readonly token: string | undefined;
};

export type CliConfigService = {
  readonly authFlowConfig: Effect.Effect<PutioCliAuthFlowConfig>;
  readonly runtimeConfig: Effect.Effect<CliRuntimeConfig>;
};

export class CliConfig extends Context.Tag("@putdotio/cli/CliConfig")<
  CliConfig,
  CliConfigService
>() {}

const optionalTrimmedString = (name: string) =>
  Config.option(Config.string(name)).pipe(
    Config.map((value) =>
      Option.flatMap(value, (raw) => {
        const trimmed = raw.trim();

        return trimmed.length > 0 ? Option.some(trimmed) : Option.none();
      }),
    ),
  );

export const buildConfigPath = (input: {
  readonly explicitConfigPath?: string;
  readonly xdgConfigHome?: string;
  readonly homePath: string;
  readonly joinPath: (...segments: ReadonlyArray<string>) => string;
}) =>
  input.explicitConfigPath
    ? input.explicitConfigPath
    : input.xdgConfigHome
      ? input.joinPath(input.xdgConfigHome, "putio", "config.json")
      : input.joinPath(input.homePath, ".config", "putio", "config.json");

const decodeAuthFlowConfig = Schema.decodeUnknownSync(PutioCliAuthFlowConfigSchema);

const makeCliConfig = (runtime: CliRuntimeService): CliConfigService => ({
  authFlowConfig: Effect.gen(function* () {
    const hostName = yield* runtime.getHostname;
    const value = yield* Config.all({
      appId: Config.succeed(PUTIO_CLI_APP_ID),
      clientName: optionalTrimmedString(ENV_CLI_CLIENT_NAME).pipe(
        Config.map((option) => Option.getOrElse(option, () => `putio-cli@${hostName}`)),
      ),
      webAppUrl: optionalTrimmedString(ENV_CLI_WEB_APP_URL).pipe(
        Config.map((option) => Option.getOrElse(option, () => DEFAULT_PUTIO_WEB_APP_URL)),
      ),
    });

    return decodeAuthFlowConfig(value);
  }).pipe(Effect.orDie),
  runtimeConfig: Effect.gen(function* () {
    const homePath = yield* runtime.getHomeDirectory;
    const apiBaseUrl = yield* optionalTrimmedString(ENV_API_BASE_URL).pipe(
      Config.map((value) => Option.getOrElse(value, () => DEFAULT_PUTIO_API_BASE_URL)),
    );
    const token = yield* optionalTrimmedString(ENV_CLI_TOKEN);
    const explicitConfigPath = yield* optionalTrimmedString(ENV_CLI_CONFIG_PATH);
    const xdgConfigHome = yield* optionalTrimmedString(ENV_XDG_CONFIG_HOME);

    return {
      apiBaseUrl,
      configPath: buildConfigPath({
        explicitConfigPath: Option.getOrUndefined(explicitConfigPath),
        xdgConfigHome: Option.getOrUndefined(xdgConfigHome),
        homePath,
        joinPath: runtime.joinPath,
      }),
      token: Option.getOrUndefined(token),
    } satisfies CliRuntimeConfig;
  }).pipe(Effect.orDie),
});

export const CliConfigLive = Layer.effect(CliConfig, Effect.map(CliRuntime, makeCliConfig));

export const resolveCliRuntimeConfig = () =>
  Effect.flatMap(CliConfig, (config) => config.runtimeConfig);

export const resolveCliAuthFlowConfig = () =>
  Effect.flatMap(CliConfig, (config) => config.authFlowConfig);
