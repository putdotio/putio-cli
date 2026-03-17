import Table from "cli-table3";

import { truncate } from "./format.js";

const ANSI_ESCAPE_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

export type TerminalColumn<Row> = {
  readonly align?: "left" | "right";
  readonly key: string;
  readonly maxWidth?: number;
  readonly title: string;
  readonly value: (row: Row) => string;
};

export const renderKeyValueBlock = (
  title: string,
  rows: ReadonlyArray<readonly [label: string, value: string]>,
): string => {
  const labelWidth = rows.reduce((width, [label]) => Math.max(width, label.length), 0);

  return [title, ...rows.map(([label, value]) => `${label.padEnd(labelWidth)}  ${value}`)].join(
    "\n",
  );
};

const stripAnsi = (value: string) => value.replace(ANSI_ESCAPE_PATTERN, "");

const padVisible = (value: string, width: number) => {
  const visibleLength = stripAnsi(value).length;

  return `${value}${" ".repeat(Math.max(0, width - visibleLength))}`;
};

export const renderPanel = (
  lines: ReadonlyArray<string>,
  options?: {
    readonly paddingX?: number;
    readonly paddingY?: number;
  },
) => {
  if (lines.length === 0) {
    return "";
  }

  const paddingX = options?.paddingX ?? 1;
  const paddingY = options?.paddingY ?? 0;
  const contentWidth = lines.reduce((width, line) => Math.max(width, stripAnsi(line).length), 0);
  const emptyLine = `│${" ".repeat(contentWidth + paddingX * 2)}│`;
  const renderLine = (line: string) =>
    `│${" ".repeat(paddingX)}${padVisible(line, contentWidth)}${" ".repeat(paddingX)}│`;

  return [
    `┌${"─".repeat(contentWidth + paddingX * 2)}┐`,
    ...Array.from({ length: paddingY }, () => emptyLine),
    ...lines.map(renderLine),
    ...Array.from({ length: paddingY }, () => emptyLine),
    `└${"─".repeat(contentWidth + paddingX * 2)}┘`,
  ].join("\n");
};

export const renderTable = <Row>(
  columns: ReadonlyArray<TerminalColumn<Row>>,
  rows: ReadonlyArray<Row>,
): string => {
  if (rows.length === 0) {
    return "";
  }

  const table = new Table({
    head: columns.map((column) => column.title),
    style: {
      border: [],
      head: [],
      "padding-left": 1,
      "padding-right": 1,
    },
    wordWrap: false,
  });

  for (const row of rows) {
    table.push(
      columns.map((column) => {
        const raw = column.value(row);
        const content = column.maxWidth ? truncate(raw, column.maxWidth) : raw;

        return {
          content,
          hAlign: column.align ?? "left",
        };
      }),
    );
  }

  return table.toString();
};
