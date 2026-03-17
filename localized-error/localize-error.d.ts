import type {
  PutioApiError,
  PutioAuthError,
  PutioErrorEnvelope,
  PutioKnownErrorContract,
  PutioOperationError,
  PutioRateLimitError,
} from "@putdotio/sdk";
import { LocalizedError, type LocalizedErrorParams } from "./localized-error";
export type PutioErrorWithBody =
  | PutioApiError
  | PutioAuthError
  | PutioRateLimitError
  | PutioOperationError<string, string, PutioKnownErrorContract>;
export type PutioLocalizableError = {
  readonly _tag?: string;
  readonly body: PutioErrorEnvelope;
  readonly status?: number;
};
export type LocalizeErrorFn<E> = (
  error: E,
) => Pick<LocalizedErrorParams, "message" | "recoverySuggestion" | "meta">;
export type APIErrorByStatusCodeLocalizer = {
  kind: "api_status_code";
  status_code: number;
  localize: LocalizeErrorFn<PutioLocalizableError>;
};
export type APIErrorByErrorTypeLocalizer = {
  kind: "api_error_type";
  error_type: string;
  localize: LocalizeErrorFn<PutioLocalizableError>;
};
export type MatchConditionLocalizer<E> = {
  kind: "match_condition";
  match: (error: E) => boolean;
  localize: LocalizeErrorFn<E>;
};
export type GenericErrorLocalizer = {
  kind: "generic";
  localize: LocalizeErrorFn<unknown>;
};
export type ErrorLocalizer<E> =
  | APIErrorByStatusCodeLocalizer
  | APIErrorByErrorTypeLocalizer
  | MatchConditionLocalizer<E>
  | GenericErrorLocalizer;
export type ErrorLocalizerFn = (error: unknown) => LocalizedError;
export declare const isErrorLocalizer: (fn: unknown) => fn is ErrorLocalizerFn;
export declare const createLocalizeError: <GlobalError extends unknown>(
  globalLocalizers: ErrorLocalizer<GlobalError>[],
) => <ScopedError extends GlobalError>(
  error: ScopedError,
  scopedLocalizers?: ErrorLocalizer<ScopedError>[],
) => LocalizedError;
