import { Clock, Duration, Effect } from "effect";

export type TransferWatchResult<Transfer> = {
  readonly timedOut: boolean;
  readonly transfer: Transfer;
};

export const watchTransfer = <Transfer, E, R, E2, R2>(options: {
  readonly intervalMs: number;
  readonly isTerminal: (transfer: Transfer) => boolean;
  readonly onUpdate: (update: TransferWatchResult<Transfer>) => Effect.Effect<void, E2, R2>;
  readonly poll: Effect.Effect<Transfer, E, R>;
  readonly timeoutMs: number;
}): Effect.Effect<TransferWatchResult<Transfer>, E | E2, R | R2> =>
  Effect.gen(function* () {
    const startedAt = yield* Clock.currentTimeMillis;

    while (true) {
      const transfer = yield* options.poll;
      const remainingMs = options.timeoutMs - ((yield* Clock.currentTimeMillis) - startedAt);

      const update = {
        timedOut: !options.isTerminal(transfer) && remainingMs <= 0,
        transfer,
      };

      yield* options.onUpdate(update);

      if (update.timedOut || options.isTerminal(transfer)) {
        return update;
      }

      yield* Effect.sleep(Duration.millis(Math.min(options.intervalMs, remainingMs)));
    }
  });
