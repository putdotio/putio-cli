import { describe, expect, it } from "vite-plus/test";

import { renderCliErrorTerminal } from "./error-terminal.js";

describe("renderCliErrorTerminal", () => {
  it("renders a titled error panel with hints", () => {
    const output = renderCliErrorTerminal({
      title: "rate limited",
      message: "Too many requests.",
      hints: ["Wait a moment and retry.", "Avoid repeating auth login rapidly."],
      meta: [["retry after", "42s"]],
    });

    expect(output).toContain("rate limited");
    expect(output).toContain("Too many requests.");
    expect(output).toContain("retry after");
    expect(output).toContain("Try this");
    expect(output).toContain("Wait a moment and retry.");
  });
});
