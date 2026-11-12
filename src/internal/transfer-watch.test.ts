import { describe, expect, it } from "@effect/vitest";
import { Clock, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

import { watchTransfer } from "./transfer-watch.js";

const watchUntil = (options: {
  readonly doneAfterPolls: number;
  readonly intervalMs: number;
  readonly timeoutMs: number;
}) => {
  const polledAt: Array<number> = [];
  const updates: Array<boolean> = [];

  const watch = watchTransfer({
    intervalMs: options.intervalMs,
    isTerminal: (status: string) => status === "COMPLETED",
    onUpdate: (update) => Effect.sync(() => updates.push(update.timedOut)),
    poll: Effect.map(Clock.currentTimeMillis, (now) => {
      polledAt.push(now);

      return polledAt.length >= options.doneAfterPolls ? "COMPLETED" : "DOWNLOADING";
    }),
    timeoutMs: options.timeoutMs,
  });

  return { polledAt, updates, watch };
};

describe("watchTransfer", () => {
  it.effect("returns the finished transfer without waiting", () =>
    Effect.gen(function* () {
      const { updates, watch } = watchUntil({
        doneAfterPolls: 1,
        intervalMs: 2_000,
        timeoutMs: 5_000,
      });

      expect(yield* watch).toEqual({ timedOut: false, transfer: "COMPLETED" });
      expect(updates).toEqual([false]);
    }),
  );

  it.effect("polls at the interval until the transfer finishes", () =>
    Effect.gen(function* () {
      const { polledAt, watch } = watchUntil({
        doneAfterPolls: 3,
        intervalMs: 2_000,
        timeoutMs: 60_000,
      });

      const start = yield* Clock.currentTimeMillis;
      const fiber = yield* Effect.forkChild(watch);

      yield* TestClock.adjust("4 seconds");

      expect(yield* Fiber.join(fiber)).toEqual({ timedOut: false, transfer: "COMPLETED" });
      expect(polledAt.map((at) => at - start)).toEqual([0, 2_000, 4_000]);
    }),
  );

  it.effect("times out at the deadline when the interval is longer than the timeout", () =>
    Effect.gen(function* () {
      const { polledAt, updates, watch } = watchUntil({
        doneAfterPolls: Number.POSITIVE_INFINITY,
        intervalMs: 60_000,
        timeoutMs: 3_000,
      });

      const start = yield* Clock.currentTimeMillis;
      const fiber = yield* Effect.forkChild(watch);

      yield* TestClock.adjust("3 seconds");

      expect(yield* Fiber.join(fiber)).toEqual({ timedOut: true, transfer: "DOWNLOADING" });
      expect(polledAt.map((at) => at - start)).toEqual([0, 3_000]);
      expect(updates).toEqual([false, true]);
    }),
  );
});
