import { describe, expect, it } from "vitest";

import { renderDownloadLinksTerminal } from "./download-links-terminal.js";

describe("renderDownloadLinksTerminal", () => {
  it("renders grouped link sections", () => {
    expect(
      renderDownloadLinksTerminal({
        links_status: "DONE",
        links: {
          download_links: ["https://download"],
          media_links: [],
          mp4_links: ["https://mp4"],
        },
      }),
    ).toContain("Download links");
  });

  it("renders a pending state", () => {
    expect(
      renderDownloadLinksTerminal({
        links_status: "IN_QUEUE",
        error_msg: null,
        links: null,
      }),
    ).toBe("Status: IN_QUEUE\nError: none");
  });
});
