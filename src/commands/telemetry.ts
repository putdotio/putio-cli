import { Command } from "effect/unstable/cli";
import { Effect } from "effect";

import { translate } from "../i18n/index.js";
import { getOption, outputOption } from "../internal/command.js";
import { outputFlag, type CommandSpec } from "../internal/command-specs.js";
import { writeOutput } from "../internal/output-service.js";
import { getTelemetryStatus, setTelemetryEnabled } from "../internal/state.js";

type TelemetryStatus = {
  readonly configPath: string;
  readonly enabled: boolean;
};

const renderTelemetryStatus = (status: TelemetryStatus) =>
  [
    status.enabled
      ? translate("cli.telemetry.status.enabled")
      : translate("cli.telemetry.status.disabled"),
    translate("cli.telemetry.status.configPath", { value: status.configPath }),
  ].join("\n");

const telemetryStatus = Command.make("status", { output: outputOption }, ({ output }) =>
  Effect.flatMap(getTelemetryStatus(), (status) =>
    writeOutput(status, getOption(output), renderTelemetryStatus),
  ),
);

const telemetryDisable = Command.make("disable", { output: outputOption }, ({ output }) =>
  Effect.flatMap(setTelemetryEnabled(false), (status) =>
    writeOutput(status, getOption(output), renderTelemetryStatus),
  ),
);

const telemetryEnable = Command.make("enable", { output: outputOption }, ({ output }) =>
  Effect.flatMap(setTelemetryEnabled(true), (status) =>
    writeOutput(status, getOption(output), renderTelemetryStatus),
  ),
);

export const telemetryCommand = Command.make("telemetry", {}, () => Effect.void).pipe(
  Command.withSubcommands([telemetryStatus, telemetryDisable, telemetryEnable]),
);

export const telemetryCommandSpecs = [
  {
    auth: { required: false },
    capabilities: {
      dryRun: false,
      fieldSelection: false,
      rawJsonInput: false,
      streaming: false,
    },
    command: "telemetry status",
    input: { flags: [outputFlag()] },
    kind: "utility",
    purpose: translate("cli.metadata.telemetryStatus"),
  },
  {
    auth: { required: false },
    capabilities: {
      dryRun: false,
      fieldSelection: false,
      rawJsonInput: false,
      streaming: false,
    },
    command: "telemetry disable",
    input: { flags: [outputFlag()] },
    kind: "utility",
    purpose: translate("cli.metadata.telemetryDisable"),
  },
  {
    auth: { required: false },
    capabilities: {
      dryRun: false,
      fieldSelection: false,
      rawJsonInput: false,
      streaming: false,
    },
    command: "telemetry enable",
    input: { flags: [outputFlag()] },
    kind: "utility",
    purpose: translate("cli.metadata.telemetryEnable"),
  },
] satisfies ReadonlyArray<CommandSpec>;
