import { installCrashBoundary, type CrashBoundaryOptions } from "./crash-boundary.js";
import {
  loadCrashReportingPreference,
  makeCrashReporter,
  type CrashReportingPreference,
  type SentryAdapter,
} from "./crash-reporting.js";
import type { CrashReportingConfig } from "./crash-reporting-config.js";

export const bootstrapCrashReporting = (
  options: {
    readonly boundary?: CrashBoundaryOptions;
    readonly config?: CrashReportingConfig;
    readonly loadPreference?: () => CrashReportingPreference;
    readonly sentry?: SentryAdapter;
  } = {},
) => {
  let preference: CrashReportingPreference;
  try {
    preference = (options.loadPreference ?? loadCrashReportingPreference)();
  } catch {
    preference = { disabled: true, reason: "configuration_unavailable" };
  }

  const reporter = makeCrashReporter({
    config: options.config,
    preference,
    sentry: options.sentry,
  });
  const remove = installCrashBoundary(reporter, options.boundary);

  return { remove, reporter };
};
