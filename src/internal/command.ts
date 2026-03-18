import { Options } from "@effect/cli";
import { Data, Effect, Option, Schema } from "effect";

import type { ResolvedAuthState } from "./state.js";
import {
  booleanFlag,
  enumFlag,
  integerFlag,
  repeatedIntegerFlag,
  repeatedStringFlag,
  stringFlag,
} from "./command-specs.js";
import {
  isStructuredOutputMode,
  normalizeOutputMode,
  renderJson,
  writeOutput,
  type OutputMode,
} from "./output-service.js";
import { CliRuntime } from "./runtime.js";
import { CliSdk, sdk } from "./sdk.js";
import { resolveAuthState } from "./state.js";

export const outputOption = Options.choice("output", ["json", "text", "ndjson"] as const).pipe(
  Options.optional,
);
export const dryRunOption = Options.boolean("dry-run").pipe(Options.withDefault(false));
export const fieldsOption = Options.text("fields").pipe(Options.optional);
export const jsonOption = Options.text("json").pipe(Options.optional);
export const pageAllOption = Options.boolean("page-all").pipe(Options.withDefault(false));

export const defineBooleanOption = (
  name: string,
  options: {
    readonly defaultValue?: boolean;
    readonly description?: string;
  } = {},
) => {
  const option =
    options.defaultValue === undefined
      ? Options.boolean(name)
      : Options.boolean(name).pipe(Options.withDefault(options.defaultValue));

  return {
    flag: booleanFlag(name, options),
    option,
  };
};

export const defineIntegerOption = (
  name: string,
  options: {
    readonly description?: string;
    readonly optional?: boolean;
    readonly required?: boolean;
  } = {},
) => {
  const option = options.optional
    ? Options.integer(name).pipe(Options.optional)
    : Options.integer(name);

  return {
    flag: integerFlag(name, {
      description: options.description,
      required: options.required ?? options.optional !== true,
    }),
    option,
  };
};

export const defineTextOption = (
  name: string,
  options: {
    readonly defaultValue?: string;
    readonly description?: string;
    readonly optional?: boolean;
    readonly required?: boolean;
  } = {},
) => {
  let option = Options.text(name);

  if (options.defaultValue !== undefined) {
    option = option.pipe(Options.withDefault(options.defaultValue));
  } else if (options.optional) {
    option = option.pipe(Options.optional);
  }

  return {
    flag: stringFlag(name, {
      defaultValue: options.defaultValue,
      description: options.description,
      required:
        options.required ?? (options.defaultValue === undefined && options.optional !== true),
    }),
    option,
  };
};

export const defineChoiceOption = <A extends ReadonlyArray<string>>(
  name: string,
  choices: A,
  options: {
    readonly description?: string;
    readonly optional?: boolean;
    readonly required?: boolean;
  } = {},
) => {
  const option = options.optional
    ? Options.choice(name, choices).pipe(Options.optional)
    : Options.choice(name, choices);

  return {
    flag: enumFlag(name, choices, {
      description: options.description,
      required: options.required ?? options.optional !== true,
    }),
    option,
  };
};

export const getOption = <A>(option: Option.Option<A>) => Option.getOrUndefined(option);

export class CliCommandInputError extends Data.TaggedError("CliCommandInputError")<{
  readonly message: string;
}> {}

type ReadOutputControls = {
  readonly output: string | undefined;
  readonly outputMode: OutputMode;
  readonly pageAll: boolean;
  readonly requestedFields: ReadonlyArray<string> | undefined;
};

const PATH_TRAVERSAL_PATTERN = /(?:^|[\\/])\.\.(?:[\\/]|$)|%2e/iu;
const QUERY_OR_FRAGMENT_PATTERN = /[?#]/u;
const TOP_LEVEL_FIELD_PATTERN = /^[A-Za-z0-9_-]+$/u;

const ownKeys = (value: Record<string, unknown>) => Object.keys(value);
const hasControlCharacters = (value: string) =>
  [...value].some((character) => {
    const codePoint = character.codePointAt(0);

    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });

const validateSafeString = (input: {
  readonly allowPathTraversal?: boolean;
  readonly allowQueryOrFragment?: boolean;
  readonly label: string;
  readonly pattern?: RegExp;
  readonly patternMessage?: string;
  readonly value: string;
}) => {
  if (hasControlCharacters(input.value)) {
    throw new CliCommandInputError({
      message: `${input.label} cannot contain control characters.`,
    });
  }

  if (input.allowPathTraversal !== true && PATH_TRAVERSAL_PATTERN.test(input.value)) {
    throw new CliCommandInputError({
      message: `${input.label} cannot contain path traversal segments like \`../\` or \`%2e\`.`,
    });
  }

  if (input.allowQueryOrFragment !== true && QUERY_OR_FRAGMENT_PATTERN.test(input.value)) {
    throw new CliCommandInputError({
      message: `${input.label} cannot include \`?\` or \`#\` fragments.`,
    });
  }

  if (input.pattern && !input.pattern.test(input.value)) {
    throw new CliCommandInputError({
      message: input.patternMessage ?? `${input.label} is invalid.`,
    });
  }

  return input.value;
};

export const validateResourceIdentifier = (label: string, value: string) =>
  validateSafeString({
    label,
    value,
  });

export const validateNameLikeInput = (label: string, value: string) =>
  validateSafeString({
    allowQueryOrFragment: true,
    label,
    value,
  });

const parseRequestedFields = (raw: string) => {
  const parts = raw.split(",").map((part) => part.trim());

  if (parts.length === 0 || parts.some((part) => part.length === 0)) {
    throw new CliCommandInputError({
      message: "Expected `--fields` to be a comma-separated list of top-level field names.",
    });
  }

  return [
    ...new Set(
      parts.map((part) =>
        validateSafeString({
          label: `\`--fields\` selector \`${part}\``,
          pattern: TOP_LEVEL_FIELD_PATTERN,
          patternMessage:
            "`--fields` only accepts top-level field names without dots, brackets, or slashes.",
          value: part,
        }),
      ),
    ),
  ];
};

const renderFieldList = (fields: ReadonlyArray<string>) =>
  fields.map((field) => `\`${field}\``).join(", ");

const readCursor = (value: Record<string, unknown>) => {
  const cursor = value.cursor;

  return typeof cursor === "string" && cursor.length > 0 ? cursor : null;
};

const readPageItems = (value: Record<string, unknown>, itemKey: string, command: string) => {
  const items = value[itemKey];

  if (!Array.isArray(items)) {
    throw new CliCommandInputError({
      message: `Expected \`${command}\` responses to include an array at \`${itemKey}\`.`,
    });
  }

  return items;
};

const integerPattern = /^-?\d+$/;

export const parseRepeatedIntegers = (
  values: ReadonlyArray<string>,
): Option.Option<ReadonlyArray<number>> => {
  const parsed: number[] = [];

  for (const value of values) {
    if (!integerPattern.test(value)) {
      return Option.none();
    }

    parsed.push(Number.parseInt(value, 10));
  }

  return Option.some(parsed);
};

export const parseRepeatedIntegerOption = (name: string) =>
  Options.text(name).pipe(
    Options.repeated,
    Options.filterMap(parseRepeatedIntegers, `Expected \`--${name}\` values to be integers.`),
  );

export const defineRepeatedIntegerOption = (
  name: string,
  options: {
    readonly description?: string;
    readonly required?: boolean;
  } = {},
) => ({
  flag: repeatedIntegerFlag(name, options),
  option: parseRepeatedIntegerOption(name),
});

export const defineRepeatedTextOption = (
  name: string,
  options: {
    readonly description?: string;
    readonly required?: boolean;
  } = {},
) => ({
  flag: repeatedStringFlag(name, options),
  option: Options.text(name).pipe(Options.repeated),
});

const mapInputError = (error: unknown, fallbackMessage: string) =>
  error instanceof CliCommandInputError
    ? error
    : new CliCommandInputError({
        message: fallbackMessage,
      });

export const decodeJsonOption = <A, I>(schema: Schema.Schema<A, I>, raw: string) =>
  Effect.try({
    try: () => JSON.parse(raw) as unknown,
    catch: () =>
      new CliCommandInputError({
        message: "Expected `--json` to contain valid JSON.",
      }),
  }).pipe(
    Effect.flatMap((value) =>
      Effect.try({
        try: () => Schema.decodeUnknownSync(schema)(value),
        catch: () =>
          new CliCommandInputError({
            message: "Expected `--json` to match the command input schema.",
          }),
      }),
    ),
  );

export const resolveMutationInput = <A, I>(input: {
  readonly buildFromFlags: () => A;
  readonly schema: Schema.Schema<A, I>;
  readonly json: Option.Option<string>;
}) =>
  Option.match(input.json, {
    onNone: () =>
      Effect.try({
        try: input.buildFromFlags,
        catch: (error) => mapInputError(error, "Unable to resolve the command input."),
      }),
    onSome: (raw) => decodeJsonOption(input.schema, raw),
  });

export const resolveReadOutputControls = (input: {
  readonly fields: Option.Option<string>;
  readonly output: string | undefined;
  readonly pageAll?: boolean;
}) =>
  Effect.flatMap(CliRuntime, (runtime) =>
    Effect.try({
      try: () => {
        const outputMode = normalizeOutputMode(input.output, runtime.isInteractiveTerminal);
        const requestedFields = Option.match(input.fields, {
          onNone: () => undefined,
          onSome: parseRequestedFields,
        });

        if (requestedFields && !isStructuredOutputMode(outputMode)) {
          throw new CliCommandInputError({
            message:
              "`--fields` requires structured output (`--output json` or `--output ndjson`).",
          });
        }

        if (input.pageAll === true && !isStructuredOutputMode(outputMode)) {
          throw new CliCommandInputError({
            message:
              "`--page-all` requires structured output (`--output json` or `--output ndjson`).",
          });
        }

        return {
          output: input.output,
          outputMode,
          pageAll: input.pageAll ?? false,
          requestedFields,
        } satisfies ReadOutputControls;
      },
      catch: (error) => mapInputError(error, "Unable to resolve the read output controls."),
    }),
  );

export const selectTopLevelFields = <A extends Record<string, unknown>>(input: {
  readonly command: string;
  readonly requestedFields: ReadonlyArray<string> | undefined;
  readonly value: A;
}) =>
  Effect.try({
    try: () => {
      if (input.requestedFields === undefined) {
        return input.value as Record<string, unknown>;
      }

      const validFields = ownKeys(input.value).sort((left, right) => left.localeCompare(right));
      const unknownFields = input.requestedFields.filter(
        (field) => !Object.prototype.hasOwnProperty.call(input.value, field),
      );

      if (unknownFields.length > 0) {
        throw new CliCommandInputError({
          message: [
            `Unknown \`--fields\` value for \`${input.command}\`: ${renderFieldList(unknownFields)}.`,
            `Valid top-level fields: ${renderFieldList(validFields)}.`,
          ].join(" "),
        });
      }

      return Object.fromEntries(input.requestedFields.map((field) => [field, input.value[field]]));
    },
    catch: (error) => mapInputError(error, `Unable to filter the \`${input.command}\` response.`),
  });

export const collectAllCursorPages = <A extends Record<string, unknown>, E, R>(input: {
  readonly command: string;
  readonly initial: A;
  readonly itemKey: string;
  readonly pageAll: boolean;
  readonly continueWithCursor: (cursor: string) => Effect.Effect<A, E, R>;
}) =>
  Effect.gen(function* () {
    if (!input.pageAll) {
      return input.initial;
    }

    const collectedItems = [...readPageItems(input.initial, input.itemKey, input.command)];
    let cursor = readCursor(input.initial);

    while (cursor !== null) {
      const nextPage = yield* input.continueWithCursor(cursor);
      collectedItems.push(...readPageItems(nextPage, input.itemKey, input.command));
      cursor = readCursor(nextPage);
    }

    return {
      ...input.initial,
      [input.itemKey]: collectedItems,
      ...(Object.prototype.hasOwnProperty.call(input.initial, "cursor") ? { cursor: null } : {}),
    } as A;
  }).pipe(
    Effect.mapError((error) =>
      mapInputError(error, `Unable to collect all pages for \`${input.command}\`.`),
    ),
  );

export const writeReadOutput = <A extends Record<string, unknown>>(input: {
  readonly command: string;
  readonly output: string | undefined;
  readonly outputMode: OutputMode;
  readonly renderTerminalValue: (value: A) => string;
  readonly requestedFields: ReadonlyArray<string> | undefined;
  readonly value: A;
}) =>
  Effect.gen(function* () {
    if (isStructuredOutputMode(input.outputMode)) {
      const selectedValue = yield* selectTopLevelFields({
        command: input.command,
        requestedFields: input.requestedFields,
        value: input.value,
      });

      return yield* writeOutput(selectedValue, input.output, renderJson);
    }

    return yield* writeOutput(input.value, input.output, input.renderTerminalValue);
  });

export const writeReadPages = <A extends Record<string, unknown>, E, R>(input: {
  readonly command: string;
  readonly controls: ReadOutputControls;
  readonly continueWithCursor?: (cursor: string) => Effect.Effect<A, E, R>;
  readonly initial: A;
  readonly itemKey?: string;
  readonly renderTerminalValue: (value: A) => string;
}) =>
  Effect.gen(function* () {
    if (input.controls.outputMode !== "ndjson") {
      const value =
        input.controls.pageAll && input.itemKey && input.continueWithCursor
          ? yield* collectAllCursorPages({
              command: input.command,
              continueWithCursor: input.continueWithCursor,
              initial: input.initial,
              itemKey: input.itemKey,
              pageAll: true,
            })
          : input.initial;

      return yield* writeReadOutput({
        command: input.command,
        output: input.controls.output,
        outputMode: input.controls.outputMode,
        renderTerminalValue: input.renderTerminalValue,
        requestedFields: input.controls.requestedFields,
        value,
      });
    }

    let current = input.initial;

    while (true) {
      const selectedValue = yield* selectTopLevelFields({
        command: input.command,
        requestedFields: input.controls.requestedFields,
        value: current,
      });

      yield* writeOutput(selectedValue, input.controls.output, renderJson);

      if (!input.controls.pageAll || !input.continueWithCursor || !input.itemKey) {
        return;
      }

      const cursor = readCursor(current);

      if (cursor === null) {
        return;
      }

      current = yield* input.continueWithCursor(cursor);
    }
  });

type DryRunPlan<A> = {
  readonly command: string;
  readonly dryRun: true;
  readonly request: A;
};

const renderDryRunPlanTerminal = <A>(value: DryRunPlan<A>) =>
  [`Dry run: ${value.command}`, "No API call was made.", "", renderJson(value.request)].join("\n");

export const writeDryRunPlan = <A>(command: string, request: A, output: string | undefined) =>
  writeOutput(
    {
      command,
      dryRun: true as const,
      request,
    },
    output,
    renderDryRunPlanTerminal,
  );

export const withAuthedSdk = <A, E, R>(
  program: (context: {
    readonly auth: ResolvedAuthState;
    readonly sdk: typeof sdk;
  }) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const auth = yield* resolveAuthState();
    const cliSdk = yield* CliSdk;

    return yield* cliSdk.provide(
      {
        token: auth.token,
        apiBaseUrl: auth.apiBaseUrl,
      },
      program({
        auth,
        sdk: cliSdk.client,
      }),
    );
  });
