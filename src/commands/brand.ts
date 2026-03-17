import { Command } from "@effect/cli";

import packageJson from "../../package.json";

import { getOption, outputOption } from "../internal/command.js";
import { outputFlag, type CommandSpec } from "../internal/command-specs.js";
import { translate } from "../i18n/index.js";
import { writeOutput } from "../internal/output-service.js";
import { renderPutioSignature } from "../internal/terminal/brand.js";

const renderVersionTerminal = (value: { readonly version: string }) =>
  [renderPutioSignature(), translate("cli.brand.versionLabel", { version: value.version })].join(
    "\n\n",
  );

export const brandCommand = Command.make("brand", { output: outputOption }, ({ output }) =>
  writeOutput(
    {
      brand: translate("cli.brand.name"),
      version: packageJson.version,
    },
    getOption(output),
    () => renderPutioSignature(),
  ),
);

export const versionCommand = Command.make("version", { output: outputOption }, ({ output }) =>
  writeOutput(
    {
      binary: translate("cli.brand.binary"),
      version: packageJson.version,
    },
    getOption(output),
    (value) => renderVersionTerminal(value),
  ),
);

export const utilityCommandSpecs = [
  {
    auth: { required: false },
    capabilities: {
      dryRun: false,
      fieldSelection: false,
      rawJsonInput: false,
      streaming: false,
    },
    command: "brand",
    input: { flags: [outputFlag()] },
    kind: "utility",
    purpose: translate("cli.metadata.brand"),
  },
  {
    auth: { required: false },
    capabilities: {
      dryRun: false,
      fieldSelection: false,
      rawJsonInput: false,
      streaming: false,
    },
    command: "version",
    input: { flags: [outputFlag()] },
    kind: "utility",
    purpose: translate("cli.metadata.version"),
  },
] satisfies ReadonlyArray<CommandSpec>;
