import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NodeContext } from "@effect/platform-node";
import { Cause, ConfigProvider, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

import { buildConfigPath } from "./config.js";
import { CliRuntime, makeCliRuntime } from "./runtime.js";
import {
  AuthStateError,
  clearPersistedState,
  getAuthStatus,
  loadPersistedState,
  resolveAuthState,
  savePersistedState,
} from "./state.js";

const makeRuntimeLayer = (homeDirectory = "/Users/tester") =>
  Effect.provideService(CliRuntime, makeCliRuntime({ homeDirectory }));

const expectFailure = <E>(exit: Exit.Exit<unknown, E>): E => {
  if (Exit.isSuccess(exit)) {
    throw new Error("Expected the effect to fail.");
  }

  const failure = Cause.failureOption(exit.cause);

  if (Option.isNone(failure)) {
    throw Cause.squash(exit.cause);
  }

  return failure.value;
};

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
    const dir = await mkdtemp(join(tmpdir(), "putio-cli-"));
    const configPath = join(dir, "config.json");

    await Effect.runPromise(
      savePersistedState(
        {
          token: "dummy-token",
          apiBaseUrl: "https://api.put.io",
        },
        configPath,
      ).pipe(
        Effect.provideService(CliRuntime, makeCliRuntime()),
        Effect.provide(NodeContext.layer),
      ),
    );

    const file = await stat(configPath);
    const contents = JSON.parse(await readFile(configPath, "utf8")) as {
      api_base_url: string;
      auth_token: string;
    };

    expect(file.mode & 0o777).toBe(0o600);
    expect(contents.api_base_url).toBe("https://api.put.io");
    expect(contents.auth_token).toBe("dummy-token");
  });

  it("does not expose token previews in auth status", async () => {
    const status = await Effect.runPromise(
      getAuthStatus().pipe(
        Effect.withConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["PUTIO_CLI_TOKEN", "dummy-token"],
              ["XDG_CONFIG_HOME", "/tmp/xdg"],
            ]),
          ),
        ),
        Effect.provideService(CliRuntime, makeCliRuntime({ homeDirectory: "/Users/tester" })),
        Effect.provide(NodeContext.layer),
      ),
    );

    expect(status).toEqual({
      authenticated: true,
      source: "env",
      apiBaseUrl: "https://api.put.io",
      configPath: "/tmp/xdg/putio/config.json",
    });
  });

  it("returns null when no persisted config exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "putio-cli-"));
    const configPath = join(dir, "missing.json");

    const state = await Effect.runPromise(
      loadPersistedState(configPath).pipe(makeRuntimeLayer(), Effect.provide(NodeContext.layer)),
    );

    expect(state).toBeNull();
  });

  it("fails when persisted config is not valid JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "putio-cli-"));
    const configPath = join(dir, "config.json");

    await writeFile(configPath, "{ definitely not json", "utf8");

    const exit = await Effect.runPromiseExit(
      loadPersistedState(configPath).pipe(makeRuntimeLayer(), Effect.provide(NodeContext.layer)),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = expectFailure(exit);
      expect(failure).toBeInstanceOf(AuthStateError);
      expect(failure.message).toBe("Stored CLI config is not valid JSON.");
    }
  });

  it("fails when persisted config does not match the schema", async () => {
    const dir = await mkdtemp(join(tmpdir(), "putio-cli-"));
    const configPath = join(dir, "config.json");

    await writeFile(configPath, JSON.stringify({ api_base_url: "" }), "utf8");

    const exit = await Effect.runPromiseExit(
      loadPersistedState(configPath).pipe(makeRuntimeLayer(), Effect.provide(NodeContext.layer)),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = expectFailure(exit);
      expect(failure).toBeInstanceOf(AuthStateError);
      expect(failure.message).toBe("Stored CLI config does not match the expected schema.");
    }
  });

  it("preserves a custom api base url when clearing persisted auth state", async () => {
    const dir = await mkdtemp(join(tmpdir(), "putio-cli-"));
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://staging.put.io",
        auth_token: "dummy-token",
      }),
      "utf8",
    );

    await Effect.runPromise(
      clearPersistedState(configPath).pipe(makeRuntimeLayer(), Effect.provide(NodeContext.layer)),
    );

    const contents = JSON.parse(await readFile(configPath, "utf8")) as {
      api_base_url: string;
      auth_token?: string;
    };

    expect(contents).toEqual({
      api_base_url: "https://staging.put.io",
    });
  });

  it("reuses a persisted custom api base url when saving a new token", async () => {
    const dir = await mkdtemp(join(tmpdir(), "putio-cli-"));
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
          token: "fresh-token",
        },
        configPath,
      ).pipe(makeRuntimeLayer(), Effect.provide(NodeContext.layer)),
    );

    expect(result.state).toEqual({
      api_base_url: "https://staging.put.io",
      auth_token: "fresh-token",
    });
  });

  it("removes the persisted config when clearing the default api base url", async () => {
    const dir = await mkdtemp(join(tmpdir(), "putio-cli-"));
    const configPath = join(dir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        api_base_url: "https://api.put.io",
        auth_token: "dummy-token",
      }),
      "utf8",
    );

    await Effect.runPromise(
      clearPersistedState(configPath).pipe(makeRuntimeLayer(), Effect.provide(NodeContext.layer)),
    );

    await expect(readFile(configPath, "utf8")).rejects.toThrow();
  });

  it("resolves auth state from persisted config when no env token is set", async () => {
    const dir = await mkdtemp(join(tmpdir(), "putio-cli-"));
    const configPath = join(dir, "config.json");

    await Effect.runPromise(
      savePersistedState(
        {
          token: "stored-token",
          apiBaseUrl: "https://api.put.io",
        },
        configPath,
      ).pipe(makeRuntimeLayer(), Effect.provide(NodeContext.layer)),
    );

    const authState = await Effect.runPromise(
      resolveAuthState().pipe(
        Effect.withConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["PUTIO_CLI_CONFIG_PATH", configPath],
              ["HOME", "/Users/tester"],
            ]),
          ),
        ),
        makeRuntimeLayer(),
        Effect.provide(NodeContext.layer),
      ),
    );

    expect(authState).toEqual({
      token: "stored-token",
      source: "config",
      apiBaseUrl: "https://api.put.io",
      configPath,
    });
  });

  it("reports auth status from persisted config when a token is stored", async () => {
    const dir = await mkdtemp(join(tmpdir(), "putio-cli-"));
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
        Effect.withConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["PUTIO_CLI_CONFIG_PATH", configPath],
              ["HOME", "/Users/tester"],
            ]),
          ),
        ),
        makeRuntimeLayer(),
        Effect.provide(NodeContext.layer),
      ),
    );

    expect(status).toEqual({
      authenticated: true,
      source: "config",
      apiBaseUrl: "https://staging.put.io",
      configPath,
    });
  });

  it("reports unauthenticated config status when the persisted token is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "putio-cli-"));
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
        Effect.withConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["PUTIO_CLI_CONFIG_PATH", configPath],
              ["HOME", "/Users/tester"],
            ]),
          ),
        ),
        makeRuntimeLayer(),
        Effect.provide(NodeContext.layer),
      ),
    );

    expect(status).toEqual({
      authenticated: false,
      source: null,
      apiBaseUrl: "https://staging.put.io",
      configPath,
    });
  });

  it("fails to resolve auth state when neither env nor config contains a token", async () => {
    const exit = await Effect.runPromiseExit(
      resolveAuthState().pipe(
        Effect.withConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["XDG_CONFIG_HOME", "/tmp/xdg"],
              ["HOME", "/Users/tester"],
            ]),
          ),
        ),
        makeRuntimeLayer(),
        Effect.provide(NodeContext.layer),
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
