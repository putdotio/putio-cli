import { describe, expect, it } from "vitest";
import { Effect, Option, Schema } from "effect";

import {
  collectAllCursorPages,
  decodeJsonOption,
  parseRepeatedIntegers,
  resolveReadOutputControls,
  selectTopLevelFields,
  validateNameLikeInput,
  validateResourceIdentifier,
} from "./command.js";
import { makeCliRuntime, CliRuntime } from "./runtime.js";

const provideRuntime = <A, E, R>(effect: Effect.Effect<A, E, R>, isInteractiveTerminal = true) =>
  effect.pipe(
    Effect.provideService(
      CliRuntime,
      makeCliRuntime({
        argv: ["node", "putio"],
        isInteractiveTerminal,
      }),
    ),
  );

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

describe("resolveReadOutputControls", () => {
  it("parses requested fields for json output", async () => {
    await expect(
      Effect.runPromise(
        provideRuntime(
          resolveReadOutputControls({
            fields: Option.some("info, auth"),
            output: "json",
            pageAll: false,
          }),
        ),
      ),
    ).resolves.toEqual({
      output: "json",
      outputMode: "json",
      pageAll: false,
      requestedFields: ["info", "auth"],
    });
  });

  it("defaults to json in non-interactive mode", async () => {
    await expect(
      Effect.runPromise(
        provideRuntime(
          resolveReadOutputControls({
            fields: Option.some("info"),
            output: undefined,
            pageAll: false,
          }),
          false,
        ),
      ),
    ).resolves.toEqual({
      output: undefined,
      outputMode: "json",
      pageAll: false,
      requestedFields: ["info"],
    });
  });

  it("accepts ndjson as structured output", async () => {
    await expect(
      Effect.runPromise(
        provideRuntime(
          resolveReadOutputControls({
            fields: Option.some("info"),
            output: "ndjson",
            pageAll: true,
          }),
        ),
      ),
    ).resolves.toEqual({
      output: "ndjson",
      outputMode: "ndjson",
      pageAll: true,
      requestedFields: ["info"],
    });
  });

  it("rejects fields in terminal mode", async () => {
    await expect(
      Effect.runPromiseExit(
        provideRuntime(
          resolveReadOutputControls({
            fields: Option.some("info"),
            output: "text",
          }),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Failure",
    });
  });

  it("rejects page-all in terminal mode", async () => {
    await expect(
      Effect.runPromiseExit(
        provideRuntime(
          resolveReadOutputControls({
            fields: Option.none(),
            output: "text",
            pageAll: true,
          }),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Failure",
    });
  });

  it("rejects malformed nested field selectors", async () => {
    const exit = await Effect.runPromiseExit(
      provideRuntime(
        resolveReadOutputControls({
          fields: Option.some("info.username"),
          output: "json",
        }),
      ),
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("top-level field names");
    }
  });

  it("rejects query fragments in field selectors", async () => {
    const exit = await Effect.runPromiseExit(
      provideRuntime(
        resolveReadOutputControls({
          fields: Option.some("info?debug=1"),
          output: "json",
        }),
      ),
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("cannot include `?` or `#` fragments");
    }
  });
});

describe("selectTopLevelFields", () => {
  it("selects only the requested top-level fields", async () => {
    await expect(
      Effect.runPromise(
        selectTopLevelFields({
          command: "whoami",
          requestedFields: ["info"],
          value: {
            auth: {
              source: "env",
            },
            info: {
              username: "altay",
            },
          },
        }),
      ),
    ).resolves.toEqual({
      info: {
        username: "altay",
      },
    });
  });

  it("fails when an unknown top-level field is requested", async () => {
    const exit = await Effect.runPromiseExit(
      selectTopLevelFields({
        command: "whoami",
        requestedFields: ["nope"],
        value: {
          auth: {
            source: "env",
          },
          info: {
            username: "altay",
          },
        },
      }),
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("Unknown `--fields` value for `whoami`");
      expect(String(exit.cause)).toContain("Valid top-level fields: `auth`, `info`");
    }
  });
});

describe("collectAllCursorPages", () => {
  it("concatenates paged list responses until the cursor is exhausted", async () => {
    const continueWithCursor = (cursor: string) =>
      Effect.succeed(
        cursor === "cursor-1"
          ? {
              cursor: "cursor-2",
              files: [{ id: 2 }],
              total: 3,
            }
          : {
              cursor: null,
              files: [{ id: 3 }],
              total: 3,
            },
      );

    await expect(
      Effect.runPromise(
        collectAllCursorPages({
          command: "files list",
          continueWithCursor,
          initial: {
            cursor: "cursor-1",
            files: [{ id: 1 }],
            total: 3,
          },
          itemKey: "files",
          pageAll: true,
        }),
      ),
    ).resolves.toEqual({
      cursor: null,
      files: [{ id: 1 }, { id: 2 }, { id: 3 }],
      total: 3,
    });
  });
});

describe("agent-safe string validation", () => {
  it("rejects query fragments in resource identifiers", () => {
    expect(() => validateResourceIdentifier("`auth preview --code`", "PUTIO1?debug=1")).toThrow(
      /cannot include `\?` or `#` fragments/,
    );
  });

  it("rejects path traversal in name-like input", () => {
    expect(() => validateNameLikeInput("`files rename --name`", "../secrets")).toThrow(
      /path traversal segments/,
    );
  });
});
