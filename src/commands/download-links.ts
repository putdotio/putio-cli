import { Command, Options } from "@effect/cli";
import { Data, Effect, Option } from "effect";

import {
  getOption,
  outputOption,
  parseRepeatedIntegerOption,
  withAuthedSdk,
} from "../internal/command.js";
import { withTerminalLoader } from "../internal/loader-service.js";
import { writeOutput } from "../internal/output-service.js";
import { renderDownloadLinksTerminal } from "../internal/terminal/download-links-terminal.js";

class DownloadLinksCommandError extends Data.TaggedError("DownloadLinksCommandError")<{
  readonly message: string;
}> {}

const cursorOption = Options.text("cursor").pipe(Options.optional);
const downloadLinksIdOption = Options.integer("id");

const idsOption = parseRepeatedIntegerOption("id");
const excludeIdsOption = parseRepeatedIntegerOption("exclude-id");

export const toOptionalIds = (values: ReadonlyArray<number>) =>
  values.length > 0 ? values : undefined;

export const resolveDownloadLinksCreateInput = (input: {
  readonly cursor: string | undefined;
  readonly excludeIds: ReadonlyArray<number> | undefined;
  readonly ids: ReadonlyArray<number> | undefined;
}) => {
  if (!input.cursor && (!input.ids || input.ids.length === 0)) {
    throw new DownloadLinksCommandError({
      message: "Provide at least one --id or a --cursor to create download links.",
    });
  }

  return input;
};

const downloadLinksCreate = Command.make(
  "create",
  {
    cursor: cursorOption,
    excludeIds: excludeIdsOption,
    ids: idsOption,
    output: outputOption,
  },
  ({ cursor, excludeIds, ids, output }) =>
    Effect.gen(function* () {
      const input = yield* Effect.succeed({
        cursor: Option.getOrUndefined(cursor),
        excludeIds: toOptionalIds(excludeIds),
        ids: toOptionalIds(ids),
      }).pipe(Effect.map(resolveDownloadLinksCreateInput));
      const result = yield* withTerminalLoader(
        {
          message: "Creating download-links job...",
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) => sdk.downloadLinks.create(input)),
      );

      yield* writeOutput(
        result,
        getOption(output),
        (value) => `download-links job id: ${value.id}`,
      );
    }),
);

const downloadLinksGet = Command.make(
  "get",
  {
    id: downloadLinksIdOption,
    output: outputOption,
  },
  ({ id, output }) =>
    Effect.gen(function* () {
      const result = yield* withTerminalLoader(
        {
          message: `Loading download-links job ${id}...`,
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) => sdk.downloadLinks.get(id)),
      );

      yield* writeOutput(result, getOption(output), renderDownloadLinksTerminal);
    }),
);

export const downloadLinksCommand = Command.make("download-links", {}, () => Effect.void).pipe(
  Command.withSubcommands([downloadLinksCreate, downloadLinksGet]),
);
