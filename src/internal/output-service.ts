import { LocalizedError } from "@putdotio/localized-error";
import { Console, Context, Effect, Layer } from "effect";

import { isLocalizedError, localizeCliError } from "./localize-error.js";
import { renderCliErrorTerminal, type CliTerminalErrorView } from "./terminal/error-terminal.js";

type OutputMode = "json" | "terminal";

export const normalizeOutputMode = (output: string | undefined): OutputMode =>
  output === "json" ? "json" : "terminal";

export const detectOutputModeFromArgv = (argv: ReadonlyArray<string>): OutputMode => {
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--output") {
      return normalizeOutputMode(argv[index + 1]);
    }

    if (argument.startsWith("--output=")) {
      return normalizeOutputMode(argument.slice("--output=".length));
    }
  }

  return "terminal";
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

export const renderJson = (value: unknown) => JSON.stringify(sanitizeTerminalValue(value), null, 2);

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

export type CliOutput = {
  readonly formatError: (error: unknown, output: string | undefined) => string;
  readonly error: (message: string) => Effect.Effect<void>;
  readonly write: <A>(
    value: A,
    output: string | undefined,
    renderTerminalValue: (value: A) => string,
  ) => Effect.Effect<void>;
};

export const CliOutput = Context.GenericTag<CliOutput>("@putdotio/cli/CliOutput");

const makeCliOutput = (): CliOutput => ({
  formatError: (error, output) =>
    normalizeOutputMode(output) === "json" ? formatCliErrorJson(error) : formatCliError(error),
  error: (message) => Console.error(sanitizeTerminalText(message)),
  write: (value, output, renderTerminalValue) =>
    Console.log(
      normalizeOutputMode(output) === "terminal"
        ? renderTerminal(value, renderTerminalValue)
        : renderJson(value),
    ),
});

export const CliOutputLive = Layer.succeed(CliOutput, makeCliOutput());

export const writeOutput = <A>(
  value: A,
  output: string | undefined,
  renderTerminalValue: (value: A) => string,
) => Effect.flatMap(CliOutput, (cliOutput) => cliOutput.write(value, output, renderTerminalValue));
