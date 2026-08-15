import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { makeCliAppLayer } from "./app-layer.js";
import { CliCrashReporter } from "./crash-reporting.js";

describe("makeCliAppLayer", () => {
  it("fails closed unless an entrypoint injects a bootstrapped crash reporter", async () => {
    const decision = await Effect.runPromise(
      Effect.scoped(
        CliCrashReporter.pipe(
          Effect.map((reporter) => reporter.decision),
          Effect.provide(makeCliAppLayer()),
        ),
      ),
    );

    expect(decision).toEqual({
      enabled: false,
      reason: "configuration_unavailable",
    });
  });
});
