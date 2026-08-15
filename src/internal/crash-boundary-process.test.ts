import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

const fixture = fileURLToPath(new URL("../test-support/crash-process.mjs", import.meta.url));

describe("crash process boundary", () => {
  it.each([
    ["uncaught_exception", "original uncaught marker"],
    ["unhandled_rejection", "original rejection marker"],
  ])("captures %s once without changing stdout or exit status", (kind, marker) => {
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", fixture, kind, "resolve"],
      { encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.match(new RegExp(`captured:${kind}`, "gu"))).toHaveLength(1);
    expect(result.stderr).toContain(marker);
  });

  it("preserves the original failure when reporting rejects", () => {
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", fixture, "uncaught_exception", "reject"],
      { encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("captured:uncaught_exception");
    expect(result.stderr).toContain("original uncaught marker");
    expect(result.stderr).not.toContain("transport failed");
  });

  it.each(["warn", "none"])(
    "keeps uncaught exceptions fatal with unhandled rejections set to %s",
    (mode) => {
      const result = spawnSync(
        process.execPath,
        ["--experimental-strip-types", fixture, "uncaught_exception", "resolve"],
        {
          encoding: "utf8",
          env: { ...process.env, NODE_OPTIONS: `--unhandled-rejections=${mode}` },
        },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr.match(/captured:uncaught_exception/gu)).toHaveLength(1);
      expect(result.stderr).toContain("original uncaught marker");
      expect(result.stderr).not.toContain("UnhandledPromiseRejectionWarning");
    },
  );

  it.each([
    ["warn", "--unhandled-rejections=warn", 0, true, true],
    ["warn with a quoted value", '--unhandled-rejections="warn"', 0, true, true],
    ["none", "--unhandled-rejections=none", 0, false, false],
    ["none with a quoted value", '--unhandled-rejections="none"', 0, false, false],
    ["warn-with-error-code", "--unhandled-rejections=warn-with-error-code", 1, true, true],
    ["strict", "--unhandled-rejections=strict", 1, true, false],
  ] as const)(
    "preserves unhandled rejection mode %s",
    (_label, nodeOptions, status, rendersMarker, rendersWarning) => {
      const result = spawnSync(
        process.execPath,
        ["--experimental-strip-types", fixture, "unhandled_rejection", "resolve"],
        {
          encoding: "utf8",
          env: { ...process.env, NODE_OPTIONS: nodeOptions },
        },
      );

      expect(result.status).toBe(status);
      expect(result.stdout).toBe("");
      expect(result.stderr.match(/captured:unhandled_rejection/gu)).toHaveLength(1);
      expect(result.stderr.includes("original rejection marker")).toBe(rendersMarker);
      expect(result.stderr.includes("UnhandledPromiseRejectionWarning")).toBe(rendersWarning);
    },
  );
});
