import { describe, expect, it } from "vitest";

import { formatNullable, formatPercent, humanFileSize, truncate } from "./format.js";

describe("humanFileSize", () => {
  it("formats bytes below one kilobyte without scaling", () => {
    expect(humanFileSize(512)).toBe("512 B");
    expect(humanFileSize(-512)).toBe("-512 B");
  });

  it("formats larger values with scaled units", () => {
    expect(humanFileSize(1_536)).toBe("1.5 KB");
    expect(humanFileSize(12_582_912)).toBe("12 MB");
  });
});

describe("truncate", () => {
  it("handles non-positive widths", () => {
    expect(truncate("putio", 0)).toBe("");
    expect(truncate("putio", -1)).toBe("");
  });

  it("returns the original value when it already fits", () => {
    expect(truncate("putio", 5)).toBe("putio");
  });

  it("uses an ellipsis when truncating", () => {
    expect(truncate("putio", 1)).toBe("…");
    expect(truncate("putio", 4)).toBe("put…");
  });
});

describe("formatPercent", () => {
  it("rounds numeric values", () => {
    expect(formatPercent(49.6)).toBe("50%");
  });

  it("renders empty values as em dash", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(undefined)).toBe("—");
  });
});

describe("formatNullable", () => {
  it("returns non-empty strings as-is", () => {
    expect(formatNullable("altay")).toBe("altay");
  });

  it("renders empty values as em dash", () => {
    expect(formatNullable("")).toBe("—");
    expect(formatNullable(null)).toBe("—");
    expect(formatNullable(undefined)).toBe("—");
  });
});
