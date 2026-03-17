import type { AccountInfoBroad } from "@putdotio/sdk";

import { translate } from "../../i18n/index.js";
import { formatNullable, humanFileSize } from "./format.js";
import { renderKeyValueBlock } from "./layout.js";

export const renderWhoamiTerminal = (value: {
  readonly auth: {
    readonly source: string;
    readonly apiBaseUrl: string;
  };
  readonly info: AccountInfoBroad;
}) =>
  [
    renderKeyValueBlock(translate("cli.whoami.terminal.account"), [
      [translate("cli.whoami.terminal.username"), value.info.username],
      [translate("cli.whoami.terminal.email"), value.info.mail],
      [translate("cli.whoami.terminal.status"), value.info.account_status],
      [
        translate("cli.whoami.terminal.subAccount"),
        value.info.is_sub_account ? translate("cli.common.yes") : translate("cli.common.no"),
      ],
      [translate("cli.whoami.terminal.familyOwner"), formatNullable(value.info.family_owner)],
    ]),
    renderKeyValueBlock(translate("cli.whoami.terminal.storage"), [
      [translate("cli.whoami.terminal.used"), humanFileSize(value.info.disk.used)],
      [translate("cli.whoami.terminal.available"), humanFileSize(value.info.disk.avail)],
      [translate("cli.whoami.terminal.total"), humanFileSize(value.info.disk.size)],
      [translate("cli.whoami.terminal.trash"), humanFileSize(value.info.trash_size)],
    ]),
    renderKeyValueBlock(translate("cli.whoami.terminal.auth"), [
      [translate("cli.whoami.terminal.source"), value.auth.source],
      [translate("cli.whoami.terminal.apiBaseUrl"), value.auth.apiBaseUrl],
      [
        translate("cli.whoami.terminal.twoFactor"),
        value.info.settings.two_factor_enabled
          ? translate("cli.whoami.terminal.enabled")
          : translate("cli.whoami.terminal.disabled"),
      ],
      [translate("cli.whoami.terminal.theme"), value.info.settings.theme],
    ]),
  ].join("\n\n");
