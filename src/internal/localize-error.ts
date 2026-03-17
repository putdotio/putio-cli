import { createLocalizeError, LocalizedError } from "@putdotio/sdk/utilities";
import { cliDownloadLinksErrorLocalizers } from "./localizers/download-links.js";
import { cliFilesErrorLocalizers } from "./localizers/files.js";
import { cliSharedErrorLocalizers } from "./localizers/shared.js";
import { cliTransfersErrorLocalizers } from "./localizers/transfers.js";

const localizeError = createLocalizeError<unknown>([
  ...cliFilesErrorLocalizers,
  ...cliTransfersErrorLocalizers,
  ...cliDownloadLinksErrorLocalizers,
  ...cliSharedErrorLocalizers,
]);

export const localizeCliError = (error: unknown) => localizeError(error);

export const isLocalizedError = (value: unknown): value is LocalizedError =>
  value instanceof LocalizedError;
