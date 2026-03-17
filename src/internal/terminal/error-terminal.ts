import { translate } from "@putdotio/translations";

import { ansi } from "./ansi.js";
import { renderPanel } from "./layout.js";

export type CliTerminalErrorView = {
  readonly title: string;
  readonly message: string;
  readonly hints?: ReadonlyArray<string>;
  readonly meta?: ReadonlyArray<readonly [label: string, value: string]>;
};

export const renderCliErrorTerminal = (value: CliTerminalErrorView) => {
  const lines = [
    ansi.redBold(value.title),
    value.message,
    ...(value.meta?.map(([label, metaValue]) => `${ansi.dim(label)}  ${metaValue}`) ?? []),
    ...((value.hints?.length ?? 0) > 0
      ? [
          "",
          ansi.yellowBold(translate("cli.error.terminal.tryThis")),
          ...(value.hints ?? []).map((hint) => `- ${hint}`),
        ]
      : []),
  ];

  return renderPanel(lines);
};
