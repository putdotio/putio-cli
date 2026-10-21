import { describe, expect, it } from "vite-plus/test";
import { Effect, Option, Schema } from "effect";
import fc from "fast-check";

import {
  CliCommandInputError,
  collectAllCursorPages,
  decodeJsonOption,
  parseRepeatedIntegers,
  resolveReadOutputControls,
  selectTopLevelFields,
  validateNameLikeInput,
  validateResourceIdentifier,
  writeReadPages,
} from "./command.js";
import { CliOutputLive } from "./output-service.js";
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

  it("does not reflect control-bearing field selectors in errors", async () => {
    const payload = "\u001B]52;c;cHduZWQ=\u0007";
    const exit = await Effect.runPromiseExit(
      provideRuntime(
        resolveReadOutputControls({
          fields: Option.some(payload),
          output: "json",
        }),
      ),
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const cause = String(exit.cause);
      expect(cause).toContain("`--fields` selector #1 cannot contain control characters");
      expect(cause).not.toContain(payload);
    }
  });

  it("identifies the invalid field selector by position without echoing it", async () => {
    const exit = await Effect.runPromiseExit(
      provideRuntime(
        resolveReadOutputControls({
          fields: Option.some("auth,bad.field"),
          output: "json",
        }),
      ),
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const cause = String(exit.cause);
      expect(cause).toContain("`--fields` selector #2 only accepts top-level field names");
      expect(cause).not.toContain("bad.field");
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
              username: "example-user",
            },
          },
        }),
      ),
    ).resolves.toEqual({
      info: {
        username: "example-user",
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
            username: "example-user",
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
  // A page chain: the initial page plus continuation pages, each naming the next cursor.
  type Page = { readonly cursor: string | null; readonly files: ReadonlyArray<number> };
  const MAX_ITEMS = 100_000;

  const collect = (pages: ReadonlyArray<Page>) => {
    const requested: string[] = [];
    const byCursor = new Map<string, Page>();
    pages.forEach((page, index) => {
      const previous = pages[index - 1];
      if (previous?.cursor) byCursor.set(previous.cursor, page);
    });
    const effect = collectAllCursorPages({
      command: "files list",
      continueWithCursor: (cursor: string) => {
        requested.push(cursor);
        const page = byCursor.get(cursor);
        return page ? Effect.succeed(page) : Effect.die(new Error(`unexpected cursor ${cursor}`));
      },
      initial: { ...pages[0]!, total: 7 },
      itemKey: "files",
      pageAll: true,
    });
    return { effect, requested };
  };

  const pageChain = (pageSizes: fc.Arbitrary<number>) =>
    fc
      .uniqueArray(fc.string({ minLength: 1, maxLength: 8 }), { maxLength: 6 })
      .chain((cursors) =>
        fc.tuple(
          fc.constant(cursors),
          fc.array(pageSizes, { minLength: cursors.length + 1, maxLength: cursors.length + 1 }),
        ),
      )
      .map(([cursors, sizes]) => {
        let next = 0;
        return sizes.map((size, index) => ({
          cursor: cursors[index] ?? null,
          files: Array.from({ length: size }, () => next++),
        }));
      });

  it("concatenates pages in order and stops at the null cursor", async () => {
    await fc.assert(
      fc.asyncProperty(pageChain(fc.nat({ max: 5 })), async (pages) => {
        const { effect, requested } = collect(pages);
        const result = await Effect.runPromise(effect);

        expect(result).toEqual({
          cursor: null,
          files: pages.flatMap((page) => page.files),
          total: 7,
        });
        expect(requested).toEqual(pages.flatMap((page) => (page.cursor ? [page.cursor] : [])));
      }),
    );
  });

  it("fails on a repeated cursor without requesting it twice", async () => {
    await fc.assert(
      fc.asyncProperty(
        pageChain(fc.nat({ max: 3 })).filter((pages) => pages.length > 1),
        fc.nat(),
        async (pages, pick) => {
          const cursors = pages.flatMap((page) => (page.cursor ? [page.cursor] : []));
          const repeated = cursors[pick % cursors.length]!;
          const last = pages.length - 1;
          const looping = pages.map((page, index) =>
            index === last ? { ...page, cursor: repeated } : page,
          );
          const { effect, requested } = collect(looping);
          const failure = await Effect.runPromise(Effect.flip(effect));

          expect(failure).toBeInstanceOf(CliCommandInputError);
          expect(failure).toMatchObject({
            message: "`files list` pagination returned a repeated cursor.",
          });
          expect(new Set(requested).size).toBe(requested.length);
        },
      ),
    );
  });

  it("fails once the collected items exceed the item cap", async () => {
    await fc.assert(
      fc.asyncProperty(pageChain(fc.nat({ max: 40_000 })), async (pages) => {
        const { effect } = collect(pages);
        const exit = await Effect.runPromiseExit(effect);
        const total = pages.reduce((sum, page) => sum + page.files.length, 0);

        if (total <= MAX_ITEMS) {
          expect(exit._tag).toBe("Success");
          return;
        }
        expect(exit._tag).toBe("Failure");
        expect(String(exit._tag === "Failure" ? exit.cause : "")).toContain(
          "`files list` pagination exceeded 100000 items.",
        );
      }),
      { numRuns: 40 },
    );
  });

  it("preserves continuation failures for their owning error boundary", async () => {
    const upstreamError = new Error("upstream unavailable");
    const failure = await Effect.runPromise(
      Effect.flip(
        collectAllCursorPages({
          command: "files list",
          continueWithCursor: () => Effect.fail(upstreamError),
          initial: {
            cursor: "cursor-1",
            files: [{ id: 1 }],
          },
          itemKey: "files",
          pageAll: true,
        }),
      ),
    );

    expect(failure).toBe(upstreamError);
  });
});

describe("writeReadPages", () => {
  it("stops streaming once the item total exceeds the cap", async () => {
    const lines: string[] = [];
    const page = (length: number, cursor: string | null) => ({
      cursor,
      files: Array.from({ length }, (_value, index) => index),
    });
    const exit = await Effect.runPromiseExit(
      writeReadPages({
        command: "files list",
        continueWithCursor: () => Effect.succeed(page(50_001, null)),
        controls: {
          output: "ndjson",
          outputMode: "ndjson",
          pageAll: true,
          requestedFields: undefined,
        },
        initial: page(60_000, "cursor-1"),
        itemKey: "files",
        renderTerminalValue: () => "",
      }).pipe(
        Effect.provide(CliOutputLive),
        Effect.provideService(
          CliRuntime,
          makeCliRuntime({ argv: ["node", "putio"], writeStdout: (line) => lines.push(line) }),
        ),
      ),
    );

    expect(lines).toHaveLength(1);
    expect(String(exit._tag === "Failure" ? exit.cause : "")).toContain(
      "`files list` pagination exceeded 100000 items.",
    );
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
