import { Command } from "@effect/cli";
import { Effect } from "effect";

import {
  fieldsOption,
  getOption,
  outputOption,
  resolveReadOutputControls,
  withAuthedSdk,
  writeReadOutput,
} from "../internal/command.js";
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
