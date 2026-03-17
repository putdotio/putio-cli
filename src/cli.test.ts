import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ConfigProvider, Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { runCli as executeCli } from "./cli.js";
import { makeCliAppLayer } from "./internal/app-layer.js";
import { makeCliRuntime } from "./internal/runtime.js";

const errorText = (error: unknown) =>
  typeof error === "object" && error !== null && "message" in error
    ? String((error as { readonly message: unknown }).message)
    : JSON.stringify(error);

type CliExecution = {
  readonly result: Awaited<ReturnType<typeof Effect.runPromise>>;
  readonly stderr: string;
  readonly stdout: string;
};

const parseCapturedText = (args: ReadonlyArray<unknown>) =>
  args
    .map((value) => (typeof value === "string" ? value : JSON.stringify(value)))
    .join(" ")
    .trim();

const parseJsonOutput = (value: string) => JSON.parse(value) as Record<string, unknown>;

const runCli = async (argv: ReadonlyArray<string>): Promise<CliExecution> => {
  const processArgv = ["node", "putio", ...argv.slice(1)];
  const configDir = await mkdtemp(join(tmpdir(), "putio-cli-parser-"));
  const configPath = join(configDir, "config.json");
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const consoleLogSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
    stdoutChunks.push(parseCapturedText(args));
  });
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
    stderrChunks.push(parseCapturedText(args));
  });

  try {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.either(
          executeCli(processArgv).pipe(
            Effect.withConfigProvider(
              ConfigProvider.fromMap(
                new Map([
                  ["PUTIO_CLI_CONFIG_PATH", configPath],
                  ["XDG_CONFIG_HOME", configDir],
                ]),
              ),
            ),
            Effect.provide(
              makeCliAppLayer(
                makeCliRuntime({
                  argv: processArgv,
                  homeDirectory: configDir,
                }),
              ),
            ),
          ),
        ),
      ),
    );

    return {
      result,
      stderr: stderrChunks.join("\n"),
      stdout: stdoutChunks.join("\n"),
    };
  } finally {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  }
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cli argv parsing", () => {
  it("renders the root help successfully", async () => {
    const { result, stdout } = await runCli(["putio"]);

    expect(result._tag).toBe("Right");
    expect(stdout).toContain("Use `putio describe` or `putio --help`.");
  });

  it("renders describe as machine-readable json", async () => {
    const { result, stdout } = await runCli(["putio", "describe"]);

    expect(result._tag).toBe("Right");
    expect(parseJsonOutput(stdout)).toMatchObject({
      binary: "putio",
      output: {
        default: "text",
        internalRenderers: ["json", "terminal"],
      },
    });
    expect(parseJsonOutput(stdout).commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auth: { required: true },
          command: "files delete",
          kind: "write",
        }),
      ]),
    );
  });

  it("renders auth preview as json without hitting the API", async () => {
    const { result, stdout } = await runCli([
      "putio",
      "auth",
      "preview",
      "--code",
      "PUTIO1",
      "--output",
      "json",
    ]);

    expect(result._tag).toBe("Right");
    expect(parseJsonOutput(stdout)).toMatchObject({
      browserOpened: false,
      code: "PUTIO1",
      linkUrl: "https://app.put.io/link?code=PUTIO1",
    });
  });

  it("renders auth status as json without a configured token", async () => {
    const { result, stdout } = await runCli(["putio", "auth", "status", "--output", "json"]);

    expect(result._tag).toBe("Right");
    expect(parseJsonOutput(stdout)).toMatchObject({
      apiBaseUrl: "https://api.put.io",
      authenticated: false,
      source: null,
    });
  });

  it("accepts repeated file ids for move and reaches auth resolution", async () => {
    const { result } = await runCli([
      "putio",
      "files",
      "move",
      "--id",
      "1",
      "--id",
      "2",
      "--parent-id",
      "3",
      "--output",
      "json",
    ]);

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(errorText(result.left)).toContain("No put.io token is configured");
      expect(errorText(result.left)).not.toContain("not a integer");
    }
  });

  it("accepts repeated file ids for delete and reaches auth resolution", async () => {
    const { result } = await runCli([
      "putio",
      "files",
      "delete",
      "--id",
      "1",
      "--id",
      "2",
      "--output",
      "json",
    ]);

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(errorText(result.left)).toContain("No put.io token is configured");
      expect(errorText(result.left)).not.toContain("not a integer");
    }
  });

  it("accepts repeated transfer ids for cancel and reaches auth resolution", async () => {
    const { result } = await runCli([
      "putio",
      "transfers",
      "cancel",
      "--id",
      "1",
      "--id",
      "2",
      "--output",
      "json",
    ]);

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(errorText(result.left)).toContain("No put.io token is configured");
      expect(errorText(result.left)).not.toContain("not a integer");
    }
  });

  it("accepts repeated download-link ids and reaches auth resolution", async () => {
    const { result } = await runCli([
      "putio",
      "download-links",
      "create",
      "--id",
      "1",
      "--id",
      "2",
      "--output",
      "json",
    ]);

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(errorText(result.left)).toContain("No put.io token is configured");
      expect(errorText(result.left)).not.toContain("not a integer");
    }
  });

  it("still rejects invalid repeated integer input", async () => {
    const { result } = await runCli([
      "putio",
      "files",
      "move",
      "--id",
      "1",
      "--id",
      "nope",
      "--parent-id",
      "3",
      "--output",
      "json",
    ]);

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(errorText(result.left)).toContain("Expected `--id` values to be integers");
    }
  });
});
