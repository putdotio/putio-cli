import { lstat, mkdtemp, readFile, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as FileSystem from "effect/FileSystem";
import * as PlatformError from "effect/PlatformError";
import { Cause, ConfigProvider, Effect, Exit, Option } from "effect";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { makeCliAppLayer } from "./app-layer.js";
import { buildConfigPath } from "./config.js";
import { makeCliRuntime } from "./runtime.js";
import {
  AuthStateError,
  CliState,
  clearPersistedState,
  getAuthStatus,
  getTelemetryStatus,
  listProfiles,
  loadPersistedState,
  parsePersistedConfig,
  removeProfile,
  resolveAuthState,
  savePersistedState,
  setTelemetryEnabled,
  useProfile,
} from "./state.js";

const tempDirectories = new Set<string>();

const notFoundTag: PlatformError.SystemErrorTag = "NotFound";

const makeTempDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), "putio-cli-"));
  tempDirectories.add(directory);

  return directory;
};

afterEach(async () => {
  const directories = [...tempDirectories];
  tempDirectories.clear();
  await Promise.all(
    directories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

const makeRuntimeLayer = (homeDirectory = "/Users/tester") =>
  Effect.provide(makeCliAppLayer(makeCliRuntime({ homeDirectory })));

const expectFailure = <E>(exit: Exit.Exit<unknown, E>): E => {
  if (Exit.isSuccess(exit)) {
    throw new Error("Expected the effect to fail.");
  }

  const failure = Cause.findErrorOption(exit.cause);

  if (Option.isNone(failure)) {
    throw Cause.squash(exit.cause);
  }

  return failure.value;
};

const withStateService = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  homeDirectory = "/Users/tester",
) => effect.pipe(Effect.provide(makeCliAppLayer(makeCliRuntime({ homeDirectory }))));

describe("resolveConfigPath", () => {
  it("prefers explicit config path", () => {
    expect(
      buildConfigPath({
        explicitConfigPath: "/tmp/putio-cli.json",
        homePath: "/Users/tester",
        joinPath: (...segments) => join(...segments),
      }),
    ).toBe("/tmp/putio-cli.json");
  });

  it("falls back to XDG config home", () => {
    expect(
      buildConfigPath({
        xdgConfigHome: "/tmp/xdg",
        homePath: "/Users/tester",
        joinPath: (...segments) => join(...segments),
      }),
    ).toBe("/tmp/xdg/putio/config.json");
  });

  it("uses home config path last", () => {
    expect(
      buildConfigPath({
        homePath: "/Users/tester",
        joinPath: (...segments) => join(...segments),
      }),
    ).toBe("/Users/tester/.config/putio/config.json");
  });

  it("writes config files with private permissions", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await Effect.runPromise(
      savePersistedState(
        {
          authMethod: "device",
          token: "dummy-token",
          apiBaseUrl: "https://api.put.io",
        },
        configPath,
      ).pipe(Effect.provide(makeCliAppLayer(makeCliRuntime()))),
    );

    const file = await stat(configPath);

    const contents: unknown = JSON.parse(await readFile(configPath, "utf8"));

    expect(file.mode & 0o777).toBe(0o600);
    expect(contents).toMatchObject({
      api_base_url: "https://api.put.io",
      auth_token: "dummy-token",
    });
  });

  it("keeps every concurrent config update and never exposes a partial file", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({ api_base_url: "https://api.put.io", auth_token: "stored-token" }),
      "utf8",
    );

    const provideConfig = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      effect.pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ PUTIO_CLI_CONFIG_PATH: configPath }),
        ),
        makeRuntimeLayer(),
      );

    const profileNames = Array.from({ length: 12 }, (_, index) => `writer-${index}`);

    const writers = [
      Effect.asVoid(setTelemetryEnabled(false)),
      ...profileNames.map((profile) =>
        Effect.asVoid(
          savePersistedState({ authMethod: "token", token: `${profile}-token` }, configPath, {
            profile,
          }),
        ),
      ),
    ];

    const readers = Array.from({ length: 4 }, () =>
      Effect.asVoid(loadPersistedState(configPath).pipe(Effect.repeat({ times: 200 }))),
    );

    const exits = await Effect.runPromise(
      provideConfig(
        Effect.all(
          [...writers, ...readers].map((effect) => Effect.exit(effect)),
          { concurrency: "unbounded" },
        ),
      ),
    );

    expect(exits.filter(Exit.isFailure)).toEqual([]);

    const persisted = parsePersistedConfig(await readFile(configPath, "utf8"));

    expect(persisted.telemetry_disabled).toBe(true);
    expect(Object.keys(persisted.profiles ?? {}).sort()).toEqual([...profileNames].sort());
  });

  it("updates the target of a symlinked config without replacing the link", async () => {
    const dir = await makeTempDirectory();
    const targetPath = join(dir, "managed.json");
    const configPath = join(dir, "config.json");
    await writeFile(
      targetPath,
      JSON.stringify({ api_base_url: "https://api.put.io", auth_token: "stored-token" }),
      "utf8",
    );
    await symlink(targetPath, configPath);

    await Effect.runPromise(
      setTelemetryEnabled(false).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ PUTIO_CLI_CONFIG_PATH: configPath }),
        ),
        makeRuntimeLayer(),
      ),
    );

    expect((await lstat(configPath)).isSymbolicLink()).toBe(true);
    expect(parsePersistedConfig(await readFile(targetPath, "utf8"))).toEqual({
      api_base_url: "https://api.put.io",
      auth_token: "stored-token",
      telemetry_disabled: true,
    });
  });

  it("recovers from a lock left behind by a dead process", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");
    const lockPath = `${configPath}.lock`;
    const abandonedAt = new Date(Date.now() - 60_000);
    await writeFile(lockPath, "", "utf8");
    await utimes(lockPath, abandonedAt, abandonedAt);

    await Effect.runPromise(
      setTelemetryEnabled(false).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ PUTIO_CLI_CONFIG_PATH: configPath }),
        ),
        makeRuntimeLayer(),
      ),
    );

    expect(parsePersistedConfig(await readFile(configPath, "utf8")).telemetry_disabled).toBe(true);
    await expect(stat(lockPath)).rejects.toThrow();
  });

  it("persists and clears the telemetry opt-out without changing auth state", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({ api_base_url: "https://api.put.io", auth_token: "stored-token" }),
      "utf8",
    );

    const provideConfig = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      effect.pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ PUTIO_CLI_CONFIG_PATH: configPath }),
        ),
        makeRuntimeLayer(),
      );

    await Effect.runPromise(provideConfig(setTelemetryEnabled(false)));
    await expect(Effect.runPromise(provideConfig(getTelemetryStatus()))).resolves.toEqual({
      configPath,
      enabled: false,
    });
    expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual({
      api_base_url: "https://api.put.io",
      auth_token: "stored-token",
      telemetry_disabled: true,
    });

    await Effect.runPromise(provideConfig(setTelemetryEnabled(true)));
    expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual({
      api_base_url: "https://api.put.io",
      auth_token: "stored-token",
    });
  });

  it("creates config files with private permissions before chmod", async () => {
    const writeModes: Array<number | undefined> = [];
    const chmodModes: Array<number> = [];

    const fileSystem = FileSystem.makeNoop({
      chmod: (_path, mode) =>
        Effect.sync(() => {
          chmodModes.push(mode);
        }),
      makeDirectory: () => Effect.void,
      remove: () => Effect.void,
      rename: () => Effect.void,
      readFileString: (path) =>
        Effect.fail(
          PlatformError.systemError({
            _tag: notFoundTag,
            module: "FileSystem",
            method: "readFileString",
            pathOrDescriptor: path,
          }),
        ),
      writeFileString: (_path, _data, options) =>
        Effect.sync(() => {
          writeModes.push(options?.mode);
        }),
    });

    await Effect.runPromise(
      savePersistedState(
        {
          authMethod: "device",
          token: "dummy-token",
          apiBaseUrl: "https://api.put.io",
        },
        "/tmp/putio-cli/config.json",
      ).pipe(
        Effect.provideService(FileSystem.FileSystem, fileSystem),
        Effect.provide(makeCliAppLayer(makeCliRuntime())),
      ),
    );

    expect(writeModes).toEqual([0o600, 0o600]);
    expect(chmodModes).toEqual([0o600]);
  });

  it("exposes persisted-state operations through the CliState service", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    const result = await Effect.runPromise(
      withStateService(
        Effect.flatMap(CliState, (state) =>
          state.savePersistedState(
            {
              authMethod: "device",
              token: "service-token",
              apiBaseUrl: "https://api.put.io",
            },
            configPath,
          ),
        ),
      ),
    );

    expect(result.state).toEqual({
      api_base_url: "https://api.put.io",
      auth_method: "device",
      auth_token: "service-token",
    });

    const loaded = await Effect.runPromise(
      withStateService(Effect.flatMap(CliState, (state) => state.loadPersistedState(configPath))),
    );

    expect(loaded).toEqual(result.state);
  });

  it("does not expose token previews in auth status", async () => {
    const status = await Effect.runPromise(
      getAuthStatus().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            PUTIO_CLI_TOKEN: "dummy-token",
            XDG_CONFIG_HOME: "/tmp/xdg",
          }),
        ),
        Effect.provide(makeCliAppLayer(makeCliRuntime({ homeDirectory: "/Users/tester" }))),
      ),
    );

    expect(status).toEqual({
      authMethod: null,
      authenticated: true,
      source: "env",
      apiBaseUrl: "https://api.put.io",
      configPath: "/tmp/xdg/putio/config.json",
      defaultProfile: null,
      profile: null,
    });
  });

  it("returns null when no persisted config exists", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "missing.json");

    const state = await Effect.runPromise(loadPersistedState(configPath).pipe(makeRuntimeLayer()));

    expect(state).toBeNull();
  });

  it("fails when persisted config is not valid JSON", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(configPath, "{ definitely not json", "utf8");

    const exit = await Effect.runPromiseExit(
      loadPersistedState(configPath).pipe(makeRuntimeLayer()),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = expectFailure(exit);
      expect(failure).toBeInstanceOf(AuthStateError);
      expect(failure.message).toBe("Stored CLI config is not valid JSON.");
    }
  });

  it("fails when persisted config does not match the schema", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(configPath, JSON.stringify({ api_base_url: "" }), "utf8");

    const exit = await Effect.runPromiseExit(
      loadPersistedState(configPath).pipe(makeRuntimeLayer()),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = expectFailure(exit);
      expect(failure).toBeInstanceOf(AuthStateError);
      expect(failure.message).toBe("Stored CLI config does not match the expected schema.");
    }
  });

  it("preserves a custom api base url when clearing persisted auth state", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://staging.put.io",
        auth_token: "dummy-token",
      }),
      "utf8",
    );

    await Effect.runPromise(clearPersistedState(configPath).pipe(makeRuntimeLayer()));

    expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual({
      api_base_url: "https://staging.put.io",
    });
  });

  it("reuses a persisted custom api base url when saving a new token", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://staging.put.io",
      }),
      "utf8",
    );

    const result = await Effect.runPromise(
      savePersistedState(
        {
          authMethod: "device",
          token: "fresh-token",
        },
        configPath,
      ).pipe(makeRuntimeLayer()),
    );

    expect(result.state).toEqual({
      api_base_url: "https://staging.put.io",
      auth_method: "device",
      auth_token: "fresh-token",
    });
  });

  it("saves named profiles without rewriting the legacy token", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://api.put.io",
        auth_token: "legacy-token",
      }),
      "utf8",
    );

    const result = await Effect.runPromise(
      savePersistedState(
        {
          authMethod: "device",
          token: "profile-token",
          apiBaseUrl: "https://staging.put.io",
        },
        configPath,
        { profile: "automation" },
      ).pipe(makeRuntimeLayer()),
    );

    expect(result.profile).toBe("automation");
    expect(result.state).toEqual({
      api_base_url: "https://api.put.io",
      auth_token: "legacy-token",
      profiles: {
        automation: {
          api_base_url: "https://staging.put.io",
          auth_method: "device",
          auth_token: "profile-token",
        },
      },
    });
  });

  it("uses the configured default profile when no profile is specified", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://api.put.io",
        default_profile: "automation",
        profiles: {
          automation: {
            api_base_url: "https://staging.put.io",
            auth_token: "profile-token",
          },
        },
      }),
      "utf8",
    );

    const authState = await Effect.runPromise(
      resolveAuthState().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            PUTIO_CLI_CONFIG_PATH: configPath,
          }),
        ),
        makeRuntimeLayer(),
      ),
    );

    expect(authState).toEqual({
      token: "profile-token",
      source: "profile",
      apiBaseUrl: "https://staging.put.io",
      configPath,
      profile: "automation",
    });
  });

  it("uses PUTIO_CLI_PROFILE to select a named profile", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://staging.put.io",
        profiles: {
          automation: {
            auth_token: "profile-token",
          },
        },
      }),
      "utf8",
    );

    const authState = await Effect.runPromise(
      resolveAuthState().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            PUTIO_CLI_CONFIG_PATH: configPath,
            PUTIO_CLI_PROFILE: "automation",
          }),
        ),
        makeRuntimeLayer(),
      ),
    );

    expect(authState).toEqual({
      token: "profile-token",
      source: "profile",
      apiBaseUrl: "https://staging.put.io",
      configPath,
      profile: "automation",
    });
  });

  it("keeps PUTIO_CLI_TOKEN as an override when a persisted profile is selected", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://staging.put.io",
        default_profile: "human",
        profiles: {
          automation: {
            auth_token: "profile-token",
          },
          human: {
            auth_token: "human-token",
          },
        },
      }),
      "utf8",
    );

    const authState = await Effect.runPromise(
      resolveAuthState().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            PUTIO_CLI_CONFIG_PATH: configPath,
            PUTIO_CLI_PROFILE: "automation",
            PUTIO_CLI_TOKEN: "env-token",
          }),
        ),
        makeRuntimeLayer(),
      ),
    );

    expect(authState).toEqual({
      token: "env-token",
      source: "env",
      apiBaseUrl: "https://api.put.io",
      configPath,
      profile: "automation",
    });

    const status = await Effect.runPromise(
      getAuthStatus().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            PUTIO_CLI_CONFIG_PATH: configPath,
            PUTIO_CLI_PROFILE: "automation",
            PUTIO_CLI_TOKEN: "env-token",
          }),
        ),
        makeRuntimeLayer(),
      ),
    );

    expect(status).toEqual({
      authMethod: null,
      authenticated: true,
      source: "env",
      apiBaseUrl: "https://api.put.io",
      configPath,
      defaultProfile: null,
      profile: "automation",
    });
  });

  it("lists profiles without token material", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://api.put.io",
        default_profile: "automation",
        profiles: {
          automation: {
            auth_token: "profile-token",
          },
        },
      }),
      "utf8",
    );

    const result = await Effect.runPromise(
      listProfiles().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            PUTIO_CLI_CONFIG_PATH: configPath,
          }),
        ),
        makeRuntimeLayer(),
      ),
    );

    expect(result).toEqual({
      configPath,
      defaultProfile: "automation",
      profiles: [
        {
          apiBaseUrl: "https://api.put.io",
          authMethod: "device",
          authenticated: true,
          current: true,
          name: "automation",
        },
      ],
    });
  });

  it("marks the PUTIO_CLI_PROFILE selection as the current listed profile", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://api.put.io",
        default_profile: "human",
        profiles: {
          automation: {
            auth_token: "profile-token",
          },
          human: {
            auth_token: "human-token",
          },
        },
      }),
      "utf8",
    );

    const result = await Effect.runPromise(
      listProfiles().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            PUTIO_CLI_CONFIG_PATH: configPath,
            PUTIO_CLI_PROFILE: "automation",
          }),
        ),
        makeRuntimeLayer(),
      ),
    );

    expect(result.profiles).toEqual([
      {
        apiBaseUrl: "https://api.put.io",
        authMethod: "device",
        authenticated: true,
        current: true,
        name: "automation",
      },
      {
        apiBaseUrl: "https://api.put.io",
        authMethod: "device",
        authenticated: true,
        current: false,
        name: "human",
      },
    ]);
  });

  it("rejects invalid PUTIO_CLI_PROFILE values when listing profiles", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://api.put.io",
        profiles: {
          automation: {
            auth_token: "profile-token",
          },
        },
      }),
      "utf8",
    );

    const exit = await Effect.runPromiseExit(
      listProfiles().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            PUTIO_CLI_CONFIG_PATH: configPath,
            PUTIO_CLI_PROFILE: "bad/name",
          }),
        ),
        makeRuntimeLayer(),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = expectFailure(exit);
      expect(failure).toBeInstanceOf(AuthStateError);
      expect(failure.message).toContain("Invalid auth profile `bad/name`");
    }
  });

  it("sets and removes the default profile", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://staging.put.io",
        profiles: {
          automation: {
            auth_token: "profile-token",
          },
        },
      }),
      "utf8",
    );

    await Effect.runPromise(
      useProfile("automation").pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            PUTIO_CLI_CONFIG_PATH: configPath,
          }),
        ),
        makeRuntimeLayer(),
      ),
    );

    let contents: unknown = JSON.parse(await readFile(configPath, "utf8"));

    expect(contents).toHaveProperty("default_profile", "automation");

    const result = await Effect.runPromise(
      removeProfile("automation").pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            PUTIO_CLI_CONFIG_PATH: configPath,
          }),
        ),
        makeRuntimeLayer(),
      ),
    );

    expect(result.removed).toBe(true);
    contents = JSON.parse(await readFile(configPath, "utf8"));
    expect(contents).not.toHaveProperty("default_profile");
    expect(contents).not.toHaveProperty("profiles");
  });

  it("rejects invalid profile names through typed profile operations", async () => {
    const useExit = await Effect.runPromiseExit(useProfile("bad/name").pipe(makeRuntimeLayer()));

    const removeExit = await Effect.runPromiseExit(
      removeProfile("bad/name").pipe(makeRuntimeLayer()),
    );

    expect(Exit.isFailure(useExit)).toBe(true);
    expect(Exit.isFailure(removeExit)).toBe(true);

    if (Exit.isFailure(useExit)) {
      const failure = expectFailure(useExit);
      expect(failure).toBeInstanceOf(AuthStateError);
      expect(failure.message).toContain("Invalid auth profile `bad/name`");
    }

    if (Exit.isFailure(removeExit)) {
      const failure = expectFailure(removeExit);
      expect(failure).toBeInstanceOf(AuthStateError);
      expect(failure.message).toContain("Invalid auth profile `bad/name`");
    }
  });

  it("clears only the selected profile on profile logout", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://api.put.io",
        profiles: {
          automation: {
            auth_token: "profile-token",
          },
          human: {
            auth_token: "human-token",
          },
        },
      }),
      "utf8",
    );

    const result = await Effect.runPromise(
      clearPersistedState(configPath, { profile: "automation" }).pipe(makeRuntimeLayer()),
    );

    expect(result).toEqual({
      cleared: true,
      configPath,
      profile: "automation",
    });

    const contents: unknown = JSON.parse(await readFile(configPath, "utf8"));

    expect(contents).toHaveProperty(["profiles", "automation"]);
    expect(contents).not.toHaveProperty(["profiles", "automation", "auth_token"]);
    expect(contents).toHaveProperty(["profiles", "human", "auth_token"], "human-token");
  });

  it("does not create a profile when logging out of a missing profile", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://api.put.io",
        profiles: {
          human: {
            auth_token: "human-token",
          },
        },
      }),
      "utf8",
    );

    const result = await Effect.runPromise(
      clearPersistedState(configPath, { profile: "automation" }).pipe(makeRuntimeLayer()),
    );

    expect(result).toEqual({
      cleared: false,
      configPath,
      profile: "automation",
    });

    const contents: unknown = JSON.parse(await readFile(configPath, "utf8"));

    expect(contents).toHaveProperty("profiles", {
      human: {
        auth_token: "human-token",
      },
    });
  });

  it("removes the persisted config when clearing the default api base url", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://api.put.io",
        auth_token: "dummy-token",
      }),
      "utf8",
    );

    await Effect.runPromise(clearPersistedState(configPath).pipe(makeRuntimeLayer()));

    await expect(readFile(configPath, "utf8")).rejects.toThrow();
  });

  it("resolves auth state from persisted config when no env token is set", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await Effect.runPromise(
      savePersistedState(
        {
          authMethod: "device",
          token: "stored-token",
          apiBaseUrl: "https://api.put.io",
        },
        configPath,
      ).pipe(makeRuntimeLayer()),
    );

    const authState = await Effect.runPromise(
      resolveAuthState().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            HOME: "/Users/tester",
            PUTIO_CLI_CONFIG_PATH: configPath,
          }),
        ),
        makeRuntimeLayer(),
      ),
    );

    expect(authState).toEqual({
      token: "stored-token",
      source: "config",
      apiBaseUrl: "https://api.put.io",
      configPath,
      profile: null,
    });
  });

  it("reports auth status from persisted config when a token is stored", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://staging.put.io",
        auth_token: "stored-token",
      }),
      "utf8",
    );

    const status = await Effect.runPromise(
      getAuthStatus().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            HOME: "/Users/tester",
            PUTIO_CLI_CONFIG_PATH: configPath,
          }),
        ),
        makeRuntimeLayer(),
      ),
    );

    expect(status).toEqual({
      authMethod: "device",
      authenticated: true,
      source: "config",
      apiBaseUrl: "https://staging.put.io",
      configPath,
      defaultProfile: null,
      profile: null,
    });
  });

  it("reports unauthenticated config status when the persisted token is missing", async () => {
    const dir = await makeTempDirectory();
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://staging.put.io",
      }),
      "utf8",
    );

    const status = await Effect.runPromise(
      getAuthStatus().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            HOME: "/Users/tester",
            PUTIO_CLI_CONFIG_PATH: configPath,
          }),
        ),
        makeRuntimeLayer(),
      ),
    );

    expect(status).toEqual({
      authMethod: null,
      authenticated: false,
      source: null,
      apiBaseUrl: "https://staging.put.io",
      configPath,
      defaultProfile: null,
      profile: null,
    });
  });

  it("fails to resolve auth state when neither env nor config contains a token", async () => {
    const exit = await Effect.runPromiseExit(
      resolveAuthState().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            HOME: "/Users/tester",
            XDG_CONFIG_HOME: "/tmp/xdg",
          }),
        ),
        makeRuntimeLayer(),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = expectFailure(exit);
      expect(failure).toBeInstanceOf(AuthStateError);
      expect(failure.message).toBe(
        "No put.io token is configured. Set PUTIO_CLI_TOKEN or run `putio auth login`.",
      );
    }
  });
});
