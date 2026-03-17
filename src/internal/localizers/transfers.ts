import { translate } from "../../i18n/index.js";

import { createOperationLocalizer, hasOperationErrorType, hasOperationStatus } from "./helpers.js";

export const cliTransfersErrorLocalizers = [
  createOperationLocalizer(
    (error) => hasOperationErrorType(error, "transfers", ["add"], "EMPTY_URL"),
    () => ({
      message: translate("cli.error.transfers.add.emptyUrl.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("cli.error.transfers.add.emptyUrl.message"),
      },
      meta: {
        hints: [translate("cli.error.transfers.add.emptyUrl.hint")],
      },
    }),
  ),
  createOperationLocalizer(
    (error) => hasOperationErrorType(error, "transfers", ["addMany"], "TOO_MANY_URLS"),
    () => ({
      message: translate("cli.error.transfers.add.tooManyUrls.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("cli.error.transfers.add.tooManyUrls.message"),
      },
      meta: {
        hints: [translate("cli.error.transfers.add.tooManyUrls.hint")],
      },
    }),
  ),
  createOperationLocalizer(
    (error) => hasOperationStatus(error, "transfers", ["get", "retry"], 404),
    () => ({
      message: translate("cli.error.transfers.notFound.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("cli.error.transfers.notFound.message"),
      },
    }),
  ),
  createOperationLocalizer(
    (error) => hasOperationStatus(error, "transfers", ["retry"], 403),
    () => ({
      message: translate("cli.error.transfers.forbidden.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("cli.error.transfers.forbidden.message"),
      },
    }),
  ),
  createOperationLocalizer(
    (error) => hasOperationStatus(error, "transfers", ["list", "add", "addMany", "retry"], 400),
    () => ({
      message: translate("cli.error.transfers.badRequest.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("cli.error.transfers.badRequest.message"),
      },
      meta: {
        hints: [translate("cli.error.transfers.badRequest.hint")],
      },
    }),
  ),
] as const;
