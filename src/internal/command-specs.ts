import { Schema } from "effect";

const NonEmptyStringSchema = Schema.String.pipe(
  Schema.filter((value): value is string => value.length > 0, {
    message: () => "Expected a non-empty string",
  }),
);

export const OutputModeSchema = Schema.Literal("json", "text", "ndjson");
export type OutputMode = Schema.Schema.Type<typeof OutputModeSchema>;

export const InternalRendererSchema = Schema.Literal("json", "terminal", "ndjson");
export type InternalRenderer = Schema.Schema.Type<typeof InternalRendererSchema>;

export const CommandKindSchema = Schema.Literal("utility", "auth", "read", "write");
export type CommandKind = Schema.Schema.Type<typeof CommandKindSchema>;

export const CommandOptionTypeSchema = Schema.Literal("string", "integer", "boolean", "enum");
export type CommandOptionType = Schema.Schema.Type<typeof CommandOptionTypeSchema>;

const JsonScalarSchema = Schema.Struct({
  kind: Schema.Literal("string", "integer", "boolean"),
});

export type CommandJsonShape =
  | {
      readonly kind: "string" | "integer" | "boolean";
    }
  | {
      readonly kind: "array";
      readonly items: CommandJsonShape;
    }
  | {
      readonly kind: "object";
      readonly properties: ReadonlyArray<JsonProperty>;
      readonly rules?: ReadonlyArray<string>;
    };

export type JsonProperty = {
  readonly name: string;
  readonly required: boolean;
  readonly schema: CommandJsonShape;
};

const JsonPropertySchema: Schema.Schema<JsonProperty> = Schema.Struct({
  name: NonEmptyStringSchema,
  required: Schema.Boolean,
  schema: Schema.suspend(() => CommandJsonShapeSchema),
});

const JsonObjectSchema = Schema.Struct({
  kind: Schema.Literal("object"),
  properties: Schema.Array(JsonPropertySchema),
  rules: Schema.optional(Schema.Array(NonEmptyStringSchema)),
});

const JsonArraySchema = Schema.Struct({
  kind: Schema.Literal("array"),
  items: Schema.suspend(() => CommandJsonShapeSchema),
});

export const CommandJsonShapeSchema: Schema.Schema<CommandJsonShape> = Schema.Union(
  JsonScalarSchema,
  JsonObjectSchema,
  JsonArraySchema,
);

export const CommandOptionSchema = Schema.Struct({
  choices: Schema.optional(Schema.Array(NonEmptyStringSchema)),
  defaultValue: Schema.optional(Schema.Union(NonEmptyStringSchema, Schema.Number, Schema.Boolean)),
  description: Schema.optional(NonEmptyStringSchema),
  name: NonEmptyStringSchema,
  repeated: Schema.Boolean,
  required: Schema.Boolean,
  type: CommandOptionTypeSchema,
});

export type CommandOption = Schema.Schema.Type<typeof CommandOptionSchema>;

const CommandInputSchema = Schema.Struct({
  flags: Schema.Array(CommandOptionSchema),
  json: Schema.optional(CommandJsonShapeSchema),
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

export type CommandDescriptor = Schema.Schema.Type<typeof CommandDescriptorSchema>;

export const CliOutputContractSchema = Schema.Struct({
  defaultInteractive: Schema.Literal("text"),
  defaultNonInteractive: Schema.Literal("json"),
  internalRenderers: Schema.Array(InternalRendererSchema),
  supported: Schema.Array(OutputModeSchema),
});

export type CliOutputContract = Schema.Schema.Type<typeof CliOutputContractSchema>;

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
    readonly flags: ReadonlyArray<CommandOption>;
    readonly json?: CommandJsonShape;
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

export const stringShape = (): CommandJsonShape => ({ kind: "string" });
export const integerShape = (): CommandJsonShape => ({ kind: "integer" });
export const booleanShape = (): CommandJsonShape => ({ kind: "boolean" });
export const arrayShape = (items: CommandJsonShape): CommandJsonShape => ({ kind: "array", items });
export const property = (
  name: string,
  schema: CommandJsonShape,
  required = true,
): JsonProperty => ({
  name,
  required,
  schema,
});
export const objectShape = (
  properties: ReadonlyArray<JsonProperty>,
  rules?: ReadonlyArray<string>,
): CommandJsonShape => ({
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

type SchemaAstNode =
  | {
      readonly _tag: string;
      readonly from?: SchemaAstNode;
      readonly to?: SchemaAstNode;
      readonly propertySignatures?: ReadonlyArray<{
        readonly isOptional?: boolean;
        readonly name: string;
        readonly type: SchemaAstNode;
      }>;
      readonly rest?: ReadonlyArray<{
        readonly type: SchemaAstNode;
      }>;
      readonly type?: SchemaAstNode;
      readonly types?: ReadonlyArray<SchemaAstNode>;
    }
  | undefined;

const unwrapSchemaAst = (ast: SchemaAstNode): SchemaAstNode => {
  let current = ast;

  while (
    current &&
    (current._tag === "Refinement" ||
      current._tag === "Transformation" ||
      current._tag === "Suspend")
  ) {
    current =
      current._tag === "Suspend"
        ? current.type
        : current._tag === "Transformation"
          ? current.to
          : current.from;
  }

  return current;
};

const schemaAstToJsonShape = (ast: SchemaAstNode): CommandJsonShape => {
  const current = unwrapSchemaAst(ast);

  switch (current?._tag) {
    case "StringKeyword":
      return stringShape();
    case "NumberKeyword":
      return integerShape();
    case "BooleanKeyword":
      return booleanShape();
    case "TupleType": {
      const item = current.rest?.[0]?.type;

      if (!item) {
        throw new Error("Unable to derive an array item schema from an empty tuple AST.");
      }

      return arrayShape(schemaAstToJsonShape(item));
    }
    case "TypeLiteral":
      return objectShape(
        (current.propertySignatures ?? []).map((propertySignature) =>
          property(
            propertySignature.name,
            schemaAstToJsonShape(propertySignature.type),
            propertySignature.isOptional !== true,
          ),
        ),
      );
    case "Union": {
      const definedTypes = (current.types ?? []).filter(
        (type) => unwrapSchemaAst(type)?._tag !== "UndefinedKeyword",
      );

      if (definedTypes.length === 1) {
        return schemaAstToJsonShape(definedTypes[0]);
      }

      throw new Error("Only optional unions are supported when deriving CLI json metadata.");
    }
    default:
      throw new Error(
        `Unsupported schema AST node for CLI json metadata: ${current?._tag ?? "unknown"}`,
      );
  }
};

export const jsonShapeFromSchema = <A, I>(
  schema: Schema.Schema<A, I>,
  rules?: ReadonlyArray<string>,
): CommandJsonShape => {
  const shape = schemaAstToJsonShape(schema.ast);

  return rules && shape.kind === "object" ? { ...shape, rules } : shape;
};
