import { translate } from "../../i18n/index.js";

import { formatPercent } from "./format.js";
import { renderTable, type TerminalColumn } from "./layout.js";

type TransferRow = {
  readonly id: number;
  readonly status: string;
  readonly percent_done: number | null;
  readonly name: string;
};

export const renderTransfersTerminal = (value: {
  readonly transfers: ReadonlyArray<TransferRow>;
}) => {
  if (value.transfers.length === 0) {
    return translate("cli.transfers.terminal.empty");
  }

  const table = renderTable(
    [
      {
        align: "right",
        key: "id",
        title: translate("cli.common.table.id"),
        value: (transfer) => String(transfer.id),
      },
      {
        key: "status",
        title: translate("cli.common.table.status"),
        value: (transfer) => transfer.status,
      },
      {
        align: "right",
        key: "done",
        title: translate("cli.transfers.terminal.table.done"),
        value: (transfer) => formatPercent(transfer.percent_done),
      },
      {
        key: "name",
        maxWidth: 48,
        title: translate("cli.common.table.name"),
        value: (transfer) => transfer.name,
      },
    ] satisfies ReadonlyArray<TerminalColumn<TransferRow>>,
    value.transfers,
  );

  return `${translate("cli.transfers.terminal.summary", { count: value.transfers.length })}\n\n${table}`;
};
