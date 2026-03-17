import { describe, expect, it } from "vitest";

import { LocalizedError } from "./localized-error";
import {
  createLocalizeError,
  isErrorLocalizer,
  type GenericErrorLocalizer,
  type PutioLocalizableError,
} from "./localize-error";

const createMockPutioError = (
  overrides: Partial<PutioLocalizableError["body"]> = {},
): PutioLocalizableError => ({
  _tag: "PutioApiError",
  body: {
    details: {},
    error_message: "test",
    error_type: "test",
    status_code: 400,
    ...overrides,
  },
  status: overrides.status_code ?? 400,
});

const genericErrorLocalizer: GenericErrorLocalizer = {
  kind: "generic",
  localize: () => ({
    message: "message",
    recoverySuggestion: {
      type: "instruction",
      description: "description",
    },
  }),
};

describe("localizeError", () => {
  it("should throw an error if no localizer is found", () => {
    const localizeError = createLocalizeError([]);
    expect(() => localizeError(undefined)).toThrowError();
  });

  it("should return a LocalizedError", () => {
    const localizeError = createLocalizeError([genericErrorLocalizer]);
    expect(localizeError(undefined)).toBeInstanceOf(LocalizedError);
  });

  it("shoud localize api errors by status_code", () => {
    const error = createMockPutioError();

    const localizeError = createLocalizeError([
      genericErrorLocalizer,
      {
        kind: "api_status_code",
        status_code: 400,
        localize: () => ({
          message: "message",
          recoverySuggestion: {
            type: "instruction",
            description: "description",
          },
        }),
      },
    ]);

    expect(localizeError(error)).toBeInstanceOf(LocalizedError);
    expect(localizeError(error.body)).toBeInstanceOf(LocalizedError);

    const updatedError = createMockPutioError({
      status_code: 401,
    });
    expect(localizeError(updatedError)).toBeInstanceOf(LocalizedError);
    expect(localizeError(updatedError.body)).toBeInstanceOf(LocalizedError);
  });

  it("shoud localize api errors by error_type", () => {
    const error = createMockPutioError();

    const localizeError = createLocalizeError([
      genericErrorLocalizer,
      {
        kind: "api_error_type",
        error_type: "test",
        localize: () => ({
          message: "message",
          recoverySuggestion: {
            type: "instruction",
            description: "description",
          },
        }),
      },
    ]);

    expect(localizeError(error)).toBeInstanceOf(LocalizedError);
    expect(localizeError(error.body)).toBeInstanceOf(LocalizedError);

    const updatedError = createMockPutioError({
      error_type: "test_new",
    });
    expect(localizeError(updatedError)).toBeInstanceOf(LocalizedError);
    expect(localizeError(updatedError.body)).toBeInstanceOf(LocalizedError);
  });

  it("shoud localize api errors by match_condition", () => {
    const error = { foo: "bar" };

    const localizeError = createLocalizeError([
      genericErrorLocalizer,
      {
        kind: "match_condition",
        match: (error: { foo: string }) => error.foo === "bar",
        localize: () => ({
          message: "message",
          recoverySuggestion: {
            type: "instruction",
            description: "description",
          },
        }),
      },
    ]);

    expect(localizeError(error)).toBeInstanceOf(LocalizedError);

    error.foo = "baz";
    expect(localizeError(error)).toBeInstanceOf(LocalizedError);
  });

  it("prefers match_condition over api_status_code for api-shaped errors", () => {
    const error = {
      _tag: "PutioOperationError" as const,
      body: {
        details: {},
        error_message: "forbidden",
        status_code: 403,
      },
      domain: "transfers",
      operation: "retry",
      status: 403,
    };

    const localizeError = createLocalizeError([
      genericErrorLocalizer,
      {
        kind: "api_status_code",
        status_code: 403,
        localize: () => ({
          message: "auth fallback",
          recoverySuggestion: {
            type: "instruction",
            description: "sign in again",
          },
        }),
      },
      {
        kind: "match_condition",
        match: (candidate: typeof error) =>
          candidate.domain === "transfers" && candidate.operation === "retry",
        localize: () => ({
          message: "retry forbidden",
          recoverySuggestion: {
            type: "instruction",
            description: "transfer-specific message",
          },
        }),
      },
    ]);

    const localized = localizeError(error);

    expect(localized.message).toBe("retry forbidden");
    expect(localized.recoverySuggestion.description).toBe("transfer-specific message");
  });

  it("should add meta attributes to the LocalizedError", () => {
    const error = { foo: "baz" };
    const meta = { field: "username" };

    const localizeError = createLocalizeError([
      genericErrorLocalizer,
      {
        kind: "match_condition",
        match: (error: { foo: string }) => error.foo === "baz",
        localize: () => ({
          message: "message",
          recoverySuggestion: {
            type: "instruction",
            description: "description",
          },
          meta,
        }),
      },
    ]);

    expect(localizeError(error).meta).toEqual(meta);
  });

  it("should throw an error if no generic localizer is found", () => {
    const error = { foo: "baz" };

    const localizeError = createLocalizeError([
      {
        kind: "match_condition",
        match: (error: { foo: string }) => error.foo === "bar",
        localize: () => ({
          message: "message",
          recoverySuggestion: {
            type: "instruction",
            description: "description",
          },
        }),
      },
    ]);

    expect(() => localizeError(error)).toThrowError();
  });
});

describe("isErrorLocalizer", () => {
  it("should return true if the object is an error localizer", () => {
    expect(
      isErrorLocalizer(
        () =>
          new LocalizedError({
            message: "message",
            recoverySuggestion: {
              type: "instruction",
              description: "description",
            },
            underlyingError: undefined,
          }),
      ),
    ).toBe(true);
  });
});
