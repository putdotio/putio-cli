import { translate } from "../../i18n/index.js";

import { renderTable, type TerminalColumn } from "./layout.js";

type EventRow = {
  readonly id: number;
  readonly type: string;
  readonly created_at: string;
  readonly file_name?: string;
  readonly transfer_name?: string;
};

export const renderEventsTerminal = (value: { readonly events: ReadonlyArray<EventRow> }) => {
  if (value.events.length === 0) {
    return translate("cli.events.terminal.empty");
  }

  const table = renderTable(
    [
      {
        align: "right",
        key: "id",
        title: translate("cli.common.table.id"),
        value: (event) => String(event.id),
      },
      {
        key: "type",
        title: translate("cli.common.table.type"),
        value: (event) => event.type,
      },
      {
        key: "created_at",
        title: translate("cli.common.table.created"),
        value: (event) => event.created_at,
      },
      {
        key: "resource",
        maxWidth: 48,
        title: translate("cli.common.table.resource"),
        value: (event) =>
          event.file_name ??
          event.transfer_name ??
          translate("cli.events.terminal.resourceFallback"),
      },
    ] satisfies ReadonlyArray<TerminalColumn<EventRow>>,
    value.events,
  );

  return `${translate("cli.events.terminal.summary", { count: value.events.length })}\n\n${table}`;
};
