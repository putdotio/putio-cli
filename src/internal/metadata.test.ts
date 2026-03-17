import { describe, expect, it } from "vitest";

import { describeCli } from "./metadata.js";

describe("describeCli", () => {
  it("returns agent-facing command metadata", () => {
    const metadata = describeCli();
    const describeCommand = metadata.commands.find((command) => command.command === "describe");
    const whoamiCommand = metadata.commands.find((command) => command.command === "whoami");
    const filesDeleteCommand = metadata.commands.find(
      (command) => command.command === "files delete",
    );

    expect(metadata.binary).toBe("putio");
    expect(metadata.output.default).toBe("text");
    expect(metadata.output.internalRenderers).toEqual(["json", "terminal"]);
    expect(metadata.commands.map((command) => command.command)).toEqual([
      "describe",
      "brand",
      "version",
      "auth status",
      "auth login",
      "auth preview",
      "auth logout",
      "whoami",
      "download-links create",
      "download-links get",
      "events list",
      "files list",
      "files mkdir",
      "files rename",
      "files move",
      "files delete",
      "files search",
      "search",
      "transfers list",
      "transfers add",
      "transfers cancel",
      "transfers retry",
      "transfers reannounce",
      "transfers watch",
      "transfers clean",
    ]);
    expect(describeCommand).toMatchObject({
      auth: { required: false },
      capabilities: {
        dryRun: false,
        fieldSelection: false,
        rawJsonInput: false,
        streaming: false,
      },
      kind: "utility",
    });
    expect(whoamiCommand).toMatchObject({
      auth: { required: true },
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
    expect(metadata.auth.envPrecedence).toEqual(["PUTIO_CLI_TOKEN"]);
    expect(metadata.auth.loginAppId).toBe("8993");
    expect(metadata.auth.loginOpensBrowserByDefault).toBe(false);
  });
});
