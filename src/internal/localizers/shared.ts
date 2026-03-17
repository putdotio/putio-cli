import type {
  APIErrorByStatusCodeLocalizer,
  GenericErrorLocalizer,
  MatchConditionLocalizer,
} from "@putdotio/sdk/utilities";
import { DEFAULT_PUTIO_WEB_APP_URL } from "@putdotio/sdk";
import { translate } from "../../i18n/index.js";

import { getNestedErrorMessage, isPlainRecord, parseRetryAfterSeconds } from "./helpers.js";

const buildRateLimitResolutionUrl = (
  rateLimitId: string,
  webAppUrl: string = DEFAULT_PUTIO_WEB_APP_URL,
) => {
  const url = new URL(`/captcha/${rateLimitId}`, webAppUrl);

  return url.toString();
};

const formatResetTimestamp = (value: unknown): string | undefined => {
  const seconds = parseRetryAfterSeconds(value);

  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
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
  match: (error): error is Record<string, unknown> =>
    isPlainRecord(error) &&
    ((error._tag === "PutioRateLimitError" &&
      "body" in error &&
      isPlainRecord(error.body) &&
      error.body.status_code === 429) ||
      ("body" in error &&
        isPlainRecord(error.body) &&
        error.body.status_code === 429 &&
        error.body.error_type === "RATE_LIMIT_ERROR")),
  localize: (error) => {
    const value = isPlainRecord(error) ? error : {};
    const retryAfter =
      parseRetryAfterSeconds(isPlainRecord(value.body) ? value.body.retry_after : undefined) ??
      parseRetryAfterSeconds(value.retryAfter);
    const resetAt = formatResetTimestamp(value.reset);
    const action =
      typeof value.action === "string" && value.action.length > 0 ? value.action : undefined;
    const rateLimitId = typeof value.id === "string" && value.id.length > 0 ? value.id : undefined;
    const resolutionUrl =
      action === "captcha-needed" && rateLimitId
        ? buildRateLimitResolutionUrl(rateLimitId)
        : undefined;
    const limit =
      typeof value.limit === "string" && value.limit.length > 0 ? value.limit : undefined;
    const remaining =
      typeof value.remaining === "string" && value.remaining.length > 0
        ? value.remaining
        : undefined;

    const details = [
      ...(typeof retryAfter === "number" && Number.isFinite(retryAfter)
        ? ([["retry after", `${retryAfter}s`]] as const)
        : []),
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
        description:
          typeof retryAfter === "number" && Number.isFinite(retryAfter)
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

const authLocalizers: APIErrorByStatusCodeLocalizer[] = [401, 403].map((status_code) => ({
  kind: "api_status_code" as const,
  status_code,
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
}));

const transportLocalizer: MatchConditionLocalizer<unknown> = {
  kind: "match_condition",
  match: (error): error is { _tag: string } =>
    isPlainRecord(error) && error._tag === "PutioTransportError",
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
  match: (error): error is { _tag: string } =>
    isPlainRecord(error) && error._tag === "PutioValidationError",
  localize: () => ({
    message: translate("cli.error.validation.title"),
    recoverySuggestion: {
      type: "instruction",
      description: translate("cli.error.validation.message"),
    },
    meta: {
      hints: [
        translate("cli.error.validation.retryHint"),
        translate("cli.error.validation.reportHint"),
      ],
    },
  }),
};

const authFlowLocalizer: MatchConditionLocalizer<unknown> = {
  kind: "match_condition",
  match: (error): error is { _tag: string } =>
    isPlainRecord(error) && error._tag === "PutioCliAuthFlowError",
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
  match: (error): error is { _tag: string } =>
    isPlainRecord(error) && error._tag === "CliConfigError",
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
  ...authLocalizers,
  transportLocalizer,
  validationLocalizer,
  authFlowLocalizer,
  configLocalizer,
  genericLocalizer,
] as const;
