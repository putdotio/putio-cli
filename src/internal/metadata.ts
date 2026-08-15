import packageJson from "../../package.json";
import { Schema } from "effect";

import { translate } from "../i18n/index.js";

import {
  CliOutputContractSchema,
  CommandDescriptorSchema,
  commandCatalog,
} from "./cli-contract.js";
import {
  CRASH_REPORTING_FLUSH_TIMEOUT_MS,
  type CrashReportingDecision,
} from "./crash-reporting.js";
import {
  ENV_API_BASE_URL,
  ENV_CLI_CLIENT_NAME,
  ENV_CLI_CONFIG_PATH,
  ENV_CLI_PROFILE,
  ENV_CLI_TOKEN,
  ENV_CLI_WEB_APP_URL,
} from "./env.js";
import { PUTIO_CLI_APP_ID } from "./constants.js";

const NonEmptyStringSchema = Schema.String.check(Schema.isNonEmpty());
const ConfigStringFieldSchema = Schema.Struct({
  required: Schema.Boolean,
  type: Schema.Literal("string"),
});
const ConfigBooleanFieldSchema = Schema.Struct({
  required: Schema.Boolean,
  type: Schema.Literal("boolean"),
});
const PersistedProfileShapeSchema = Schema.Struct({
  api_base_url: ConfigStringFieldSchema,
  auth_token: ConfigStringFieldSchema,
});
const SupportedOutputModeSchema = Schema.Literals(["json", "text", "ndjson"] as const);
const AutomationContractSchema = Schema.Struct({
  consumerSkillLibrary: Schema.Boolean,
  defaultNonInteractiveOutput: Schema.Literal("json"),
  dryRunForWrites: Schema.Boolean,
  fieldSelectionForReads: Schema.Boolean,
  rawJsonInputForWrites: Schema.Boolean,
  schemaIntrospection: Schema.Boolean,
  secretRedaction: Schema.Boolean,
  streamingReadCommands: Schema.Array(NonEmptyStringSchema),
  supportedOutputModes: Schema.Array(SupportedOutputModeSchema),
  untrustedTextAnnotations: Schema.Boolean,
});

const CliMetadataSchema = Schema.Struct({
  automation: AutomationContractSchema,
  auth: Schema.Struct({
    apiBaseUrlEnv: NonEmptyStringSchema,
    envPrecedence: Schema.Array(NonEmptyStringSchema),
    loginAppId: NonEmptyStringSchema,
    loginClientNameEnv: NonEmptyStringSchema,
    loginOpensBrowserByDefault: Schema.Boolean,
    loginWebAppUrlEnv: NonEmptyStringSchema,
    persistedConfigEnv: NonEmptyStringSchema,
    persistedConfigShape: Schema.Struct({
      api_base_url: ConfigStringFieldSchema,
      auth_token: ConfigStringFieldSchema,
      default_profile: ConfigStringFieldSchema,
      profiles: Schema.Struct({
        required: Schema.Boolean,
        type: Schema.Literal("record"),
        values: PersistedProfileShapeSchema,
      }),
      telemetry_disabled: ConfigBooleanFieldSchema,
    }),
    profileEnv: NonEmptyStringSchema,
  }),
  binary: NonEmptyStringSchema,
  commands: Schema.Array(CommandDescriptorSchema),
  crashReporting: Schema.Struct({
    capturedFields: Schema.Array(NonEmptyStringSchema),
    defaultEnabled: Schema.Literal(true),
    disabledReason: Schema.NullOr(
      Schema.Literals([
        "configuration_unavailable",
        "initialization_failed",
        "persisted_opt_out",
      ] as const),
    ),
    disableCommand: Schema.Literal("telemetry disable"),
    enabled: Schema.Boolean,
    enableCommand: Schema.Literal("telemetry enable"),
    flushDeadlineMs: Schema.Int,
    persistedConfigField: Schema.Literal("telemetry_disabled"),
    provider: Schema.Literal("Sentry"),
    statusCommand: Schema.Literal("telemetry status"),
  }),
  name: NonEmptyStringSchema,
  output: CliOutputContractSchema,
  version: NonEmptyStringSchema,
});

export type CliMetadata = Schema.Schema.Type<typeof CliMetadataSchema>;

const decodeCliMetadata = Schema.decodeUnknownSync(CliMetadataSchema);

const makeAutomationContract = (): Schema.Schema.Type<typeof AutomationContractSchema> => {
  const readCommands = commandCatalog.filter((command) => command.kind === "read");
  const writeCommands = commandCatalog.filter((command) => command.kind === "write");

  return {
    consumerSkillLibrary: true,
    defaultNonInteractiveOutput: "json",
    dryRunForWrites: writeCommands.every((command) => command.capabilities.dryRun),
    fieldSelectionForReads: readCommands.every((command) => command.capabilities.fieldSelection),
    rawJsonInputForWrites: writeCommands.every((command) => command.capabilities.rawJsonInput),
    schemaIntrospection: true,
    secretRedaction: true,
    streamingReadCommands: commandCatalog
      .filter((command) => command.capabilities.streaming)
      .map((command) => command.command),
    supportedOutputModes: ["json", "text", "ndjson"],
    untrustedTextAnnotations: true,
  };
};

export const describeCli = (
  crashReporting: CrashReportingDecision = { enabled: true },
): CliMetadata =>
  decodeCliMetadata({
    automation: makeAutomationContract(),
    auth: {
      apiBaseUrlEnv: ENV_API_BASE_URL,
      envPrecedence: [ENV_CLI_TOKEN],
      loginAppId: PUTIO_CLI_APP_ID,
      loginClientNameEnv: ENV_CLI_CLIENT_NAME,
      loginOpensBrowserByDefault: false,
      loginWebAppUrlEnv: ENV_CLI_WEB_APP_URL,
      persistedConfigEnv: ENV_CLI_CONFIG_PATH,
      persistedConfigShape: {
        api_base_url: { required: true, type: "string" },
        auth_token: { required: false, type: "string" },
        default_profile: { required: false, type: "string" },
        profiles: {
          required: false,
          type: "record",
          values: {
            api_base_url: { required: false, type: "string" },
            auth_token: { required: false, type: "string" },
          },
        },
        telemetry_disabled: { required: false, type: "boolean" },
      },
      profileEnv: ENV_CLI_PROFILE,
    },
    binary: translate("cli.brand.binary"),
    commands: commandCatalog,
    crashReporting: {
      capturedFields: [
        "event_id",
        "timestamp",
        "fixed_message",
        "failure_kind",
        "fixed_component",
        "fixed_platform",
        "fixed_environment",
        "fixed_fingerprint",
        "fixed_level",
        "fixed_logger",
        "package_release",
        "provider_envelope_metadata",
      ],
      defaultEnabled: true,
      disabledReason: crashReporting.enabled ? null : crashReporting.reason,
      disableCommand: "telemetry disable",
      enabled: crashReporting.enabled,
      enableCommand: "telemetry enable",
      flushDeadlineMs: CRASH_REPORTING_FLUSH_TIMEOUT_MS,
      persistedConfigField: "telemetry_disabled",
      provider: "Sentry",
      statusCommand: "telemetry status",
    },
    name: packageJson.name,
    output: {
      defaultInteractive: "text",
      defaultNonInteractive: "json",
      internalRenderers: ["json", "terminal", "ndjson"],
      supported: ["json", "text", "ndjson"],
    },
    version: packageJson.version,
  });
