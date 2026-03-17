import { describe, expect, it } from "vitest";

import {
  detectOutputModeFromArgv,
  formatCliError,
  formatCliErrorJson,
  renderJson,
  renderTerminal,
  sanitizeTerminalText,
  sanitizeTerminalValue,
} from "./output-service.js";

describe("sanitizeTerminalValue", () => {
  it("redacts sensitive object keys recursively", () => {
    expect(
      sanitizeTerminalValue({
        auth_token: "secret-token",
        nested: {
          password: "super-secret",
          token: "another-secret",
        },
        safe: "visible",
      }),
    ).toEqual({
      auth_token: "[REDACTED]",
      nested: {
        password: "[REDACTED]",
        token: "[REDACTED]",
      },
      safe: "visible",
    });
  });
});

describe("sanitizeTerminalText", () => {
  it("redacts bearer tokens and token-like assignments", () => {
    expect(
      sanitizeTerminalText(
        'Authorization: Bearer secret-token auth_token="another-secret" password=hunter2',
      ),
    ).toBe('Authorization: Bearer [REDACTED] auth_token="[REDACTED]" password=[REDACTED]');
  });

  it("redacts token query parameters inside URLs", () => {
    expect(
      sanitizeTerminalText(
        "https://api.put.io/v2/files/1/download/file.txt?oauth_token=secret-token&x=1",
      ),
    ).toBe("https://api.put.io/v2/files/1/download/file.txt?oauth_token=[REDACTED]&x=1");
  });
});

describe("renderJson", () => {
  it("renders sanitized json output", () => {
    expect(renderJson({ token: "secret-token", safe: "visible" })).toBe(
      '{\n  "token": "[REDACTED]",\n  "safe": "visible"\n}',
    );
  });

  it("preserves schema sentinel values for sensitive-looking keys", () => {
    expect(renderJson({ persistedConfigShape: { auth_token: "string" } })).toBe(
      '{\n  "persistedConfigShape": {\n    "auth_token": "string"\n  }\n}',
    );
  });

  it("sanitizes token-bearing URLs nested in JSON values", () => {
    expect(
      renderJson({
        links: ["https://api.put.io/v2/files/1/download/file.txt?oauth_token=secret-token"],
      }),
    ).toBe(
      '{\n  "links": [\n    "https://api.put.io/v2/files/1/download/file.txt?oauth_token=[REDACTED]"\n  ]\n}',
    );
  });
});

describe("renderTerminal", () => {
  it("defaults terminal output through the sanitizer", () => {
    expect(
      renderTerminal({ token: "secret-token" }, () => "Authorization: Bearer secret-token"),
    ).toBe("Authorization: Bearer [REDACTED]");
  });
});

describe("detectOutputModeFromArgv", () => {
  it("detects explicit json output via separate flag", () => {
    expect(detectOutputModeFromArgv(["auth", "status", "--output", "json"])).toBe("json");
  });

  it("detects explicit json output via equals syntax", () => {
    expect(detectOutputModeFromArgv(["auth", "status", "--output=json"])).toBe("json");
  });

  it("defaults to terminal output", () => {
    expect(detectOutputModeFromArgv(["auth", "status"])).toBe("terminal");
  });
});

describe("formatCliError", () => {
  it("prefers put.io API error payload messages", () => {
    const output = formatCliError({
      _tag: "PutioApiError",
      body: {
        status_code: 500,
        error_message: "No soup for you.",
      },
      message: "",
    });

    expect(output).toContain("Command failed");
    expect(output).toContain("No soup for you.");
  });

  it("formats rate limit errors with retry information", () => {
    const output = formatCliError({
      _tag: "PutioRateLimitError",
      action: "captcha-needed",
      body: {
        status_code: 429,
        error_message: "Too many requests.",
      },
      id: "rl_123",
      limit: "10",
      remaining: "0",
      reset: "1773496255",
      retryAfter: "42",
    });

    expect(output).toContain("Rate limited");
    expect(output).toContain("Wait about 42s and try again.");
    expect(output).toContain("reset at");
    expect(output).toContain("2026-03-14 13:50:55 UTC");
    expect(output).toContain("action");
    expect(output).toContain("captcha-needed");
    expect(output).toContain("rate limit id");
    expect(output).toContain("rl_123");
    expect(output).toContain("https://app.put.io/captcha/rl_123");
    expect(output).toContain("retry after");
    expect(output).toContain("42s");
    expect(output).toContain("Try this");
  });

  it("falls back to a generic message when nothing usable is present", () => {
    const output = formatCliError({ message: "" });

    expect(output).toContain("Command failed");
    expect(output).toContain("Command failed.");
  });

  it("renders auth recovery guidance", () => {
    const output = formatCliError({
      _tag: "PutioAuthError",
      body: {
        status_code: 401,
        error_message: "invalid access token",
      },
    });

    expect(output).toContain("Authentication failed");
    expect(output).toContain("putio auth login");
  });
});

describe("formatCliErrorJson", () => {
  it("renders localized errors as structured json", () => {
    const output = formatCliErrorJson({
      _tag: "PutioAuthError",
      body: {
        status_code: 401,
        error_message: "invalid access token",
      },
    });

    expect(output).toContain('"title": "Authentication failed"');
    expect(output).toContain('"type": "instruction"');
    expect(output).toContain('"Run `putio auth login` to sign in again."');
  });
});
