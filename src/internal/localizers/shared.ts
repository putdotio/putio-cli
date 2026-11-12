import type {
  APIErrorByStatusCodeLocalizer,
  GenericErrorLocalizer,
  MatchConditionLocalizer,
} from "@putdotio/sdk/utilities";
import { DEFAULT_PUTIO_WEB_APP_URL } from "@putdotio/sdk";
import { Predicate } from "effect";
import { translate } from "../../i18n/index.js";

import {
  getNestedErrorMessage,
  isPlainRecord,
  isRetryAfterInput,
  parseRetryAfterSeconds,
} from "./helpers.js";

const buildRateLimitResolutionUrl = (
  rateLimitId: string,
  webAppUrl: string = DEFAULT_PUTIO_WEB_APP_URL,
) => {
  const url = new URL(`/captcha/${rateLimitId}`, webAppUrl);

  return url.toString();
};

const isNonEmptyString = (value: unknown): value is string =>
  Predicate.isString(value) && value.length > 0;

const formatResetTimestamp = (seconds: number | undefined): string | undefined => {
  if (seconds === undefined || !Number.isFinite(seconds)) {
    return undefined;
  }

  const date = new Date(seconds * 1000);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const pad = (part: number) => String(part).padStart(2, "0");

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
};

const rateLimitLocalizer: MatchConditionLocalizer<unknown> = {
  kind: "match_condition",
  match: (error) =>
    isPlainRecord(error) &&
    (Predicate.isTagged(error, "PutioRateLimitError") ||
      ("body" in error &&
        isPlainRecord(error.body) &&
        error.body.status_code === 429 &&
        error.body.error_type === "RATE_LIMIT_ERROR")),
  localize: (error) => {
    const value = isPlainRecord(error) ? error : {};
    const body = "body" in value && isPlainRecord(value.body) ? value.body : {};
    const bodyRetryAfter = "retry_after" in body ? body.retry_after : undefined;
    const errorRetryAfter = "retryAfter" in value ? value.retryAfter : undefined;
    const reset = "reset" in value ? value.reset : undefined;

    const retryAfter =
      (isRetryAfterInput(bodyRetryAfter) ? parseRetryAfterSeconds(bodyRetryAfter) : undefined) ??
      (isRetryAfterInput(errorRetryAfter) ? parseRetryAfterSeconds(errorRetryAfter) : undefined);

    const resetAt = formatResetTimestamp(
      isRetryAfterInput(reset) ? parseRetryAfterSeconds(reset) : undefined,
    );

    const action = "action" in value && isNonEmptyString(value.action) ? value.action : undefined;

    const rateLimitId = "id" in value && isNonEmptyString(value.id) ? value.id : undefined;

    const resolutionUrl =
      action === "captcha-needed" && rateLimitId
        ? buildRateLimitResolutionUrl(rateLimitId)
        : undefined;

    const limit = "limit" in value && isNonEmptyString(value.limit) ? value.limit : undefined;

    const remaining =
      "remaining" in value && isNonEmptyString(value.remaining) ? value.remaining : undefined;

    const hasRetryAfter = retryAfter !== undefined && Number.isFinite(retryAfter);

    const details = [
      ...(hasRetryAfter ? ([["retry after", `${retryAfter}s`]] as const) : []),
      ...(resetAt ? ([["reset at", resetAt]] as const) : []),
      ...(action ? ([["action", action]] as const) : []),
      ...(limit ? ([["limit", limit]] as const) : []),
      ...(remaining ? ([["remaining", remaining]] as const) : []),
      ...(rateLimitId ? ([["rate limit id", rateLimitId]] as const) : []),
    ];

    return {
      message: translate("cli.error.rateLimit.title"),
      recoverySuggestion: {
        type: "instruction",
        description: hasRetryAfter
          ? translate("cli.error.rateLimit.retryAfter", { seconds: retryAfter })
          : resetAt
            ? translate("cli.error.rateLimit.retryAt", { resetAt })
            : translate("cli.error.rateLimit.retrySoon"),
      },
      meta: {
        details: details.length > 0 ? details : undefined,
        hints: [
          ...(resolutionUrl
            ? [translate("cli.error.rateLimit.captchaNeeded"), resolutionUrl]
            : action === "captcha-needed"
              ? [translate("cli.error.rateLimit.captchaNeeded")]
              : []),
          translate("cli.error.rateLimit.avoidRepeating"),
        ],
      },
    };
  },
};

const authLocalizer: APIErrorByStatusCodeLocalizer = {
  kind: "api_status_code",
  status_code: 401,
  localize: () => ({
    message: translate("app.auth.failed.title"),
    recoverySuggestion: {
      type: "instruction",
      description: translate("app.auth.failed.message"),
    },
    meta: {
      hints: [translate("cli.error.auth.loginHint"), translate("cli.error.auth.statusHint")],
    },
  }),
};

const forbiddenLocalizer: APIErrorByStatusCodeLocalizer = {
  kind: "api_status_code",
  status_code: 403,
  localize: (error) => ({
    message: translate("cli.error.forbidden.title"),
    recoverySuggestion: {
      type: "instruction",
      description: getNestedErrorMessage(error) ?? translate("cli.error.forbidden.message"),
    },
  }),
};

const transportLocalizer: MatchConditionLocalizer<unknown> = {
  kind: "match_condition",
  match: (error) => isPlainRecord(error) && Predicate.isTagged(error, "PutioTransportError"),
  localize: () => ({
    message: translate("cli.error.network.title"),
    recoverySuggestion: {
      type: "instruction",
      description: translate("cli.error.network.message"),
    },
    meta: {
      hints: [
        translate("cli.error.network.checkConnection"),
        translate("cli.error.network.checkApiBaseUrl"),
      ],
    },
  }),
};

const validationLocalizer: MatchConditionLocalizer<unknown> = {
  kind: "match_condition",
  match: (error) => isPlainRecord(error) && Predicate.isTagged(error, "PutioValidationError"),
  localize: () => ({
    message: translate("cli.error.validation.title"),
    recoverySuggestion: {
      type: "instruction",
      description: translate("cli.error.validation.message"),
    },
    meta: {
      hints: [
        translate("cli.error.validation.checkHint"),
        translate("cli.error.validation.describeHint"),
      ],
    },
  }),
};

const contractLocalizer: MatchConditionLocalizer<unknown> = {
  kind: "match_condition",
  match: (error) => isPlainRecord(error) && Predicate.isTagged(error, "PutioContractError"),
  localize: (error) => {
    const missingField =
      isPlainRecord(error) && "missingField" in error && isNonEmptyString(error.missingField)
        ? error.missingField
        : undefined;

    return {
      message: translate("cli.error.contract.title"),
      recoverySuggestion: {
        type: "instruction",
        description: translate("cli.error.contract.message"),
      },
      meta: {
        details: missingField ? ([["missing field", missingField]] as const) : undefined,
        hints: [
          translate("cli.error.contract.retryHint"),
          translate("cli.error.contract.reportHint"),
        ],
      },
    };
  },
};

const sdkArgumentsLocalizer: MatchConditionLocalizer<unknown> = {
  kind: "match_condition",
  match: (error) => isPlainRecord(error) && Predicate.isTagged(error, "CliSdkArgumentsError"),
  localize: (error) => {
    const value = isPlainRecord(error) ? error : {};

    const operation =
      "operation" in value && isNonEmptyString(value.operation) ? value.operation : undefined;

    const issue = "issue" in value && isNonEmptyString(value.issue) ? value.issue : undefined;

    return {
      message: translate("cli.error.sdkArguments.title"),
      recoverySuggestion: {
        type: "instruction",
        description: getNestedErrorMessage(error) ?? translate("cli.error.sdkArguments.title"),
      },
      meta: {
        details: [
          ...(operation ? ([["operation", operation]] as const) : []),
          ...(issue ? ([["issue", issue]] as const) : []),
        ],
        hints: [
          translate("cli.error.sdkArguments.argsHint"),
          translate("cli.error.sdkArguments.dryRunHint"),
        ],
      },
    };
  },
};

const authFlowLocalizer: MatchConditionLocalizer<unknown> = {
  kind: "match_condition",
  match: (error) => isPlainRecord(error) && Predicate.isTagged(error, "PutioCliAuthFlowError"),
  localize: () => ({
    message: translate("cli.error.authFlow.title"),
    recoverySuggestion: {
      type: "instruction",
      description: translate("cli.error.authFlow.message"),
    },
    meta: {
      hints: [
        translate("cli.error.authFlow.finishHint"),
        translate("cli.error.authFlow.retryHint"),
      ],
    },
  }),
};

const configLocalizer: MatchConditionLocalizer<unknown> = {
  kind: "match_condition",
  match: (error) =>
    isPlainRecord(error) &&
    (Predicate.isTagged(error, "CliConfigError") ||
      Predicate.isTagged(error, "PutioConfigurationError")),
  localize: (error) => ({
    message: translate("cli.error.config.title"),
    recoverySuggestion: {
      type: "instruction",
      description: getNestedErrorMessage(error) ?? translate("cli.error.config.message"),
    },
    meta: {
      hints: [translate("cli.error.config.envHint"), translate("cli.error.config.configHint")],
    },
  }),
};

const genericLocalizer: GenericErrorLocalizer = {
  kind: "generic",
  localize: (error) => ({
    message: translate("cli.error.commandFailed.title"),
    recoverySuggestion: {
      type: "instruction",
      description: getNestedErrorMessage(error) ?? translate("cli.error.commandFailed.message"),
    },
  }),
};

export const cliSharedErrorLocalizers = [
  rateLimitLocalizer,
  authLocalizer,
  forbiddenLocalizer,
  transportLocalizer,
  validationLocalizer,
  contractLocalizer,
  sdkArgumentsLocalizer,
  authFlowLocalizer,
  configLocalizer,
  genericLocalizer,
] as const;
