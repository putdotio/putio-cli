import {
  PutioConfigurationError,
  PutioContractError,
  PutioOperationError,
  PutioRateLimitError,
  PutioTransportError,
  PutioValidationError,
} from "@putdotio/sdk";
import { Data } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { isLocalizedError, localizeCliError } from "./localize-error.js";
import { isPlainRecord } from "./localizers/helpers.js";

class AuthFlowFailure extends Data.TaggedError("PutioCliAuthFlowError")<{
  readonly message: string;
}> {}

const operationError = (
  domain: string,
  operation: string,
  {
    errorMessage,
    errorType,
    status,
  }: {
    readonly errorMessage: string;
    readonly errorType?: string;
    readonly status: number;
  },
) =>
  errorType === undefined
    ? new PutioOperationError<string, string, { readonly statusCode: number }>({
        body: { error_message: errorMessage, status_code: status },
        contract: { statusCode: status },
        domain,
        operation,
        reason: { kind: "status_code", statusCode: status },
        status,
      })
    : new PutioOperationError<
        string,
        string,
        { readonly errorType: string; readonly statusCode: number }
      >({
        body: { error_message: errorMessage, error_type: errorType, status_code: status },
        contract: { errorType, statusCode: status },
        domain,
        operation,
        reason: { kind: "error_type", errorType },
        status,
      });

describe("isPlainRecord", () => {
  it("accepts records and rejects arrays", () => {
    expect(isPlainRecord({ error: "boom" })).toBe(true);
    expect(isPlainRecord(["boom"])).toBe(false);
  });
});

describe("localizeCliError", () => {
  it("localizes rate limit errors with retry details", () => {
    const localized = localizeCliError(
      new PutioRateLimitError({
        action: "captcha-needed",
        body: {
          status_code: 429,
          error_message: "Too many requests.",
        },
        id: "rl_123",
        limit: "10",
        remaining: "0",
        reset: "1773496255",
        retryAfter: "42",
        status: 429,
      }),
    );

    expect(isLocalizedError(localized)).toBe(true);
    expect(localized.message).toBe("Rate limited");
    expect(localized.recoverySuggestion.description).toBe("Wait about 42s and try again.");
    expect(localized.meta).toEqual({
      details: [
        ["retry after", "42s"],
        ["reset at", "2026-03-14 13:50:55 UTC"],
        ["action", "captcha-needed"],
        ["limit", "10"],
        ["remaining", "0"],
        ["rate limit id", "rl_123"],
      ],
      hints: [
        "Complete the captcha in the browser to unlock this IP sooner.",
        "https://app.put.io/captcha/rl_123",
        "Avoid repeating the same command rapidly, especially `putio auth login`.",
      ],
    });
  });

  it("localizes auth flow errors with CLI hints", () => {
    const localized = localizeCliError(new AuthFlowFailure({ message: "device flow failed" }));

    expect(localized.message).toBe("Device login failed");
    expect(localized.recoverySuggestion.description).toBe(
      "The CLI could not complete the device authorization flow.",
    );
    expect(localized.meta).toEqual({
      hints: [
        "Make sure you finish the code flow at `put.io/link`.",
        "Retry `putio auth login` if the code expired.",
      ],
    });
  });

  it("falls back to a generic command failure", () => {
    const localized = localizeCliError(new Error("boom"));

    expect(localized.message).toBe("Command failed");
    expect(localized.recoverySuggestion.description).toBe("boom");
  });

  it("localizes files operation errors with file-specific copy", () => {
    const localized = localizeCliError(
      operationError("files", "list", {
        errorMessage: "file lost",
        errorType: "FILE_LOST",
        status: 410,
      }),
    );

    expect(localized.message).toBe("This file is no longer available");
    expect(localized.recoverySuggestion.description).toBe("It may have been removed or expired.");
  });

  it("localizes transfer add validation errors", () => {
    const localized = localizeCliError(
      operationError("transfers", "add", {
        errorMessage: "empty url",
        errorType: "EMPTY_URL",
        status: 400,
      }),
    );

    expect(localized.message).toBe("Transfer URL is required");
    expect(localized.recoverySuggestion.description).toBe(
      "Provide at least one valid URL to add a transfer.",
    );
    expect(localized.meta).toEqual({
      hints: ["Use `putio transfers add --url <url>` to add a transfer."],
    });
  });

  it("localizes download-links operation errors", () => {
    const localized = localizeCliError(
      operationError("downloadLinks", "create", {
        errorMessage: "too many files",
        errorType: "DownloadLinksTooManyFilesRequested",
        status: 400,
      }),
    );

    expect(localized.message).toBe("Too many files were requested for one download-links job");
    expect(localized.recoverySuggestion.description).toBe(
      "Request fewer files at a time and try again.",
    );
  });

  it.each([
    [
      "localizes file-not-reachable errors",
      operationError("files", "list", {
        errorMessage: "file not reachable",
        errorType: "FILE_NOT_REACHABLE",
        status: 503,
      }),
      "We temporarily cannot access this file",
      "For updates, visit status.put.io.",
    ],
    [
      "localizes long file-search queries",
      operationError("files", "search", {
        errorMessage: "too long",
        errorType: "SEARCH_TOO_LONG_QUERY",
        status: 400,
      }),
      "Search query is too long",
      "Use a shorter search query and try again.",
    ],
    [
      "localizes generic file not found responses",
      operationError("files", "get", {
        errorMessage: "not found",
        status: 404,
      }),
      "File not found",
      "The file you requested is not available.",
    ],
    [
      "localizes generic file service errors",
      operationError("files", "rename", {
        errorMessage: "unavailable",
        status: 503,
      }),
      "put.io is temporarily unavailable",
      "Please try again in a moment.",
    ],
    [
      "localizes transfer add-many validation errors",
      operationError("transfers", "addMany", {
        errorMessage: "too many urls",
        errorType: "TOO_MANY_URLS",
        status: 400,
      }),
      "Too many transfer URLs were submitted at once",
      "Split the request into smaller batches and try again.",
    ],
    [
      "localizes transfer not-found errors",
      operationError("transfers", "get", {
        errorMessage: "missing transfer",
        status: 404,
      }),
      "Transfer not found",
      "The transfer may have already finished, been removed, or the id may be wrong.",
    ],
    [
      "localizes generic transfer bad requests",
      operationError("transfers", "list", {
        errorMessage: "bad request",
        status: 400,
      }),
      "That transfer request is not valid",
      "Review the transfer id or input and try again.",
    ],
    [
      "localizes transfer continuation bad requests",
      operationError("transfers", "continue", {
        errorMessage: "bad request",
        status: 400,
      }),
      "That transfer request is not valid",
      "Review the transfer id or input and try again.",
    ],
    [
      "localizes search continuation not-found errors",
      operationError("files", "continueSearch", {
        errorMessage: "not found",
        status: 404,
      }),
      "File not found",
      "The file you requested is not available.",
    ],
    [
      "localizes concurrent download-links limits",
      operationError("downloadLinks", "create", {
        errorMessage: "concurrent limit",
        errorType: "DownloadLinksConcurrentLimit",
        status: 400,
      }),
      "Too many download-links jobs are already running",
      "Wait for an active download-links job to finish, then try again.",
    ],
    [
      "localizes too-many-children download-links errors",
      operationError("downloadLinks", "create", {
        errorMessage: "too many children",
        errorType: "DownloadLinksTooManyChildrenRequested",
        status: 400,
      }),
      "Too many nested files were requested",
      "Narrow the selection before creating download links.",
    ],
    [
      "localizes generic download-links bad requests",
      operationError("downloadLinks", "create", {
        errorMessage: "bad request",
        status: 400,
      }),
      "That download-links request is not valid",
      "Review the file ids or cursor and try again.",
    ],
    [
      "localizes missing download-links jobs by status",
      operationError("downloadLinks", "get", {
        errorMessage: "not found",
        status: 404,
      }),
      "Download-links job not found",
      "The job may have expired or the id may be incorrect.",
    ],
  ])("%s", (_label, error, message, description) => {
    const localized = localizeCliError(error);

    expect(localized.message).toBe(message);
    expect(localized.recoverySuggestion.description).toBe(description);
  });

  it("localizes transfer retry 403 responses with transfer-specific copy", () => {
    const localized = localizeCliError(
      operationError("transfers", "retry", {
        errorMessage: "forbidden",
        status: 403,
      }),
    );

    expect(localized.message).toBe("That transfer action is not allowed");
    expect(localized.recoverySuggestion.description).toBe(
      "The current transfer cannot be changed in its current state.",
    );
  });

  it("localizes API auth failures", () => {
    const localized = localizeCliError({
      body: {
        error_message: "not allowed",
        status_code: 401,
      },
      status: 401,
    });

    expect(localized.message).toBe("Authentication failed");
    expect(localized.recoverySuggestion.description).toBe("Please sign in again to continue.");
    expect(localized.meta).toEqual({
      hints: [
        "Run `putio auth login` to sign in again.",
        "If you expected a saved session, run `putio auth status` to inspect it.",
      ],
    });
  });

  it("localizes transport errors", () => {
    const localized = localizeCliError(
      new PutioTransportError({ cause: new Error("socket hang up") }),
    );

    expect(localized.message).toBe("Network request failed");
    expect(localized.recoverySuggestion.description).toBe(
      "The CLI could not reach put.io successfully.",
    );
  });

  it("localizes validation errors", () => {
    const localized = localizeCliError(
      new PutioValidationError({ cause: new Error("bad payload") }),
    );

    expect(localized.message).toBe("Invalid request");
    expect(localized.recoverySuggestion.description).toBe(
      "The request input was rejected before it was sent.",
    );
    expect(localized.meta).toEqual({
      hints: [
        "Check the flag values or JSON input and try again.",
        "Run `putio describe` to see what the command accepts.",
      ],
    });
  });

  it("localizes a response that lacks a requested field", () => {
    const localized = localizeCliError(new PutioContractError({ missingField: "total" }));

    expect(localized.message).toBe("Unexpected response from put.io");
    expect(localized.recoverySuggestion.description).toBe(
      "put.io returned data the CLI did not expect.",
    );
    expect(localized.meta).toEqual({
      details: [["missing field", "total"]],
      hints: [
        "Retry the command once in case the response was transient.",
        "If it keeps happening, report it with the command and output.",
      ],
    });
  });

  it("localizes a response that is not valid JSON", () => {
    const localized = localizeCliError(
      new PutioContractError({
        cause: new SyntaxError("The HTTP response body is not valid JSON"),
      }),
    );

    expect(localized.message).toBe("Unexpected response from put.io");
    expect(localized.recoverySuggestion.description).toBe(
      "put.io returned data the CLI did not expect.",
    );
    expect(localized.meta).toEqual({
      details: undefined,
      hints: [
        "Retry the command once in case the response was transient.",
        "If it keeps happening, report it with the command and output.",
      ],
    });
  });

  it("localizes SDK configuration errors", () => {
    const localized = localizeCliError(
      new PutioConfigurationError({
        cause: "SDK request headers must be valid HTTP header values",
      }),
    );

    expect(localized.message).toBe("Configuration error");
    expect(localized.meta).toEqual({
      hints: [
        "Check the relevant `PUTIO_CLI_*` environment variables and try again.",
        "If you use a persisted config file, verify that its JSON is valid.",
      ],
    });
  });

  it("localizes rate-limit errors without retry metadata", () => {
    const localized = localizeCliError(
      new PutioRateLimitError({
        body: {
          status_code: 429,
          error_message: "Too many requests.",
        },
        status: 429,
      }),
    );

    expect(localized.message).toBe("Rate limited");
    expect(localized.recoverySuggestion.description).toBe("Wait a moment and try again.");
    expect(localized.meta).toEqual({
      details: undefined,
      hints: ["Avoid repeating the same command rapidly, especially `putio auth login`."],
    });
  });
});
