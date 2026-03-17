import { Command, Options } from "@effect/cli";
import { Data, Effect, Option, Schema } from "effect";

import {
  dryRunOption,
  fieldsOption,
  getOption,
  jsonOption,
  outputOption,
  parseRepeatedIntegerOption,
  resolveMutationInput,
  resolveReadOutputControls,
  withAuthedSdk,
  writeDryRunPlan,
  writeReadOutput,
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

export const DownloadLinksCreateInputSchema = Schema.Struct({
  cursor: Schema.optional(Schema.String),
  excludeIds: Schema.optional(Schema.Array(Schema.Number)),
  ids: Schema.optional(Schema.Array(Schema.Number)),
});

export type DownloadLinksCreateInput = Schema.Schema.Type<typeof DownloadLinksCreateInputSchema>;

export const resolveDownloadLinksCreateInput = (input: DownloadLinksCreateInput) => {
  const normalized = {
    cursor: input.cursor,
    excludeIds: toOptionalIds(input.excludeIds ?? []),
    ids: toOptionalIds(input.ids ?? []),
  };

  if (!normalized.cursor && !normalized.ids) {
    throw new DownloadLinksCommandError({
      message: "Provide at least one --id or a --cursor to create download links.",
    });
  }

  return normalized;
};

const downloadLinksCreate = Command.make(
  "create",
  {
    cursor: cursorOption,
    dryRun: dryRunOption,
    excludeIds: excludeIdsOption,
    ids: idsOption,
    json: jsonOption,
    output: outputOption,
  },
  ({ cursor, dryRun, excludeIds, ids, json, output }) =>
    Effect.gen(function* () {
      const input = yield* resolveMutationInput({
        buildFromFlags: () =>
          resolveDownloadLinksCreateInput({
            cursor: Option.getOrUndefined(cursor),
            excludeIds: toOptionalIds(excludeIds),
            ids: toOptionalIds(ids),
          }),
        json,
        schema: DownloadLinksCreateInputSchema,
      }).pipe(Effect.map(resolveDownloadLinksCreateInput));

      if (dryRun) {
        return yield* writeDryRunPlan("download-links create", input, getOption(output));
      }

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
    fields: fieldsOption,
    id: downloadLinksIdOption,
    output: outputOption,
  },
  ({ fields, id, output }) =>
    Effect.gen(function* () {
      const controls = yield* resolveReadOutputControls({
        fields,
        output: getOption(output),
      });
      const result = yield* withTerminalLoader(
        {
          message: `Loading download-links job ${id}...`,
          output: controls.output,
        },
        withAuthedSdk(({ sdk }) => sdk.downloadLinks.get(id)),
      );

      yield* writeReadOutput({
        command: "download-links get",
        output: controls.output,
        renderTerminalValue: renderDownloadLinksTerminal,
        requestedFields: controls.requestedFields,
        value: result,
      });
    }),
);

export const downloadLinksCommand = Command.make("download-links", {}, () => Effect.void).pipe(
  Command.withSubcommands([downloadLinksCreate, downloadLinksGet]),
);
