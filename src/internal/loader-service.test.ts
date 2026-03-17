import { describe, expect, it } from "vitest";

import { shouldUseTerminalLoader } from "./loader-service.js";

describe("shouldUseTerminalLoader", () => {
  it("uses loaders for default terminal output on interactive terminals", () => {
    expect(shouldUseTerminalLoader(undefined, true)).toBe(true);
  });

  it("does not use loaders for json output", () => {
    expect(shouldUseTerminalLoader("json", true)).toBe(false);
  });

  it("does not use loaders on non-interactive terminals", () => {
    expect(shouldUseTerminalLoader(undefined, false)).toBe(false);
  });
});
