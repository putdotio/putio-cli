import { describe, expect, it } from "vitest";
import { Option } from "effect";

import { parseRepeatedIntegers } from "./command.js";

describe("parseRepeatedIntegers", () => {
  it("parses repeated integer strings", () => {
    expect(Option.getOrUndefined(parseRepeatedIntegers(["1", "2", "3"]))).toEqual([1, 2, 3]);
  });

  it("preserves zero and negative integers", () => {
    expect(Option.getOrUndefined(parseRepeatedIntegers(["0", "-2"]))).toEqual([0, -2]);
  });

  it("rejects non-integer values", () => {
    expect(Option.isNone(parseRepeatedIntegers(["1", "2.5"]))).toBe(true);
  });
});
