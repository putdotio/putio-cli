import { describe, expect, it } from "vitest";

import { renderEventsTerminal } from "./events-terminal.js";

describe("renderEventsTerminal", () => {
  it("renders a compact event table", () => {
    const output = renderEventsTerminal({
      events: [
        {
          id: 1,
          type: "transfer_completed",
          created_at: "2026-03-14T10:00:00Z",
          transfer_name: "ubuntu.iso",
        },
      ],
    });

    expect(output).toContain("Showing 1 event(s).");
    expect(output).toContain("┌");
    expect(output).toContain("transfer_completed");
    expect(output).toContain("ubuntu.iso");
  });

  it("renders an empty state", () => {
    expect(renderEventsTerminal({ events: [] })).toBe("No events found.");
  });
});
