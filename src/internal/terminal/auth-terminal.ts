import { translate } from "@putdotio/translations";

import { ansi } from "./ansi.js";
import { renderPutioSignature } from "./brand.js";
import { renderPanel } from "./layout.js";

const joinSegments = (
  left: string,
  middle: string,
  right: string,
  segments: ReadonlyArray<string>,
) => {
  if (segments.length === 0) {
    return "";
  }

  return `${left}${segments.join(middle)}${right}`;
};

export const renderActivationCode = (code: string) => {
  const cells = code
    .trim()
    .split("")
    .map((character) => ` ${character.toUpperCase()} `);

  return [
    joinSegments(
      "┌",
      "┬",
      "┐",
      cells.map(() => "───"),
    ),
    `│${cells.join("│")}│`,
    joinSegments(
      "└",
      "┴",
      "┘",
      cells.map(() => "───"),
    ),
  ].join("\n");
};

const renderAuthTitle = () => ansi.bold(translate("cli.auth.login.title"));

const renderShortcutLine = (message: string, key: string) => {
  const parts = message.split(key);

  if (parts.length < 2) {
    return ansi.dim(message);
  }

  return `${ansi.dim(parts[0] ?? "")}${ansi.yellowBold(key)}${ansi.dim(parts.slice(1).join(key))}`;
};

const renderAuthActions = (value: { readonly browserOpened: boolean; readonly linkUrl: string }) =>
  [
    ansi.yellowBold(value.linkUrl),
    value.browserOpened
      ? ansi.dim(translate("cli.auth.login.autoOpened"))
      : renderShortcutLine(translate("cli.auth.login.openShortcut", { key: "o" }), "o"),
    renderShortcutLine(translate("cli.auth.login.cancelShortcut", { key: "Ctrl+C" }), "Ctrl+C"),
  ].join("\n");

export const renderAuthLoginTerminal = (value: {
  readonly browserOpened: boolean;
  readonly code: string;
  readonly linkUrl: string;
}) =>
  [
    renderPutioSignature(),
    renderAuthTitle(),
    [ansi.dim(translate("cli.auth.login.activationCode")), renderActivationCode(value.code)].join(
      "\n",
    ),
    renderAuthActions(value),
  ].join("\n\n");

export const renderAuthLoginSuccessTerminal = (value: {
  readonly apiBaseUrl: string;
  readonly browserOpened: boolean;
  readonly configPath: string;
}) =>
  [
    renderPutioSignature(),
    renderPanel(
      [
        ansi.bold(translate("cli.auth.success.savedToken")),
        translate("cli.auth.success.apiBaseUrl", { value: value.apiBaseUrl }),
        translate("cli.auth.success.configPath", { value: value.configPath }),
        translate("cli.auth.success.browserOpened", {
          value: value.browserOpened ? translate("cli.common.yes") : translate("cli.common.no"),
        }),
      ],
      {
        paddingX: 2,
        paddingY: 1,
      },
    ),
  ].join("\n\n");
