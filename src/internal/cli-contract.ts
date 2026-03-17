import { DownloadLinksCreateInputSchema } from "@putdotio/sdk";
import {
  FilesDeleteInputSchema,
  FilesMkdirInputSchema,
  FilesMoveInputSchema,
  FilesRenameInputSchema,
} from "../commands/files.js";
import {
  TransfersAddInputSchema,
  TransfersCancelInputSchema,
  TransfersCleanInputSchema,
  TransfersSingleIdInputSchema,
} from "../commands/transfers.js";
import { translate } from "../i18n/index.js";

import {
  CliOutputContractSchema,
  CommandDescriptorSchema,
  booleanFlag,
  decodeCommandSpecs,
  dryRunFlag,
  enumFlag,
  fieldsFlag,
  integerFlag,
  jsonFlag,
  jsonShapeFromSchema,
  outputFlag,
  pageAllFlag,
  repeatedIntegerFlag,
  repeatedStringFlag,
  stringFlag,
  type CliOutputContract,
  type CommandDescriptor,
} from "./command-specs.js";

export { CliOutputContractSchema, CommandDescriptorSchema };
export type { CliOutputContract, CommandDescriptor };

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

export const commandCatalog = decodeCommandSpecs([
  {
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "describe",
    input: { flags: [] },
    kind: "utility",
    purpose: translate("cli.metadata.describe"),
  },
  {
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "brand",
    input: { flags: [outputFlag()] },
    kind: "utility",
    purpose: translate("cli.metadata.brand"),
  },
  {
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "version",
    input: { flags: [outputFlag()] },
    kind: "utility",
    purpose: translate("cli.metadata.version"),
  },
  {
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
  },
  {
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "auth status",
    input: { flags: [outputFlag()] },
    kind: "auth",
    purpose: translate("cli.metadata.authStatus"),
  },
  {
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "auth logout",
    input: { flags: [outputFlag()] },
    kind: "auth",
    purpose: translate("cli.metadata.authLogout"),
  },
  {
    auth: { required: false },
    capabilities: { dryRun: false, fieldSelection: false, rawJsonInput: false, streaming: false },
    command: "auth preview",
    input: {
      flags: [stringFlag("code", { required: true }), booleanFlag("open"), outputFlag()],
    },
    kind: "auth",
    purpose: translate("cli.metadata.authPreview"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: true, rawJsonInput: false, streaming: false },
    command: "whoami",
    input: { flags: [fieldsFlag(), outputFlag()] },
    kind: "read",
    purpose: translate("cli.metadata.whoami"),
  },
  {
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
      json: jsonShapeFromSchema(DownloadLinksCreateInputSchema, [
        "Provide at least one ids entry or a cursor value.",
      ]),
    },
    kind: "write",
    purpose: translate("cli.metadata.downloadLinksCreate"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: true, rawJsonInput: false, streaming: false },
    command: "download-links get",
    input: { flags: [fieldsFlag(), integerFlag("id", { required: true }), outputFlag()] },
    kind: "read",
    purpose: translate("cli.metadata.downloadLinksGet"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: true, rawJsonInput: false, streaming: false },
    command: "events list",
    input: {
      flags: [
        integerFlag("before"),
        fieldsFlag(),
        outputFlag(),
        integerFlag("per-page"),
        enumFlag("type", eventTypeChoices),
      ],
    },
    kind: "read",
    purpose: translate("cli.metadata.eventsList"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: true, rawJsonInput: false, streaming: true },
    command: "files list",
    input: {
      flags: [
        fieldsFlag(),
        outputFlag(),
        pageAllFlag(),
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
  },
  {
    auth: { required: true },
    capabilities: { dryRun: true, fieldSelection: false, rawJsonInput: true, streaming: false },
    command: "files mkdir",
    input: {
      flags: [dryRunFlag(), jsonFlag(), outputFlag(), integerFlag("parent-id"), stringFlag("name")],
      json: jsonShapeFromSchema(FilesMkdirInputSchema, [
        "`name` rejects control characters and path traversal segments like `../` or `%2e`.",
      ]),
    },
    kind: "write",
    purpose: translate("cli.metadata.filesMkdir"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: true, fieldSelection: false, rawJsonInput: true, streaming: false },
    command: "files rename",
    input: {
      flags: [dryRunFlag(), integerFlag("id"), jsonFlag(), stringFlag("name"), outputFlag()],
      json: jsonShapeFromSchema(FilesRenameInputSchema, [
        "`name` rejects control characters and path traversal segments like `../` or `%2e`.",
      ]),
    },
    kind: "write",
    purpose: translate("cli.metadata.filesRename"),
  },
  {
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
      json: jsonShapeFromSchema(FilesMoveInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.filesMove"),
  },
  {
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
      json: jsonShapeFromSchema(FilesDeleteInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.filesDelete"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: true, rawJsonInput: false, streaming: true },
    command: "files search",
    input: {
      flags: [
        fieldsFlag(),
        outputFlag(),
        pageAllFlag(),
        integerFlag("per-page"),
        stringFlag("query", { required: true }),
        enumFlag("file-type", fileTypeChoices),
      ],
    },
    kind: "read",
    purpose: translate("cli.metadata.filesSearch"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: true, rawJsonInput: false, streaming: true },
    command: "search",
    input: {
      flags: [
        fieldsFlag(),
        outputFlag(),
        pageAllFlag(),
        integerFlag("per-page"),
        stringFlag("query", { required: true }),
        enumFlag("file-type", fileTypeChoices),
      ],
    },
    kind: "read",
    purpose: translate("cli.metadata.search"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: true, rawJsonInput: false, streaming: true },
    command: "transfers list",
    input: { flags: [fieldsFlag(), outputFlag(), pageAllFlag(), integerFlag("per-page")] },
    kind: "read",
    purpose: translate("cli.metadata.transfersList"),
  },
  {
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
      json: jsonShapeFromSchema(TransfersAddInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.transfersAdd"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: true, fieldSelection: false, rawJsonInput: true, streaming: false },
    command: "transfers cancel",
    input: {
      flags: [dryRunFlag(), repeatedIntegerFlag("id"), jsonFlag(), outputFlag()],
      json: jsonShapeFromSchema(TransfersCancelInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.transfersCancel"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: true, fieldSelection: false, rawJsonInput: true, streaming: false },
    command: "transfers retry",
    input: {
      flags: [dryRunFlag(), integerFlag("id"), jsonFlag(), outputFlag()],
      json: jsonShapeFromSchema(TransfersSingleIdInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.transfersRetry"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: true, fieldSelection: false, rawJsonInput: true, streaming: false },
    command: "transfers reannounce",
    input: {
      flags: [dryRunFlag(), integerFlag("id"), jsonFlag(), outputFlag()],
      json: jsonShapeFromSchema(TransfersSingleIdInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.transfersReannounce"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: false, fieldSelection: true, rawJsonInput: false, streaming: true },
    command: "transfers watch",
    input: {
      flags: [
        fieldsFlag(),
        integerFlag("id", { required: true }),
        integerFlag("interval-seconds"),
        outputFlag(),
        integerFlag("timeout-seconds"),
      ],
    },
    kind: "read",
    purpose: translate("cli.metadata.transfersWatch"),
  },
  {
    auth: { required: true },
    capabilities: { dryRun: true, fieldSelection: false, rawJsonInput: true, streaming: false },
    command: "transfers clean",
    input: {
      flags: [dryRunFlag(), repeatedIntegerFlag("id"), jsonFlag(), outputFlag()],
      json: jsonShapeFromSchema(TransfersCleanInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.transfersClean"),
  },
]);
