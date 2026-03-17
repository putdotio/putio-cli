import { Command, Options } from "@effect/cli";
import { translate } from "@putdotio/translations";
import { Effect, Option } from "effect";

import { getOption, outputOption, withAuthedSdk } from "../internal/command.js";
import { withTerminalLoader } from "../internal/loader-service.js";
import { writeOutput } from "../internal/output-service.js";
import { renderEventsTerminal } from "../internal/terminal/events-terminal.js";
const beforeOption = Options.integer("before").pipe(Options.optional);
const perPageOption = Options.integer("per-page").pipe(Options.optional);
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
const eventTypeOption = Options.choice("type", eventTypeChoices).pipe(Options.optional);

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
    output: outputOption,
    perPage: perPageOption,
    type: eventTypeOption,
  },
  ({ before, output, perPage, type }) =>
    Effect.gen(function* () {
      const result = yield* withTerminalLoader(
        {
          message: translate("cli.events.command.loading"),
          output: getOption(output),
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

      yield* writeOutput(result, getOption(output), renderEventsTerminal);
    }),
);

export const eventsCommand = Command.make("events", {}, () => Effect.void).pipe(
  Command.withSubcommands([eventsList]),
);
