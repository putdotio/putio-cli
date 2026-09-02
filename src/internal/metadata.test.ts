import { describe, expect, it } from "vite-plus/test";

import { describeCli } from "./metadata.js";

describe("describeCli", () => {
  it("returns agent-facing command metadata", () => {
    const metadata = describeCli();
    const describeCommand = metadata.commands.find((command) => command.command === "describe");
    const whoamiCommand = metadata.commands.find((command) => command.command === "whoami");
    const filesListCommand = metadata.commands.find((command) => command.command === "files list");
    const filesDeleteCommand = metadata.commands.find(
      (command) => command.command === "files delete",
    );
    const filesMoveCommand = metadata.commands.find((command) => command.command === "files move");
    const filesRenameCommand = metadata.commands.find(
      (command) => command.command === "files rename",
    );
    const transfersListCommand = metadata.commands.find(
      (command) => command.command === "transfers list",
    );
    const authProfilesUseCommand = metadata.commands.find(
      (command) => command.command === "auth profiles use",
    );

    expect(metadata.binary).toBe("putio");
    expect(metadata.crashReporting).toEqual({
      capturedFields: [
        "event_id",
        "timestamp",
        "fixed_message",
        "failure_kind",
        "fixed_component",
        "fixed_platform",
        "fixed_environment",
        "fixed_fingerprint",
        "fixed_level",
        "fixed_logger",
        "package_release",
        "provider_envelope_metadata",
      ],
      defaultEnabled: true,
      disabledReason: null,
      disableCommand: "telemetry disable",
      enabled: true,
      enableCommand: "telemetry enable",
      flushDeadlineMs: 250,
      persistedConfigField: "telemetry_disabled",
      provider: "Sentry",
      statusCommand: "telemetry status",
    });
    expect(metadata.automation).toMatchObject({
      consumerSkillLibrary: true,
      defaultNonInteractiveOutput: "json",
      dryRunForWrites: true,
      fieldSelectionForReads: true,
      rawJsonInputForWrites: true,
      schemaIntrospection: true,
      secretRedaction: true,
      supportedOutputModes: ["json", "text", "ndjson"],
      untrustedTextAnnotations: true,
    });
    expect(metadata.automation.streamingReadCommands).toEqual([
      "files list",
      "files search",
      "search",
      "transfers list",
      "transfers watch",
    ]);
    expect(metadata.output.defaultInteractive).toBe("text");
    expect(metadata.output.defaultNonInteractive).toBe("json");
    expect(metadata.output.internalRenderers).toEqual(["json", "terminal", "ndjson"]);
    expect(metadata.commands.map((command) => command.command)).toEqual([
      "describe",
      "brand",
      "version",
      "auth approve",
      "auth login",
      "auth status",
      "auth logout",
      "auth preview",
      "auth profiles list",
      "auth profiles use",
      "auth profiles remove",
      "whoami",
      "download-links create",
      "download-links get",
      "events list",
      "files hls-manifest",
      "files start-from get",
      "files start-from set",
      "files start-from reset",
      "files list",
      "files search",
      "files mkdir",
      "files upload",
      "files rename",
      "files move",
      "files delete",
      "search",
      "sdk list",
      "sdk call",
      "telemetry status",
      "telemetry disable",
      "telemetry enable",
      "transfers list",
      "transfers add",
      "transfers cancel",
      "transfers retry",
      "transfers clean",
      "transfers reannounce",
      "transfers watch",
    ]);
    expect(describeCommand).toMatchObject({
      auth: { required: false },
      capabilities: {
        dryRun: false,
        fieldSelection: false,
        rawJsonInput: false,
        streaming: false,
      },
      input: {
        flags: expect.arrayContaining([
          expect.objectContaining({
            name: "output",
            type: "enum",
          }),
        ]),
      },
      kind: "utility",
    });
    expect(whoamiCommand).toMatchObject({
      auth: { required: true },
      capabilities: {
        fieldSelection: true,
      },
      input: {
        flags: expect.arrayContaining([
          expect.objectContaining({
            name: "fields",
            type: "string",
          }),
        ]),
      },
      kind: "read",
    });
    expect(filesListCommand).toMatchObject({
      capabilities: {
        fieldSelection: true,
        streaming: true,
      },
      input: {
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
      },
      kind: "read",
    });
    expect(filesDeleteCommand).toMatchObject({
      auth: { required: true },
      capabilities: {
        dryRun: true,
        rawJsonInput: true,
      },
      input: {
        flags: expect.arrayContaining([
          expect.objectContaining({
            name: "dry-run",
            required: false,
            type: "boolean",
          }),
          expect.objectContaining({
            name: "json",
            required: false,
            type: "string",
          }),
          expect.objectContaining({
            name: "id",
            repeated: true,
            type: "integer",
          }),
        ]),
        json: {
          kind: "object",
          properties: expect.arrayContaining([
            expect.objectContaining({
              name: "ids",
              required: true,
            }),
          ]),
        },
      },
      kind: "write",
    });
    expect(filesRenameCommand).toMatchObject({
      input: {
        json: {
          kind: "object",
          rules: [
            "`name` rejects control characters and path traversal segments like `../` or `%2e`.",
          ],
        },
      },
      kind: "write",
    });
    expect(filesMoveCommand).toMatchObject({
      input: {
        json: {
          kind: "object",
          properties: expect.arrayContaining([
            expect.objectContaining({
              name: "parent_id",
              required: true,
            }),
          ]),
        },
      },
    });
    expect(transfersListCommand).toMatchObject({
      capabilities: {
        fieldSelection: true,
        streaming: true,
      },
      input: {
        flags: expect.arrayContaining([
          expect.objectContaining({
            name: "fields",
          }),
          expect.objectContaining({
            name: "page-all",
          }),
        ]),
      },
      kind: "read",
    });
    expect(authProfilesUseCommand).toMatchObject({
      input: {
        arguments: [
          expect.objectContaining({
            name: "profile",
            required: true,
            type: "string",
          }),
        ],
      },
    });
    expect(metadata.auth.envPrecedence).toEqual(["PUTIO_CLI_TOKEN"]);
    expect(metadata.auth.loginAppId).toBe("8993");
    expect(metadata.auth.loginOpensBrowserByDefault).toBe(false);
    expect(metadata.auth.persistedConfigShape).toMatchObject({
      api_base_url: { required: true, type: "string" },
      auth_token: { required: false, type: "string" },
      default_profile: { required: false, type: "string" },
      profiles: {
        required: false,
        type: "record",
        values: {
          api_base_url: { required: false, type: "string" },
          auth_token: { required: false, type: "string" },
        },
      },
      telemetry_disabled: { required: false, type: "boolean" },
    });
    expect(metadata.auth.profileEnv).toBe("PUTIO_CLI_PROFILE");
  });

  it("reports an effective crash-reporting opt-out", () => {
    const metadata = describeCli({ enabled: false, reason: "persisted_opt_out" });

    expect(metadata.crashReporting.enabled).toBe(false);
    expect(metadata.crashReporting.disabledReason).toBe("persisted_opt_out");
  });

  it("reports a source build without injected crash-reporting configuration", () => {
    const metadata = describeCli({
      enabled: false,
      reason: "build_configuration_unavailable",
    });

    expect(metadata.crashReporting.enabled).toBe(false);
    expect(metadata.crashReporting.disabledReason).toBe("build_configuration_unavailable");
  });
});
