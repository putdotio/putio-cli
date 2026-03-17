import { describe, expect, it } from "vitest";

import { renderFilesTerminal } from "./files-terminal.js";

describe("renderFilesTerminal", () => {
  it("renders a compact file table", () => {
    const output = renderFilesTerminal({
      total: 2,
      parent: { name: "Downloads" },
      files: [
        { id: 1, file_type: "FOLDER", size: 0, name: "Movies" },
        { id: 2, file_type: "VIDEO", size: 2_097_152, name: "movie.mkv" },
      ],
    });

    expect(output).toContain("Showing 2 file(s) in Downloads (2 total).");
    expect(output).toContain("┌");
    expect(output).toContain("│ ID");
    expect(output).toContain("Movies");
    expect(output).toContain("movie.mkv");
  });

  it("renders an empty state", () => {
    expect(renderFilesTerminal({ files: [], parent: { name: "Downloads" } })).toBe(
      "No files found in Downloads.",
    );
  });
});
