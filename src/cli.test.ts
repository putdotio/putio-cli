import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NodeContext } from "@effect/platform-node";
import * as NodeTerminal from "@effect/platform-node/NodeTerminal";
import { ConfigProvider, Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { runCli as executeCli } from "./cli.js";
import { CliOutputLive } from "./internal/output-service.js";
import { CliRuntime, makeCliRuntime } from "./internal/runtime.js";

const errorText = (error: unknown) =>
  typeof error === "object" && error !== null && "message" in error
    ? String((error as { readonly message: unknown }).message)
    : JSON.stringify(error);

const runCli = async (argv: ReadonlyArray<string>) => {
  const processArgv = ["node", "putio", ...argv.slice(1)];
  const configDir = await mkdtemp(join(tmpdir(), "putio-cli-parser-"));
  const configPath = join(configDir, "config.json");

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
          Effect.provideService(
            CliRuntime,
            makeCliRuntime({
              argv: processArgv,
              homeDirectory: configDir,
            }),
          ),
          Effect.provide(Layer.mergeAll(NodeContext.layer, NodeTerminal.layer, CliOutputLive)),
        ),
      ),
    ),
  );

  return result;
};

describe("cli argv parsing", () => {
  it("renders the root help successfully", async () => {
    const result = await runCli(["putio"]);

    expect(result._tag).toBe("Right");
  });

  it("renders describe successfully", async () => {
    const result = await runCli(["putio", "describe"]);

    expect(result._tag).toBe("Right");
  });

  it("renders auth preview successfully without hitting the API", async () => {
    const result = await runCli([
      "putio",
      "auth",
      "preview",
      "--code",
      "PUTIO1",
      "--output",
      "json",
    ]);

    expect(result._tag).toBe("Right");
  });

  it("renders auth status successfully without a configured token", async () => {
    const result = await runCli(["putio", "auth", "status", "--output", "json"]);

    expect(result._tag).toBe("Right");
  });

  it("accepts repeated file ids for move and reaches auth resolution", async () => {
    const result = await runCli([
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
    const result = await runCli([
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
    const result = await runCli([
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
    const result = await runCli([
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
    const result = await runCli([
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
