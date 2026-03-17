import packageJson from "../../package.json";
import { Schema } from "effect";

import { translate } from "../i18n/index.js";

import {
  CliOutputContractSchema,
  CommandDescriptorSchema,
  commandCatalog,
} from "./cli-contract.js";
import {
  ENV_API_BASE_URL,
  ENV_CLI_CLIENT_NAME,
  ENV_CLI_CONFIG_PATH,
  ENV_CLI_TOKEN,
  ENV_CLI_WEB_APP_URL,
} from "./env.js";
import { PUTIO_CLI_APP_ID } from "./constants.js";

const NonEmptyStringSchema = Schema.String.pipe(
  Schema.filter((value): value is string => value.length > 0, {
    message: () => "Expected a non-empty string",
  }),
);

const CliMetadataSchema = Schema.Struct({
  auth: Schema.Struct({
    apiBaseUrlEnv: NonEmptyStringSchema,
    envPrecedence: Schema.Array(NonEmptyStringSchema),
    loginAppId: NonEmptyStringSchema,
    loginClientNameEnv: NonEmptyStringSchema,
    loginOpensBrowserByDefault: Schema.Boolean,
    loginWebAppUrlEnv: NonEmptyStringSchema,
    persistedConfigEnv: NonEmptyStringSchema,
    persistedConfigShape: Schema.Struct({
      api_base_url: Schema.Literal("string"),
      auth_token: Schema.Literal("string"),
    }),
  }),
  binary: NonEmptyStringSchema,
  commands: Schema.Array(CommandDescriptorSchema),
  name: NonEmptyStringSchema,
  output: CliOutputContractSchema,
  version: NonEmptyStringSchema,
});

const decodeCliMetadata = Schema.decodeUnknownSync(CliMetadataSchema);

export const describeCli = () =>
  decodeCliMetadata({
    auth: {
      apiBaseUrlEnv: ENV_API_BASE_URL,
      envPrecedence: [ENV_CLI_TOKEN],
      loginAppId: PUTIO_CLI_APP_ID,
      loginClientNameEnv: ENV_CLI_CLIENT_NAME,
      loginOpensBrowserByDefault: false,
      loginWebAppUrlEnv: ENV_CLI_WEB_APP_URL,
      persistedConfigEnv: ENV_CLI_CONFIG_PATH,
      persistedConfigShape: {
        api_base_url: "string",
        auth_token: "string",
      },
    },
    binary: translate("cli.brand.binary"),
    commands: commandCatalog,
    name: packageJson.name,
    output: {
      default: "text",
      internalRenderers: ["json", "terminal"],
      supported: ["json", "text"],
    },
    version: packageJson.version,
  });
