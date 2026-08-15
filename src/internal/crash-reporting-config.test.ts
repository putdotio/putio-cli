import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  CRASH_REPORTING_DSN_DEFINE,
  CRASH_REPORTING_DSN_ENV,
  CRASH_REPORTING_DSN_REQUIRED_ENV,
  decodeCrashReportingConfig,
  loadCrashReportingConfig,
  makeCrashReportingBuildDefines,
} from "./crash-reporting-config.js";

const TEST_DSN = "https://0123456789abcdef0123456789abcdef@o1.ingest.us.sentry.io/123";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("crash-reporting build configuration", () => {
  it("decodes an HTTPS Sentry DSN through Schema", () => {
    expect(decodeCrashReportingConfig(TEST_DSN)).toEqual({ dsn: TEST_DSN });
  });

  it.each([
    undefined,
    "",
    "not-a-url",
    "http://public-key@o1.ingest.us.sentry.io/123",
    "https://o1.ingest.us.sentry.io/123",
    "https://public-key@o1.ingest.us.sentry.io/project",
  ])("rejects missing or invalid runtime build configuration", (input) => {
    expect(decodeCrashReportingConfig(input)).toBeUndefined();
  });

  it("injects the validated DSN as a build constant", () => {
    expect(makeCrashReportingBuildDefines({ [CRASH_REPORTING_DSN_ENV]: TEST_DSN })).toEqual({
      [CRASH_REPORTING_DSN_DEFINE]: JSON.stringify(TEST_DSN),
    });
  });

  it("allows secret-free local builds while disabling their reporter", () => {
    vi.stubEnv(CRASH_REPORTING_DSN_ENV, "");

    expect(makeCrashReportingBuildDefines({})).toEqual({
      [CRASH_REPORTING_DSN_DEFINE]: JSON.stringify(""),
    });
    expect(loadCrashReportingConfig()).toBeUndefined();
  });

  it("fails release builds without a valid DSN", () => {
    expect(() =>
      makeCrashReportingBuildDefines({ [CRASH_REPORTING_DSN_REQUIRED_ENV]: "true" }),
    ).toThrow(`${CRASH_REPORTING_DSN_ENV} is required for release builds.`);
    expect(() =>
      makeCrashReportingBuildDefines({ [CRASH_REPORTING_DSN_ENV]: "not-a-dsn" }),
    ).toThrow(`${CRASH_REPORTING_DSN_ENV} must be a valid HTTPS Sentry DSN.`);
  });
});
