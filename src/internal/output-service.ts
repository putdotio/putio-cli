import { LocalizedError } from "@putdotio/sdk/utilities";
import { Console, Context, Effect, Layer } from "effect";

import { isLocalizedError, localizeCliError } from "./localize-error.js";
import { CliRuntime } from "./runtime.js";
import { renderCliErrorTerminal, type CliTerminalErrorView } from "./terminal/error-terminal.js";

export type OutputMode = "json" | "ndjson" | "terminal";
type RequestedOutputMode = "json" | "ndjson" | "text" | undefined;

export const isStructuredOutputMode = (outputMode: OutputMode) =>
  outputMode === "json" || outputMode === "ndjson";

export const normalizeOutputMode = (
  output: RequestedOutputMode,
  isInteractiveTerminal = true,
): OutputMode => {
  if (output === "json") {
    return "json";
  }

  if (output === "ndjson") {
    return "ndjson";
  }

  if (output === "text") {
    return "terminal";
  }

  return isInteractiveTerminal ? "terminal" : "json";
};

export const detectOutputModeFromArgv = (
  argv: ReadonlyArray<string>,
  isInteractiveTerminal = true,
): OutputMode => {
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--output") {
      return normalizeOutputMode(argv[index + 1] as RequestedOutputMode, isInteractiveTerminal);
    }

    if (argument.startsWith("--output=")) {
      return normalizeOutputMode(
        argument.slice("--output=".length) as RequestedOutputMode,
        isInteractiveTerminal,
      );
    }
  }

  return normalizeOutputMode(undefined, isInteractiveTerminal);
};

const SENSITIVE_KEY_PATTERN =
  /^(auth_?token|token|access_?token|refresh_?token|authorization|password|secret|cookie)$/i;

const REDACTED_VALUE = "[REDACTED]";
const SAFE_SENSITIVE_SENTINEL_VALUES = new Set([
  "string",
  "number",
  "boolean",
  "null",
  REDACTED_VALUE,
]);
const UNTRUSTED_TEXT_PREFIX = "[UNTRUSTED_API_TEXT] ";
const PROMPT_INJECTION_PATTERN =
  /\b(ignore (?:all|any|previous|above)|system prompt|developer message|tool call|function call|follow these instructions|you are chatgpt|you are an ai)\b/iu;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const sanitizeTerminalText = (value: string) =>
  value
    .replace(
      /(Authorization\s*:\s*Bearer\s+)([A-Za-z0-9._~+/=-]+)/gi,
      (_match, prefix: string) => `${prefix}${REDACTED_VALUE}`,
    )
    .replace(
      /((?:auth_?token|access_?token|refresh_?token|oauth_?token|token|password|secret|cookie)["']?\s*[:=]\s*["']?)([^"'&,\s}]+)/gi,
      (_match, prefix: string) => `${prefix}${REDACTED_VALUE}`,
    )
    .replace(
      /(Bearer\s+)([A-Za-z0-9._~+/=-]+)/gi,
      (_match, prefix: string) => `${prefix}${REDACTED_VALUE}`,
    )
    .replace(
      /([?&](?:auth_?token|access_?token|refresh_?token|oauth_?token|token)=)([^&\s]+)/gi,
      (_match, prefix: string) => `${prefix}${REDACTED_VALUE}`,
    );

export const sanitizeTerminalValue = (value: unknown): unknown => {
  if (typeof value === "string") {
    return sanitizeTerminalText(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeTerminalValue);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) && typeof nestedValue === "string"
          ? SAFE_SENSITIVE_SENTINEL_VALUES.has(nestedValue)
            ? nestedValue
            : REDACTED_VALUE
          : sanitizeTerminalValue(nestedValue),
      ]),
    );
  }

  return value;
};

const sanitizeStructuredText = (value: string) => {
  const sanitized = sanitizeTerminalText(value);

  return PROMPT_INJECTION_PATTERN.test(sanitized)
    ? `${UNTRUSTED_TEXT_PREFIX}${sanitized}`
    : sanitized;
};

export const sanitizeStructuredValue = (value: unknown): unknown => {
  if (typeof value === "string") {
    return sanitizeStructuredText(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeStructuredValue);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) && typeof nestedValue === "string"
          ? SAFE_SENSITIVE_SENTINEL_VALUES.has(nestedValue)
            ? nestedValue
            : REDACTED_VALUE
          : sanitizeStructuredValue(nestedValue),
      ]),
    );
  }

  return value;
};

export const renderJson = (value: unknown) =>
  JSON.stringify(sanitizeStructuredValue(value), null, 2);
export const renderNdjson = (value: unknown) => JSON.stringify(sanitizeStructuredValue(value));

export const renderTerminal = <A>(value: A, renderTerminalValue: (value: A) => string) =>
  sanitizeTerminalText(renderTerminalValue(value));

type LocalizedErrorMeta = {
  readonly details?: ReadonlyArray<readonly [label: string, value: string]>;
  readonly hints?: ReadonlyArray<string>;
};

const toCliErrorView = (error: LocalizedError): CliTerminalErrorView => {
  const meta = error.meta as LocalizedErrorMeta;

  return {
    title: error.message,
    message: error.recoverySuggestion.description,
    hints: meta?.hints,
    meta: meta?.details,
  };
};

type CliErrorJson = {
  readonly error: {
    readonly title: string;
    readonly message: string;
    readonly recoverySuggestion: {
      readonly description: string;
      readonly type: LocalizedError["recoverySuggestion"]["type"];
    };
    readonly details?: ReadonlyArray<readonly [label: string, value: string]>;
    readonly hints?: ReadonlyArray<string>;
  };
};

const toCliErrorJson = (error: LocalizedError): CliErrorJson => {
  const meta = error.meta as LocalizedErrorMeta;

  return {
    error: {
      title: error.message,
      message: error.recoverySuggestion.description,
      recoverySuggestion: {
        description: error.recoverySuggestion.description,
        type: error.recoverySuggestion.type,
      },
      details: meta?.details,
      hints: meta?.hints,
    },
  };
};

const localizeError = (error: unknown) =>
  isLocalizedError(error) ? error : localizeCliError(error);

export const formatCliError = (error: unknown) => {
  const localized = localizeError(error);

  return sanitizeTerminalText(renderCliErrorTerminal(toCliErrorView(localized)));
};

export const formatCliErrorJson = (error: unknown) => {
  const localized = isLocalizedError(error) ? error : localizeCliError(error);

  return renderJson(toCliErrorJson(localized));
};

export type CliOutputService = {
  readonly formatError: (error: unknown, output: string | undefined) => string;
  readonly error: (message: string) => Effect.Effect<void>;
  readonly write: <A>(
    value: A,
    output: string | undefined,
    renderTerminalValue: (value: A) => string,
  ) => Effect.Effect<void>;
};

export class CliOutput extends Context.Tag("@putdotio/cli/CliOutput")<
  CliOutput,
  CliOutputService
>() {}

export const makeCliOutput = (runtime: {
  readonly isInteractiveTerminal: boolean;
}): CliOutputService => ({
  formatError: (error, output) =>
    isStructuredOutputMode(
      normalizeOutputMode(output as RequestedOutputMode, runtime.isInteractiveTerminal),
    )
      ? formatCliErrorJson(error)
      : formatCliError(error),
  error: (message) => Console.error(sanitizeTerminalText(message)),
  write: (value, output, renderTerminalValue) =>
    Console.log(
      (() => {
        const outputMode = normalizeOutputMode(
          output as RequestedOutputMode,
          runtime.isInteractiveTerminal,
        );

        switch (outputMode) {
          case "terminal":
            return renderTerminal(value, renderTerminalValue);
          case "ndjson":
            return renderNdjson(value);
          case "json":
            return renderJson(value);
        }
      })(),
    ),
});

export const CliOutputLive = Layer.effect(CliOutput, Effect.map(CliRuntime, makeCliOutput));

export const writeOutput = <A>(
  value: A,
  output: string | undefined,
  renderTerminalValue: (value: A) => string,
) => Effect.flatMap(CliOutput, (cliOutput) => cliOutput.write(value, output, renderTerminalValue));
