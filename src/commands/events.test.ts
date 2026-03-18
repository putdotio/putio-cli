import { describe, expect, it } from "vite-plus/test";

import { renderEventsTerminal } from "../internal/terminal/events-terminal.js";

import { filterEventsByType } from "./events.js";

const events = [
  {
    id: 1,
    type: "transfer_completed",
    created_at: "2026-03-14T10:00:00Z",
    transfer_name: "ubuntu.iso",
  },
  {
    id: 2,
    type: "file_shared",
    created_at: "2026-03-14T11:00:00Z",
    file_name: "movie.mkv",
  },
] as const;

describe("filterEventsByType", () => {
  it("returns all events when no type is requested", () => {
    expect(filterEventsByType(events, undefined)).toEqual(events);
  });

  it("filters to the requested type", () => {
    expect(filterEventsByType(events, "file_shared")).toEqual([events[1]]);
  });
});

describe("renderEventsTerminal", () => {
  it("renders event tables with the best available resource name", () => {
    expect(renderEventsTerminal({ events })).toContain("movie.mkv");
    expect(renderEventsTerminal({ events })).toContain("ubuntu.iso");
  });
});
