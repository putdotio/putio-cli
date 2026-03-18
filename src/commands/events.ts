import { Command } from "@effect/cli";
import { Effect, Option } from "effect";

import {
  defineChoiceOption,
  defineIntegerOption,
  fieldsOption,
  getOption,
  outputOption,
  resolveReadOutputControls,
  withAuthedSdk,
  writeReadOutput,
} from "../internal/command.js";
import { fieldsFlag, outputFlag, type CommandSpec } from "../internal/command-specs.js";
import { translate } from "../i18n/index.js";
import { withTerminalLoader } from "../internal/loader-service.js";
import { renderEventsTerminal } from "../internal/terminal/events-terminal.js";
const beforeConfig = defineIntegerOption("before", { optional: true });
const perPageConfig = defineIntegerOption("per-page", { optional: true });
const eventTypeChoices = [
  "file_shared",
  "upload",
  "file_from_rss_deleted_for_space",
  "transfer_completed",
  "transfer_error",
  "transfer_from_rss_error",
  "transfer_callback_error",
  "private_torrent_pin",
  "rss_filter_paused",
  "voucher",
  "zip_created",
] as const;
const eventTypeConfig = defineChoiceOption("type", eventTypeChoices, { optional: true });

const beforeOption = beforeConfig.option;
const perPageOption = perPageConfig.option;
const eventTypeOption = eventTypeConfig.option;

export const filterEventsByType = <
  A extends {
    readonly type: string;
  },
>(
  events: ReadonlyArray<A>,
  expectedType: string | undefined,
) => events.filter((event) => (expectedType ? event.type === expectedType : true));

const eventsList = Command.make(
  "list",
  {
    before: beforeOption,
    fields: fieldsOption,
    output: outputOption,
    perPage: perPageOption,
    type: eventTypeOption,
  },
  ({ before, fields, output, perPage, type }) =>
    Effect.gen(function* () {
      const controls = yield* resolveReadOutputControls({
        fields,
        output: getOption(output),
      });
      const result = yield* withTerminalLoader(
        {
          message: translate("cli.events.command.loading"),
          output: controls.output,
        },
        withAuthedSdk(({ sdk }) =>
          sdk.events.list({
            before: Option.getOrUndefined(before),
            per_page: Option.getOrElse(perPage, () => 20),
          }),
        ).pipe(
          Effect.map((value) => ({
            ...value,
            events: filterEventsByType(value.events, Option.getOrUndefined(type)),
          })),
        ),
      );

      yield* writeReadOutput({
        command: "events list",
        output: controls.output,
        outputMode: controls.outputMode,
        renderTerminalValue: renderEventsTerminal,
        requestedFields: controls.requestedFields,
        value: result,
      });
    }),
);

export const eventsCommand = Command.make("events", {}, () => Effect.void).pipe(
  Command.withSubcommands([eventsList]),
);

export const eventsCommandSpecs = [
  {
    auth: { required: true },
    capabilities: {
      dryRun: false,
      fieldSelection: true,
      rawJsonInput: false,
      streaming: false,
    },
    command: "events list",
    input: {
      flags: [
        beforeConfig.flag,
        fieldsFlag(),
        outputFlag(),
        perPageConfig.flag,
        eventTypeConfig.flag,
      ],
    },
    kind: "read",
    purpose: translate("cli.metadata.eventsList"),
  },
] satisfies ReadonlyArray<CommandSpec>;
