import { describe, expect, it } from "vite-plus/test";

import { renderFilesTerminal } from "../internal/terminal/files-terminal.js";

import {
  renderFileCreatedTerminal,
  renderFileRenamedTerminal,
  renderFilesDeletedTerminal,
  renderFilesMovedTerminal,
} from "./files.js";

describe("renderFilesTerminal", () => {
  it("renders a human-friendly table", () => {
    expect(
      renderFilesTerminal({
        files: [
          {
            id: 1,
            file_type: "FOLDER",
            size: 0,
            name: "Movies",
          },
          {
            id: 2,
            file_type: "VIDEO",
            size: 42,
            name: "movie.mkv",
          },
        ],
      }),
    ).toContain("Showing 2 file(s).");
  });

  it("renders an empty state", () => {
    expect(renderFilesTerminal({ files: [] })).toBe("No files found.");
  });
});

describe("file mutation renderers", () => {
  it("renders folder creation feedback", () => {
    expect(
      renderFileCreatedTerminal({
        id: 42,
        name: "Projects",
        parent_id: 0,
      }),
    ).toBe('created folder "Projects" (id 42, parent 0)');
  });

  it("renders rename feedback", () => {
    expect(
      renderFileRenamedTerminal({
        fileId: 42,
        name: "Projects 2026",
      }),
    ).toBe('renamed file 42 to "Projects 2026"');
  });

  it("renders delete feedback", () => {
    expect(
      renderFilesDeletedTerminal({
        ids: [1, 2],
        skipped: 1,
        skipTrash: true,
      }),
    ).toContain("deleted file ids: 1, 2");
  });

  it("renders move feedback and move errors", () => {
    expect(
      renderFilesMovedTerminal({
        ids: [1, 2],
        parentId: 9,
        errors: [
          {
            id: 2,
            error_type: "NAME_ALREADY_EXIST",
            status_code: 400,
          },
        ],
      }),
    ).toContain("move errors: 1");
  });
});
