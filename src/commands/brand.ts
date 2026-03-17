import { Command } from "@effect/cli";
import { translate } from "@putdotio/translations";

import packageJson from "../../package.json";

import { getOption, outputOption } from "../internal/command.js";
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
