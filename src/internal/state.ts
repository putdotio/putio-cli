import * as FileSystem from "@effect/platform/FileSystem";
import { SystemError } from "@effect/platform/Error";

import { DEFAULT_PUTIO_API_BASE_URL } from "@putdotio/sdk";
import { Context, Data, Effect, Layer, Schema } from "effect";

import { CONFIG_FILE_MODE } from "./constants.js";
import { resolveCliRuntimeConfig } from "./config.js";
import { CliRuntime } from "./runtime.js";

const NonEmptyStringSchema = Schema.String.pipe(
  Schema.filter((value): value is string => value.length > 0, {
    message: () => "Expected a non-empty string",
  }),
);

export const PutioCliConfigSchema = Schema.Struct({
  api_base_url: NonEmptyStringSchema,
  auth_token: Schema.optional(NonEmptyStringSchema),
});

export type PutioCliConfig = Schema.Schema.Type<typeof PutioCliConfigSchema>;

export const ResolvedAuthStateSchema = Schema.Struct({
  apiBaseUrl: NonEmptyStringSchema,
  configPath: NonEmptyStringSchema,
  source: Schema.Literal("env", "config"),
  token: NonEmptyStringSchema,
});

export type ResolvedAuthState = Schema.Schema.Type<typeof ResolvedAuthStateSchema>;

export const AuthStatusSchema = Schema.Struct({
  apiBaseUrl: NonEmptyStringSchema,
  authenticated: Schema.Boolean,
  configPath: NonEmptyStringSchema,
  source: Schema.NullOr(Schema.Literal("env", "config")),
});

export type AuthStatus = Schema.Schema.Type<typeof AuthStatusSchema>;

export class AuthStateError extends Data.TaggedError("AuthStateError")<{
  readonly message: string;
}> {}

export type CliStateService = {
  readonly loadPersistedState: (
    configPath?: string,
  ) => Effect.Effect<PutioCliConfig | null, AuthStateError, FileSystem.FileSystem | CliRuntime>;
  readonly savePersistedState: (
    state: {
      readonly apiBaseUrl?: string;
      readonly token: string;
    },
    configPath?: string,
  ) => Effect.Effect<
    {
      readonly configPath: string;
      readonly state: PutioCliConfig;
    },
    AuthStateError,
    FileSystem.FileSystem | CliRuntime
  >;
  readonly clearPersistedState: (
    configPath?: string,
  ) => Effect.Effect<
    { readonly configPath: string },
    AuthStateError,
    FileSystem.FileSystem | CliRuntime
  >;
  readonly getAuthStatus: () => Effect.Effect<
    AuthStatus,
    AuthStateError,
    FileSystem.FileSystem | CliRuntime
  >;
  readonly resolveAuthState: () => Effect.Effect<
    ResolvedAuthState,
    AuthStateError,
    FileSystem.FileSystem | CliRuntime
  >;
};

export class CliState extends Context.Tag("@putdotio/cli/CliState")<CliState, CliStateService>() {}

const decodePersistedConfig = Schema.decodeUnknownSync(PutioCliConfigSchema);

const mapFileSystemError = (error: unknown, message: string): AuthStateError =>
  error instanceof AuthStateError
    ? error
    : new AuthStateError({
        message,
      });

const parsePersistedConfig = (raw: string): PutioCliConfig => {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    throw new AuthStateError({
      message: "Stored CLI config is not valid JSON.",
    });
  }

  try {
    return decodePersistedConfig(value);
  } catch {
    throw new AuthStateError({
      message: "Stored CLI config does not match the expected schema.",
    });
  }
};

const loadPersistedStateEffect = (
  configPath?: string,
): Effect.Effect<PutioCliConfig | null, AuthStateError, FileSystem.FileSystem | CliRuntime> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const effectiveConfigPath = configPath ?? (yield* resolveCliRuntimeConfig()).configPath;

    const rawConfig = yield* fs.readFileString(effectiveConfigPath, "utf8").pipe(
      Effect.catchIf(
        (error): error is SystemError =>
          error instanceof SystemError && error.reason === "NotFound",
        () => Effect.succeed(null),
      ),
      Effect.mapError((error) =>
        mapFileSystemError(error, `Unable to read CLI config at ${effectiveConfigPath}.`),
      ),
    );

    if (rawConfig === null) {
      return null;
    }

    return yield* Effect.try({
      try: () => parsePersistedConfig(rawConfig),
      catch: (error) =>
        mapFileSystemError(error, `Unable to read CLI config at ${effectiveConfigPath}.`),
    });
  });

const savePersistedStateEffect = (
  state: {
    readonly apiBaseUrl?: string;
    readonly token: string;
  },
  configPath?: string,
): Effect.Effect<
  {
    readonly configPath: string;
    readonly state: PutioCliConfig;
  },
  AuthStateError,
  FileSystem.FileSystem | CliRuntime
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const runtime = yield* CliRuntime;
    const effectiveConfigPath = configPath ?? (yield* resolveCliRuntimeConfig()).configPath;
    const existingConfig = yield* loadPersistedStateEffect(effectiveConfigPath);
    const persistedState: PutioCliConfig = {
      api_base_url: state.apiBaseUrl ?? existingConfig?.api_base_url ?? DEFAULT_PUTIO_API_BASE_URL,
      auth_token: state.token,
    };

    yield* fs
      .makeDirectory(runtime.dirname(effectiveConfigPath), { recursive: true })
      .pipe(
        Effect.mapError((error) =>
          mapFileSystemError(error, `Unable to write CLI config to ${effectiveConfigPath}.`),
        ),
      );
    yield* fs
      .writeFileString(effectiveConfigPath, `${JSON.stringify(persistedState, null, 2)}\n`)
      .pipe(
        Effect.mapError((error) =>
          mapFileSystemError(error, `Unable to write CLI config to ${effectiveConfigPath}.`),
        ),
      );
    yield* fs
      .chmod(effectiveConfigPath, CONFIG_FILE_MODE)
      .pipe(
        Effect.mapError((error) =>
          mapFileSystemError(error, `Unable to write CLI config to ${effectiveConfigPath}.`),
        ),
      );

    return {
      configPath: effectiveConfigPath,
      state: persistedState,
    };
  });

const clearPersistedStateEffect = (
  configPath?: string,
): Effect.Effect<
  { readonly configPath: string },
  AuthStateError,
  FileSystem.FileSystem | CliRuntime
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const runtime = yield* CliRuntime;
    const effectiveConfigPath = configPath ?? (yield* resolveCliRuntimeConfig()).configPath;
    const existingConfig = yield* loadPersistedStateEffect(effectiveConfigPath);

    if (existingConfig && existingConfig.api_base_url !== DEFAULT_PUTIO_API_BASE_URL) {
      const nextConfig: PutioCliConfig = {
        api_base_url: existingConfig.api_base_url,
      };

      yield* fs
        .makeDirectory(runtime.dirname(effectiveConfigPath), { recursive: true })
        .pipe(
          Effect.mapError((error) =>
            mapFileSystemError(error, `Unable to clear CLI auth state at ${effectiveConfigPath}.`),
          ),
        );
      yield* fs
        .writeFileString(effectiveConfigPath, `${JSON.stringify(nextConfig, null, 2)}\n`)
        .pipe(
          Effect.mapError((error) =>
            mapFileSystemError(error, `Unable to clear CLI auth state at ${effectiveConfigPath}.`),
          ),
        );
      yield* fs
        .chmod(effectiveConfigPath, CONFIG_FILE_MODE)
        .pipe(
          Effect.mapError((error) =>
            mapFileSystemError(error, `Unable to clear CLI auth state at ${effectiveConfigPath}.`),
          ),
        );
    } else {
      yield* fs
        .remove(effectiveConfigPath, { force: true })
        .pipe(
          Effect.mapError((error) =>
            mapFileSystemError(error, `Unable to clear CLI auth state at ${effectiveConfigPath}.`),
          ),
        );
    }

    return { configPath: effectiveConfigPath };
  });

const getAuthStatusEffect = (): Effect.Effect<
  AuthStatus,
  AuthStateError,
  FileSystem.FileSystem | CliRuntime
> =>
  Effect.gen(function* () {
    const runtime = yield* resolveCliRuntimeConfig();

    if (runtime.token) {
      return {
        authenticated: true as const,
        source: "env" as const,
        apiBaseUrl: runtime.apiBaseUrl,
        configPath: runtime.configPath,
      };
    }

    const state = yield* loadPersistedStateEffect(runtime.configPath);

    return state === null
      ? {
          authenticated: false as const,
          source: null,
          apiBaseUrl: runtime.apiBaseUrl,
          configPath: runtime.configPath,
        }
      : {
          authenticated: typeof state.auth_token === "string" ? (true as const) : (false as const),
          source: typeof state.auth_token === "string" ? ("config" as const) : null,
          apiBaseUrl: state.api_base_url,
          configPath: runtime.configPath,
        };
  });

const resolveAuthStateEffect = (): Effect.Effect<
  ResolvedAuthState,
  AuthStateError,
  FileSystem.FileSystem | CliRuntime
> =>
  Effect.gen(function* () {
    const runtime = yield* resolveCliRuntimeConfig();

    if (runtime.token) {
      return {
        token: runtime.token,
        apiBaseUrl: runtime.apiBaseUrl,
        source: "env" as const,
        configPath: runtime.configPath,
      };
    }

    const state = yield* loadPersistedStateEffect(runtime.configPath);

    if (state === null || typeof state.auth_token !== "string") {
      return yield* Effect.fail(
        new AuthStateError({
          message: "No put.io token is configured. Set PUTIO_CLI_TOKEN or run `putio auth login`.",
        }),
      );
    }

    return {
      token: state.auth_token,
      apiBaseUrl: state.api_base_url,
      source: "config" as const,
      configPath: runtime.configPath,
    };
  });

const makeCliState = (): CliStateService => ({
  clearPersistedState: clearPersistedStateEffect,
  getAuthStatus: getAuthStatusEffect,
  loadPersistedState: loadPersistedStateEffect,
  resolveAuthState: resolveAuthStateEffect,
  savePersistedState: savePersistedStateEffect,
});

export const CliStateLive = Layer.sync(CliState, makeCliState);

export const loadPersistedState = (configPath?: string) =>
  Effect.flatMap(CliState, (state) => state.loadPersistedState(configPath));

export const savePersistedState = (
  state: {
    readonly apiBaseUrl?: string;
    readonly token: string;
  },
  configPath?: string,
) => Effect.flatMap(CliState, (cliState) => cliState.savePersistedState(state, configPath));

export const clearPersistedState = (configPath?: string) =>
  Effect.flatMap(CliState, (state) => state.clearPersistedState(configPath));

export const getAuthStatus = () => Effect.flatMap(CliState, (state) => state.getAuthStatus());

export const resolveAuthState = () => Effect.flatMap(CliState, (state) => state.resolveAuthState());
