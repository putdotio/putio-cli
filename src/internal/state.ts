import * as FileSystem from "effect/FileSystem";
import { PlatformError, SystemError } from "effect/PlatformError";

import { DEFAULT_PUTIO_API_BASE_URL } from "@putdotio/sdk";
import { Context, Data, Effect, Layer, Schema } from "effect";

import { normalizeAuthProfileName } from "./auth-profile.js";
import { CONFIG_FILE_MODE } from "./constants.js";
import { CliConfig, resolveCliRuntimeConfig } from "./config.js";
import { CliRuntime } from "./runtime.js";

const NonEmptyStringSchema = Schema.String.check(Schema.isNonEmpty());

export const PutioCliProfileConfigSchema = Schema.Struct({
  api_base_url: Schema.optional(NonEmptyStringSchema),
  auth_token: Schema.optional(NonEmptyStringSchema),
});

export type PutioCliProfileConfig = Schema.Schema.Type<typeof PutioCliProfileConfigSchema>;

export const PutioCliConfigSchema = Schema.Struct({
  api_base_url: NonEmptyStringSchema,
  auth_token: Schema.optional(NonEmptyStringSchema),
  default_profile: Schema.optional(NonEmptyStringSchema),
  profiles: Schema.optional(Schema.Record(Schema.String, PutioCliProfileConfigSchema)),
});

export type PutioCliConfig = Schema.Schema.Type<typeof PutioCliConfigSchema>;

export const ResolvedAuthStateSchema = Schema.Struct({
  apiBaseUrl: NonEmptyStringSchema,
  configPath: NonEmptyStringSchema,
  profile: Schema.NullOr(NonEmptyStringSchema),
  source: Schema.Literals(["env", "config", "profile"] as const),
  token: NonEmptyStringSchema,
});

export type ResolvedAuthState = Schema.Schema.Type<typeof ResolvedAuthStateSchema>;

export const AuthStatusSchema = Schema.Struct({
  apiBaseUrl: NonEmptyStringSchema,
  authenticated: Schema.Boolean,
  configPath: NonEmptyStringSchema,
  defaultProfile: Schema.NullOr(NonEmptyStringSchema),
  profile: Schema.NullOr(NonEmptyStringSchema),
  source: Schema.NullOr(Schema.Literals(["env", "config", "profile"] as const)),
});

export type AuthStatus = Schema.Schema.Type<typeof AuthStatusSchema>;

export const AuthProfileSummarySchema = Schema.Struct({
  apiBaseUrl: NonEmptyStringSchema,
  authenticated: Schema.Boolean,
  current: Schema.Boolean,
  name: NonEmptyStringSchema,
});

export type AuthProfileSummary = Schema.Schema.Type<typeof AuthProfileSummarySchema>;

export const AuthProfileListSchema = Schema.Struct({
  configPath: NonEmptyStringSchema,
  defaultProfile: Schema.NullOr(NonEmptyStringSchema),
  profiles: Schema.Array(AuthProfileSummarySchema),
});

export type AuthProfileList = Schema.Schema.Type<typeof AuthProfileListSchema>;

export class AuthStateError extends Data.TaggedError("AuthStateError")<{
  readonly message: string;
}> {}

type AuthProfileSelection = {
  readonly profile?: string;
};

export type CliStateService = {
  readonly loadPersistedState: (
    configPath?: string,
  ) => Effect.Effect<
    PutioCliConfig | null,
    AuthStateError,
    CliConfig | FileSystem.FileSystem | CliRuntime
  >;
  readonly savePersistedState: (
    state: {
      readonly apiBaseUrl?: string;
      readonly token: string;
    },
    configPath?: string,
    selection?: AuthProfileSelection,
  ) => Effect.Effect<
    {
      readonly configPath: string;
      readonly profile: string | null;
      readonly state: PutioCliConfig;
    },
    AuthStateError,
    CliConfig | FileSystem.FileSystem | CliRuntime
  >;
  readonly clearPersistedState: (
    configPath?: string,
    selection?: AuthProfileSelection,
  ) => Effect.Effect<
    { readonly configPath: string; readonly profile: string | null },
    AuthStateError,
    CliConfig | FileSystem.FileSystem | CliRuntime
  >;
  readonly listProfiles: () => Effect.Effect<
    AuthProfileList,
    AuthStateError,
    CliConfig | FileSystem.FileSystem | CliRuntime
  >;
  readonly getAuthStatus: (
    selection?: AuthProfileSelection,
  ) => Effect.Effect<AuthStatus, AuthStateError, CliConfig | FileSystem.FileSystem | CliRuntime>;
  readonly removeProfile: (
    profile: string,
  ) => Effect.Effect<
    { readonly configPath: string; readonly profile: string; readonly removed: boolean },
    AuthStateError,
    CliConfig | FileSystem.FileSystem | CliRuntime
  >;
  readonly resolveAuthState: (
    selection?: AuthProfileSelection,
  ) => Effect.Effect<
    ResolvedAuthState,
    AuthStateError,
    CliConfig | FileSystem.FileSystem | CliRuntime
  >;
  readonly useProfile: (
    profile: string,
  ) => Effect.Effect<
    { readonly configPath: string; readonly profile: string },
    AuthStateError,
    CliConfig | FileSystem.FileSystem | CliRuntime
  >;
};

export class CliState extends Context.Service<CliState, CliStateService>()(
  "@putdotio/cli/CliState",
) {}

const decodePersistedConfig = Schema.decodeUnknownSync(PutioCliConfigSchema);

const mapFileSystemError = (error: unknown, message: string): AuthStateError =>
  error instanceof AuthStateError
    ? error
    : new AuthStateError({
        message,
      });

const resolveAuthRuntimeConfig = () =>
  resolveCliRuntimeConfig().pipe(
    Effect.mapError(
      (error) =>
        new AuthStateError({
          message: error.message,
        }),
    ),
  );

const profileErrorMessage = (profile: string) =>
  `Invalid auth profile \`${profile}\`. Profile names must start with a letter or number and may contain letters, numbers, dots, underscores, or hyphens.`;

const validateProfileName = (profile: string) => {
  const normalized = normalizeAuthProfileName(profile);

  if (normalized === null) {
    throw new AuthStateError({
      message: profileErrorMessage(profile),
    });
  }

  return normalized;
};

const validateOptionalProfileName = (profile: string | undefined) =>
  profile === undefined ? undefined : validateProfileName(profile);

const validatePersistedConfig = (state: PutioCliConfig) => {
  validateOptionalProfileName(state.default_profile);

  for (const name of Object.keys(state.profiles ?? {})) {
    validateProfileName(name);
  }

  return state;
};

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
    return validatePersistedConfig(decodePersistedConfig(value));
  } catch (error) {
    if (error instanceof AuthStateError) {
      throw error;
    }

    throw new AuthStateError({
      message: "Stored CLI config does not match the expected schema.",
    });
  }
};

const profileConfigApiBaseUrl = (state: PutioCliConfig, profile: PutioCliProfileConfig) =>
  profile.api_base_url ?? state.api_base_url;

const selectProfileName = (input: {
  readonly explicitProfile?: string;
  readonly runtimeProfile?: string;
  readonly state: PutioCliConfig | null;
}) =>
  validateOptionalProfileName(input.explicitProfile) ??
  validateOptionalProfileName(input.runtimeProfile) ??
  validateOptionalProfileName(input.state?.default_profile);

const shouldRemoveConfigFile = (state: PutioCliConfig) =>
  state.api_base_url === DEFAULT_PUTIO_API_BASE_URL &&
  state.auth_token === undefined &&
  state.default_profile === undefined &&
  Object.keys(state.profiles ?? {}).length === 0;

const persistConfigEffect = (
  effectiveConfigPath: string,
  state: PutioCliConfig,
  message: string,
): Effect.Effect<void, AuthStateError, FileSystem.FileSystem | CliRuntime> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const runtime = yield* CliRuntime;

    if (shouldRemoveConfigFile(state)) {
      return yield* fs
        .remove(effectiveConfigPath, { force: true })
        .pipe(Effect.mapError((error) => mapFileSystemError(error, message)));
    }

    yield* fs
      .makeDirectory(runtime.dirname(effectiveConfigPath), { recursive: true })
      .pipe(Effect.mapError((error) => mapFileSystemError(error, message)));
    yield* fs
      .writeFileString(effectiveConfigPath, `${JSON.stringify(state, null, 2)}\n`)
      .pipe(Effect.mapError((error) => mapFileSystemError(error, message)));
    yield* fs
      .chmod(effectiveConfigPath, CONFIG_FILE_MODE)
      .pipe(Effect.mapError((error) => mapFileSystemError(error, message)));
  });

const makeEmptyState = (apiBaseUrl = DEFAULT_PUTIO_API_BASE_URL): PutioCliConfig => ({
  api_base_url: apiBaseUrl,
});

const loadPersistedStateEffect = (
  configPath?: string,
): Effect.Effect<
  PutioCliConfig | null,
  AuthStateError,
  CliConfig | FileSystem.FileSystem | CliRuntime
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const effectiveConfigPath = configPath ?? (yield* resolveAuthRuntimeConfig()).configPath;

    const rawConfig = yield* fs.readFileString(effectiveConfigPath, "utf8").pipe(
      Effect.catchIf(
        (error): error is PlatformError =>
          error instanceof PlatformError &&
          error.reason instanceof SystemError &&
          error.reason._tag === "NotFound",
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
  selection: AuthProfileSelection = {},
): Effect.Effect<
  {
    readonly configPath: string;
    readonly profile: string | null;
    readonly state: PutioCliConfig;
  },
  AuthStateError,
  CliConfig | FileSystem.FileSystem | CliRuntime
> =>
  Effect.gen(function* () {
    const runtime = yield* resolveAuthRuntimeConfig();
    const effectiveConfigPath = configPath ?? runtime.configPath;
    const existingConfig = yield* loadPersistedStateEffect(effectiveConfigPath);
    const selectedProfile = selectProfileName({
      explicitProfile: selection.profile,
      runtimeProfile: runtime.profile,
      state: existingConfig,
    });
    const persistedState = existingConfig ?? makeEmptyState(state.apiBaseUrl);

    if (selectedProfile) {
      const existingProfiles = persistedState.profiles ?? {};
      const existingProfile = existingProfiles[selectedProfile];
      const nextProfile: PutioCliProfileConfig = {
        api_base_url:
          state.apiBaseUrl ?? existingProfile?.api_base_url ?? persistedState.api_base_url,
        auth_token: state.token,
      };
      const nextState: PutioCliConfig = {
        ...persistedState,
        profiles: {
          ...existingProfiles,
          [selectedProfile]: nextProfile,
        },
      };

      yield* persistConfigEffect(
        effectiveConfigPath,
        nextState,
        `Unable to write CLI config to ${effectiveConfigPath}.`,
      );

      return {
        configPath: effectiveConfigPath,
        profile: selectedProfile,
        state: nextState,
      };
    }

    const nextState: PutioCliConfig = {
      ...persistedState,
      api_base_url: state.apiBaseUrl ?? persistedState.api_base_url,
      auth_token: state.token,
    };

    yield* persistConfigEffect(
      effectiveConfigPath,
      nextState,
      `Unable to write CLI config to ${effectiveConfigPath}.`,
    );

    return {
      configPath: effectiveConfigPath,
      profile: null,
      state: nextState,
    };
  });

const clearPersistedStateEffect = (
  configPath?: string,
  selection: AuthProfileSelection = {},
): Effect.Effect<
  { readonly configPath: string; readonly profile: string | null },
  AuthStateError,
  CliConfig | FileSystem.FileSystem | CliRuntime
> =>
  Effect.gen(function* () {
    const runtime = yield* resolveAuthRuntimeConfig();
    const effectiveConfigPath = configPath ?? runtime.configPath;
    const existingConfig = yield* loadPersistedStateEffect(effectiveConfigPath);
    const selectedProfile = selectProfileName({
      explicitProfile: selection.profile,
      runtimeProfile: runtime.profile,
      state: existingConfig,
    });

    if (existingConfig === null) {
      return { configPath: effectiveConfigPath, profile: selectedProfile ?? null };
    }

    if (selectedProfile) {
      const existingProfiles = existingConfig.profiles ?? {};
      const existingProfile = existingProfiles[selectedProfile];

      if (existingProfile === undefined) {
        return { configPath: effectiveConfigPath, profile: selectedProfile };
      }

      const nextProfile: PutioCliProfileConfig = {
        api_base_url: existingProfile.api_base_url ?? existingConfig.api_base_url,
      };
      const nextState: PutioCliConfig = {
        ...existingConfig,
        profiles: {
          ...existingProfiles,
          [selectedProfile]: nextProfile,
        },
      };

      yield* persistConfigEffect(
        effectiveConfigPath,
        nextState,
        `Unable to clear CLI auth state at ${effectiveConfigPath}.`,
      );

      return { configPath: effectiveConfigPath, profile: selectedProfile };
    }

    const nextState: PutioCliConfig = {
      ...existingConfig,
      auth_token: undefined,
    };

    yield* persistConfigEffect(
      effectiveConfigPath,
      nextState,
      `Unable to clear CLI auth state at ${effectiveConfigPath}.`,
    );

    return { configPath: effectiveConfigPath, profile: null };
  });

const listProfilesEffect = (): Effect.Effect<
  AuthProfileList,
  AuthStateError,
  CliConfig | FileSystem.FileSystem | CliRuntime
> =>
  Effect.gen(function* () {
    const runtime = yield* resolveAuthRuntimeConfig();
    const state = yield* loadPersistedStateEffect(runtime.configPath);
    const defaultProfile = state?.default_profile ?? null;
    const currentProfile = runtime.profile ?? defaultProfile;
    const profiles = Object.entries(state?.profiles ?? {})
      .map(([name, profile]) => ({
        apiBaseUrl: profileConfigApiBaseUrl(state ?? makeEmptyState(), profile),
        authenticated: typeof profile.auth_token === "string",
        current: currentProfile === name,
        name,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    return {
      configPath: runtime.configPath,
      defaultProfile,
      profiles,
    };
  });

const getAuthStatusEffect = (
  selection: AuthProfileSelection = {},
): Effect.Effect<AuthStatus, AuthStateError, CliConfig | FileSystem.FileSystem | CliRuntime> =>
  Effect.gen(function* () {
    const runtime = yield* resolveAuthRuntimeConfig();

    if (runtime.token) {
      return {
        authenticated: true,
        source: "env",
        apiBaseUrl: runtime.apiBaseUrl,
        configPath: runtime.configPath,
        defaultProfile: null,
        profile:
          validateOptionalProfileName(selection.profile) ??
          validateOptionalProfileName(runtime.profile) ??
          null,
      };
    }

    const state = yield* loadPersistedStateEffect(runtime.configPath);
    const selectedProfile = selectProfileName({
      explicitProfile: selection.profile,
      runtimeProfile: runtime.profile,
      state,
    });

    if (selectedProfile) {
      if (state === null) {
        return {
          authenticated: false,
          source: null,
          apiBaseUrl: runtime.apiBaseUrl,
          configPath: runtime.configPath,
          defaultProfile: null,
          profile: selectedProfile,
        };
      }

      const profile = state?.profiles?.[selectedProfile];

      return profile === undefined || typeof profile.auth_token !== "string"
        ? {
            authenticated: false,
            source: null,
            apiBaseUrl: runtime.apiBaseUrl,
            configPath: runtime.configPath,
            defaultProfile: state?.default_profile ?? null,
            profile: selectedProfile,
          }
        : {
            authenticated: true,
            source: "profile",
            apiBaseUrl: profileConfigApiBaseUrl(state, profile),
            configPath: runtime.configPath,
            defaultProfile: state.default_profile ?? null,
            profile: selectedProfile,
          };
    }

    return state === null
      ? {
          authenticated: false,
          source: null,
          apiBaseUrl: runtime.apiBaseUrl,
          configPath: runtime.configPath,
          defaultProfile: null,
          profile: null,
        }
      : {
          authenticated: typeof state.auth_token === "string",
          source: typeof state.auth_token === "string" ? "config" : null,
          apiBaseUrl: state.api_base_url,
          configPath: runtime.configPath,
          defaultProfile: state.default_profile ?? null,
          profile: null,
        };
  });

const removeProfileEffect = (
  profile: string,
): Effect.Effect<
  { readonly configPath: string; readonly profile: string; readonly removed: boolean },
  AuthStateError,
  CliConfig | FileSystem.FileSystem | CliRuntime
> =>
  Effect.gen(function* () {
    const profileName = validateProfileName(profile);
    const runtime = yield* resolveAuthRuntimeConfig();
    const state = yield* loadPersistedStateEffect(runtime.configPath);

    if (state === null || state.profiles?.[profileName] === undefined) {
      return {
        configPath: runtime.configPath,
        profile: profileName,
        removed: false,
      };
    }

    const { [profileName]: _removed, ...remainingProfiles } = state.profiles;
    const nextState: PutioCliConfig = {
      ...state,
      default_profile: state.default_profile === profileName ? undefined : state.default_profile,
      profiles: Object.keys(remainingProfiles).length > 0 ? remainingProfiles : undefined,
    };

    yield* persistConfigEffect(
      runtime.configPath,
      nextState,
      `Unable to remove auth profile \`${profileName}\` at ${runtime.configPath}.`,
    );

    return {
      configPath: runtime.configPath,
      profile: profileName,
      removed: true,
    };
  });

const resolveAuthStateEffect = (
  selection: AuthProfileSelection = {},
): Effect.Effect<
  ResolvedAuthState,
  AuthStateError,
  CliConfig | FileSystem.FileSystem | CliRuntime
> =>
  Effect.gen(function* () {
    const runtime = yield* resolveAuthRuntimeConfig();
    const explicitOrEnvProfile =
      validateOptionalProfileName(selection.profile) ??
      validateOptionalProfileName(runtime.profile) ??
      null;

    if (runtime.token) {
      return {
        token: runtime.token,
        apiBaseUrl: runtime.apiBaseUrl,
        source: "env",
        configPath: runtime.configPath,
        profile: explicitOrEnvProfile,
      };
    }

    const state = yield* loadPersistedStateEffect(runtime.configPath);
    const selectedProfile = selectProfileName({
      explicitProfile: selection.profile,
      runtimeProfile: runtime.profile,
      state,
    });

    if (selectedProfile) {
      if (state === null) {
        return yield* Effect.fail(
          new AuthStateError({
            message: `No put.io token is configured for profile \`${selectedProfile}\`. Set PUTIO_CLI_TOKEN or run \`putio auth login --profile ${selectedProfile}\`.`,
          }),
        );
      }

      const profile = state?.profiles?.[selectedProfile];

      if (profile === undefined || typeof profile.auth_token !== "string") {
        return yield* Effect.fail(
          new AuthStateError({
            message: `No put.io token is configured for profile \`${selectedProfile}\`. Set PUTIO_CLI_TOKEN or run \`putio auth login --profile ${selectedProfile}\`.`,
          }),
        );
      }

      return {
        token: profile.auth_token,
        apiBaseUrl: profileConfigApiBaseUrl(state, profile),
        source: "profile",
        configPath: runtime.configPath,
        profile: selectedProfile,
      };
    }

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
      source: "config",
      configPath: runtime.configPath,
      profile: null,
    };
  });

const useProfileEffect = (
  profile: string,
): Effect.Effect<
  { readonly configPath: string; readonly profile: string },
  AuthStateError,
  CliConfig | FileSystem.FileSystem | CliRuntime
> =>
  Effect.gen(function* () {
    const profileName = validateProfileName(profile);
    const runtime = yield* resolveAuthRuntimeConfig();
    const state = yield* loadPersistedStateEffect(runtime.configPath);

    if (state?.profiles?.[profileName] === undefined) {
      return yield* Effect.fail(
        new AuthStateError({
          message: `Auth profile \`${profileName}\` does not exist. Run \`putio auth login --profile ${profileName}\` first.`,
        }),
      );
    }

    const nextState: PutioCliConfig = {
      ...state,
      default_profile: profileName,
    };

    yield* persistConfigEffect(
      runtime.configPath,
      nextState,
      `Unable to set the default auth profile at ${runtime.configPath}.`,
    );

    return {
      configPath: runtime.configPath,
      profile: profileName,
    };
  });

const makeCliState = (): CliStateService => ({
  clearPersistedState: clearPersistedStateEffect,
  getAuthStatus: getAuthStatusEffect,
  listProfiles: listProfilesEffect,
  loadPersistedState: loadPersistedStateEffect,
  removeProfile: removeProfileEffect,
  resolveAuthState: resolveAuthStateEffect,
  savePersistedState: savePersistedStateEffect,
  useProfile: useProfileEffect,
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
  selection?: AuthProfileSelection,
) =>
  Effect.flatMap(CliState, (cliState) => cliState.savePersistedState(state, configPath, selection));

export const clearPersistedState = (configPath?: string, selection?: AuthProfileSelection) =>
  Effect.flatMap(CliState, (state) => state.clearPersistedState(configPath, selection));

export const getAuthStatus = (selection?: AuthProfileSelection) =>
  Effect.flatMap(CliState, (state) => state.getAuthStatus(selection));

export const listProfiles = () => Effect.flatMap(CliState, (state) => state.listProfiles());

export const removeProfile = (profile: string) =>
  Effect.flatMap(CliState, (state) => state.removeProfile(profile));

export const resolveAuthState = (selection?: AuthProfileSelection) =>
  Effect.flatMap(CliState, (state) => state.resolveAuthState(selection));

export const useProfile = (profile: string) =>
  Effect.flatMap(CliState, (state) => state.useProfile(profile));
