import { describe, expect, it } from "vite-plus/test";

import { renderTransfersTerminal } from "./transfers-terminal.js";

describe("renderTransfersTerminal", () => {
  it("renders a compact transfer table", () => {
    const output = renderTransfersTerminal({
      transfers: [{ id: 1, status: "DOWNLOADING", percent_done: 42, name: "Ubuntu ISO" }],
    });

    expect(output).toContain("Showing 1 transfer(s).");
    expect(output).toContain("┌");
    expect(output).toContain("DOWNLOADING");
    expect(output).toContain("Ubuntu ISO");
  });

  it("renders an empty state", () => {
    expect(renderTransfersTerminal({ transfers: [] })).toBe("No active transfers.");
  });
});
