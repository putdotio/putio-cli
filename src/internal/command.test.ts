import { describe, expect, it } from "vitest";
import { Effect, Option, Schema } from "effect";

import { decodeJsonOption, parseRepeatedIntegers } from "./command.js";

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

describe("decodeJsonOption", () => {
  const schema = Schema.Struct({
    ids: Schema.Array(Schema.Number),
  });

  it("decodes valid json input", async () => {
    await expect(Effect.runPromise(decodeJsonOption(schema, '{"ids":[1,2]}'))).resolves.toEqual({
      ids: [1, 2],
    });
  });

  it("fails on invalid json", async () => {
    await expect(Effect.runPromiseExit(decodeJsonOption(schema, "{nope"))).resolves.toMatchObject({
      _tag: "Failure",
    });
  });

  it("fails with a tagged input error when the payload shape is wrong", async () => {
    const exit = await Effect.runPromiseExit(decodeJsonOption(schema, '{"ids":"nope"}'));

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("CliCommandInputError");
    }
  });
});
