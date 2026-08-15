import { installCrashBoundary, type CrashBoundaryOptions } from "./crash-boundary.js";
import {
  loadCrashReportingPreference,
  makeCrashReporter,
  type CrashReportingPreference,
  type SentryAdapter,
} from "./crash-reporting.js";

export const bootstrapCrashReporting = (
  options: {
    readonly boundary?: CrashBoundaryOptions;
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
    preference,
    sentry: options.sentry,
  });
  const remove = installCrashBoundary(reporter, options.boundary);

  return { remove, reporter };
};
