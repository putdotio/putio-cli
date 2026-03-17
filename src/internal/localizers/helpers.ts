import type { MatchConditionLocalizer } from "@putdotio/localized-error";

export const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const parseRetryAfterSeconds = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

export const getNestedErrorMessage = (value: unknown): string | undefined => {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  if (
    "body" in value &&
    isPlainRecord(value.body) &&
    "error_message" in value.body &&
    typeof value.body.error_message === "string" &&
    value.body.error_message.trim().length > 0
  ) {
    return value.body.error_message.trim();
  }

  if ("message" in value && typeof value.message === "string" && value.message.trim().length > 0) {
    return value.message.trim();
  }

  if ("cause" in value) {
    return getNestedErrorMessage(value.cause);
  }

  return undefined;
};

type OperationErrorRecord = {
  readonly _tag: "PutioOperationError";
  readonly domain: string;
  readonly operation: string;
  readonly body: Record<string, unknown>;
  readonly status: number;
};

const isOperationError = (error: unknown): error is OperationErrorRecord =>
  isPlainRecord(error) &&
  error._tag === "PutioOperationError" &&
  typeof error.domain === "string" &&
  typeof error.operation === "string" &&
  typeof error.status === "number" &&
  isPlainRecord(error.body);

export const hasOperationStatus = (
  error: unknown,
  domain: string,
  operations: ReadonlyArray<string>,
  status: number,
) =>
  isOperationError(error) &&
  error.domain === domain &&
  operations.includes(error.operation) &&
  error.status === status;

export const hasOperationErrorType = (
  error: unknown,
  domain: string,
  operations: ReadonlyArray<string>,
  errorType: string,
) =>
  isOperationError(error) &&
  error.domain === domain &&
  operations.includes(error.operation) &&
  error.body.error_type === errorType;

export const createOperationLocalizer = (
  match: MatchConditionLocalizer<unknown>["match"],
  localize: MatchConditionLocalizer<unknown>["localize"],
): MatchConditionLocalizer<unknown> => ({
  kind: "match_condition",
  match,
  localize,
});
