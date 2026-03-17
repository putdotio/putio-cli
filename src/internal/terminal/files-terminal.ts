import { translate } from "../../i18n/index.js";

import { humanFileSize } from "./format.js";
import { renderTable, type TerminalColumn } from "./layout.js";

type FileRow = {
  readonly id: number;
  readonly file_type: string;
  readonly size: number;
  readonly name: string;
};

type FilesTextInput = {
  readonly files: ReadonlyArray<FileRow>;
  readonly total?: number;
  readonly parent?: {
    readonly name: string;
  } | null;
};

export const renderFilesTerminal = <T extends FilesTextInput>(value: T) => {
  if (value.files.length === 0) {
    return value.parent?.name
      ? translate("cli.files.terminal.emptyInParent", { name: value.parent.name })
      : translate("cli.files.terminal.empty");
  }

  const totalSuffix =
    typeof value.total === "number"
      ? translate("cli.files.terminal.totalSuffix", { total: value.total })
      : "";
  const summary = value.parent?.name
    ? translate("cli.files.terminal.summaryInParent", {
        count: value.files.length,
        name: value.parent.name,
        totalSuffix,
      })
    : translate("cli.files.terminal.summary", {
        count: value.files.length,
        totalSuffix,
      });

  const table = renderTable(
    [
      {
        align: "right",
        key: "id",
        title: translate("cli.common.table.id"),
        value: (file) => String(file.id),
      },
      {
        key: "type",
        title: translate("cli.common.table.type"),
        value: (file) => file.file_type,
      },
      {
        align: "right",
        key: "size",
        title: translate("cli.common.table.size"),
        value: (file) => humanFileSize(file.size),
      },
      {
        key: "name",
        maxWidth: 48,
        title: translate("cli.common.table.name"),
        value: (file) => file.name,
      },
    ] satisfies ReadonlyArray<TerminalColumn<FileRow>>,
    value.files,
  );

  return `${summary}\n\n${table}`;
};
