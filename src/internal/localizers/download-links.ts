import { translate } from "@putdotio/translations";

import { createOperationLocalizer, hasOperationErrorType, hasOperationStatus } from "./helpers.js";

export const cliDownloadLinksErrorLocalizers = [
  createOperationLocalizer(
    (error) =>
      hasOperationErrorType(error, "downloadLinks", ["create"], "DownloadLinksConcurrentLimit"),
    () => ({
      message: translate("cli.error.downloadLinks.concurrentLimit.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("cli.error.downloadLinks.concurrentLimit.message"),
      },
    }),
  ),
  createOperationLocalizer(
    (error) =>
      hasOperationErrorType(
        error,
        "downloadLinks",
        ["create"],
        "DownloadLinksTooManyFilesRequested",
      ),
    () => ({
      message: translate("cli.error.downloadLinks.tooManyFilesRequested.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("cli.error.downloadLinks.tooManyFilesRequested.message"),
      },
    }),
  ),
  createOperationLocalizer(
    (error) =>
      hasOperationErrorType(
        error,
        "downloadLinks",
        ["create"],
        "DownloadLinksTooManyChildrenRequested",
      ),
    () => ({
      message: translate("cli.error.downloadLinks.tooManyChildrenRequested.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("cli.error.downloadLinks.tooManyChildrenRequested.message"),
      },
    }),
  ),
  createOperationLocalizer(
    (error) => hasOperationStatus(error, "downloadLinks", ["create"], 400),
    () => ({
      message: translate("cli.error.downloadLinks.badRequest.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("cli.error.downloadLinks.badRequest.message"),
      },
    }),
  ),
  createOperationLocalizer(
    (error) =>
      hasOperationErrorType(error, "downloadLinks", ["get"], "LINKS_NOT_FOUND") ||
      hasOperationStatus(error, "downloadLinks", ["get"], 404),
    () => ({
      message: translate("cli.error.downloadLinks.notFound.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("cli.error.downloadLinks.notFound.message"),
      },
    }),
  ),
] as const;
