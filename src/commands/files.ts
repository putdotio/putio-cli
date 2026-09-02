import { Argument, Command } from "effect/unstable/cli";
import { Effect, Option, Schema } from "effect";

import {
  CliCommandInputError,
  defineBooleanOption,
  defineChoiceOption,
  defineIntegerOption,
  defineRepeatedIntegerOption,
  defineRepeatedTextOption,
  defineTextOption,
  dryRunOption,
  fieldsOption,
  getOption,
  jsonOption,
  outputOption,
  pageAllOption,
  resolveMutationInput,
  resolveReadOutputControls,
  validateLocalPathInput,
  validateNameLikeInput,
  withAuthedSdk,
  writeDryRunPlan,
  writeReadOutput,
  writeReadPages,
} from "../internal/command.js";
import {
  dryRunFlag,
  fieldsFlag,
  integerArgument,
  jsonFlag,
  jsonShapeFromSchema,
  outputFlag,
  pageAllFlag,
  type CommandSpec,
} from "../internal/command-specs.js";
import { translate } from "../i18n/index.js";
import { inspectLocalUpload, openLocalUploadBlob } from "../internal/local-upload.js";
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
const uploadPathConfig = defineTextOption("path", { optional: true });
const uploadFileNameConfig = defineTextOption("file-name", { optional: true });
const hlsOriginalConfig = defineBooleanOption("original", {
  defaultValue: false,
  description: "Serve the original file instead of the MP4 conversion.",
});
const hlsMaxSubtitleCountConfig = defineIntegerOption("max-subtitle-count", { optional: true });
const hlsSubtitleLanguageConfig = defineRepeatedTextOption("subtitle-language");

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
const uploadPathOption = uploadPathConfig.option;
const uploadFileNameOption = uploadFileNameConfig.option;
const hlsFileIdArgument = Argument.integer("file-id");
const startFromFileIdArgument = Argument.integer("file-id");
const optionalStartFromFileIdArgument = startFromFileIdArgument.pipe(Argument.optional);
const optionalStartFromTimeArgument = Argument.integer("seconds").pipe(Argument.optional);

const NonBlankStringSchema = Schema.String.check(
  Schema.makeFilter((value) =>
    value.trim().length > 0 ? undefined : "Expected a non-empty string",
  ),
);

const NonEmptyIdsSchema = Schema.Array(Schema.Number).check(Schema.isNonEmpty());
const PositiveIntegerSchema = Schema.Int.check(Schema.isGreaterThan(0));
const NonNegativeIntegerSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

const FilesMkdirInputSchema = Schema.Struct({
  name: NonBlankStringSchema,
  parent_id: Schema.optional(Schema.Number),
});

const FilesRenameInputSchema = Schema.Struct({
  file_id: Schema.Number,
  name: NonBlankStringSchema,
});

const FilesDeleteInputSchema = Schema.Struct({
  ids: NonEmptyIdsSchema,
  skip_trash: Schema.optional(Schema.Boolean),
});

const FilesMoveInputSchema = Schema.Struct({
  ids: NonEmptyIdsSchema,
  parent_id: Schema.Number,
});

const FilesUploadInputSchema = Schema.Struct({
  file_name: Schema.optional(NonBlankStringSchema),
  parent_id: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  path: NonBlankStringSchema,
});

const FilesStartFromSetInputSchema = Schema.Struct({
  file_id: PositiveIntegerSchema,
  time: NonNegativeIntegerSchema,
});

const FilesStartFromResetInputSchema = Schema.Struct({
  file_id: PositiveIntegerSchema,
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

const optionalNonNegativeInteger = (value: number | undefined, message: string) => {
  if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
    throw new CliCommandInputError({ message });
  }

  return value;
};

const requiredPositiveInteger = (value: number | undefined, message: string) => {
  if (value === undefined || !Number.isInteger(value) || value <= 0) {
    throw new CliCommandInputError({ message });
  }

  return value;
};

const requiredNonNegativeInteger = (value: number | undefined, message: string) => {
  if (value === undefined || !Number.isInteger(value) || value < 0) {
    throw new CliCommandInputError({ message });
  }

  return value;
};

export const renderFileUploadedTerminal = (
  value:
    | { readonly type: "file"; readonly file: { readonly id: number; readonly name: string } }
    | {
        readonly type: "transfer";
        readonly transfer: { readonly id: number; readonly name: string };
      },
) =>
  value.type === "file"
    ? translate("cli.files.terminal.uploadedFile", {
        id: value.file.id,
        name: value.file.name,
      })
    : translate("cli.files.terminal.uploadedTransfer", {
        id: value.transfer.id,
        name: value.transfer.name,
      });

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

const filesUpload = Command.make(
  "upload",
  {
    dryRun: dryRunOption,
    fileName: uploadFileNameOption,
    json: jsonOption,
    output: outputOption,
    parentId: parentIdOption,
    path: uploadPathOption,
  },
  ({ dryRun, fileName, json, output, parentId, path }) =>
    Effect.gen(function* () {
      const input = yield* resolveMutationInput({
        buildFromFlags: () => ({
          file_name: getOption(fileName),
          parent_id: getOption(parentId),
          path: requiredNonEmptyText(
            getOption(path),
            "Provide `--path` or `--json` for `files upload`.",
          ),
        }),
        json,
        schema: FilesUploadInputSchema,
      }).pipe(
        Effect.map((value) => ({
          ...value,
          file_name:
            value.file_name === undefined
              ? undefined
              : validateNameLikeInput(
                  "`files upload --file-name`",
                  requiredNonEmptyText(
                    value.file_name,
                    "Expected `files upload --file-name` to be a non-empty string.",
                  ),
                ),
          parent_id: optionalNonNegativeInteger(
            value.parent_id,
            "Expected `files upload --parent-id` to be a non-negative integer.",
          ),
          path: validateLocalPathInput("`files upload --path`", value.path),
        })),
      );
      const prepared = yield* inspectLocalUpload(input.path);
      const resolvedFileName = validateNameLikeInput(
        "`files upload --file-name`",
        input.file_name ?? prepared.fileName,
      );
      const plan = {
        file_name: resolvedFileName,
        parent_id: input.parent_id,
        path: input.path,
        size: prepared.size,
      };

      if (dryRun) {
        return yield* writeDryRunPlan("files upload", plan, getOption(output));
      }

      const file = yield* openLocalUploadBlob(prepared.path);
      const result = yield* withTerminalLoader(
        {
          message: translate("cli.files.command.uploading", { name: resolvedFileName }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk }) =>
          sdk.files.upload({
            file,
            fileName: resolvedFileName,
            parentId: input.parent_id,
          }),
        ),
      );

      yield* writeOutput(result, getOption(output), renderFileUploadedTerminal);
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
  },
  ({ fields, output, pageAll, perPage, query }) =>
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

const filesStartFromGet = Command.make(
  "get",
  {
    fields: fieldsOption,
    fileId: startFromFileIdArgument,
    output: outputOption,
  },
  ({ fields, fileId, output }) =>
    Effect.gen(function* () {
      const validatedFileId = requiredPositiveInteger(
        fileId,
        "Expected `files start-from get` file-id to be a positive integer.",
      );
      const controls = yield* resolveReadOutputControls({
        fields,
        output: getOption(output),
      });
      const startFrom = yield* withTerminalLoader(
        {
          message: translate("cli.files.command.loadingStartFrom", { fileId: validatedFileId }),
          output: controls.output,
        },
        withAuthedSdk(({ sdk }) => sdk.files.getStartFrom(validatedFileId)),
      );
      const result = {
        file_id: validatedFileId,
        start_from: startFrom,
      };

      yield* writeReadOutput({
        command: "files start-from get",
        output: controls.output,
        outputMode: controls.outputMode,
        renderTerminalValue: (value) =>
          translate("cli.files.terminal.startFrom", {
            fileId: value.file_id,
            seconds: value.start_from,
          }),
        requestedFields: controls.requestedFields,
        value: result,
      });
    }),
);

const filesStartFromSet = Command.make(
  "set",
  {
    dryRun: dryRunOption,
    fileId: optionalStartFromFileIdArgument,
    json: jsonOption,
    output: outputOption,
    seconds: optionalStartFromTimeArgument,
  },
  ({ dryRun, fileId, json, output, seconds }) =>
    Effect.gen(function* () {
      const input = yield* resolveMutationInput({
        buildFromFlags: () => ({
          file_id: requiredPositiveInteger(
            getOption(fileId),
            "Provide a positive file-id or `--json` for `files start-from set`.",
          ),
          time: requiredNonNegativeInteger(
            getOption(seconds),
            "Provide non-negative seconds or `--json` for `files start-from set`.",
          ),
        }),
        json,
        schema: FilesStartFromSetInputSchema,
      });

      if (dryRun) {
        return yield* writeDryRunPlan("files start-from set", input, getOption(output));
      }

      const result = yield* withAuthedSdk(({ sdk }) => sdk.files.setStartFrom(input));

      yield* writeOutput(
        {
          file_id: input.file_id,
          start_from: input.time,
          ...result,
        },
        getOption(output),
        () =>
          translate("cli.files.terminal.startFromSet", {
            fileId: input.file_id,
            seconds: input.time,
          }),
      );
    }),
);

const filesStartFromReset = Command.make(
  "reset",
  {
    dryRun: dryRunOption,
    fileId: optionalStartFromFileIdArgument,
    json: jsonOption,
    output: outputOption,
  },
  ({ dryRun, fileId, json, output }) =>
    Effect.gen(function* () {
      const input = yield* resolveMutationInput({
        buildFromFlags: () => ({
          file_id: requiredPositiveInteger(
            getOption(fileId),
            "Provide a positive file-id or `--json` for `files start-from reset`.",
          ),
        }),
        json,
        schema: FilesStartFromResetInputSchema,
      });

      if (dryRun) {
        return yield* writeDryRunPlan("files start-from reset", input, getOption(output));
      }

      const result = yield* withAuthedSdk(({ sdk }) => sdk.files.resetStartFrom(input.file_id));

      yield* writeOutput(
        {
          file_id: input.file_id,
          start_from: 0,
          ...result,
        },
        getOption(output),
        () => translate("cli.files.terminal.startFromReset", { fileId: input.file_id }),
      );
    }),
);

const filesHlsManifest = Command.make(
  "hls-manifest",
  {
    fields: fieldsOption,
    fileId: hlsFileIdArgument,
    maxSubtitleCount: hlsMaxSubtitleCountConfig.option,
    original: hlsOriginalConfig.option,
    output: outputOption,
    subtitleLanguages: hlsSubtitleLanguageConfig.option,
  },
  ({ fields, fileId, maxSubtitleCount, original, output, subtitleLanguages }) =>
    Effect.gen(function* () {
      const validatedFileId = requiredPositiveInteger(
        fileId,
        "Expected `files hls-manifest` file-id to be a positive integer.",
      );
      const controls = yield* resolveReadOutputControls({
        fields,
        output: getOption(output),
      });
      const languages = subtitleLanguages.map((value) => value.trim()).filter(Boolean);
      const manifest = yield* withTerminalLoader(
        {
          message: translate("cli.files.command.loadingHlsManifest", { fileId: validatedFileId }),
          output: controls.output,
        },
        withAuthedSdk(({ sdk }) =>
          sdk.files.getHlsMasterPlaylist(validatedFileId, {
            maxSubtitleCount: Option.getOrUndefined(maxSubtitleCount),
            playOriginal: original,
            ...(languages.length > 0 ? { subtitleLanguages: languages } : {}),
          }),
        ),
      );
      const result = {
        file_id: validatedFileId,
        manifest,
        original,
      };

      yield* writeReadOutput({
        command: "files hls-manifest",
        output: controls.output,
        outputMode: controls.outputMode,
        renderTerminalValue: (value) => value.manifest,
        requestedFields: controls.requestedFields,
        value: result,
      });
    }),
);

const filesStartFrom = Command.make("start-from", {}, () => Effect.void).pipe(
  Command.withSubcommands([filesStartFromGet, filesStartFromSet, filesStartFromReset]),
);

export const searchCommand = filesSearchCommand;

export const filesCommand = Command.make("files", {}, () => Effect.void).pipe(
  Command.withSubcommands([
    filesList,
    filesSearchCommand,
    filesMkdir,
    filesUpload,
    filesRename,
    filesMove,
    filesDelete,
    filesHlsManifest,
    filesStartFrom,
  ]),
);

export const filesCommandSpecs = [
  {
    auth: { required: true },
    capabilities: {
      dryRun: false,
      fieldSelection: true,
      rawJsonInput: false,
      streaming: false,
    },
    command: "files hls-manifest",
    input: {
      arguments: [integerArgument("file-id")],
      flags: [
        fieldsFlag(),
        outputFlag(),
        hlsOriginalConfig.flag,
        hlsMaxSubtitleCountConfig.flag,
        hlsSubtitleLanguageConfig.flag,
      ],
    },
    kind: "read",
    purpose: translate("cli.metadata.filesHlsManifest"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: false,
      fieldSelection: true,
      rawJsonInput: false,
      streaming: false,
    },
    command: "files start-from get",
    input: {
      arguments: [integerArgument("file-id")],
      flags: [fieldsFlag(), outputFlag()],
    },
    kind: "read",
    purpose: translate("cli.metadata.filesStartFromGet"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: true,
      fieldSelection: false,
      rawJsonInput: true,
      streaming: false,
    },
    command: "files start-from set",
    input: {
      arguments: [
        integerArgument("file-id", { required: false }),
        integerArgument("seconds", { required: false }),
      ],
      flags: [dryRunFlag(), jsonFlag(), outputFlag()],
      json: jsonShapeFromSchema(FilesStartFromSetInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.filesStartFromSet"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: true,
      fieldSelection: false,
      rawJsonInput: true,
      streaming: false,
    },
    command: "files start-from reset",
    input: {
      arguments: [integerArgument("file-id", { required: false })],
      flags: [dryRunFlag(), jsonFlag(), outputFlag()],
      json: jsonShapeFromSchema(FilesStartFromResetInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.filesStartFromReset"),
  },
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
      flags: [fieldsFlag(), outputFlag(), pageAllFlag(), perPageConfig.flag, queryConfig.flag],
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
    command: "files upload",
    input: {
      flags: [
        dryRunFlag(),
        uploadFileNameConfig.flag,
        jsonFlag(),
        outputFlag(),
        parentIdConfig.flag,
        uploadPathConfig.flag,
      ],
      json: jsonShapeFromSchema(FilesUploadInputSchema, [
        "`path` must resolve to a readable regular file.",
        "`file_name` rejects control characters and path traversal segments like `../` or `%2e`.",
      ]),
    },
    kind: "write",
    purpose: translate("cli.metadata.filesUpload"),
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
      flags: [fieldsFlag(), outputFlag(), pageAllFlag(), perPageConfig.flag, queryConfig.flag],
    },
    kind: "read",
    purpose: translate("cli.metadata.search"),
  },
] satisfies ReadonlyArray<CommandSpec>;
