import { Command } from "@effect/cli";
import { translate } from "@putdotio/translations";
import { Console } from "effect";
import packageJson from "../package.json";

import { makeAuthCommand } from "./commands/auth.js";
import { brandCommand, versionCommand } from "./commands/brand.js";
import { downloadLinksCommand } from "./commands/download-links.js";
import { eventsCommand } from "./commands/events.js";
import { filesCommand, searchCommand } from "./commands/files.js";
import { transfersCommand } from "./commands/transfers.js";
import { whoamiCommand } from "./commands/whoami.js";
import { describeCli } from "./internal/metadata.js";
import { renderJson } from "./internal/output-service.js";

const authCommand = makeAuthCommand();

const describeCommand = Command.make("describe", {}, () => Console.log(renderJson(describeCli())));

const command = Command.make("putio", {}, () => Console.log(translate("cli.root.help"))).pipe(
  Command.withSubcommands([
    describeCommand,
    brandCommand,
    versionCommand,
    authCommand,
    whoamiCommand,
    downloadLinksCommand,
    eventsCommand,
    filesCommand,
    searchCommand,
    transfersCommand,
  ]),
);

export function runCli(args: ReadonlyArray<string>) {
  return Command.run(command, {
    name: "putio",
    version: `v${packageJson.version}`,
  })(args);
}
