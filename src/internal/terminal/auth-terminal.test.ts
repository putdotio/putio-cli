import { describe, expect, it } from "vite-plus/test";

import {
  renderActivationCode,
  renderAuthLoginSuccessTerminal,
  renderAuthLoginTerminal,
} from "./auth-terminal.js";

describe("renderActivationCode", () => {
  it("renders a boxed activation code", () => {
    expect(renderActivationCode("mkiqwo")).toContain("│ M │ K │ I │ Q │ W │ O │");
  });
});

describe("renderAuthLoginTerminal", () => {
  it("renders the signature and activation flow", () => {
    const output = renderAuthLoginTerminal({
      browserOpened: false,
      code: "mkiqwo",
      linkUrl: "https://app.put.io/link",
    });

    expect(output).toContain("put.io");
    expect(output).toContain("┌( ಠ‿ಠ)┘ welcome!");
    expect(output).toContain("https://app.put.io/link");
    expect(output).toContain("press");
    expect(output).toContain("o");
    expect(output).toContain("to open browser");
    expect(output).not.toContain("qr code");
    expect(output).not.toContain("complete login at");
    expect(output).toContain("│ M │ K │ I │ Q │ W │ O │");
  });
});

describe("renderAuthLoginSuccessTerminal", () => {
  it("renders a branded success summary", () => {
    const output = renderAuthLoginSuccessTerminal({
      apiBaseUrl: "https://api.put.io",
      browserOpened: true,
      configPath: "/tmp/putio/config.json",
    });

    expect(output).toContain("authenticated and saved token");
    expect(output).toContain("/tmp/putio/config.json");
  });
});
