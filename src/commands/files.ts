import { Command } from "@effect/cli";
import { Effect, Option, Schema } from "effect";

import {
  CliCommandInputError,
  defineBooleanOption,
  defineChoiceOption,
  defineIntegerOption,
  defineRepeatedIntegerOption,
  defineTextOption,
  dryRunOption,
  fieldsOption,
  getOption,
  jsonOption,
  outputOption,
  pageAllOption,
  resolveMutationInput,
  resolveReadOutputControls,
  validateNameLikeInput,
  withAuthedSdk,
  writeDryRunPlan,
  writeReadPages,
} from "../internal/command.js";
import {
  dryRunFlag,
  fieldsFlag,
  jsonFlag,
  jsonShapeFromSchema,
  outputFlag,
  pageAllFlag,
  type CommandSpec,
} from "../internal/command-specs.js";
import { translate } from "../i18n/index.js";
import { withTerminalLoader } from "../internal/loader-service.js";
import { writeOutput } from "../internal/output-service.js";
import { renderFilesTerminal } from "../internal/terminal/files-terminal.js";
const parentIdConfig = defineIntegerOption("parent-id", { optional: true });
const perPageConfig = defineIntegerOption("per-page", { optional: true });
const queryConfig = defineTextOption("query");
const fileIdsConfig = defineRepeatedIntegerOption("id");
const contentTypeConfig = defineTextOption("content-type", { optional: true });
const hiddenConfig = defineBooleanOption("hidden", { defaultValue: false });
const skipTrashConfig = defineBooleanOption("skip-trash", { defaultValue: false });
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
const fileTypeConfig = defineChoiceOption("file-type", fileTypeChoices, { optional: true });
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
const sortByConfig = defineChoiceOption("sort-by", fileSortChoices, { optional: true });
const optionalFileIdConfig = defineIntegerOption("id", { optional: true });
const optionalFileNameConfig = defineTextOption("name", { optional: true });

const parentIdOption = parentIdConfig.option;
const perPageOption = perPageConfig.option;
const queryOption = queryConfig.option;
const fileIdsOption = fileIdsConfig.option;
const contentTypeOption = contentTypeConfig.option;
const hiddenOption = hiddenConfig.option;
const skipTrashOption = skipTrashConfig.option;
const fileTypeOption = fileTypeConfig.option;
const sortByOption = sortByConfig.option;
const optionalFileIdOption = optionalFileIdConfig.option;
const optionalFileNameOption = optionalFileNameConfig.option;

const NonEmptyStringSchema = Schema.String.pipe(
  Schema.filter((value): value is string => value.trim().length > 0, {
    message: () => "Expected a non-empty string",
  }),
);

const NonEmptyIdsSchema = Schema.Array(Schema.Number).pipe(
  Schema.filter((value): value is ReadonlyArray<number> => value.length > 0, {
    message: () => "Expected at least one id",
  }),
);

export const FilesMkdirInputSchema = Schema.Struct({
  name: NonEmptyStringSchema,
  parent_id: Schema.optional(Schema.Number),
});

export const FilesRenameInputSchema = Schema.Struct({
  file_id: Schema.Number,
  name: NonEmptyStringSchema,
});

export const FilesDeleteInputSchema = Schema.Struct({
  ids: NonEmptyIdsSchema,
  skip_trash: Schema.optional(Schema.Boolean),
});

export const FilesMoveInputSchema = Schema.Struct({
  ids: NonEmptyIdsSchema,
  parent_id: Schema.Number,
});

const requiredValue = <A>(value: A | undefined, message: string) => {
  if (value === undefined) {
    throw new CliCommandInputError({ message });
  }

  return value;
};

const requiredNonEmptyText = (value: string | undefined, message: string) => {
  if (value === undefined || value.trim().length === 0) {
    throw new CliCommandInputError({ message });
  }

  return value;
};

const requiredIds = (value: ReadonlyArray<number>, message: string) => {
  if (value.length === 0) {
    throw new CliCommandInputError({ message });
  }

  return value;
};

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
    fields: fieldsOption,
    output: outputOption,
    pageAll: pageAllOption,
    parentId: parentIdOption,
    perPage: perPageOption,
    contentType: contentTypeOption,
    hidden: hiddenOption,
    fileType: fileTypeOption,
    sortBy: sortByOption,
  },
  ({ fields, output, pageAll, parentId, perPage, contentType, hidden, fileType, sortBy }) =>
    Effect.gen(function* () {
      const controls = yield* resolveReadOutputControls({
        fields,
        output: getOption(output),
        pageAll,
      });
      const parent = Option.getOrElse(parentId, () => 0);
      const perPageValue = Option.getOrElse(perPage, () => 20);
      const query = {
        content_type: Option.getOrUndefined(contentType),
        file_type: Option.getOrUndefined(fileType),
        hidden: hidden ? 1 : undefined,
        per_page: perPageValue,
        sort_by: Option.getOrUndefined(sortBy),
        total: 1,
      } as const;
      const result = yield* withTerminalLoader(
        {
          message: translate("cli.files.command.loading"),
          output: controls.output,
        },
        withAuthedSdk(({ sdk }) => sdk.files.list(parent, query)),
      );

      yield* writeReadPages({
        command: "files list",
        continueWithCursor: (cursor) =>
          withAuthedSdk(({ sdk }) => sdk.files.continue(cursor, { per_page: perPageValue })),
        controls,
        initial: result,
        itemKey: "files",
        renderTerminalValue: renderFilesTerminal,
      });
    }),
);

const filesMkdir = Command.make(
  "mkdir",
  {
    dryRun: dryRunOption,
    json: jsonOption,
    output: outputOption,
    parentId: parentIdOption,
    name: optionalFileNameOption,
  },
  ({ dryRun, output, parentId, name, json }) =>
    Effect.gen(function* () {
      const input = yield* resolveMutationInput({
        buildFromFlags: () => ({
          name: requiredNonEmptyText(
            getOption(name),
            "Provide `--name` or `--json` for `files mkdir`.",
          ),
          parent_id: getOption(parentId),
        }),
        json,
        schema: FilesMkdirInputSchema,
      }).pipe(
        Effect.map((value) => ({
          ...value,
          name: validateNameLikeInput("`files mkdir --name`", value.name),
        })),
      );

      if (dryRun) {
        return yield* writeDryRunPlan("files mkdir", input, getOption(output));
      }

      const result = yield* withTerminalLoader(
        {
          message: translate("cli.files.command.creatingFolder", { name: input.name }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) => sdk.files.createFolder(input)),
      );

      yield* writeOutput(result, getOption(output), renderFileCreatedTerminal);
    }),
);

const filesRename = Command.make(
  "rename",
  {
    dryRun: dryRunOption,
    id: optionalFileIdOption,
    json: jsonOption,
    name: optionalFileNameOption,
    output: outputOption,
  },
  ({ dryRun, id, name, json, output }) =>
    Effect.gen(function* () {
      const input = yield* resolveMutationInput({
        buildFromFlags: () => ({
          file_id: requiredValue(getOption(id), "Provide `--id` or `--json` for `files rename`."),
          name: requiredNonEmptyText(
            getOption(name),
            "Provide `--name` or `--json` for `files rename`.",
          ),
        }),
        json,
        schema: FilesRenameInputSchema,
      }).pipe(
        Effect.map((value) => ({
          ...value,
          name: validateNameLikeInput("`files rename --name`", value.name),
        })),
      );

      if (dryRun) {
        return yield* writeDryRunPlan("files rename", input, getOption(output));
      }

      yield* withTerminalLoader(
        {
          message: translate("cli.files.command.renaming", { id: input.file_id, name: input.name }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) => sdk.files.rename(input)),
      );

      yield* writeOutput(
        { fileId: input.file_id, name: input.name },
        getOption(output),
        renderFileRenamedTerminal,
      );
    }),
);

const filesDelete = Command.make(
  "delete",
  {
    dryRun: dryRunOption,
    id: fileIdsOption,
    json: jsonOption,
    output: outputOption,
    skipTrash: skipTrashOption,
  },
  ({ dryRun, id, json, output, skipTrash }) =>
    Effect.gen(function* () {
      const input = yield* resolveMutationInput({
        buildFromFlags: () => ({
          ids: requiredIds(id, "Provide at least one `--id` or `--json` for `files delete`."),
          skip_trash: skipTrash,
        }),
        json,
        schema: FilesDeleteInputSchema,
      }).pipe(
        Effect.map((value) => ({
          ids: value.ids,
          skipTrash: value.skip_trash ?? false,
        })),
      );

      if (dryRun) {
        return yield* writeDryRunPlan("files delete", input, getOption(output));
      }

      const result = yield* withTerminalLoader(
        {
          message: translate("cli.files.command.deleting", { count: input.ids.length }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) => sdk.files.delete(input.ids, { skipTrash: input.skipTrash })),
      );

      yield* writeOutput(
        {
          ids: input.ids,
          skipTrash: input.skipTrash,
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
    dryRun: dryRunOption,
    id: fileIdsOption,
    json: jsonOption,
    output: outputOption,
    parentId: parentIdOption,
  },
  ({ dryRun, id, json, output, parentId }) =>
    Effect.gen(function* () {
      const input = yield* resolveMutationInput({
        buildFromFlags: () => ({
          ids: requiredIds(id, "Provide at least one `--id` or `--json` for `files move`."),
          parent_id: requiredValue(
            getOption(parentId),
            "Provide `--parent-id` or `--json` for `files move`.",
          ),
        }),
        json,
        schema: FilesMoveInputSchema,
      });

      if (dryRun) {
        return yield* writeDryRunPlan("files move", input, getOption(output));
      }

      const errors = yield* withTerminalLoader(
        {
          message: translate("cli.files.command.moving", {
            count: input.ids.length,
            parentId: input.parent_id,
          }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) => sdk.files.move(input.ids, input.parent_id)),
      );

      yield* writeOutput(
        {
          errors,
          ids: input.ids,
          parentId: input.parent_id,
        },
        getOption(output),
        renderFilesMovedTerminal,
      );
    }),
);

const filesSearchCommand = Command.make(
  "search",
  {
    fields: fieldsOption,
    output: outputOption,
    pageAll: pageAllOption,
    perPage: perPageOption,
    query: queryOption,
    fileType: fileTypeOption,
  },
  ({ fields, output, pageAll, perPage, query, fileType }) =>
    Effect.gen(function* () {
      const controls = yield* resolveReadOutputControls({
        fields,
        output: getOption(output),
        pageAll,
      });
      const perPageValue = Option.getOrElse(perPage, () => 20);
      const searchQuery = {
        per_page: perPageValue,
        query,
        type: Option.getOrUndefined(fileType),
      } as const;
      const result = yield* withTerminalLoader(
        {
          message: translate("cli.files.command.searching", { query }),
          output: controls.output,
        },
        withAuthedSdk(({ sdk }) => sdk.files.search(searchQuery)),
      );

      yield* writeReadPages({
        command: "files search",
        continueWithCursor: (cursor) =>
          withAuthedSdk(({ sdk }) => sdk.files.continueSearch(cursor, { per_page: perPageValue })),
        controls,
        initial: result,
        itemKey: "files",
        renderTerminalValue: renderFilesTerminal,
      });
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

export const filesCommandSpecs = [
  {
    auth: { required: true },
    capabilities: {
      dryRun: false,
      fieldSelection: true,
      rawJsonInput: false,
      streaming: true,
    },
    command: "files list",
    input: {
      flags: [
        fieldsFlag(),
        outputFlag(),
        pageAllFlag(),
        parentIdConfig.flag,
        perPageConfig.flag,
        contentTypeConfig.flag,
        hiddenConfig.flag,
        fileTypeConfig.flag,
        sortByConfig.flag,
      ],
    },
    kind: "read",
    purpose: translate("cli.metadata.filesList"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: false,
      fieldSelection: true,
      rawJsonInput: false,
      streaming: true,
    },
    command: "files search",
    input: {
      flags: [
        fieldsFlag(),
        outputFlag(),
        pageAllFlag(),
        perPageConfig.flag,
        queryConfig.flag,
        fileTypeConfig.flag,
      ],
    },
    kind: "read",
    purpose: translate("cli.metadata.filesSearch"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: true,
      fieldSelection: false,
      rawJsonInput: true,
      streaming: false,
    },
    command: "files mkdir",
    input: {
      flags: [
        dryRunFlag(),
        jsonFlag(),
        outputFlag(),
        parentIdConfig.flag,
        optionalFileNameConfig.flag,
      ],
      json: jsonShapeFromSchema(FilesMkdirInputSchema, [
        "`name` rejects control characters and path traversal segments like `../` or `%2e`.",
      ]),
    },
    kind: "write",
    purpose: translate("cli.metadata.filesMkdir"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: true,
      fieldSelection: false,
      rawJsonInput: true,
      streaming: false,
    },
    command: "files rename",
    input: {
      flags: [
        dryRunFlag(),
        optionalFileIdConfig.flag,
        jsonFlag(),
        optionalFileNameConfig.flag,
        outputFlag(),
      ],
      json: jsonShapeFromSchema(FilesRenameInputSchema, [
        "`name` rejects control characters and path traversal segments like `../` or `%2e`.",
      ]),
    },
    kind: "write",
    purpose: translate("cli.metadata.filesRename"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: true,
      fieldSelection: false,
      rawJsonInput: true,
      streaming: false,
    },
    command: "files move",
    input: {
      flags: [dryRunFlag(), fileIdsConfig.flag, jsonFlag(), outputFlag(), parentIdConfig.flag],
      json: jsonShapeFromSchema(FilesMoveInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.filesMove"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: true,
      fieldSelection: false,
      rawJsonInput: true,
      streaming: false,
    },
    command: "files delete",
    input: {
      flags: [dryRunFlag(), fileIdsConfig.flag, jsonFlag(), outputFlag(), skipTrashConfig.flag],
      json: jsonShapeFromSchema(FilesDeleteInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.filesDelete"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: false,
      fieldSelection: true,
      rawJsonInput: false,
      streaming: true,
    },
    command: "search",
    input: {
      flags: [
        fieldsFlag(),
        outputFlag(),
        pageAllFlag(),
        perPageConfig.flag,
        queryConfig.flag,
        fileTypeConfig.flag,
      ],
    },
    kind: "read",
    purpose: translate("cli.metadata.search"),
  },
] satisfies ReadonlyArray<CommandSpec>;
