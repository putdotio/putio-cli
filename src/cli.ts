import { CliError, Command } from "effect/unstable/cli";
import { Console, Effect, Result } from "effect";
import packageJson from "../package.json";

import { makeAuthCommand } from "./commands/auth.js";
import { brandCommand, versionCommand } from "./commands/brand.js";
import { downloadLinksCommand } from "./commands/download-links.js";
import { eventsCommand } from "./commands/events.js";
import { filesCommand, searchCommand } from "./commands/files.js";
import { translate } from "./i18n/index.js";
import type { CliConfig } from "./internal/config.js";
import { transfersCommand } from "./commands/transfers.js";
import { whoamiCommand } from "./commands/whoami.js";
import { describeCli } from "./internal/metadata.js";
import type { CliOutput } from "./internal/output-service.js";
import { CliRuntime } from "./internal/runtime.js";
import { getOption, outputOption } from "./internal/command.js";
import {
  detectOutputModeFromArgv,
  isStructuredOutputMode,
  renderJson,
  writeOutput,
} from "./internal/output-service.js";
import type { CliSdk } from "./internal/sdk.js";
import type { CliState } from "./internal/state.js";

const authCommand = makeAuthCommand();

const describeCommand = Command.make("describe", { output: outputOption }, ({ output }) =>
  writeOutput(describeCli(), getOption(output), renderJson),
);

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

type BufferedConsoleEntry = {
  readonly args: ReadonlyArray<unknown>;
  readonly method: keyof Console.Console;
};

const makeBufferedConsole = (entries: Array<BufferedConsoleEntry>): Console.Console => ({
  assert: (condition, ...args) => entries.push({ args: [condition, ...args], method: "assert" }),
  clear: () => entries.push({ args: [], method: "clear" }),
  count: (label) => entries.push({ args: label === undefined ? [] : [label], method: "count" }),
  countReset: (label) =>
    entries.push({ args: label === undefined ? [] : [label], method: "countReset" }),
  debug: (...args) => entries.push({ args, method: "debug" }),
  dir: (item, options) =>
    entries.push({ args: options === undefined ? [item] : [item, options], method: "dir" }),
  dirxml: (...args) => entries.push({ args, method: "dirxml" }),
  error: (...args) => entries.push({ args, method: "error" }),
  group: (...args) => entries.push({ args, method: "group" }),
  groupCollapsed: (...args) => entries.push({ args, method: "groupCollapsed" }),
  groupEnd: () => entries.push({ args: [], method: "groupEnd" }),
  info: (...args) => entries.push({ args, method: "info" }),
  log: (...args) => entries.push({ args, method: "log" }),
  table: (tabularData, properties) =>
    entries.push({
      args: properties === undefined ? [tabularData] : [tabularData, properties],
      method: "table",
    }),
  time: (label) => entries.push({ args: label === undefined ? [] : [label], method: "time" }),
  timeEnd: (label) => entries.push({ args: label === undefined ? [] : [label], method: "timeEnd" }),
  timeLog: (label, ...args) =>
    entries.push({
      args: label === undefined ? args : [label, ...args],
      method: "timeLog",
    }),
  trace: (...args) => entries.push({ args, method: "trace" }),
  warn: (...args) => entries.push({ args, method: "warn" }),
});

const replayBufferedConsole = (
  console: Console.Console,
  entries: ReadonlyArray<BufferedConsoleEntry>,
) =>
  Effect.sync(() => {
    for (const entry of entries) {
      const method = console[entry.method] as (...args: ReadonlyArray<unknown>) => void;
      method(...entry.args);
    }
  });

const formatCliParserError = (error: CliError.ShowHelp) =>
  error.errors.map((nestedError) => nestedError.message).join("\n");

const executableName = (value: string) => {
  const normalized = value.replaceAll("\\", "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
};

const commandArgsFromArgv = (args: ReadonlyArray<string>) => {
  const [first] = args;

  if (first === undefined) {
    return args;
  }

  const firstName = executableName(first);

  if (firstName === "node" || firstName === "node.exe") {
    return args.slice(2);
  }

  if (firstName === "putio" || firstName === "putio.exe" || firstName === "bin.mjs") {
    return args.slice(1);
  }

  return args;
};

type CliCommandEnvironment =
  | Command.Environment
  | CliConfig
  | CliOutput
  | CliRuntime
  | CliSdk
  | CliState;

export function runCli(
  args: ReadonlyArray<string>,
): Effect.Effect<void, unknown, CliCommandEnvironment> {
  const run = Command.runWith(command, {
    version: packageJson.version,
  });

  return Effect.flatMap(CliRuntime, (runtime) => {
    const outputMode = detectOutputModeFromArgv(args, runtime.isInteractiveTerminal);
    const commandArgs = commandArgsFromArgv(args);

    if (!isStructuredOutputMode(outputMode)) {
      return run(commandArgs);
    }

    return Console.consoleWith((currentConsole) => {
      const entries: Array<BufferedConsoleEntry> = [];

      return run(commandArgs).pipe(
        Effect.provideService(Console.Console, makeBufferedConsole(entries)),
        Effect.tap(() => replayBufferedConsole(currentConsole, entries)),
        Effect.catchFilter(
          (error) =>
            CliError.isCliError(error) && error._tag === "ShowHelp"
              ? Result.succeed(error)
              : Result.fail(error),
          (error) => {
            if (error.errors.length === 0) {
              return replayBufferedConsole(currentConsole, entries);
            }

            return Effect.fail(new Error(formatCliParserError(error)));
          },
          (error) => Effect.fail(error),
        ),
      );
    });
  });
}
