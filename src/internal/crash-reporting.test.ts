import { createServer, type Server } from "node:http";
import * as Sentry from "@sentry/core";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import packageJson from "../../package.json";

import {
  CRASH_REPORTING_FLUSH_TIMEOUT_MS,
  loadCrashReportingPreference,
  makeCrashReporter,
  resolveCrashReporting,
  sanitizeCrashEnvelope,
  sanitizeCrashEvent,
  sendCrashRequest,
  type SentryAdapter,
} from "./crash-reporting.js";

const makeSentryAdapter = () => {
  const captureEvent = vi.fn<SentryAdapter["captureEvent"]>(() => "event-id");
  const flush = vi.fn<SentryAdapter["flush"]>(() => Promise.resolve(true));
  const init = vi.fn<SentryAdapter["init"]>(() => undefined);

  return {
    adapter: { captureEvent, flush, init },
    captureEvent,
    flush,
    init,
  };
};

const listen = (server: Server) =>
  new Promise<string>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("Expected the test server to listen on an IP socket."));
        return;
      }

      resolve(`http://127.0.0.1:${address.port}`);
    });
  });

const close = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });

afterEach(async () => {
  await Sentry.close(0);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("resolveCrashReporting", () => {
  it("defaults to enabled", () => {
    expect(resolveCrashReporting()).toEqual({ enabled: true });
  });

  it("honors the persisted opt-out", () => {
    expect(resolveCrashReporting({ disabled: true, reason: "persisted_opt_out" })).toEqual({
      enabled: false,
      reason: "persisted_opt_out",
    });
  });
});

describe("loadCrashReportingPreference", () => {
  it("loads the preference from the resolved persisted config", () => {
    const readConfig = vi.fn(
      () => '{"api_base_url":"https://api.put.io","telemetry_disabled":true,"auth_token":"secret"}',
    );

    expect(
      loadCrashReportingPreference({
        environment: { XDG_CONFIG_HOME: "/tmp/xdg" },
        homePath: "/Users/tester",
        readConfig,
      }),
    ).toEqual({ disabled: true, reason: "persisted_opt_out" });
    expect(readConfig).toHaveBeenCalledWith("/tmp/xdg/putio/config.json");
  });

  it("defaults to enabled when no config exists", () => {
    const missing = Object.assign(new Error("missing"), { code: "ENOENT" });

    expect(
      loadCrashReportingPreference({
        homePath: "/Users/tester",
        readConfig: () => {
          throw missing;
        },
      }),
    ).toEqual({ disabled: false });
  });

  it("uses the same default in CI, agents, and DO_NOT_TRACK environments", () => {
    const missing = Object.assign(new Error("missing"), { code: "ENOENT" });

    expect(
      loadCrashReportingPreference({
        environment: { CI: "true", DO_NOT_TRACK: "1", PUTIO_AGENT: "true" },
        homePath: "/Users/tester",
        readConfig: () => {
          throw missing;
        },
      }),
    ).toEqual({ disabled: false });
  });

  it("fails closed when the config cannot be decoded", () => {
    expect(
      loadCrashReportingPreference({
        homePath: "/Users/tester",
        readConfig: () => "not-json",
      }),
    ).toEqual({ disabled: true, reason: "configuration_unavailable" });
  });

  it.each([
    '{"api_base_url":42,"telemetry_disabled":false}',
    '{"api_base_url":"https://api.put.io","profiles":{"invalid name":{}}}',
    '{"api_base_url":"https://api.put.io","unexpected_field":true}',
  ])("fails closed when the persisted config is invalid", (rawConfig) => {
    expect(
      loadCrashReportingPreference({
        homePath: "/Users/tester",
        readConfig: () => rawConfig,
      }),
    ).toEqual({ disabled: true, reason: "configuration_unavailable" });
  });
});

describe("sanitizeCrashEvent", () => {
  it("projects arbitrary SDK input into the fixed allowlist", () => {
    const event = sanitizeCrashEvent(
      {
        breadcrumbs: [{ message: "secret filename.mkv" }],
        event_id: "event-id",
        exception: { values: [{ value: "/private/path/token" }] },
        extra: { argv: ["--token", "secret"] },
        message: "server response with token",
        request: { url: "https://example.test/private" },
        server_name: "private-host",
        timestamp: 123,
        user: { id: "account-id" },
      },
      "unhandled_rejection",
    );

    expect(event).toEqual({
      environment: "production",
      event_id: "event-id",
      fingerprint: ["Unexpected CLI failure", "unhandled_rejection"],
      level: "fatal",
      logger: "putio-cli.crash-reporting",
      message: "Unexpected CLI failure",
      platform: "node",
      release: `@putdotio/cli@${packageJson.version}`,
      tags: {
        component: "cli",
        failure_kind: "unhandled_rejection",
      },
      timestamp: 123,
    });
  });
});

describe("sanitizeCrashEnvelope", () => {
  const expected = {
    eventId: "0123456789abcdef0123456789abcdef",
    kind: "unhandled_rejection" as const,
    timestamp: 123,
  };

  it("rebuilds the serialized envelope from the fixed allowlist", () => {
    const input = [
      JSON.stringify({
        dsn: "https://secret@example.test/1",
        event_id: expected.eventId,
        private_header: "secret",
        sent_at: "private timestamp",
      }),
      JSON.stringify({ content_type: "application/json", private_header: "secret", type: "event" }),
      JSON.stringify({
        breadcrumbs: [{ message: "secret filename.mkv" }],
        event_id: expected.eventId,
        exception: { values: [{ value: "/private/path/token" }] },
        extra: { argv: ["--token", "secret"] },
        message: "server response with token",
        tags: { failure_kind: expected.kind, secret: "value" },
      }),
    ].join("\n");

    const sanitized = sanitizeCrashEnvelope(input, expected);

    expect(sanitized).toBeDefined();
    if (sanitized === undefined) {
      throw new Error("Expected the authorized crash envelope to be rebuilt.");
    }

    expect(Sentry.parseEnvelope(sanitized)).toEqual([
      {
        event_id: expected.eventId,
        sent_at: "1970-01-01T00:02:03.000Z",
      },
      [
        [
          { type: "event" },
          {
            environment: "production",
            event_id: expected.eventId,
            fingerprint: ["Unexpected CLI failure", expected.kind],
            level: "fatal",
            logger: "putio-cli.crash-reporting",
            message: "Unexpected CLI failure",
            platform: "node",
            release: `@putdotio/cli@${packageJson.version}`,
            tags: { component: "cli", failure_kind: expected.kind },
            timestamp: expected.timestamp,
          },
        ],
      ],
    ]);
  });

  it("drops SDK-internal and otherwise unauthorized events", () => {
    const internalEvent = [
      JSON.stringify({ event_id: "fedcba9876543210fedcba9876543210" }),
      JSON.stringify({ type: "event" }),
      JSON.stringify({
        event_id: "fedcba9876543210fedcba9876543210",
        exception: { values: [{ value: "event processor leaked a secret" }] },
      }),
    ].join("\n");

    expect(sanitizeCrashEnvelope(internalEvent, expected)).toBeUndefined();
  });
});

describe("sendCrashRequest", () => {
  it("uses a bounded POST and returns Sentry rate-limit headers", async () => {
    const request = vi.fn(async (_url: string, _init: RequestInit) =>
      Promise.resolve(
        new Response(undefined, {
          headers: {
            "retry-after": "60",
            "x-sentry-rate-limits": "60:error:organization",
          },
          status: 202,
        }),
      ),
    );

    await expect(
      sendCrashRequest(
        {
          recordDroppedEvent: vi.fn(),
          url: "https://ingest.example.test/envelope",
        },
        "envelope",
        request,
      ),
    ).resolves.toEqual({
      headers: {
        "retry-after": "60",
        "x-sentry-rate-limits": "60:error:organization",
      },
      statusCode: 202,
    });
    expect(request).toHaveBeenCalledWith(
      "https://ingest.example.test/envelope",
      expect.objectContaining({
        body: "envelope",
        method: "POST",
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("does not follow redirects or retransmit the envelope", async () => {
    let destinationRequests = 0;
    const destination = createServer((_request, response) => {
      destinationRequests += 1;
      response.writeHead(202).end();
    });
    const destinationUrl = await listen(destination);
    let redirectRequests = 0;
    const redirect = createServer((_request, response) => {
      redirectRequests += 1;
      response.writeHead(307, { location: `${destinationUrl}/forwarded` }).end();
    });
    const redirectUrl = await listen(redirect);

    try {
      await expect(
        sendCrashRequest(
          {
            recordDroppedEvent: vi.fn(),
            url: `${redirectUrl}/envelope`,
          },
          "synthetic-envelope",
        ),
      ).rejects.toThrow();
      expect(redirectRequests).toBe(1);
      expect(destinationRequests).toBe(0);
    } finally {
      await Promise.all([close(redirect), close(destination)]);
    }
  });

  it("surfaces transport failure to the reporter boundary", async () => {
    const request = vi.fn(async () => Promise.reject(new Error("offline")));

    await expect(
      sendCrashRequest(
        {
          recordDroppedEvent: vi.fn(),
          url: "https://ingest.example.test/envelope",
        },
        "envelope",
        request,
      ),
    ).rejects.toThrow("offline");
  });
});

describe("makeCrashReporter", () => {
  it("does not initialize or capture after the persisted opt-out", async () => {
    const sentry = makeSentryAdapter();
    const reporter = makeCrashReporter({
      preference: { disabled: true, reason: "persisted_opt_out" },
      sentry: sentry.adapter,
    });

    await reporter.capture("effect_defect");

    expect(reporter.decision).toEqual({ enabled: false, reason: "persisted_opt_out" });
    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureEvent).not.toHaveBeenCalled();
    expect(sentry.flush).not.toHaveBeenCalled();
  });

  it("initializes without default integrations and captures only once", async () => {
    const sentry = makeSentryAdapter();
    const reporter = makeCrashReporter({ sentry: sentry.adapter });

    await reporter.capture("effect_defect");
    await reporter.capture("unhandled_rejection");

    expect(reporter.decision).toEqual({ enabled: true });
    expect(sentry.init).toHaveBeenCalledOnce();
    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: "production",
        release: `@putdotio/cli@${packageJson.version}`,
      }),
    );
    expect(sentry.captureEvent).toHaveBeenCalledOnce();
    expect(sentry.flush).toHaveBeenCalledWith(CRASH_REPORTING_FLUSH_TIMEOUT_MS);

    const initOptions = sentry.init.mock.calls[0]?.[0];
    const beforeSend = initOptions?.beforeSend;
    expect(beforeSend).toBeDefined();
    if (beforeSend === undefined) {
      throw new Error("beforeSend was not installed");
    }

    const sanitized = await beforeSend({
      exception: { values: [{ value: "/private/file.mkv" }] },
      extra: { argv: ["--token", "secret"] },
      request: { url: "https://example.test/private" },
      user: { id: "account-id" },
    });

    expect(sanitized).toEqual(expect.objectContaining({ message: "Unexpected CLI failure" }));
    expect(sanitized).not.toHaveProperty("exception");
    expect(sanitized).not.toHaveProperty("extra");
    expect(sanitized).not.toHaveProperty("request");
    expect(sanitized).not.toHaveProperty("user");
  });

  it("swallows transport failures", async () => {
    const sentry = makeSentryAdapter();
    sentry.flush.mockRejectedValue(new Error("offline"));
    const reporter = makeCrashReporter({ sentry: sentry.adapter });

    await expect(reporter.capture("effect_defect")).resolves.toBeUndefined();
  });

  it("swallows synthetic event construction failures", async () => {
    const sentry = makeSentryAdapter();
    const reporter = makeCrashReporter({
      createEventIdentity: () => {
        throw new Error("random source unavailable");
      },
      sentry: sentry.adapter,
    });

    await expect(reporter.capture("effect_defect")).resolves.toBeUndefined();
    expect(sentry.captureEvent).not.toHaveBeenCalled();
    expect(sentry.flush).not.toHaveBeenCalled();
  });

  it("bounds a transport that never settles", async () => {
    vi.useFakeTimers();
    const sentry = makeSentryAdapter();
    sentry.flush.mockReturnValue(new Promise(() => undefined));
    const reporter = makeCrashReporter({ sentry: sentry.adapter });

    const capture = reporter.capture("effect_defect");
    await vi.advanceTimersByTimeAsync(CRASH_REPORTING_FLUSH_TIMEOUT_MS);

    await expect(capture).resolves.toBeUndefined();
  });

  it("fails closed when SDK initialization throws", async () => {
    const sentry = makeSentryAdapter();
    sentry.init.mockImplementation(() => {
      throw new Error("bad DSN");
    });
    const reporter = makeCrashReporter({ sentry: sentry.adapter });

    await reporter.capture("effect_defect");

    expect(reporter.decision).toEqual({ enabled: false, reason: "initialization_failed" });
    expect(sentry.captureEvent).not.toHaveBeenCalled();
  });

  it("sends one allowlisted envelope through the concrete Sentry adapter", async () => {
    const request = vi.fn(async () =>
      Promise.resolve(
        new Response(undefined, {
          status: 202,
        }),
      ),
    );
    vi.stubGlobal("fetch", request);
    const reporter = makeCrashReporter({
      createEventIdentity: () => ({
        eventId: "0123456789abcdef0123456789abcdef",
        timestamp: 123,
      }),
    });

    await reporter.capture("effect_defect");

    expect(request).toHaveBeenCalledOnce();
    const call = request.mock.calls[0];
    if (call === undefined) {
      throw new Error("Expected the concrete Sentry transport to issue one request.");
    }

    const [url, init] = call;
    expect(url).toBe(
      "https://o804.ingest.us.sentry.io/api/4511913835495424/envelope/?sentry_version=7&sentry_key=50cfbc1da5d6ee5c7665a2f10ec3d08f",
    );
    expect(init).toEqual(
      expect.objectContaining({
        method: "POST",
        signal: expect.any(AbortSignal),
      }),
    );
    const body = init?.body;
    if (typeof body !== "string" && !(body instanceof Uint8Array)) {
      throw new Error("Expected a serialized Sentry envelope request body.");
    }

    expect(Sentry.parseEnvelope(body)).toEqual([
      {
        event_id: "0123456789abcdef0123456789abcdef",
        sent_at: "1970-01-01T00:02:03.000Z",
      },
      [
        [
          { type: "event" },
          {
            environment: "production",
            event_id: "0123456789abcdef0123456789abcdef",
            fingerprint: ["Unexpected CLI failure", "effect_defect"],
            level: "fatal",
            logger: "putio-cli.crash-reporting",
            message: "Unexpected CLI failure",
            platform: "node",
            release: `@putdotio/cli@${packageJson.version}`,
            tags: { component: "cli", failure_kind: "effect_defect" },
            timestamp: 123,
          },
        ],
      ],
    ]);
  });
});
