import type { MatchConditionLocalizer } from "@putdotio/sdk/utilities";
import { Predicate } from "effect";

export const isPlainRecord = Predicate.isObject;

export const isRetryAfterInput = (value: unknown): value is number | string =>
  Predicate.isNumber(value) || Predicate.isString(value);

export const parseRetryAfterSeconds = (value: number | string): number | undefined => {
  if (Predicate.isNumber(value)) {
    return Number.isFinite(value) ? value : undefined;
  }

  if (value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const isNonBlankString = (value: unknown): value is string =>
  Predicate.isString(value) && value.trim().length > 0;

export const getNestedErrorMessage = (cause: unknown): string | undefined => {
  if (!isPlainRecord(cause)) {
    return undefined;
  }

  if (
    "body" in cause &&
    isPlainRecord(cause.body) &&
    "error_message" in cause.body &&
    isNonBlankString(cause.body.error_message)
  ) {
    return cause.body.error_message.trim();
  }

  if ("message" in cause && isNonBlankString(cause.message)) {
    return cause.message.trim();
  }

  if ("cause" in cause) {
    return getNestedErrorMessage(cause.cause);
  }

  return undefined;
};

type OperationErrorRecord = {
  readonly _tag: "PutioOperationError";
  readonly domain: string;
  readonly operation: string;
  readonly body: { readonly error_type?: unknown };
  readonly status: number;
};

const isOperationError = (cause: unknown): cause is OperationErrorRecord =>
  isPlainRecord(cause) &&
  Predicate.isTagged(cause, "PutioOperationError") &&
  "domain" in cause &&
  Predicate.isString(cause.domain) &&
  "operation" in cause &&
  Predicate.isString(cause.operation) &&
  "status" in cause &&
  Predicate.isNumber(cause.status) &&
  "body" in cause &&
  isPlainRecord(cause.body);

export const hasOperationStatus = (
  cause: unknown,
  domain: string,
  operations: ReadonlyArray<string>,
  status: number,
) =>
  isOperationError(cause) &&
  cause.domain === domain &&
  operations.includes(cause.operation) &&
  cause.status === status;

export const hasOperationErrorType = (
  cause: unknown,
  domain: string,
  operations: ReadonlyArray<string>,
  errorType: string,
) =>
  isOperationError(cause) &&
  cause.domain === domain &&
  operations.includes(cause.operation) &&
  cause.body.error_type === errorType;

export const createOperationLocalizer = (
  match: MatchConditionLocalizer<unknown>["match"],
  localize: MatchConditionLocalizer<unknown>["localize"],
): MatchConditionLocalizer<unknown> => ({
  kind: "match_condition",
  match,
  localize,
});
