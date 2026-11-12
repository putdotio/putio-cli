import { Command } from "effect/cli";
import { DownloadLinksCreateInputSchema, type FilesBulkSelection } from "@putdotio/sdk";
import { Effect, Option, Predicate, Schema } from "effect";

import {
  checkCommandInput,
  CliCommandInputError,
  defineIntegerOption,
  defineRepeatedIntegerOption,
  defineTextOption,
  dryRunOption,
  fieldsOption,
  getOption,
  jsonOption,
  outputOption,
  resolveMutationInput,
  resolveReadOutputControls,
  withAuthedSdk,
  writeDryRunPlan,
  writeReadOutput,
} from "../internal/command.js";
import {
  dryRunFlag,
  fieldsFlag,
  jsonFlag,
  jsonInputSpecFromSchema,
  outputFlag,
  type CommandSpec,
} from "../internal/command-specs.js";
import { translate } from "../i18n/index.js";
import { withTerminalLoader } from "../internal/loader-service.js";
import { writeOutput } from "../internal/output-service.js";
import { renderDownloadLinksTerminal } from "../internal/terminal/download-links-terminal.js";

const cursorConfig = defineTextOption("cursor", { optional: true });
const downloadLinksIdConfig = defineIntegerOption("id");
const idsConfig = defineRepeatedIntegerOption("id");
const excludeIdsConfig = defineRepeatedIntegerOption("exclude-id");

const cursorOption = cursorConfig.option;
const downloadLinksIdOption = downloadLinksIdConfig.option;
const idsOption = idsConfig.option;
const excludeIdsOption = excludeIdsConfig.option;

export const toOptionalIds = (values: ReadonlyArray<number>) =>
  values.length > 0 ? values : undefined;

export { DownloadLinksCreateInputSchema } from "@putdotio/sdk";

export type DownloadLinksCreateInput = Schema.Schema.Type<typeof DownloadLinksCreateInputSchema>;

const selectionIds = (value: ReadonlyArray<number> | string | undefined) =>
  value === undefined || Predicate.isString(value) ? [] : value;

export const resolveDownloadLinksCreateInput = (
  input: DownloadLinksCreateInput,
): FilesBulkSelection => {
  const excludeIds = toOptionalIds(selectionIds(input.excludeIds));
  const ids = toOptionalIds(selectionIds(input.ids));

  if (ids !== undefined) {
    return { cursor: input.cursor, excludeIds, ids };
  }

  if (input.cursor) {
    return { cursor: input.cursor, excludeIds, ids };
  }

  throw new CliCommandInputError({
    message: "Provide at least one --id or a --cursor to create download links.",
  });
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
      }).pipe(
        Effect.flatMap((value) => checkCommandInput(() => resolveDownloadLinksCreateInput(value))),
      );

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
        outputMode: controls.outputMode,
        renderTerminalValue: renderDownloadLinksTerminal,
        requestedFields: controls.requestedFields,
        value: result,
      });
    }),
);

export const downloadLinksCommand = Command.make("download-links", {}, () => Effect.void).pipe(
  Command.withSubcommands([downloadLinksCreate, downloadLinksGet]),
);

export const downloadLinksCommandSpecs = [
  {
    auth: { required: true },
    capabilities: {
      dryRun: true,
      fieldSelection: false,
      rawJsonInput: true,
      streaming: false,
    },
    command: "download-links create",
    input: {
      flags: [
        cursorConfig.flag,
        dryRunFlag(),
        excludeIdsConfig.flag,
        idsConfig.flag,
        jsonFlag(),
        outputFlag(),
      ],
      json: jsonInputSpecFromSchema(DownloadLinksCreateInputSchema, [
        "Provide at least one ids entry or a cursor value.",
      ]),
    },
    kind: "write",
    purpose: translate("cli.metadata.downloadLinksCreate"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: false,
      fieldSelection: true,
      rawJsonInput: false,
      streaming: false,
    },
    command: "download-links get",
    input: { flags: [fieldsFlag(), downloadLinksIdConfig.flag, outputFlag()] },
    kind: "read",
    purpose: translate("cli.metadata.downloadLinksGet"),
  },
] satisfies ReadonlyArray<CommandSpec>;
