import { Command } from "@effect/cli";
import { Effect } from "effect";

import { translate } from "../i18n/index.js";
import {
  fieldsOption,
  getOption,
  outputOption,
  resolveReadOutputControls,
  withAuthedSdk,
  writeReadOutput,
} from "../internal/command.js";
import { fieldsFlag, outputFlag, type CommandSpec } from "../internal/command-specs.js";
import { renderWhoamiTerminal } from "../internal/terminal/whoami-terminal.js";

export const whoamiCommand = Command.make(
  "whoami",
  {
    fields: fieldsOption,
    output: outputOption,
  },
  ({ fields, output }) =>
    Effect.gen(function* () {
      const controls = yield* resolveReadOutputControls({
        fields,
        output: getOption(output),
      });
      const { auth, info } = yield* withAuthedSdk(({ auth, sdk }) =>
        sdk.account.getInfo({}).pipe(
          Effect.map((info) => ({
            auth,
            info,
          })),
        ),
      );

      yield* writeReadOutput({
        command: "whoami",
        output: controls.output,
        outputMode: controls.outputMode,
        renderTerminalValue: renderWhoamiTerminal,
        requestedFields: controls.requestedFields,
        value: {
          auth: {
            source: auth.source,
            apiBaseUrl: auth.apiBaseUrl,
          },
          info,
        },
      });
    }),
);

export const whoamiCommandSpecs = [
  {
    auth: { required: true },
    capabilities: {
      dryRun: false,
      fieldSelection: true,
      rawJsonInput: false,
      streaming: false,
    },
    command: "whoami",
    input: { flags: [fieldsFlag(), outputFlag()] },
    kind: "read",
    purpose: translate("cli.metadata.whoami"),
  },
] satisfies ReadonlyArray<CommandSpec>;
