import { Command } from "effect/unstable/cli";
import { Console, Effect, Schema } from "effect";

import { translate } from "../i18n/index.js";
import {
  defineBooleanOption,
  defineTextOption,
  dryRunOption,
  getOption,
  jsonOption,
  outputOption,
  resolveMutationInput,
  withAuthedSdk,
  writeDryRunPlan,
  CliCommandInputError,
} from "../internal/command.js";
import {
  dryRunFlag,
  jsonFlag,
  outputFlag,
  type CommandJsonShape,
  type CommandSpec,
} from "../internal/command-specs.js";
import { withTerminalLoader } from "../internal/loader-service.js";
import {
  redactSensitiveStructuredValues,
  renderJson,
  writeOutput,
} from "../internal/output-service.js";
import { sdk } from "../internal/sdk.js";
import {
  invokeSdkOperation,
  listSdkOperations,
  normalizeSdkOperationResult,
  resolveSdkOperation,
} from "../internal/sdk-operations.js";

const NonBlankStringSchema = Schema.String.check(
  Schema.makeFilter((value) =>
    value.trim().length > 0 ? undefined : "Expected a non-empty string",
  ),
);

const SdkCallInputSchema = Schema.Struct({
  args: Schema.optional(Schema.Array(Schema.Json)),
  operation: NonBlankStringSchema,
});

type SdkCallInput = Schema.Schema.Type<typeof SdkCallInputSchema>;

const argsConfig = defineTextOption("args", {
  defaultValue: "[]",
  description: "JSON array of positional arguments passed to the SDK function.",
});
const executeConfig = defineBooleanOption("execute", {
  defaultValue: false,
  description: "Explicitly execute the selected SDK operation.",
});
const operationConfig = defineTextOption("operation", {
  description: "Dot-separated SDK function path, for example files.get.",
  optional: true,
});

const argsOption = argsConfig.option;
const executeOption = executeConfig.option;
const operationOption = operationConfig.option;

const parseSdkArguments = (raw: string) => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new CliCommandInputError({
      message: "Expected `sdk call --args` to contain valid JSON.",
    });
  }

  try {
    return Schema.decodeUnknownSync(Schema.Array(Schema.Json))(parsed);
  } catch {
    throw new CliCommandInputError({
      message: "Expected `sdk call --args` to contain a JSON array.",
    });
  }
};

const resolveExecutionMode = (dryRun: boolean, execute: boolean) => {
  if (dryRun === execute) {
    throw new CliCommandInputError({
      message: "Choose exactly one of `sdk call --dry-run` or `sdk call --execute`.",
    });
  }

  return dryRun ? "dry-run" : "execute";
};

const resolveInput = (input: SdkCallInput) => ({
  args: input.args ?? [],
  operation: input.operation,
});

const renderSdkCatalogTerminal = (catalog: ReturnType<typeof listSdkOperations>) => {
  const supported = catalog.operations.map((operation) => `  ${operation}`);
  const unsupported = catalog.unsupported.map(
    ({ operation, reason }) => `  ${operation} — ${reason}`,
  );

  return [
    `JSON-callable SDK operations (${catalog.operations.length})`,
    ...supported,
    "",
    `Unsupported SDK operations (${catalog.unsupported.length})`,
    ...unsupported,
  ].join("\n");
};

const sdkList = Command.make("list", { output: outputOption }, ({ output }) =>
  writeOutput(listSdkOperations(sdk), getOption(output), renderSdkCatalogTerminal),
);

const sdkCall = Command.make(
  "call",
  {
    args: argsOption,
    dryRun: dryRunOption,
    execute: executeOption,
    json: jsonOption,
    operation: operationOption,
    output: outputOption,
  },
  ({ args, dryRun, execute, json, operation, output }) =>
    Effect.gen(function* () {
      const mode = yield* Effect.try({
        try: () => resolveExecutionMode(dryRun, execute),
        catch: (error) => error,
      });
      const input = yield* resolveMutationInput({
        buildFromFlags: () => ({
          args: parseSdkArguments(args),
          operation:
            getOption(operation) ??
            (() => {
              throw new CliCommandInputError({
                message: "Provide `sdk call --operation` or `sdk call --json`.",
              });
            })(),
        }),
        json,
        schema: SdkCallInputSchema,
      }).pipe(Effect.map(resolveInput));

      yield* Effect.try({
        try: () => resolveSdkOperation(sdk, input.operation),
        catch: (error) => error,
      });

      if (mode === "dry-run") {
        return yield* writeDryRunPlan(
          "sdk call",
          {
            args: redactSensitiveStructuredValues(input.args),
            operation: input.operation,
          },
          getOption(output),
        );
      }

      const result = yield* withTerminalLoader(
        {
          message: translate("cli.sdk.command.calling", { operation: input.operation }),
          output: getOption(output),
        },
        withAuthedSdk(({ sdk: authedSdk }) =>
          invokeSdkOperation(authedSdk, input.operation, input.args),
        ),
      );
      const normalized = yield* Effect.try({
        try: () => normalizeSdkOperationResult(input.operation, result),
        catch: (error) => error,
      });

      yield* writeOutput(
        {
          operation: input.operation,
          result: redactSensitiveStructuredValues(normalized),
        },
        getOption(output),
        (value) => `${value.operation}\n${renderJson(value.result)}`,
      );
    }),
);

export const sdkCommand = Command.make("sdk", {}, () =>
  Console.log(translate("cli.sdk.chooseSubcommand")),
).pipe(Command.withSubcommands([sdkList, sdkCall]));

const sdkCallJsonShape = {
  kind: "object",
  properties: [
    {
      name: "args",
      required: false,
      schema: { kind: "array", items: { kind: "json" } },
    },
    {
      name: "operation",
      required: true,
      schema: { kind: "string" },
    },
  ],
  rules: [
    "`operation` must be an own, JSON-callable SDK function path returned by `sdk list`.",
    "Exactly one of `--dry-run` or `--execute` is required.",
  ],
} satisfies CommandJsonShape;

export const sdkCommandSpecs = [
  {
    auth: { required: false },
    capabilities: {
      dryRun: false,
      fieldSelection: false,
      rawJsonInput: false,
      streaming: false,
    },
    command: "sdk list",
    input: { flags: [outputFlag()] },
    kind: "utility",
    purpose: translate("cli.metadata.sdkList"),
  },
  {
    auth: { required: true },
    capabilities: {
      dryRun: true,
      fieldSelection: false,
      rawJsonInput: true,
      streaming: false,
    },
    command: "sdk call",
    input: {
      flags: [
        argsConfig.flag,
        dryRunFlag(),
        executeConfig.flag,
        jsonFlag(),
        operationConfig.flag,
        outputFlag(),
      ],
      json: sdkCallJsonShape,
    },
    kind: "write",
    purpose: translate("cli.metadata.sdkCall"),
  },
] satisfies ReadonlyArray<CommandSpec>;
