import { Command, Options } from "@effect/cli";
import { translate } from "@putdotio/translations";
import { Clock, Duration, Effect, Option } from "effect";

import {
  getOption,
  outputOption,
  parseRepeatedIntegerOption,
  withAuthedSdk,
} from "../internal/command.js";
import { withTerminalLoader } from "../internal/loader-service.js";
import { writeOutput } from "../internal/output-service.js";
import { renderTransfersTerminal } from "../internal/terminal/transfers-terminal.js";
const perPageOption = Options.integer("per-page").pipe(Options.optional);
const callbackUrlOption = Options.text("callback-url").pipe(Options.optional);
const transferIdOption = Options.integer("id");
const transferIdsOption = parseRepeatedIntegerOption("id");
const saveParentIdOption = Options.integer("save-parent-id").pipe(Options.optional);
const intervalSecondsOption = Options.integer("interval-seconds").pipe(Options.optional);
const timeoutSecondsOption = Options.integer("timeout-seconds").pipe(Options.optional);
const urlOption = Options.text("url").pipe(Options.atLeast(1));

const WATCH_TERMINAL_STATUSES = ["COMPLETED", "ERROR", "SEEDING"] as const;

export const isTerminalTransferStatus = (status: string) =>
  WATCH_TERMINAL_STATUSES.includes(status as (typeof WATCH_TERMINAL_STATUSES)[number]);

export const renderTransfers = (
  transfers: ReadonlyArray<{
    readonly id: number;
    readonly status: string;
    readonly percent_done: number | null;
    readonly name: string;
  }>,
) =>
  transfers
    .map(
      (transfer) =>
        `${transfer.id}\t${transfer.status}\t${transfer.percent_done}\t${transfer.name}`,
    )
    .join("\n");

export const renderTransferAddResult = (value: {
  readonly transfers: ReadonlyArray<{
    readonly id: number;
    readonly status: string;
    readonly percent_done: number | null;
    readonly name: string;
  }>;
  readonly errors: ReadonlyArray<{
    readonly status_code: number;
    readonly error_type: string;
    readonly url: string;
  }>;
}) =>
  [
    translate("cli.transfers.terminal.add.transfers", { count: value.transfers.length }),
    renderTransfers(value.transfers),
    value.errors.length === 0
      ? ""
      : [
          translate("cli.transfers.terminal.add.errors", { count: value.errors.length }),
          ...value.errors.map((error) => `${error.status_code}\t${error.error_type}\t${error.url}`),
        ].join("\n"),
  ]
    .filter((part) => part.length > 0)
    .join("\n");

export const renderTransferWatchFinishedTerminal = (value: {
  readonly id: number;
  readonly status: string;
  readonly timedOut: boolean;
}) =>
  value.timedOut
    ? translate("cli.transfers.command.watchTimedOut", { id: value.id, status: value.status })
    : translate("cli.transfers.command.watchFinished", { id: value.id, status: value.status });

const transfersList = Command.make(
  "list",
  {
    output: outputOption,
    perPage: perPageOption,
  },
  ({ output, perPage }) =>
    Effect.gen(function* () {
      const result = yield* withTerminalLoader(
        {
          message: translate("cli.transfers.command.loading"),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) =>
          sdk.transfers.list({
            per_page: Option.getOrElse(perPage, () => 20),
          }),
        ),
      );

      yield* writeOutput(result, getOption(output), renderTransfersTerminal);
    }),
);

const transfersAdd = Command.make(
  "add",
  {
    output: outputOption,
    callbackUrl: callbackUrlOption,
    saveParentId: saveParentIdOption,
    url: urlOption,
  },
  ({ output, callbackUrl, saveParentId, url }) =>
    Effect.gen(function* () {
      const input = {
        callback_url: Option.getOrUndefined(callbackUrl),
        save_parent_id: Option.getOrUndefined(saveParentId),
      } as const;
      const result = yield* withTerminalLoader(
        {
          message: translate("cli.transfers.command.adding", { count: url.length }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) =>
          sdk.transfers.addMany(
            url.map((currentUrl) => ({
              ...input,
              url: currentUrl,
            })),
          ),
        ),
      );

      yield* writeOutput(result, getOption(output), renderTransferAddResult);
    }),
);

const transfersCancel = Command.make(
  "cancel",
  {
    id: transferIdsOption,
    output: outputOption,
  },
  ({ id, output }) =>
    Effect.gen(function* () {
      const result = yield* withAuthedSdk(({ sdk }) => sdk.transfers.cancel(id));

      yield* writeOutput(result, getOption(output), () =>
        translate("cli.transfers.command.cancelled", { ids: id.join(", ") }),
      );
    }),
);

const transfersRetry = Command.make(
  "retry",
  {
    id: transferIdOption,
    output: outputOption,
  },
  ({ id, output }) =>
    Effect.gen(function* () {
      const result = yield* withTerminalLoader(
        {
          message: translate("cli.transfers.command.retrying", { id }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) => sdk.transfers.retry(id)),
      );

      yield* writeOutput(result, getOption(output), (value) =>
        renderTransfersTerminal({ transfers: [value] }),
      );
    }),
);

const transfersClean = Command.make(
  "clean",
  {
    id: transferIdsOption.pipe(Options.optional),
    output: outputOption,
  },
  ({ id, output }) =>
    Effect.gen(function* () {
      const result = yield* withAuthedSdk(({ sdk }) =>
        sdk.transfers.clean(Option.getOrUndefined(id)),
      );

      yield* writeOutput(result, getOption(output), (value) =>
        value.deleted_ids.length > 0
          ? translate("cli.transfers.command.cleaningDeleted", {
              ids: value.deleted_ids.join(", "),
            })
          : translate("cli.transfers.command.cleaningNone"),
      );
    }),
);

const transfersReannounce = Command.make(
  "reannounce",
  {
    id: transferIdOption,
    output: outputOption,
  },
  ({ id, output }) =>
    Effect.gen(function* () {
      yield* withTerminalLoader(
        {
          message: translate("cli.transfers.command.reannouncing", { id }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) => sdk.transfers.reannounce(id)),
      );

      yield* writeOutput({ id, reannounced: true }, getOption(output), (value) =>
        translate("cli.transfers.command.reannounced", { id: value.id }),
      );
    }),
);

const transfersWatch = Command.make(
  "watch",
  {
    id: transferIdOption,
    intervalSeconds: intervalSecondsOption,
    output: outputOption,
    timeoutSeconds: timeoutSecondsOption,
  },
  ({ id, intervalSeconds, output, timeoutSeconds }) =>
    Effect.gen(function* () {
      const intervalMs =
        Math.max(
          1,
          Option.getOrElse(intervalSeconds, () => 2),
        ) * 1_000;
      const timeoutMs =
        Math.max(
          1,
          Option.getOrElse(timeoutSeconds, () => 300),
        ) * 1_000;
      const startedAt = yield* Clock.currentTimeMillis;

      const result = yield* withTerminalLoader(
        {
          message: translate("cli.transfers.command.watching", { id }),
          output: getOption(output),
        },
        Effect.gen(function* () {
          while (true) {
            const current = yield* withAuthedSdk(({ sdk }) => sdk.transfers.get(id));

            if (isTerminalTransferStatus(current.status)) {
              return {
                timedOut: false,
                transfer: current,
              } as const;
            }

            if ((yield* Clock.currentTimeMillis) - startedAt >= timeoutMs) {
              return {
                timedOut: true,
                transfer: current,
              } as const;
            }

            yield* Effect.sleep(Duration.millis(intervalMs));
          }
        }),
      );

      yield* writeOutput(result, getOption(output), (value) =>
        [
          renderTransferWatchFinishedTerminal({
            id: value.transfer.id,
            status: value.transfer.status,
            timedOut: value.timedOut,
          }),
          "",
          renderTransfersTerminal({ transfers: [value.transfer] }),
        ].join("\n"),
      );
    }),
);

export const transfersCommand = Command.make("transfers", {}, () => Effect.void).pipe(
  Command.withSubcommands([
    transfersList,
    transfersAdd,
    transfersCancel,
    transfersRetry,
    transfersClean,
    transfersReannounce,
    transfersWatch,
  ]),
);
