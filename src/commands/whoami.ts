import { Command } from "@effect/cli";
import { Effect } from "effect";

import { getOption, outputOption, withAuthedSdk } from "../internal/command.js";
import { writeOutput } from "../internal/output-service.js";
import { renderWhoamiTerminal } from "../internal/terminal/whoami-terminal.js";

export const whoamiCommand = Command.make("whoami", { output: outputOption }, ({ output }) =>
  Effect.gen(function* () {
    const { auth, info } = yield* withAuthedSdk(({ auth, sdk }) =>
      sdk.account.getInfo({}).pipe(
        Effect.map((info) => ({
          auth,
          info,
        })),
      ),
    );

    yield* writeOutput(
      {
        auth: {
          source: auth.source,
          apiBaseUrl: auth.apiBaseUrl,
        },
        info,
      },
      getOption(output),
      renderWhoamiTerminal,
    );
  }),
);
