import { Predicate, Schema } from "effect";
import * as SchemaAST from "effect/SchemaAST";

const NonEmptyStringSchema = Schema.String.check(Schema.isNonEmpty());

const OutputModeSchema = Schema.Literals(["json", "text", "ndjson"] as const);

const InternalRendererSchema = Schema.Literals(["json", "terminal", "ndjson"] as const);

const CommandKindSchema = Schema.Literals(["utility", "auth", "read", "write"] as const);

type CommandKind = Schema.Schema.Type<typeof CommandKindSchema>;

const CommandOptionTypeSchema = Schema.Literals(["string", "integer", "boolean", "enum"] as const);

const JsonPrimitiveKindSchema = Schema.Literals([
  "string",
  "integer",
  "boolean",
  "null",
  "json",
] as const);

const JsonScalarSchema = Schema.Struct({
  kind: JsonPrimitiveKindSchema,
});

const JsonEnumValueSchema = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
] as const);

export type JsonInputSpec =
  | {
      readonly kind: "string" | "integer" | "boolean" | "null" | "json";
    }
  | {
      readonly kind: "enum";
      readonly values: ReadonlyArray<string | number | boolean | null>;
    }
  | {
      readonly kind: "array";
      readonly items: JsonInputSpec;
    }
  | {
      readonly kind: "object";
      readonly properties: ReadonlyArray<JsonProperty>;
      readonly rules?: ReadonlyArray<string>;
    };

type JsonProperty = {
  readonly name: string;
  readonly required: boolean;
  readonly schema: JsonInputSpec;
};

const JsonPropertySchema: Schema.Codec<JsonProperty> = Schema.Struct({
  name: NonEmptyStringSchema,
  required: Schema.Boolean,
  schema: Schema.suspend((): Schema.Codec<JsonInputSpec> => JsonInputSpecSchema),
});

const JsonObjectSchema = Schema.Struct({
  kind: Schema.Literal("object"),
  properties: Schema.Array(JsonPropertySchema),
  rules: Schema.optional(Schema.Array(NonEmptyStringSchema)),
});

const JsonArraySchema = Schema.Struct({
  kind: Schema.Literal("array"),
  items: Schema.suspend((): Schema.Codec<JsonInputSpec> => JsonInputSpecSchema),
});

const JsonEnumSchema = Schema.Struct({
  kind: Schema.Literal("enum"),
  values: Schema.Array(JsonEnumValueSchema),
});

const JsonInputSpecSchema: Schema.Codec<JsonInputSpec> = Schema.Union([
  JsonScalarSchema,
  JsonEnumSchema,
  JsonObjectSchema,
  JsonArraySchema,
] as const);

const CommandOptionSchema = Schema.Struct({
  choices: Schema.optional(Schema.Array(NonEmptyStringSchema)),
  defaultValue: Schema.optional(
    Schema.Union([NonEmptyStringSchema, Schema.Number, Schema.Boolean] as const),
  ),
  description: Schema.optional(NonEmptyStringSchema),
  name: NonEmptyStringSchema,
  repeated: Schema.Boolean,
  required: Schema.Boolean,
  type: CommandOptionTypeSchema,
});

export type CommandOption = Schema.Schema.Type<typeof CommandOptionSchema>;

const CommandArgumentSchema = Schema.Struct({
  choices: Schema.optional(Schema.Array(NonEmptyStringSchema)),
  description: Schema.optional(NonEmptyStringSchema),
  name: NonEmptyStringSchema,
  required: Schema.Boolean,
  type: CommandOptionTypeSchema,
});

export type CommandArgument = Schema.Schema.Type<typeof CommandArgumentSchema>;

const CommandInputSchema = Schema.Struct({
  arguments: Schema.optional(Schema.Array(CommandArgumentSchema)),
  flags: Schema.Array(CommandOptionSchema),
  json: Schema.optional(JsonInputSpecSchema),
});

const CommandCapabilitiesSchema = Schema.Struct({
  dryRun: Schema.Boolean,
  fieldSelection: Schema.Boolean,
  rawJsonInput: Schema.Boolean,
  streaming: Schema.Boolean,
});

const CommandAuthSchema = Schema.Struct({
  required: Schema.Boolean,
});

export const CommandDescriptorSchema = Schema.Struct({
  auth: CommandAuthSchema,
  capabilities: CommandCapabilitiesSchema,
  command: NonEmptyStringSchema,
  input: CommandInputSchema,
  kind: CommandKindSchema,
  purpose: NonEmptyStringSchema,
});

export const CliOutputContractSchema = Schema.Struct({
  defaultInteractive: Schema.Literal("text"),
  defaultNonInteractive: Schema.Literal("json"),
  internalRenderers: Schema.Array(InternalRendererSchema),
  supported: Schema.Array(OutputModeSchema),
});

export type CommandSpec = {
  readonly auth: { readonly required: boolean };
  readonly capabilities: {
    readonly dryRun: boolean;
    readonly fieldSelection: boolean;
    readonly rawJsonInput: boolean;
    readonly streaming: boolean;
  };
  readonly command: string;
  readonly input?: {
    readonly arguments?: ReadonlyArray<CommandArgument>;
    readonly flags: ReadonlyArray<CommandOption>;
    readonly json?: JsonInputSpec;
  };
  readonly kind: CommandKind;
  readonly purpose: string;
};

const decodeCommandCatalog = Schema.decodeUnknownSync(Schema.Array(CommandDescriptorSchema));

const hasFlag = (spec: CommandSpec, name: string) =>
  spec.input?.flags.some((flag) => flag.name === name) ?? false;

const validateCommandSpecs = (specs: ReadonlyArray<CommandSpec>) => {
  const seenCommands = new Set<string>();

  for (const spec of specs) {
    if (seenCommands.has(spec.command)) {
      throw new Error(`Duplicate CLI command metadata entry: ${spec.command}`);
    }

    seenCommands.add(spec.command);

    if (spec.capabilities.dryRun && !hasFlag(spec, "dry-run")) {
      throw new Error(
        `Command metadata for \`${spec.command}\` advertises dry-run without a dry-run flag.`,
      );
    }

    if (spec.capabilities.rawJsonInput) {
      if (!hasFlag(spec, "json")) {
        throw new Error(
          `Command metadata for \`${spec.command}\` advertises raw JSON input without a json flag.`,
        );
      }

      if (spec.input?.json === undefined) {
        throw new Error(
          `Command metadata for \`${spec.command}\` advertises raw JSON input without a JSON schema.`,
        );
      }
    }

    if (spec.capabilities.fieldSelection && !hasFlag(spec, "fields")) {
      throw new Error(
        `Command metadata for \`${spec.command}\` advertises field selection without a fields flag.`,
      );
    }

    if (hasFlag(spec, "page-all") && spec.kind !== "read") {
      throw new Error(
        `Command metadata for \`${spec.command}\` uses page-all outside a read command.`,
      );
    }
  }

  return specs;
};

export const decodeCommandSpecs = (specs: ReadonlyArray<CommandSpec>) =>
  decodeCommandCatalog(validateCommandSpecs(specs));

const stringSpec = (): JsonInputSpec => ({ kind: "string" });
const integerSpec = (): JsonInputSpec => ({ kind: "integer" });
const booleanSpec = (): JsonInputSpec => ({ kind: "boolean" });
const nullSpec = (): JsonInputSpec => ({ kind: "null" });

const enumSpec = (values: ReadonlyArray<string | number | boolean | null>): JsonInputSpec => ({
  kind: "enum",
  values: [...values],
});

const arraySpec = (items: JsonInputSpec): JsonInputSpec => ({ kind: "array", items });

const property = (name: string, schema: JsonInputSpec, required = true): JsonProperty => ({
  name,
  required,
  schema,
});

const objectSpec = (
  properties: ReadonlyArray<JsonProperty>,
  rules?: ReadonlyArray<string>,
): JsonInputSpec => ({
  kind: "object",
  properties,
  rules,
});

export const outputFlag = (): CommandOption => ({
  choices: ["json", "text", "ndjson"],
  name: "output",
  repeated: false,
  required: false,
  type: "enum",
});

export const dryRunFlag = (): CommandOption => ({
  defaultValue: false,
  name: "dry-run",
  repeated: false,
  required: false,
  type: "boolean",
});

export const jsonFlag = (): CommandOption => ({
  name: "json",
  repeated: false,
  required: false,
  type: "string",
});

export const fieldsFlag = (): CommandOption => ({
  description:
    "Comma-separated top-level response fields only. Requires structured output and rejects dots, brackets, path traversal, and query fragments.",
  name: "fields",
  repeated: false,
  required: false,
  type: "string",
});

export const pageAllFlag = (): CommandOption => ({
  defaultValue: false,
  description:
    "Continue cursor-backed reads until the cursor is exhausted. Requires structured output.",
  name: "page-all",
  repeated: false,
  required: false,
  type: "boolean",
});

export const booleanFlag = (
  name: string,
  options: {
    readonly defaultValue?: boolean;
    readonly description?: string;
    readonly required?: boolean;
  } = {},
): CommandOption => ({
  defaultValue: options.defaultValue,
  description: options.description,
  name,
  repeated: false,
  required: options.required ?? false,
  type: "boolean",
});

export const integerFlag = (
  name: string,
  options: {
    readonly description?: string;
    readonly required?: boolean;
  } = {},
): CommandOption => ({
  description: options.description,
  name,
  repeated: false,
  required: options.required ?? false,
  type: "integer",
});

export const repeatedIntegerFlag = (
  name: string,
  options: {
    readonly description?: string;
    readonly required?: boolean;
  } = {},
): CommandOption => ({
  description: options.description,
  name,
  repeated: true,
  required: options.required ?? false,
  type: "integer",
});

export const stringFlag = (
  name: string,
  options: {
    readonly defaultValue?: string;
    readonly description?: string;
    readonly required?: boolean;
  } = {},
): CommandOption => ({
  defaultValue: options.defaultValue,
  description: options.description,
  name,
  repeated: false,
  required: options.required ?? false,
  type: "string",
});

export const stringArgument = (
  name: string,
  options: {
    readonly description?: string;
    readonly required?: boolean;
  } = {},
): CommandArgument => ({
  description: options.description,
  name,
  required: options.required ?? true,
  type: "string",
});

export const integerArgument = (
  name: string,
  options: {
    readonly description?: string;
    readonly required?: boolean;
  } = {},
): CommandArgument => ({
  description: options.description,
  name,
  required: options.required ?? true,
  type: "integer",
});

export const repeatedStringFlag = (
  name: string,
  options: {
    readonly description?: string;
    readonly required?: boolean;
  } = {},
): CommandOption => ({
  description: options.description,
  name,
  repeated: true,
  required: options.required ?? false,
  type: "string",
});

export const enumFlag = (
  name: string,
  choices: ReadonlyArray<string>,
  options: {
    readonly description?: string;
    readonly required?: boolean;
  } = {},
): CommandOption => ({
  choices: [...choices],
  description: options.description,
  name,
  repeated: false,
  required: options.required ?? false,
  type: "enum",
});

type SchemaAstNode = SchemaAST.AST | undefined;

const unwrapSchemaAst = (ast: SchemaAstNode): SchemaAstNode => {
  let current = ast;

  while (current && SchemaAST.isSuspend(current)) {
    current = current.thunk();
  }

  return current;
};

const schemaAstToJsonInputSpec = (ast: SchemaAstNode): JsonInputSpec => {
  const current = unwrapSchemaAst(ast);

  switch (current?._tag) {
    case "String":
      return stringSpec();
    case "Number":
      return integerSpec();
    case "Boolean":
      return booleanSpec();
    case "Undefined":
    case "Void":
    case "Null":
      return nullSpec();
    case "Literal": {
      const literal = current.literal ?? null;

      if (Predicate.isBigInt(literal)) {
        throw new Error("BigInt literals are not supported in CLI json metadata.");
      }

      return enumSpec([literal]);
    }

    case "Arrays": {
      const item = current.rest[0] ?? current.elements[0];

      if (!item) {
        throw new Error("Unable to derive an array item schema from an empty tuple AST.");
      }

      return arraySpec(schemaAstToJsonInputSpec(item));
    }

    case "Objects":
      return objectSpec(
        current.propertySignatures.map((propertySignature) =>
          property(
            String(propertySignature.name),
            schemaAstToJsonInputSpec(propertySignature.type),
            !SchemaAST.isOptional(propertySignature.type),
          ),
        ),
      );
    case "Union": {
      const definedTypes = current.types.filter(
        (type) => unwrapSchemaAst(type)?._tag !== "Undefined",
      );

      const enumValues = definedTypes.flatMap((type) => {
        const unwrapped = unwrapSchemaAst(type);

        if (unwrapped?._tag === "Literal") {
          const literal = unwrapped.literal ?? null;

          return Predicate.isBigInt(literal) ? [] : [literal];
        }

        if (unwrapped?._tag === "Null" || unwrapped?._tag === "Void") {
          return [null];
        }

        return [];
      });

      if (enumValues.length === definedTypes.length && enumValues.length > 0) {
        return enumSpec(enumValues);
      }

      if (definedTypes.length === 1) {
        return schemaAstToJsonInputSpec(definedTypes[0]);
      }

      throw new Error("Only optional unions are supported when deriving CLI json metadata.");
    }

    default:
      throw new Error(
        `Unsupported schema AST node for CLI json metadata: ${current?._tag ?? "unknown"}`,
      );
  }
};

export const jsonInputSpecFromSchema = <A>(
  schema: Schema.Codec<A>,
  rules?: ReadonlyArray<string>,
): JsonInputSpec => {
  const spec = schemaAstToJsonInputSpec(schema.ast);

  return rules && spec.kind === "object" ? { ...spec, rules } : spec;
};
