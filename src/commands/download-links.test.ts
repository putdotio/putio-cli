import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { renderDownloadLinksTerminal } from "../internal/terminal/download-links-terminal.js";

import {
  DownloadLinksCreateInputSchema,
  resolveDownloadLinksCreateInput,
  toOptionalIds,
} from "./download-links.js";

describe("toOptionalIds", () => {
  it("normalizes empty repeated options to undefined", () => {
    expect(toOptionalIds([])).toBeUndefined();
  });

  it("preserves provided ids", () => {
    expect(toOptionalIds([1, 2])).toEqual([1, 2]);
  });

  it("preserves zero as a valid id value", () => {
    expect(toOptionalIds([0])).toEqual([0]);
  });
});

describe("resolveDownloadLinksCreateInput", () => {
  it("accepts explicit file ids", () => {
    expect(
      resolveDownloadLinksCreateInput({
        cursor: undefined,
        excludeIds: [2],
        ids: [1],
      }),
    ).toEqual({
      cursor: undefined,
      excludeIds: [2],
      ids: [1],
    });
  });

  it("accepts a cursor without ids", () => {
    expect(
      resolveDownloadLinksCreateInput({
        cursor: "cursor-1",
        excludeIds: undefined,
        ids: undefined,
      }),
    ).toEqual({
      cursor: "cursor-1",
      excludeIds: undefined,
      ids: undefined,
    });
  });

  it("rejects empty input", () => {
    expect(() =>
      resolveDownloadLinksCreateInput({
        cursor: undefined,
        excludeIds: undefined,
        ids: undefined,
      }),
    ).toThrow("Provide at least one --id or a --cursor to create download links.");
  });

  it("accepts raw json that matches the create schema", () => {
    const input = Schema.decodeUnknownSync(DownloadLinksCreateInputSchema)({
      cursor: "cursor-1",
      excludeIds: [2],
      ids: [1],
    });

    expect(resolveDownloadLinksCreateInput(input)).toEqual({
      cursor: "cursor-1",
      excludeIds: [2],
      ids: [1],
    });
  });
});

describe("renderDownloadLinksTerminal", () => {
  it("renders nonterminal task state", () => {
    expect(
      renderDownloadLinksTerminal({
        links_status: "IN_QUEUE",
        error_msg: null,
        links: null,
      }),
    ).toBe("Status: IN_QUEUE\nError: none");
  });

  it("renders terminal task links", () => {
    expect(
      renderDownloadLinksTerminal({
        links_status: "COMPLETED",
        links: {
          download_links: ["https://download"],
          media_links: ["https://media"],
          mp4_links: ["https://mp4"],
        },
      }),
    ).toContain("Download links (1)");
  });
});
