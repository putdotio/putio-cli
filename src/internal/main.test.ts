import { Cause, Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { handleCliCause } from "./main.js";

describe("handleCliCause", () => {
  it("preserves interrupt-only causes for NodeRuntime signal handling", async () => {
    const exit = await Effect.runPromiseExit(handleCliCause(Cause.interrupt()));

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true);
    }
  });
});
