import packageJson from "../../package.json";
import { translate } from "../i18n/index.js";

import {
  ENV_API_BASE_URL,
  ENV_CLI_CLIENT_NAME,
  ENV_CLI_CONFIG_PATH,
  ENV_CLI_TOKEN,
  ENV_CLI_WEB_APP_URL,
} from "./env.js";
import { PUTIO_CLI_APP_ID } from "./constants.js";

export const commandCatalog = [
  {
    command: "describe",
    purpose: translate("cli.metadata.describe"),
  },
  {
    command: "brand",
    purpose: translate("cli.metadata.brand"),
  },
  {
    command: "version",
    purpose: translate("cli.metadata.version"),
  },
  {
    command: "auth status",
    purpose: translate("cli.metadata.authStatus"),
  },
  {
    command: "auth login",
    purpose: translate("cli.metadata.authLogin"),
  },
  {
    command: "auth preview",
    purpose: translate("cli.metadata.authPreview"),
  },
  {
    command: "auth logout",
    purpose: translate("cli.metadata.authLogout"),
  },
  {
    command: "whoami",
    purpose: translate("cli.metadata.whoami"),
  },
  {
    command: "download-links create",
    purpose: translate("cli.metadata.downloadLinksCreate"),
  },
  {
    command: "download-links get",
    purpose: translate("cli.metadata.downloadLinksGet"),
  },
  {
    command: "events list",
    purpose: translate("cli.metadata.eventsList"),
  },
  {
    command: "files list",
    purpose: translate("cli.metadata.filesList"),
  },
  {
    command: "files mkdir",
    purpose: translate("cli.metadata.filesMkdir"),
  },
  {
    command: "files rename",
    purpose: translate("cli.metadata.filesRename"),
  },
  {
    command: "files move",
    purpose: translate("cli.metadata.filesMove"),
  },
  {
    command: "files delete",
    purpose: translate("cli.metadata.filesDelete"),
  },
  {
    command: "files search",
    purpose: translate("cli.metadata.filesSearch"),
  },
  {
    command: "search",
    purpose: translate("cli.metadata.search"),
  },
  {
    command: "transfers list",
    purpose: translate("cli.metadata.transfersList"),
  },
  {
    command: "transfers add",
    purpose: translate("cli.metadata.transfersAdd"),
  },
  {
    command: "transfers cancel",
    purpose: translate("cli.metadata.transfersCancel"),
  },
  {
    command: "transfers retry",
    purpose: translate("cli.metadata.transfersRetry"),
  },
  {
    command: "transfers reannounce",
    purpose: translate("cli.metadata.transfersReannounce"),
  },
  {
    command: "transfers watch",
    purpose: translate("cli.metadata.transfersWatch"),
  },
  {
    command: "transfers clean",
    purpose: translate("cli.metadata.transfersClean"),
  },
] as const;

export const describeCli = () => ({
  name: packageJson.name,
  version: packageJson.version,
  binary: translate("cli.brand.binary"),
  output: {
    default: "text",
    internalRenderers: ["json", "terminal"],
    supported: ["json", "text"],
  },
  auth: {
    envPrecedence: [ENV_CLI_TOKEN],
    loginAppId: PUTIO_CLI_APP_ID,
    loginClientNameEnv: ENV_CLI_CLIENT_NAME,
    loginWebAppUrlEnv: ENV_CLI_WEB_APP_URL,
    loginOpensBrowserByDefault: false,
    apiBaseUrlEnv: ENV_API_BASE_URL,
    persistedConfigEnv: ENV_CLI_CONFIG_PATH,
    persistedConfigShape: {
      api_base_url: "string",
      auth_token: "string",
    },
  },
  commands: commandCatalog,
});
