import { describe, expect, it } from "vitest";

import { describeCli } from "./metadata.js";

describe("describeCli", () => {
  it("returns agent-facing command metadata", () => {
    const metadata = describeCli();

    expect(metadata.binary).toBe("putio");
    expect(metadata.output.default).toBe("text");
    expect(metadata.output.internalRenderers).toEqual(["json", "terminal"]);
    expect(metadata.commands.some((command) => command.command === "describe")).toBe(true);
    expect(metadata.commands.some((command) => command.command === "brand")).toBe(true);
    expect(metadata.commands.some((command) => command.command === "version")).toBe(true);
    expect(metadata.commands.some((command) => command.command === "auth login")).toBe(true);
    expect(metadata.commands.some((command) => command.command === "auth preview")).toBe(true);
    expect(metadata.commands.some((command) => command.command === "auth logout")).toBe(true);
    expect(metadata.commands.some((command) => command.command === "whoami")).toBe(true);
    expect(metadata.commands.some((command) => command.command === "files mkdir")).toBe(true);
    expect(metadata.commands.some((command) => command.command === "files rename")).toBe(true);
    expect(metadata.commands.some((command) => command.command === "files move")).toBe(true);
    expect(metadata.commands.some((command) => command.command === "files delete")).toBe(true);
    expect(metadata.commands.some((command) => command.command === "files search")).toBe(true);
    expect(metadata.commands.some((command) => command.command === "transfers add")).toBe(true);
    expect(metadata.commands.some((command) => command.command === "transfers reannounce")).toBe(
      true,
    );
    expect(metadata.commands.some((command) => command.command === "transfers watch")).toBe(true);
    expect(metadata.commands.some((command) => command.command === "download-links create")).toBe(
      true,
    );
    expect(metadata.commands.some((command) => command.command === "events list")).toBe(true);
    expect(metadata.auth.envPrecedence).toEqual(["PUTIO_CLI_TOKEN"]);
    expect(metadata.auth.loginAppId).toBe("8993");
    expect(metadata.auth.loginOpensBrowserByDefault).toBe(false);
  });
});
