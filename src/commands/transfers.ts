import { Command, Options } from "@effect/cli";
import { TransferAddInputSchema } from "@putdotio/sdk";
import { Clock, Duration, Effect, Option, Schema } from "effect";

import {
  CliCommandInputError,
  dryRunOption,
  fieldsOption,
  getOption,
  jsonOption,
  outputOption,
  pageAllOption,
  parseRepeatedIntegerOption,
  resolveMutationInput,
  resolveReadOutputControls,
  withAuthedSdk,
  writeDryRunPlan,
  writeReadOutput,
  writeReadPages,
} from "../internal/command.js";
import {
  dryRunFlag,
  fieldsFlag,
  integerFlag,
  jsonFlag,
  jsonShapeFromSchema,
  outputFlag,
  pageAllFlag,
  repeatedIntegerFlag,
  repeatedStringFlag,
  stringFlag,
  type CommandSpec,
} from "../internal/command-specs.js";
import { translate } from "../i18n/index.js";
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
const urlOption = Options.text("url").pipe(Options.repeated);
const optionalTransferIdOption = Options.integer("id").pipe(Options.optional);

const WATCH_TERMINAL_STATUSES = ["COMPLETED", "ERROR", "SEEDING"] as const;

const NonEmptyIdsSchema = Schema.Array(Schema.Number).pipe(
  Schema.filter((value): value is ReadonlyArray<number> => value.length > 0, {
    message: () => "Expected at least one id",
  }),
);

export const TransfersAddInputSchema = Schema.Array(TransferAddInputSchema).pipe(
  Schema.filter(
    (value): value is ReadonlyArray<Schema.Schema.Type<typeof TransferAddInputSchema>> =>
      value.length > 0,
    {
      message: () => "Expected at least one transfer input",
    },
  ),
);

export const TransfersCancelInputSchema = Schema.Struct({
  ids: NonEmptyIdsSchema,
});

export const TransfersSingleIdInputSchema = Schema.Struct({
  id: Schema.Number,
});

export const TransfersCleanInputSchema = Schema.Struct({
  ids: Schema.optional(NonEmptyIdsSchema),
});

const requiredTransferId = (value: number | undefined, message: string) => {
  if (value === undefined) {
    throw new CliCommandInputError({ message });
  }

  return value;
};

const requiredUrls = (value: ReadonlyArray<string>) => {
  if (value.length === 0) {
    throw new CliCommandInputError({
      message: "Provide at least one `--url` or `--json` for `transfers add`.",
    });
  }

  return value;
};

const requiredTransferIds = (value: ReadonlyArray<number>, message: string) => {
  if (value.length === 0) {
    throw new CliCommandInputError({ message });
  }

  return value;
};

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
    fields: fieldsOption,
    output: outputOption,
    pageAll: pageAllOption,
    perPage: perPageOption,
  },
  ({ fields, output, pageAll, perPage }) =>
    Effect.gen(function* () {
      const controls = yield* resolveReadOutputControls({
        fields,
        output: getOption(output),
        pageAll,
      });
      const perPageValue = Option.getOrElse(perPage, () => 20);
      const result = yield* withTerminalLoader(
        {
          message: translate("cli.transfers.command.loading"),
          output: controls.output,
        },
        withAuthedSdk(({ sdk }) =>
          sdk.transfers.list({
            per_page: perPageValue,
          }),
        ),
      );

      yield* writeReadPages({
        command: "transfers list",
        continueWithCursor: (cursor) =>
          withAuthedSdk(({ sdk }) => sdk.transfers.continue(cursor, { per_page: perPageValue })),
        controls,
        initial: result,
        itemKey: "transfers",
        renderTerminalValue: renderTransfersTerminal,
      });
    }),
);

const transfersAdd = Command.make(
  "add",
  {
    dryRun: dryRunOption,
    output: outputOption,
    callbackUrl: callbackUrlOption,
    json: jsonOption,
    saveParentId: saveParentIdOption,
    url: urlOption,
  },
  ({ dryRun, output, callbackUrl, json, saveParentId, url }) =>
    Effect.gen(function* () {
      const input = yield* resolveMutationInput({
        buildFromFlags: () => {
          const sharedInput = {
            callback_url: Option.getOrUndefined(callbackUrl),
            save_parent_id: Option.getOrUndefined(saveParentId),
          } as const;

          return requiredUrls(url).map((currentUrl) => ({
            ...sharedInput,
            url: currentUrl,
          }));
        },
        json,
        schema: TransfersAddInputSchema,
      });

      if (dryRun) {
        return yield* writeDryRunPlan("transfers add", input, getOption(output));
      }

      const result = yield* withTerminalLoader(
        {
          message: translate("cli.transfers.command.adding", { count: input.length }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) => sdk.transfers.addMany(input)),
      );

      yield* writeOutput(result, getOption(output), renderTransferAddResult);
    }),
);

const transfersCancel = Command.make(
  "cancel",
  {
    dryRun: dryRunOption,
    id: transferIdsOption,
    json: jsonOption,
    output: outputOption,
  },
  ({ dryRun, id, json, output }) =>
    Effect.gen(function* () {
      const input = yield* resolveMutationInput({
        buildFromFlags: () => ({
          ids: requiredTransferIds(
            id,
            "Provide at least one `--id` or `--json` for `transfers cancel`.",
          ),
        }),
        json,
        schema: TransfersCancelInputSchema,
      });

      if (dryRun) {
        return yield* writeDryRunPlan("transfers cancel", input, getOption(output));
      }

      const result = yield* withAuthedSdk(({ sdk }) => sdk.transfers.cancel(input.ids));

      yield* writeOutput(result, getOption(output), () =>
        translate("cli.transfers.command.cancelled", { ids: input.ids.join(", ") }),
      );
    }),
);

const transfersRetry = Command.make(
  "retry",
  {
    dryRun: dryRunOption,
    id: optionalTransferIdOption,
    json: jsonOption,
    output: outputOption,
  },
  ({ dryRun, id, json, output }) =>
    Effect.gen(function* () {
      const input = yield* resolveMutationInput({
        buildFromFlags: () => ({
          id: requiredTransferId(
            getOption(id),
            "Provide `--id` or `--json` for `transfers retry`.",
          ),
        }),
        json,
        schema: TransfersSingleIdInputSchema,
      });

      if (dryRun) {
        return yield* writeDryRunPlan("transfers retry", input, getOption(output));
      }

      const result = yield* withTerminalLoader(
        {
          message: translate("cli.transfers.command.retrying", { id: input.id }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) => sdk.transfers.retry(input.id)),
      );

      yield* writeOutput(result, getOption(output), (value) =>
        renderTransfersTerminal({ transfers: [value] }),
      );
    }),
);

const transfersClean = Command.make(
  "clean",
  {
    dryRun: dryRunOption,
    id: transferIdsOption.pipe(Options.optional),
    json: jsonOption,
    output: outputOption,
  },
  ({ dryRun, id, json, output }) =>
    Effect.gen(function* () {
      const input = yield* resolveMutationInput({
        buildFromFlags: () => ({
          ids: Option.getOrUndefined(id),
        }),
        json,
        schema: TransfersCleanInputSchema,
      });

      if (dryRun) {
        return yield* writeDryRunPlan("transfers clean", input, getOption(output));
      }

      const result = yield* withAuthedSdk(({ sdk }) => sdk.transfers.clean(input.ids));

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
    dryRun: dryRunOption,
    id: optionalTransferIdOption,
    json: jsonOption,
    output: outputOption,
  },
  ({ dryRun, id, json, output }) =>
    Effect.gen(function* () {
      const input = yield* resolveMutationInput({
        buildFromFlags: () => ({
          id: requiredTransferId(
            getOption(id),
            "Provide `--id` or `--json` for `transfers reannounce`.",
          ),
        }),
        json,
        schema: TransfersSingleIdInputSchema,
      });

      if (dryRun) {
        return yield* writeDryRunPlan("transfers reannounce", input, getOption(output));
      }

      yield* withTerminalLoader(
        {
          message: translate("cli.transfers.command.reannouncing", { id: input.id }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) => sdk.transfers.reannounce(input.id)),
      );

      yield* writeOutput({ id: input.id, reannounced: true }, getOption(output), (value) =>
        translate("cli.transfers.command.reannounced", { id: value.id }),
      );
    }),
);

const transfersWatch = Command.make(
  "watch",
  {
    fields: fieldsOption,
    id: transferIdOption,
    intervalSeconds: intervalSecondsOption,
    output: outputOption,
    timeoutSeconds: timeoutSecondsOption,
  },
  ({ fields, id, intervalSeconds, output, timeoutSeconds }) =>
    Effect.gen(function* () {
      const controls = yield* resolveReadOutputControls({
        fields,
        output: getOption(output),
      });
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
          output: controls.output,
        },
        Effect.gen(function* () {
          while (true) {
            const current = yield* withAuthedSdk(({ sdk }) => sdk.transfers.get(id));

            if (isTerminalTransferStatus(current.status)) {
              const value = {
                timedOut: false,
                transfer: current,
              } as const;

              if (controls.outputMode === "ndjson") {
                yield* writeReadOutput({
                  command: "transfers watch",
                  output: controls.output,
                  outputMode: controls.outputMode,
                  renderTerminalValue: (terminalValue) =>
                    [
                      renderTransferWatchFinishedTerminal({
                        id: terminalValue.transfer.id,
                        status: terminalValue.transfer.status,
                        timedOut: terminalValue.timedOut,
                      }),
                      "",
                      renderTransfersTerminal({ transfers: [terminalValue.transfer] }),
                    ].join("\n"),
                  requestedFields: controls.requestedFields,
                  value,
                });
              }

              return value;
            }

            if ((yield* Clock.currentTimeMillis) - startedAt >= timeoutMs) {
              const value = {
                timedOut: true,
                transfer: current,
              } as const;

              if (controls.outputMode === "ndjson") {
                yield* writeReadOutput({
                  command: "transfers watch",
                  output: controls.output,
                  outputMode: controls.outputMode,
                  renderTerminalValue: (terminalValue) =>
                    [
                      renderTransferWatchFinishedTerminal({
                        id: terminalValue.transfer.id,
                        status: terminalValue.transfer.status,
                        timedOut: terminalValue.timedOut,
                      }),
                      "",
                      renderTransfersTerminal({ transfers: [terminalValue.transfer] }),
                    ].join("\n"),
                  requestedFields: controls.requestedFields,
                  value,
                });
              }

              return value;
            }

            if (controls.outputMode === "ndjson") {
              yield* writeReadOutput({
                command: "transfers watch",
                output: controls.output,
                outputMode: controls.outputMode,
                renderTerminalValue: (terminalValue) =>
                  [
                    renderTransferWatchFinishedTerminal({
                      id: terminalValue.transfer.id,
                      status: terminalValue.transfer.status,
                      timedOut: terminalValue.timedOut,
                    }),
                    "",
                    renderTransfersTerminal({ transfers: [terminalValue.transfer] }),
                  ].join("\n"),
                requestedFields: controls.requestedFields,
                value: {
                  timedOut: false,
                  transfer: current,
                },
              });
            }

            yield* Effect.sleep(Duration.millis(intervalMs));
          }
        }),
      );

      if (controls.outputMode === "ndjson") {
        return;
      }

      yield* writeReadOutput({
        command: "transfers watch",
        output: controls.output,
        outputMode: controls.outputMode,
        renderTerminalValue: (value) =>
          [
            renderTransferWatchFinishedTerminal({
              id: value.transfer.id,
              status: value.transfer.status,
              timedOut: value.timedOut,
            }),
            "",
            renderTransfersTerminal({ transfers: [value.transfer] }),
          ].join("\n"),
        requestedFields: controls.requestedFields,
        value: result,
      });
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

export const transfersCommandSpecs = [
  {
    auth: { required: true },
    capabilities: {
      dryRun: false,
      fieldSelection: true,
      rawJsonInput: false,
      streaming: true,
    },
    command: "transfers list",
    input: {
      flags: [fieldsFlag(), outputFlag(), pageAllFlag(), integerFlag("per-page")],
    },
    kind: "read",
    purpose: translate("cli.metadata.transfersList"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: true,
      fieldSelection: false,
      rawJsonInput: true,
      streaming: false,
    },
    command: "transfers add",
    input: {
      flags: [
        dryRunFlag(),
        outputFlag(),
        stringFlag("callback-url"),
        jsonFlag(),
        integerFlag("save-parent-id"),
        repeatedStringFlag("url"),
      ],
      json: jsonShapeFromSchema(TransfersAddInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.transfersAdd"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: true,
      fieldSelection: false,
      rawJsonInput: true,
      streaming: false,
    },
    command: "transfers cancel",
    input: {
      flags: [dryRunFlag(), repeatedIntegerFlag("id"), jsonFlag(), outputFlag()],
      json: jsonShapeFromSchema(TransfersCancelInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.transfersCancel"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: true,
      fieldSelection: false,
      rawJsonInput: true,
      streaming: false,
    },
    command: "transfers retry",
    input: {
      flags: [dryRunFlag(), integerFlag("id"), jsonFlag(), outputFlag()],
      json: jsonShapeFromSchema(TransfersSingleIdInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.transfersRetry"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: true,
      fieldSelection: false,
      rawJsonInput: true,
      streaming: false,
    },
    command: "transfers clean",
    input: {
      flags: [dryRunFlag(), repeatedIntegerFlag("id"), jsonFlag(), outputFlag()],
      json: jsonShapeFromSchema(TransfersCleanInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.transfersClean"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: true,
      fieldSelection: false,
      rawJsonInput: true,
      streaming: false,
    },
    command: "transfers reannounce",
    input: {
      flags: [dryRunFlag(), integerFlag("id"), jsonFlag(), outputFlag()],
      json: jsonShapeFromSchema(TransfersSingleIdInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.transfersReannounce"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: false,
      fieldSelection: true,
      rawJsonInput: false,
      streaming: true,
    },
    command: "transfers watch",
    input: {
      flags: [
        fieldsFlag(),
        integerFlag("id", { required: true }),
        integerFlag("interval-seconds"),
        outputFlag(),
        integerFlag("timeout-seconds"),
      ],
    },
    kind: "read",
    purpose: translate("cli.metadata.transfersWatch"),
  },
] satisfies ReadonlyArray<CommandSpec>;
