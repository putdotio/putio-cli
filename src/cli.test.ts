import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ConfigProvider, Effect, Result } from "effect";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import packageJson from "../package.json";
import { runCli as executeCli } from "./cli.js";
import { makeCliAppLayer } from "./internal/app-layer.js";
import { makeCliRuntime } from "./internal/runtime.js";

const errorText = (error: unknown) =>
  typeof error === "object" && error !== null && "message" in error
    ? String((error as { readonly message: unknown }).message)
    : JSON.stringify(error);

type CliExecution = {
  readonly result: Result.Result<void, unknown>;
  readonly stderr: string;
  readonly stdout: string;
};

const parseCapturedText = (args: ReadonlyArray<unknown>) =>
  args
    .map((value) => (typeof value === "string" ? value : JSON.stringify(value)))
    .join(" ")
    .trim();

const parseJsonOutput = (value: string) => JSON.parse(value) as Record<string, unknown>;

const runProcessArgv = async (processArgv: ReadonlyArray<string>): Promise<CliExecution> => {
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
        Effect.result(
          executeCli(processArgv).pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({
                PUTIO_CLI_CONFIG_PATH: configPath,
                XDG_CONFIG_HOME: configDir,
              }),
            ),
            Effect.provide(
              makeCliAppLayer(
                makeCliRuntime({
                  argv: processArgv,
                  homeDirectory: configDir,
                  writeStdout: (message) => {
                    stdoutChunks.push(message.trim());
                  },
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

const runCli = (argv: ReadonlyArray<string>): Promise<CliExecution> =>
  runProcessArgv(["node", "putio", ...argv.slice(1)]);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cli argv parsing", () => {
  it("renders the root help successfully", async () => {
    const { result, stdout } = await runCli(["putio"]);

    expect(result._tag).toBe("Success");
    expect(stdout).toContain("Use `putio describe` or `putio --help`.");
  });

  it("renders the global version without double-prefixing", async () => {
    const { result, stdout } = await runCli(["putio", "--version"]);

    expect(result._tag).toBe("Success");
    expect(stdout).toBe(`putio v${packageJson.version}`);
  });

  it("accepts argv that already starts at the CLI binary", async () => {
    const { result, stdout } = await runProcessArgv(["putio", "--version"]);

    expect(result._tag).toBe("Success");
    expect(stdout).toBe(`putio v${packageJson.version}`);
  });

  it("renders describe as machine-readable json", async () => {
    const { result, stdout } = await runCli(["putio", "describe"]);

    expect(result._tag).toBe("Success");
    expect(parseJsonOutput(stdout)).toMatchObject({
      binary: "putio",
      output: {
        defaultInteractive: "text",
        defaultNonInteractive: "json",
        internalRenderers: ["json", "terminal", "ndjson"],
      },
    });
    expect(parseJsonOutput(stdout).commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auth: { required: true },
          capabilities: expect.objectContaining({
            dryRun: false,
            fieldSelection: true,
            rawJsonInput: false,
          }),
          command: "files list",
          input: expect.objectContaining({
            flags: expect.arrayContaining([
              expect.objectContaining({
                name: "fields",
                type: "string",
              }),
              expect.objectContaining({
                defaultValue: false,
                name: "page-all",
                type: "boolean",
              }),
            ]),
          }),
          kind: "read",
        }),
      ]),
    );
    const commands = parseJsonOutput(stdout).commands as ReadonlyArray<{
      readonly command: string;
      readonly input: {
        readonly json?: {
          readonly properties?: ReadonlyArray<{
            readonly name: string;
            readonly required: boolean;
          }>;
        };
      };
    }>;
    const mkdir = commands.find((entry) => entry.command === "files mkdir");
    const deleteFiles = commands.find((entry) => entry.command === "files delete");

    expect(mkdir?.input.json?.properties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "name", required: true }),
        expect.objectContaining({ name: "parent_id", required: false }),
      ]),
    );
    expect(deleteFiles?.input.json?.properties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "ids", required: true }),
        expect.objectContaining({ name: "skip_trash", required: false }),
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

    expect(result._tag).toBe("Success");
    expect(parseJsonOutput(stdout)).toMatchObject({
      browserOpened: false,
      code: "PUTIO1",
      linkUrl: "https://app.put.io/link?code=PUTIO1",
    });
  });

  it("renders auth status as json without a configured token", async () => {
    const { result, stdout } = await runCli(["putio", "auth", "status", "--output", "json"]);

    expect(result._tag).toBe("Success");
    expect(parseJsonOutput(stdout)).toMatchObject({
      apiBaseUrl: "https://api.put.io",
      authenticated: false,
      defaultProfile: null,
      profile: null,
      source: null,
    });
  });

  it("defaults to json output for non-interactive auth status", async () => {
    const { result, stdout } = await runCli(["putio", "auth", "status"]);

    expect(result._tag).toBe("Success");
    expect(parseJsonOutput(stdout)).toMatchObject({
      apiBaseUrl: "https://api.put.io",
      authenticated: false,
      defaultProfile: null,
      profile: null,
      source: null,
    });
  });

  it("renders auth profiles list as json", async () => {
    const { result, stdout } = await runCli([
      "putio",
      "auth",
      "profiles",
      "list",
      "--output",
      "json",
    ]);

    expect(result._tag).toBe("Success");
    expect(parseJsonOutput(stdout)).toMatchObject({
      defaultProfile: null,
      profiles: [],
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

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(errorText(result.failure)).toContain("No put.io token is configured");
      expect(errorText(result.failure)).not.toContain("not a integer");
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

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(errorText(result.failure)).toContain("No put.io token is configured");
      expect(errorText(result.failure)).not.toContain("not a integer");
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

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(errorText(result.failure)).toContain("No put.io token is configured");
      expect(errorText(result.failure)).not.toContain("not a integer");
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

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(errorText(result.failure)).toContain("No put.io token is configured");
      expect(errorText(result.failure)).not.toContain("not a integer");
    }
  });

  it("still rejects invalid repeated integer input", async () => {
    const { result, stderr, stdout } = await runCli([
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

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(`${stdout}\n${stderr}\n${errorText(result.failure)}`).toContain(
        "Expected `--id` values to be integers",
      );
    }
  });

  it("keeps structured parser failures machine-readable", async () => {
    const { result, stderr, stdout } = await runCli([
      "putio",
      "files",
      "list",
      "--parent-id",
      "foo",
      "--output",
      "json",
    ]);

    expect(result._tag).toBe("Failure");
    expect(stdout).toBe("");
    expect(stderr).toBe("");
    if (result._tag === "Failure") {
      expect(errorText(result.failure)).toContain("Invalid value for flag --parent-id");
      expect(errorText(result.failure)).not.toContain("Help requested");
    }
  });

  it("rejects whitespace-only JSON names before write dry-runs", async () => {
    const mkdir = await runCli([
      "putio",
      "files",
      "mkdir",
      "--json",
      '{"parent_id":1,"name":"   "}',
      "--dry-run",
      "--output",
      "json",
    ]);
    const rename = await runCli([
      "putio",
      "files",
      "rename",
      "--json",
      '{"file_id":1,"name":"   "}',
      "--dry-run",
      "--output",
      "json",
    ]);

    expect(mkdir.result._tag).toBe("Failure");
    expect(rename.result._tag).toBe("Failure");
    if (mkdir.result._tag === "Failure") {
      expect(errorText(mkdir.result.failure)).toContain("Expected `--json` to match");
    }
    if (rename.result._tag === "Failure") {
      expect(errorText(rename.result.failure)).toContain("Expected `--json` to match");
    }
  });
});
