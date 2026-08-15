import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { bootstrapCrashReporting } from "./crash-bootstrap.js";
import type { CrashBoundaryRuntime } from "./crash-boundary.js";
import type { SentryAdapter } from "./crash-reporting.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("bootstrapCrashReporting", () => {
  it("does not initialize Sentry or install handlers after a persisted opt-out", async () => {
    const configDirectory = await mkdtemp(join(tmpdir(), "putio-cli-crash-bootstrap-"));
    const configPath = join(configDirectory, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({ api_base_url: "https://api.put.io", telemetry_disabled: true }),
      "utf8",
    );
    vi.stubEnv("PUTIO_CLI_CONFIG_PATH", configPath);

    const runtime: CrashBoundaryRuntime = {
      addUncaughtExceptionHandler: vi.fn(),
      addUnhandledRejectionHandler: vi.fn(),
      removeUncaughtExceptionHandler: vi.fn(),
      removeUnhandledRejectionHandler: vi.fn(),
    };
    const sentry: SentryAdapter = {
      captureEvent: vi.fn(() => "event-id"),
      flush: vi.fn(() => Promise.resolve(true)),
      init: vi.fn(),
    };

    const { reporter } = bootstrapCrashReporting({ boundary: { runtime }, sentry });

    expect(reporter.decision).toEqual({ enabled: false, reason: "persisted_opt_out" });
    expect(sentry.init).not.toHaveBeenCalled();
    expect(runtime.addUncaughtExceptionHandler).not.toHaveBeenCalled();
    expect(runtime.addUnhandledRejectionHandler).not.toHaveBeenCalled();
  });

  it("fails closed when preference resolution throws", () => {
    const runtime: CrashBoundaryRuntime = {
      addUncaughtExceptionHandler: vi.fn(),
      addUnhandledRejectionHandler: vi.fn(),
      removeUncaughtExceptionHandler: vi.fn(),
      removeUnhandledRejectionHandler: vi.fn(),
    };
    const sentry: SentryAdapter = {
      captureEvent: vi.fn(() => "event-id"),
      flush: vi.fn(() => Promise.resolve(true)),
      init: vi.fn(),
    };

    const { reporter } = bootstrapCrashReporting({
      boundary: { runtime },
      loadPreference: () => {
        throw new Error("home directory unavailable");
      },
      sentry,
    });

    expect(reporter.decision).toEqual({ enabled: false, reason: "configuration_unavailable" });
    expect(sentry.init).not.toHaveBeenCalled();
    expect(runtime.addUncaughtExceptionHandler).not.toHaveBeenCalled();
    expect(runtime.addUnhandledRejectionHandler).not.toHaveBeenCalled();
  });
});
