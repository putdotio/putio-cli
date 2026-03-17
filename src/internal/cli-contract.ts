import { authCommandSpecs } from "../commands/auth.js";
import { utilityCommandSpecs } from "../commands/brand.js";
import { downloadLinksCommandSpecs } from "../commands/download-links.js";
import { eventsCommandSpecs } from "../commands/events.js";
import { filesCommandSpecs } from "../commands/files.js";
import { transfersCommandSpecs } from "../commands/transfers.js";
import { whoamiCommandSpecs } from "../commands/whoami.js";
import { translate } from "../i18n/index.js";

import {
  CliOutputContractSchema,
  CommandDescriptorSchema,
  decodeCommandSpecs,
  type CliOutputContract,
  type CommandDescriptor,
  type CommandSpec,
} from "./command-specs.js";

export { CliOutputContractSchema, CommandDescriptorSchema };
export type { CliOutputContract, CommandDescriptor };

const describeCommandSpec = {
  auth: { required: false },
  capabilities: {
    dryRun: false,
    fieldSelection: false,
    rawJsonInput: false,
    streaming: false,
  },
  command: "describe",
  input: { flags: [] },
  kind: "utility",
  purpose: translate("cli.metadata.describe"),
} satisfies CommandSpec;

export const commandCatalog = decodeCommandSpecs([
  describeCommandSpec,
  ...utilityCommandSpecs,
  ...authCommandSpecs,
  ...whoamiCommandSpecs,
  ...downloadLinksCommandSpecs,
  ...eventsCommandSpecs,
  ...filesCommandSpecs,
  ...transfersCommandSpecs,
]);
