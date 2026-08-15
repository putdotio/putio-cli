import { Option, Schema } from "effect";

export const CRASH_REPORTING_DSN_ENV = "PUTIO_CLI_SENTRY_DSN";
export const CRASH_REPORTING_DSN_REQUIRED_ENV = "PUTIO_CLI_REQUIRE_SENTRY_DSN";
export const CRASH_REPORTING_DSN_DEFINE = `process.env.${CRASH_REPORTING_DSN_ENV}`;

const SentryDsnSchema = Schema.URLFromString.check(
  Schema.makeFilter(
    (url) => url.protocol === "https:" && url.username.length > 0 && /^\/\d+$/u.test(url.pathname),
    { expected: "an HTTPS Sentry DSN with a public key and numeric project ID" },
  ),
);

export type CrashReportingConfig = {
  readonly dsn: string;
};

const decodeSentryDsn = Schema.decodeUnknownOption(SentryDsnSchema);

export const decodeCrashReportingConfig = (input: unknown): CrashReportingConfig | undefined => {
  const dsn = Option.getOrUndefined(decodeSentryDsn(input));
  return dsn === undefined ? undefined : { dsn: dsn.toString() };
};

export const loadCrashReportingConfig = (): CrashReportingConfig | undefined =>
  decodeCrashReportingConfig(process.env.PUTIO_CLI_SENTRY_DSN);

export const makeCrashReportingBuildDefines = (
  environment: Readonly<Record<string, string | undefined>>,
) => {
  const rawDsn = environment[CRASH_REPORTING_DSN_ENV]?.trim();
  const config =
    rawDsn === undefined || rawDsn.length === 0 ? undefined : decodeCrashReportingConfig(rawDsn);

  if (rawDsn !== undefined && rawDsn.length > 0 && config === undefined) {
    throw new Error(`${CRASH_REPORTING_DSN_ENV} must be a valid HTTPS Sentry DSN.`);
  }
  if (environment[CRASH_REPORTING_DSN_REQUIRED_ENV] === "true" && config === undefined) {
    throw new Error(`${CRASH_REPORTING_DSN_ENV} is required for release builds.`);
  }

  return {
    [CRASH_REPORTING_DSN_DEFINE]: JSON.stringify(config?.dsn ?? ""),
  };
};
