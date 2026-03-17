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

export const commandCatalog = decodeCommandCatalog([
  {
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "describe",
    kind: "utility",
    purpose: translate("cli.metadata.describe"),
  },
  {
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "brand",
    kind: "utility",
    purpose: translate("cli.metadata.brand"),
  },
  {
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "version",
    kind: "utility",
    purpose: translate("cli.metadata.version"),
  },
  {
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "auth status",
    kind: "auth",
    purpose: translate("cli.metadata.authStatus"),
  },
  {
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "auth login",
    kind: "auth",
    purpose: translate("cli.metadata.authLogin"),
  },
  {
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "auth preview",
    kind: "auth",
    purpose: translate("cli.metadata.authPreview"),
  },
  {
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "auth logout",
    kind: "auth",
    purpose: translate("cli.metadata.authLogout"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "whoami",
    kind: "read",
    purpose: translate("cli.metadata.whoami"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "download-links create",
    kind: "write",
    purpose: translate("cli.metadata.downloadLinksCreate"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "download-links get",
    kind: "read",
    purpose: translate("cli.metadata.downloadLinksGet"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "events list",
    kind: "read",
    purpose: translate("cli.metadata.eventsList"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "files list",
    kind: "read",
    purpose: translate("cli.metadata.filesList"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "files mkdir",
    kind: "write",
    purpose: translate("cli.metadata.filesMkdir"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "files rename",
    kind: "write",
    purpose: translate("cli.metadata.filesRename"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "files move",
    kind: "write",
    purpose: translate("cli.metadata.filesMove"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "files delete",
    kind: "write",
    purpose: translate("cli.metadata.filesDelete"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "files search",
    kind: "read",
    purpose: translate("cli.metadata.filesSearch"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "search",
    kind: "read",
    purpose: translate("cli.metadata.search"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "transfers list",
    kind: "read",
    purpose: translate("cli.metadata.transfersList"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "transfers add",
    kind: "write",
    purpose: translate("cli.metadata.transfersAdd"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "transfers cancel",
    kind: "write",
    purpose: translate("cli.metadata.transfersCancel"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "transfers retry",
    kind: "write",
    purpose: translate("cli.metadata.transfersRetry"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "transfers reannounce",
    kind: "write",
    purpose: translate("cli.metadata.transfersReannounce"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "transfers watch",
    kind: "read",
    purpose: translate("cli.metadata.transfersWatch"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "transfers clean",
    kind: "write",
    purpose: translate("cli.metadata.transfersClean"),
  },
]);
