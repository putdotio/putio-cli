import { translate } from "../../i18n/index.js";

import { createOperationLocalizer, hasOperationErrorType, hasOperationStatus } from "./helpers.js";

const fileOperations = ["list", "continue", "get", "search", "createFolder", "rename"] as const;

export const cliFilesErrorLocalizers = [
  createOperationLocalizer(
    (error) => hasOperationErrorType(error, "files", fileOperations, "FILE_LOST"),
    () => ({
      message: translate("files.lost.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("files.lost.message"),
      },
    }),
  ),
  createOperationLocalizer(
    (error) => hasOperationStatus(error, "files", fileOperations, 410),
    () => ({
      message: translate("files.lost.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("files.lost.message"),
      },
    }),
  ),
  createOperationLocalizer(
    (error) => hasOperationErrorType(error, "files", fileOperations, "FILE_NOT_REACHABLE"),
    () => ({
      message: translate("files.notReachable.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("files.notReachable.message"),
      },
    }),
  ),
  createOperationLocalizer(
    (error) => hasOperationErrorType(error, "files", ["search"], "SEARCH_TOO_LONG_QUERY"),
    () => ({
      message: translate("cli.error.files.searchTooLong.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("cli.error.files.searchTooLong.message"),
      },
    }),
  ),
  createOperationLocalizer(
    (error) => hasOperationStatus(error, "files", fileOperations, 400),
    () => ({
      message: translate("files.badRequest.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("files.badRequest.message"),
      },
    }),
  ),
  createOperationLocalizer(
    (error) => hasOperationStatus(error, "files", fileOperations, 404),
    () => ({
      message: translate("files.notFound.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("files.notFound.message"),
      },
    }),
  ),
  createOperationLocalizer(
    (error) => hasOperationStatus(error, "files", fileOperations, 503),
    () => ({
      message: translate("generic.error503.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("generic.error503.message"),
      },
    }),
  ),
] as const;
