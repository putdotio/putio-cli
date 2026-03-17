import { Schema } from "effect";

import { translate } from "../i18n/index.js";

const NonEmptyStringSchema = Schema.String.pipe(
  Schema.filter((value): value is string => value.length > 0, {
    message: () => "Expected a non-empty string",
  }),
);

const OutputModeSchema = Schema.Literal("json", "text");
const InternalRendererSchema = Schema.Literal("json", "terminal");
const CommandKindSchema = Schema.Literal("utility", "auth", "read", "write");
const CommandOptionTypeSchema = Schema.Literal("string", "integer", "boolean", "enum");

const JsonScalarSchema = Schema.Struct({
  kind: Schema.Literal("string", "integer", "boolean"),
});

type JsonShape = CommandJsonShape;

const JsonPropertySchema: Schema.Schema<JsonProperty> = Schema.Struct({
  name: NonEmptyStringSchema,
  required: Schema.Boolean,
  schema: Schema.suspend(() => CommandJsonShapeSchema),
});

const JsonObjectSchema = Schema.Struct({
  kind: Schema.Literal("object"),
  properties: Schema.Array(JsonPropertySchema),
  rules: Schema.optional(Schema.Array(NonEmptyStringSchema)),
});

const JsonArraySchema = Schema.Struct({
  kind: Schema.Literal("array"),
  items: Schema.suspend(() => CommandJsonShapeSchema),
});

export const CommandJsonShapeSchema: Schema.Schema<CommandJsonShape> = Schema.Union(
  JsonScalarSchema,
  JsonObjectSchema,
  JsonArraySchema,
);

export type JsonProperty = {
  readonly name: string;
  readonly required: boolean;
  readonly schema: CommandJsonShape;
};

export type CommandJsonShape =
  | {
      readonly kind: "string" | "integer" | "boolean";
    }
  | {
      readonly kind: "array";
      readonly items: CommandJsonShape;
    }
  | {
      readonly kind: "object";
      readonly properties: ReadonlyArray<JsonProperty>;
      readonly rules?: ReadonlyArray<string>;
    };

export const CommandOptionSchema = Schema.Struct({
  choices: Schema.optional(Schema.Array(NonEmptyStringSchema)),
  defaultValue: Schema.optional(Schema.Union(NonEmptyStringSchema, Schema.Number, Schema.Boolean)),
  description: Schema.optional(NonEmptyStringSchema),
  name: NonEmptyStringSchema,
  repeated: Schema.Boolean,
  required: Schema.Boolean,
  type: CommandOptionTypeSchema,
});

export type CommandOption = Schema.Schema.Type<typeof CommandOptionSchema>;

const CommandInputSchema = Schema.Struct({
  flags: Schema.Array(CommandOptionSchema),
  json: Schema.optional(CommandJsonShapeSchema),
});

const CommandCapabilitiesSchema = Schema.Struct({
  dryRun: Schema.Boolean,
  fieldSelection: Schema.Boolean,
  rawJsonInput: Schema.Boolean,
  streaming: Schema.Boolean,
});

const CommandAuthSchema = Schema.Struct({
  required: Schema.Boolean,
});

export const CommandDescriptorSchema = Schema.Struct({
  auth: CommandAuthSchema,
  capabilities: CommandCapabilitiesSchema,
  command: NonEmptyStringSchema,
  input: CommandInputSchema,
  kind: CommandKindSchema,
  purpose: NonEmptyStringSchema,
});

export type CommandDescriptor = Schema.Schema.Type<typeof CommandDescriptorSchema>;

export const CliOutputContractSchema = Schema.Struct({
  default: Schema.Literal("text"),
  internalRenderers: Schema.Array(InternalRendererSchema),
  supported: Schema.Array(OutputModeSchema),
});

export type CliOutputContract = Schema.Schema.Type<typeof CliOutputContractSchema>;

const decodeCommandCatalog = Schema.decodeUnknownSync(Schema.Array(CommandDescriptorSchema));

const stringShape = (): JsonShape => ({ kind: "string" });
const integerShape = (): JsonShape => ({ kind: "integer" });
const booleanShape = (): JsonShape => ({ kind: "boolean" });
const arrayShape = (items: JsonShape): JsonShape => ({ kind: "array", items });
const property = (name: string, schema: JsonShape, required = true): JsonProperty => ({
  name,
  required,
  schema,
});
const objectShape = (
  properties: ReadonlyArray<JsonProperty>,
  rules?: ReadonlyArray<string>,
): JsonShape => ({
  kind: "object",
  properties,
  rules,
});

const outputFlag = (): CommandOption => ({
  choices: ["json", "text"],
  name: "output",
  repeated: false,
  required: false,
  type: "enum",
});

const dryRunFlag = (): CommandOption => ({
  defaultValue: false,
  name: "dry-run",
  repeated: false,
  required: false,
  type: "boolean",
});

const jsonFlag = (): CommandOption => ({
  name: "json",
  repeated: false,
  required: false,
  type: "string",
});

const booleanFlag = (
  name: string,
  options: {
    readonly defaultValue?: boolean;
    readonly description?: string;
    readonly required?: boolean;
  } = {},
): CommandOption => ({
  defaultValue: options.defaultValue,
  description: options.description,
  name,
  repeated: false,
  required: options.required ?? false,
  type: "boolean",
});

const integerFlag = (
  name: string,
  options: {
    readonly description?: string;
    readonly required?: boolean;
  } = {},
): CommandOption => ({
  description: options.description,
  name,
  repeated: false,
  required: options.required ?? false,
  type: "integer",
});

const repeatedIntegerFlag = (
  name: string,
  options: {
    readonly description?: string;
    readonly required?: boolean;
  } = {},
): CommandOption => ({
  description: options.description,
  name,
  repeated: true,
  required: options.required ?? false,
  type: "integer",
});

const stringFlag = (
  name: string,
  options: {
    readonly defaultValue?: string;
    readonly description?: string;
    readonly required?: boolean;
  } = {},
): CommandOption => ({
  defaultValue: options.defaultValue,
  description: options.description,
  name,
  repeated: false,
  required: options.required ?? false,
  type: "string",
});

const repeatedStringFlag = (
  name: string,
  options: {
    readonly description?: string;
    readonly required?: boolean;
  } = {},
): CommandOption => ({
  description: options.description,
  name,
  repeated: true,
  required: options.required ?? false,
  type: "string",
});

const enumFlag = (
  name: string,
  choices: ReadonlyArray<string>,
  options: {
    readonly description?: string;
    readonly required?: boolean;
  } = {},
): CommandOption => ({
  choices: [...choices],
  description: options.description,
  name,
  repeated: false,
  required: options.required ?? false,
  type: "enum",
});

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

const command = (
  descriptor: Omit<CommandDescriptor, "input"> & {
    readonly input?: CommandDescriptor["input"];
  },
): CommandDescriptor => ({
  ...descriptor,
  input: descriptor.input ?? { flags: [] },
});

export const commandCatalog = decodeCommandCatalog([
  command({
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "describe",
    input: { flags: [] },
    kind: "utility",
    purpose: translate("cli.metadata.describe"),
  }),
  command({
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "brand",
    input: { flags: [outputFlag()] },
    kind: "utility",
    purpose: translate("cli.metadata.brand"),
  }),
  command({
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "version",
    input: { flags: [outputFlag()] },
    kind: "utility",
    purpose: translate("cli.metadata.version"),
  }),
  command({
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "auth status",
    input: { flags: [outputFlag()] },
    kind: "auth",
    purpose: translate("cli.metadata.authStatus"),
  }),
  command({
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "auth login",
    input: {
      flags: [
        booleanFlag("open", { defaultValue: false }),
        outputFlag(),
        integerFlag("timeout-seconds"),
      ],
    },
    kind: "auth",
    purpose: translate("cli.metadata.authLogin"),
  }),
  command({
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "auth preview",
    input: {
      flags: [
        stringFlag("code", { defaultValue: "PUTIO1" }),
        booleanFlag("open", { defaultValue: false }),
        outputFlag(),
      ],
    },
    kind: "auth",
    purpose: translate("cli.metadata.authPreview"),
  }),
  command({
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "auth logout",
    input: { flags: [outputFlag()] },
    kind: "auth",
    purpose: translate("cli.metadata.authLogout"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "whoami",
    input: { flags: [outputFlag()] },
    kind: "read",
    purpose: translate("cli.metadata.whoami"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: true, fieldSelection: false, rawJsonInput: true, streaming: false },
    command: "download-links create",
    input: {
      flags: [
        stringFlag("cursor"),
        dryRunFlag(),
        repeatedIntegerFlag("exclude-id"),
        repeatedIntegerFlag("id"),
        jsonFlag(),
        outputFlag(),
      ],
      json: objectShape(
        [
          property("cursor", stringShape(), false),
          property("excludeIds", arrayShape(integerShape()), false),
          property("ids", arrayShape(integerShape()), false),
        ],
        ["Provide at least one ids entry or a cursor value."],
      ),
    },
    kind: "write",
    purpose: translate("cli.metadata.downloadLinksCreate"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "download-links get",
    input: { flags: [integerFlag("id", { required: true }), outputFlag()] },
    kind: "read",
    purpose: translate("cli.metadata.downloadLinksGet"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "events list",
    input: {
      flags: [
        integerFlag("before"),
        outputFlag(),
        integerFlag("per-page"),
        enumFlag("type", eventTypeChoices),
      ],
    },
    kind: "read",
    purpose: translate("cli.metadata.eventsList"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "files list",
    input: {
      flags: [
        outputFlag(),
        integerFlag("parent-id"),
        integerFlag("per-page"),
        stringFlag("content-type"),
        booleanFlag("hidden", { defaultValue: false }),
        enumFlag("file-type", fileTypeChoices),
        enumFlag("sort-by", fileSortChoices),
      ],
    },
    kind: "read",
    purpose: translate("cli.metadata.filesList"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: true, fieldSelection: false, rawJsonInput: true, streaming: false },
    command: "files mkdir",
    input: {
      flags: [dryRunFlag(), jsonFlag(), outputFlag(), integerFlag("parent-id"), stringFlag("name")],
      json: objectShape([
        property("name", stringShape()),
        property("parent_id", integerShape(), false),
      ]),
    },
    kind: "write",
    purpose: translate("cli.metadata.filesMkdir"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: true, fieldSelection: false, rawJsonInput: true, streaming: false },
    command: "files rename",
    input: {
      flags: [dryRunFlag(), integerFlag("id"), jsonFlag(), stringFlag("name"), outputFlag()],
      json: objectShape([property("file_id", integerShape()), property("name", stringShape())]),
    },
    kind: "write",
    purpose: translate("cli.metadata.filesRename"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: true, fieldSelection: false, rawJsonInput: true, streaming: false },
    command: "files move",
    input: {
      flags: [
        dryRunFlag(),
        repeatedIntegerFlag("id"),
        jsonFlag(),
        outputFlag(),
        integerFlag("parent-id"),
      ],
      json: objectShape([
        property("ids", arrayShape(integerShape())),
        property("parentId", integerShape()),
      ]),
    },
    kind: "write",
    purpose: translate("cli.metadata.filesMove"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: true, fieldSelection: false, rawJsonInput: true, streaming: false },
    command: "files delete",
    input: {
      flags: [
        dryRunFlag(),
        repeatedIntegerFlag("id"),
        jsonFlag(),
        outputFlag(),
        booleanFlag("skip-trash", { defaultValue: false }),
      ],
      json: objectShape([
        property("ids", arrayShape(integerShape())),
        property("skipTrash", booleanShape(), false),
      ]),
    },
    kind: "write",
    purpose: translate("cli.metadata.filesDelete"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "files search",
    input: {
      flags: [
        outputFlag(),
        integerFlag("per-page"),
        stringFlag("query", { required: true }),
        enumFlag("file-type", fileTypeChoices),
      ],
    },
    kind: "read",
    purpose: translate("cli.metadata.filesSearch"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "search",
    input: {
      flags: [
        outputFlag(),
        integerFlag("per-page"),
        stringFlag("query", { required: true }),
        enumFlag("file-type", fileTypeChoices),
      ],
    },
    kind: "read",
    purpose: translate("cli.metadata.search"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "transfers list",
    input: { flags: [outputFlag(), integerFlag("per-page")] },
    kind: "read",
    purpose: translate("cli.metadata.transfersList"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: true, fieldSelection: false, rawJsonInput: true, streaming: false },
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
      json: arrayShape(
        objectShape([
          property("callback_url", stringShape(), false),
          property("save_parent_id", integerShape(), false),
          property("url", stringShape()),
        ]),
      ),
    },
    kind: "write",
    purpose: translate("cli.metadata.transfersAdd"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: true, fieldSelection: false, rawJsonInput: true, streaming: false },
    command: "transfers cancel",
    input: {
      flags: [dryRunFlag(), repeatedIntegerFlag("id"), jsonFlag(), outputFlag()],
      json: objectShape([property("ids", arrayShape(integerShape()))]),
    },
    kind: "write",
    purpose: translate("cli.metadata.transfersCancel"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: true, fieldSelection: false, rawJsonInput: true, streaming: false },
    command: "transfers retry",
    input: {
      flags: [dryRunFlag(), integerFlag("id"), jsonFlag(), outputFlag()],
      json: objectShape([property("id", integerShape())]),
    },
    kind: "write",
    purpose: translate("cli.metadata.transfersRetry"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: true, fieldSelection: false, rawJsonInput: true, streaming: false },
    command: "transfers reannounce",
    input: {
      flags: [dryRunFlag(), integerFlag("id"), jsonFlag(), outputFlag()],
      json: objectShape([property("id", integerShape())]),
    },
    kind: "write",
    purpose: translate("cli.metadata.transfersReannounce"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "transfers watch",
    input: {
      flags: [
        integerFlag("id", { required: true }),
        integerFlag("interval-seconds"),
        outputFlag(),
        integerFlag("timeout-seconds"),
      ],
    },
    kind: "read",
    purpose: translate("cli.metadata.transfersWatch"),
  }),
  command({
    auth: { required: true },
    capabilities: { dryRun: true, fieldSelection: false, rawJsonInput: true, streaming: false },
    command: "transfers clean",
    input: {
      flags: [dryRunFlag(), repeatedIntegerFlag("id"), jsonFlag(), outputFlag()],
      json: objectShape([property("ids", arrayShape(integerShape()), false)]),
    },
    kind: "write",
    purpose: translate("cli.metadata.transfersClean"),
  }),
]);
