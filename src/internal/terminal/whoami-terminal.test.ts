import { describe, expect, it } from "vitest";

import { renderWhoamiTerminal } from "./whoami-terminal.js";

describe("renderWhoamiTerminal", () => {
  it("renders grouped account sections", () => {
    expect(
      renderWhoamiTerminal({
        auth: {
          source: "env",
          apiBaseUrl: "https://api.put.io",
        },
        info: {
          username: "putio-user",
          mail: "user@example.com",
          account_status: "active",
          is_sub_account: false,
          family_owner: null,
          disk: {
            avail: 1024,
            size: 2048,
            used: 1024,
          },
          trash_size: 0,
          settings: {
            two_factor_enabled: true,
            theme: "auto",
          },
        },
      } as never),
    ).toContain("Account");
  });
});
