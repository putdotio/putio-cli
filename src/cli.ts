import { CliError, Command } from "effect/cli";
import { Console, Effect, Predicate, Result, type Scope } from "effect";
import packageJson from "../package.json";

import { authCommand } from "./commands/auth.js";
import { brandCommand, versionCommand } from "./commands/brand.js";
import { downloadLinksCommand } from "./commands/download-links.js";
import { eventsCommand } from "./commands/events.js";
import { filesCommand, searchCommand } from "./commands/files.js";
import { sdkCommand } from "./commands/sdk.js";
import { translate } from "./i18n/index.js";
import type { CliConfig } from "./internal/config.js";
import { transfersCommand } from "./commands/transfers.js";
import { telemetryCommand } from "./commands/telemetry.js";
import { whoamiCommand } from "./commands/whoami.js";
import { describeCli } from "./internal/metadata.js";
import { CliCrashReporter } from "./internal/crash-reporting.js";
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

const describeCommand = Command.make("describe", { output: outputOption }, ({ output }) =>
  Effect.gen(function* () {
    const crashReporter = yield* CliCrashReporter;
    yield* writeOutput(describeCli(crashReporter.decision), getOption(output), renderJson);
  }),
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
    sdkCommand,
    telemetryCommand,
    transfersCommand,
  ]),
);

type BufferedConsoleEntry = (console: Console.Console) => void;

const makeBufferedConsole = (entries: Array<BufferedConsoleEntry>): Console.Console => ({
  assert: (condition, ...args) => entries.push((console) => console.assert(condition, ...args)),
  clear: () => entries.push((console) => console.clear()),
  count: (label) =>
    entries.push((console) => (label === undefined ? console.count() : console.count(label))),
  countReset: (label) =>
    entries.push((console) =>
      label === undefined ? console.countReset() : console.countReset(label),
    ),
  debug: (...args) => entries.push((console) => console.debug(...args)),
  dir: (item, options) =>
    entries.push((console) =>
      options === undefined ? console.dir(item) : console.dir(item, options),
    ),
  dirxml: (...args) => entries.push((console) => console.dirxml(...args)),
  error: (...args) => entries.push((console) => console.error(...args)),
  group: (...args) => entries.push((console) => console.group(...args)),
  groupCollapsed: (...args) => entries.push((console) => console.groupCollapsed(...args)),
  groupEnd: () => entries.push((console) => console.groupEnd()),
  info: (...args) => entries.push((console) => console.info(...args)),
  log: (...args) => entries.push((console) => console.log(...args)),
  table: (tabularData, properties) =>
    entries.push((console) =>
      properties === undefined
        ? console.table(tabularData)
        : console.table(tabularData, properties),
    ),
  time: (label) =>
    entries.push((console) => (label === undefined ? console.time() : console.time(label))),
  timeEnd: (label) =>
    entries.push((console) => (label === undefined ? console.timeEnd() : console.timeEnd(label))),
  timeLog: (label, ...args) =>
    entries.push((console) =>
      label === undefined ? console.timeLog(...args) : console.timeLog(label, ...args),
    ),
  trace: (...args) => entries.push((console) => console.trace(...args)),
  warn: (...args) => entries.push((console) => console.warn(...args)),
});

const replayBufferedConsole = (
  console: Console.Console,
  entries: ReadonlyArray<BufferedConsoleEntry>,
) =>
  Effect.sync(() => {
    for (const replay of entries) {
      replay(console);
    }
  });

const formatCliParserError = (error: CliError.ShowHelp) =>
  error.errors.map((nestedError) => nestedError.message).join("\n");

const executableName = (value: string) => {
  const normalized = value.replaceAll("\\", "/");

  return normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
};

const isNodeExecutable = (value: string) => {
  const name = executableName(value);

  return name === "node" || name === "node.exe";
};

const isPutioExecutable = (value: string) => {
  const name = executableName(value);

  return name === "putio" || name === "putio.exe" || name === "bin.mjs";
};

const stripLeadingPutioExecutables = (args: ReadonlyArray<string>) => {
  let start = 0;

  while (isPutioExecutable(args[start] ?? "")) {
    start++;
  }

  return args.slice(start);
};

const RUNTIME_ARGV_PREFIX_LENGTH = 2;

const commandArgsFromArgv = (args: ReadonlyArray<string>, isSingleExecutable: boolean) => {
  const [first] = args;

  if (first === undefined) {
    return args;
  }

  if (isSingleExecutable || isNodeExecutable(first)) {
    return stripLeadingPutioExecutables(args.slice(RUNTIME_ARGV_PREFIX_LENGTH));
  }

  return stripLeadingPutioExecutables(args);
};

type CliCommandEnvironment =
  | Command.Environment
  | CliConfig
  | CliCrashReporter
  | CliOutput
  | CliRuntime
  | CliSdk
  | CliState
  | Scope.Scope;

export const runCli: (
  args: ReadonlyArray<string>,
) => Effect.Effect<void, unknown, CliCommandEnvironment> = Effect.fn("putio.cli.run")(function* (
  args: ReadonlyArray<string>,
) {
  const run = Command.runWith(command, {
    version: packageJson.version,
  });

  const runtime = yield* CliRuntime;
  const outputMode = detectOutputModeFromArgv(args, runtime.isInteractiveTerminal);
  const commandArgs = commandArgsFromArgv(args, runtime.isSingleExecutable);

  yield* Effect.annotateCurrentSpan({
    "cli.command": commandArgs[0] ?? "root",
    "cli.output_mode": outputMode,
  });

  if (!isStructuredOutputMode(outputMode)) {
    return yield* run(commandArgs);
  }

  return yield* Console.consoleWith((currentConsole) => {
    const entries: Array<BufferedConsoleEntry> = [];

    return run(commandArgs).pipe(
      Effect.provideService(Console.Console, makeBufferedConsole(entries)),
      Effect.tap(() => replayBufferedConsole(currentConsole, entries)),
      Effect.catchFilter(
        (error) =>
          CliError.isCliError(error) && Predicate.isTagged(error, "ShowHelp")
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
