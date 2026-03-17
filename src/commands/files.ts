import { Command, Options } from "@effect/cli";
import { Effect, Option } from "effect";

import {
  getOption,
  outputOption,
  parseRepeatedIntegerOption,
  withAuthedSdk,
} from "../internal/command.js";
import { translate } from "../i18n/index.js";
import { withTerminalLoader } from "../internal/loader-service.js";
import { writeOutput } from "../internal/output-service.js";
import { renderFilesTerminal } from "../internal/terminal/files-terminal.js";
const parentIdOption = Options.integer("parent-id").pipe(Options.optional);
const perPageOption = Options.integer("per-page").pipe(Options.optional);
const queryOption = Options.text("query");
const fileIdOption = Options.integer("id");
const fileIdsOption = parseRepeatedIntegerOption("id");
const fileNameOption = Options.text("name");
const requiredParentIdOption = Options.integer("parent-id");
const contentTypeOption = Options.text("content-type").pipe(Options.optional);
const hiddenOption = Options.boolean("hidden").pipe(Options.withDefault(false));
const skipTrashOption = Options.boolean("skip-trash").pipe(Options.withDefault(false));
const fileTypeChoices = [
  "FOLDER",
  "FILE",
  "AUDIO",
  "VIDEO",
  "IMAGE",
  "ARCHIVE",
  "PDF",
  "TEXT",
  "SWF",
] as const;
const fileTypeOption = Options.choice("file-type", fileTypeChoices).pipe(Options.optional);
const fileSortChoices = [
  "NAME_ASC",
  "NAME_DESC",
  "SIZE_ASC",
  "SIZE_DESC",
  "DATE_ASC",
  "DATE_DESC",
  "MODIFIED_ASC",
  "MODIFIED_DESC",
  "TYPE_ASC",
  "TYPE_DESC",
  "WATCH_ASC",
  "WATCH_DESC",
] as const;
const sortByOption = Options.choice("sort-by", fileSortChoices).pipe(Options.optional);

export const renderFileCreatedTerminal = (value: {
  readonly id: number;
  readonly name: string;
  readonly parent_id: number | null;
}) =>
  translate("cli.files.terminal.created", {
    id: value.id,
    name: value.name,
    parentId: value.parent_id ?? translate("cli.common.none"),
  });

export const renderFileRenamedTerminal = (value: {
  readonly fileId: number;
  readonly name: string;
}) => translate("cli.files.terminal.renamed", { fileId: value.fileId, name: value.name });

export const renderFilesDeletedTerminal = (value: {
  readonly ids: ReadonlyArray<number>;
  readonly skipped: number;
  readonly skipTrash: boolean;
}) =>
  [
    translate("cli.files.terminal.deleted", { ids: value.ids.join(", ") }),
    translate("cli.files.terminal.skipped", { count: value.skipped }),
    value.skipTrash ? translate("cli.files.terminal.skipTrashEnabled") : "",
  ]
    .filter((line) => line.length > 0)
    .join("\n");

export const renderFilesMovedTerminal = (value: {
  readonly ids: ReadonlyArray<number>;
  readonly parentId: number;
  readonly errors: ReadonlyArray<{
    readonly id: number;
    readonly error_type: string;
    readonly status_code: number;
  }>;
}) =>
  [
    translate("cli.files.terminal.moved", {
      ids: value.ids.join(", "),
      parentId: value.parentId,
    }),
    value.errors.length === 0
      ? ""
      : [
          translate("cli.files.terminal.moveErrors", { count: value.errors.length }),
          ...value.errors.map((error) =>
            translate("cli.files.terminal.moveErrorLine", {
              errorType: error.error_type,
              fileId: error.id,
              statusCode: error.status_code,
            }),
          ),
        ].join("\n"),
  ]
    .filter((line) => line.length > 0)
    .join("\n");

const filesList = Command.make(
  "list",
  {
    output: outputOption,
    parentId: parentIdOption,
    perPage: perPageOption,
    contentType: contentTypeOption,
    hidden: hiddenOption,
    fileType: fileTypeOption,
    sortBy: sortByOption,
  },
  ({ output, parentId, perPage, contentType, hidden, fileType, sortBy }) =>
    Effect.gen(function* () {
      const result = yield* withTerminalLoader(
        {
          message: translate("cli.files.command.loading"),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) =>
          sdk.files.list(
            Option.getOrElse(parentId, () => 0),
            {
              content_type: Option.getOrUndefined(contentType),
              file_type: Option.getOrUndefined(fileType),
              hidden: hidden ? 1 : undefined,
              per_page: Option.getOrElse(perPage, () => 20),
              sort_by: Option.getOrUndefined(sortBy),
              total: 1,
            },
          ),
        ),
      );

      yield* writeOutput(result, getOption(output), renderFilesTerminal);
    }),
);

const filesMkdir = Command.make(
  "mkdir",
  {
    output: outputOption,
    parentId: parentIdOption,
    name: fileNameOption,
  },
  ({ output, parentId, name }) =>
    Effect.gen(function* () {
      const result = yield* withTerminalLoader(
        {
          message: translate("cli.files.command.creatingFolder", { name }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) =>
          sdk.files.createFolder({
            name,
            parent_id: Option.getOrElse(parentId, () => 0),
          }),
        ),
      );

      yield* writeOutput(result, getOption(output), renderFileCreatedTerminal);
    }),
);

const filesRename = Command.make(
  "rename",
  {
    id: fileIdOption,
    name: fileNameOption,
    output: outputOption,
  },
  ({ id, name, output }) =>
    Effect.gen(function* () {
      yield* withTerminalLoader(
        {
          message: translate("cli.files.command.renaming", { id, name }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) =>
          sdk.files.rename({
            file_id: id,
            name,
          }),
        ),
      );

      yield* writeOutput({ fileId: id, name }, getOption(output), renderFileRenamedTerminal);
    }),
);

const filesDelete = Command.make(
  "delete",
  {
    id: fileIdsOption,
    output: outputOption,
    skipTrash: skipTrashOption,
  },
  ({ id, output, skipTrash }) =>
    Effect.gen(function* () {
      const result = yield* withTerminalLoader(
        {
          message: translate("cli.files.command.deleting", { count: id.length }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) =>
          sdk.files.delete(id, {
            skipTrash,
          }),
        ),
      );

      yield* writeOutput(
        {
          ids: id,
          skipTrash,
          skipped: result.skipped,
        },
        getOption(output),
        renderFilesDeletedTerminal,
      );
    }),
);

const filesMove = Command.make(
  "move",
  {
    id: fileIdsOption,
    output: outputOption,
    parentId: requiredParentIdOption,
  },
  ({ id, output, parentId }) =>
    Effect.gen(function* () {
      const errors = yield* withTerminalLoader(
        {
          message: translate("cli.files.command.moving", { count: id.length, parentId }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) => sdk.files.move(id, parentId)),
      );

      yield* writeOutput(
        {
          errors,
          ids: id,
          parentId,
        },
        getOption(output),
        renderFilesMovedTerminal,
      );
    }),
);

const filesSearchCommand = Command.make(
  "search",
  {
    output: outputOption,
    perPage: perPageOption,
    query: queryOption,
    fileType: fileTypeOption,
  },
  ({ output, perPage, query, fileType }) =>
    Effect.gen(function* () {
      const result = yield* withTerminalLoader(
        {
          message: translate("cli.files.command.searching", { query }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) =>
          sdk.files.search({
            per_page: Option.getOrElse(perPage, () => 20),
            query,
            type: Option.getOrUndefined(fileType),
          }),
        ),
      );

      yield* writeOutput(result, getOption(output), renderFilesTerminal);
    }),
);

export const searchCommand = filesSearchCommand;

export const filesCommand = Command.make("files", {}, () => Effect.void).pipe(
  Command.withSubcommands([
    filesList,
    filesSearchCommand,
    filesMkdir,
    filesRename,
    filesMove,
    filesDelete,
  ]),
);
