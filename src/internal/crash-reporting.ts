import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import * as Sentry from "@sentry/core";
import { Context } from "effect";
import packageJson from "../../package.json";

import { buildConfigPath } from "./config.js";
import { ENV_CLI_CONFIG_PATH, ENV_XDG_CONFIG_HOME } from "./env.js";
import { parsePersistedConfig } from "./state.js";

export const CRASH_REPORTING_FLUSH_TIMEOUT_MS = 250;
const CRASH_REPORTING_REQUEST_TIMEOUT_MS = 200;

const SENTRY_DSN =
  "https://50cfbc1da5d6ee5c7665a2f10ec3d08f@o804.ingest.us.sentry.io/4511913835495424";
const SENTRY_ENVIRONMENT = "production";
const SENTRY_RELEASE = `@putdotio/cli@${packageJson.version}`;
const SENTRY_MESSAGE = "Unexpected CLI failure";

export type CrashKind = "effect_defect" | "uncaught_exception" | "unhandled_rejection";
type CrashReportingDisabledReason =
  | "configuration_unavailable"
  | "initialization_failed"
  | "persisted_opt_out";

export type CrashReportingPreference =
  | { readonly disabled: false }
  | {
      readonly disabled: true;
      readonly reason: "configuration_unavailable" | "persisted_opt_out";
    };

export type CrashReportingDecision =
  | { readonly enabled: true }
  | { readonly enabled: false; readonly reason: CrashReportingDisabledReason };

export type CrashReporterService = {
  readonly decision: CrashReportingDecision;
  readonly capture: (kind: CrashKind) => Promise<void>;
};

type CrashSentryOptions = {
  readonly beforeSend: (event: Sentry.Event) => Sentry.Event;
  readonly dsn: string;
  readonly environment: string;
  readonly release: string;
  readonly sanitizeEnvelope: (body: string | Uint8Array) => string | Uint8Array | undefined;
};

export type SentryAdapter = {
  readonly captureEvent: typeof Sentry.captureEvent;
  readonly flush: typeof Sentry.flush;
  readonly init: (options: CrashSentryOptions) => void;
};

type CrashFetch = (url: string, init: RequestInit) => Promise<Response>;

export const sendCrashRequest = async (
  options: Sentry.BaseTransportOptions,
  body: string | Uint8Array,
  request: CrashFetch = fetch,
) => {
  const response = await request(options.url, {
    body,
    headers: options.headers,
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(CRASH_REPORTING_REQUEST_TIMEOUT_MS),
  });

  return {
    headers: {
      "retry-after": response.headers.get("retry-after"),
      "x-sentry-rate-limits": response.headers.get("x-sentry-rate-limits"),
    },
    statusCode: response.status,
  };
};

const makeFetchTransport = (
  options: Sentry.BaseTransportOptions,
  sanitizeEnvelope: CrashSentryOptions["sanitizeEnvelope"],
) =>
  Sentry.createTransport(options, ({ body }) => {
    const sanitizedBody = sanitizeEnvelope(body);
    return sanitizedBody === undefined
      ? Promise.reject(new Error("Crash-reporting envelope rejected."))
      : sendCrashRequest(options, sanitizedBody);
  });

const sentryAdapter: SentryAdapter = {
  captureEvent: Sentry.captureEvent,
  flush: Sentry.flush,
  init: ({ sanitizeEnvelope, ...options }) => {
    Sentry.initAndBind(Sentry.ServerRuntimeClient, {
      ...options,
      attachStacktrace: false,
      includeServerName: false,
      integrations: [],
      maxBreadcrumbs: 0,
      platform: "node",
      sendClientReports: false,
      stackParser: () => [],
      transport: (transportOptions) => makeFetchTransport(transportOptions, sanitizeEnvelope),
    });
  },
};

const optionalTrimmedValue = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

export const loadCrashReportingPreference = (
  options: {
    readonly environment?: Readonly<Record<string, string | undefined>>;
    readonly homePath?: string;
    readonly readConfig?: (path: string) => string;
  } = {},
): CrashReportingPreference => {
  const environment = options.environment ?? process.env;
  const configPath = buildConfigPath({
    explicitConfigPath: optionalTrimmedValue(environment[ENV_CLI_CONFIG_PATH]),
    homePath: options.homePath ?? homedir(),
    joinPath: join,
    xdgConfigHome: optionalTrimmedValue(environment[ENV_XDG_CONFIG_HOME]),
  });

  let rawConfig: string;
  try {
    rawConfig = (options.readConfig ?? ((path) => readFileSync(path, "utf8")))(configPath);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT"
      ? { disabled: false }
      : { disabled: true, reason: "configuration_unavailable" };
  }

  try {
    const config = parsePersistedConfig(rawConfig);
    return config.telemetry_disabled === true
      ? { disabled: true, reason: "persisted_opt_out" }
      : { disabled: false };
  } catch {
    return { disabled: true, reason: "configuration_unavailable" };
  }
};

export const resolveCrashReporting = (
  preference: CrashReportingPreference = { disabled: false },
): CrashReportingDecision =>
  preference.disabled ? { enabled: false, reason: preference.reason } : { enabled: true };

export const sanitizeCrashEvent = (event: Sentry.Event, kind: CrashKind): Sentry.Event => ({
  environment: SENTRY_ENVIRONMENT,
  event_id: event.event_id,
  fingerprint: [SENTRY_MESSAGE, kind],
  level: "fatal",
  logger: "putio-cli.crash-reporting",
  message: SENTRY_MESSAGE,
  platform: "node",
  release: SENTRY_RELEASE,
  tags: {
    component: "cli",
    failure_kind: kind,
  },
  timestamp: event.timestamp,
});

const isCrashKind = (value: unknown): value is CrashKind =>
  value === "effect_defect" || value === "uncaught_exception" || value === "unhandled_rejection";

const hasProperty = <Key extends PropertyKey>(
  value: object,
  key: Key,
): value is Record<Key, unknown> => key in value;

const getEnvelopeCrashKind = (event: unknown) => {
  if (
    typeof event !== "object" ||
    event === null ||
    !hasProperty(event, "tags") ||
    typeof event.tags !== "object" ||
    event.tags === null ||
    !hasProperty(event.tags, "failure_kind")
  ) {
    return undefined;
  }

  return isCrashKind(event.tags.failure_kind) ? event.tags.failure_kind : undefined;
};

export const sanitizeCrashEnvelope = (
  body: string | Uint8Array,
  expected: {
    readonly eventId: string;
    readonly kind: CrashKind;
    readonly timestamp: number;
  },
): string | Uint8Array | undefined => {
  try {
    const [headers, items] = Sentry.parseEnvelope(body);
    const item = items.length === 1 ? items[0] : undefined;
    if (
      headers.event_id !== expected.eventId ||
      item?.[0].type !== "event" ||
      typeof item[1] !== "object" ||
      item[1] === null ||
      !hasProperty(item[1], "event_id") ||
      item[1].event_id !== expected.eventId ||
      getEnvelopeCrashKind(item[1]) !== expected.kind
    ) {
      return undefined;
    }

    const event = sanitizeCrashEvent(
      { event_id: expected.eventId, timestamp: expected.timestamp },
      expected.kind,
    );
    return Sentry.serializeEnvelope(
      Sentry.createEnvelope<Sentry.EventEnvelope>(
        {
          event_id: expected.eventId,
          sent_at: new Date(expected.timestamp * 1_000).toISOString(),
        },
        [[{ type: "event" }, event]],
      ),
    );
  } catch {
    return undefined;
  }
};

const waitForFlush = async (flush: () => Promise<boolean>) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      flush(),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, CRASH_REPORTING_FLUSH_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Reporting is best-effort and must never replace the command failure.
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
};

const disabledReporter = (reason: CrashReportingDisabledReason): CrashReporterService => ({
  capture: () => Promise.resolve(),
  decision: { enabled: false, reason },
});

export const makeCrashReporter = (
  options: {
    readonly createEventIdentity?: () => { readonly eventId: string; readonly timestamp: number };
    readonly preference?: CrashReportingPreference;
    readonly sentry?: SentryAdapter;
  } = {},
): CrashReporterService => {
  const decision = resolveCrashReporting(options.preference);

  if (!decision.enabled) {
    return disabledReporter(decision.reason);
  }

  const sentry = options.sentry ?? sentryAdapter;
  let pendingEvent:
    | {
        readonly eventId: string;
        readonly kind: CrashKind;
        readonly timestamp: number;
      }
    | undefined;

  try {
    sentry.init({
      beforeSend: (event) => sanitizeCrashEvent(event, pendingEvent?.kind ?? "uncaught_exception"),
      dsn: SENTRY_DSN,
      environment: SENTRY_ENVIRONMENT,
      release: SENTRY_RELEASE,
      sanitizeEnvelope: (body) =>
        pendingEvent === undefined ? undefined : sanitizeCrashEnvelope(body, pendingEvent),
    });
  } catch {
    return disabledReporter("initialization_failed");
  }

  let captured = false;

  return {
    capture: async (kind) => {
      if (captured) {
        return;
      }

      captured = true;

      try {
        const identity = (
          options.createEventIdentity ??
          (() => ({
            eventId: randomUUID().replaceAll("-", ""),
            timestamp: Date.now() / 1_000,
          }))
        )();
        pendingEvent = { ...identity, kind };
        sentry.captureEvent(
          sanitizeCrashEvent(
            { event_id: pendingEvent.eventId, timestamp: pendingEvent.timestamp },
            kind,
          ),
        );
        await waitForFlush(() => sentry.flush(CRASH_REPORTING_FLUSH_TIMEOUT_MS));
      } catch {
        // Reporting is best-effort and must never replace the command failure.
      } finally {
        pendingEvent = undefined;
      }
    },
    decision,
  };
};

export class CliCrashReporter extends Context.Service<CliCrashReporter, CrashReporterService>()(
  "@putdotio/cli/CliCrashReporter",
) {}
