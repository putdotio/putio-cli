import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as Stdio from "effect/Stdio";
import * as Terminal from "effect/Terminal";
import {
  type Cause,
  Console,
  ConfigProvider,
  Effect,
  Layer,
  Option,
  Predicate,
  Queue,
  Schema,
  Stream,
} from "effect";

import { runCli } from "../cli.js";
import { CliServicesLive } from "../internal/app-layer.js";
import { CrashReportingDisabledLive } from "../internal/crash-reporting.js";
import { handleCliCause } from "../internal/main.js";
import { cliRuntimeLayer } from "../internal/runtime.js";

export const FIXTURE_TOKEN = "fixture-token";

type RecordedRequest = {
  readonly authorization: string | undefined;
  readonly body: Record<string, string>;
  readonly method: string;
  readonly origin: string;
  readonly path: string;
  readonly query: Record<string, string>;
};

type FixtureResponse = {
  readonly body: unknown;
  readonly contentType?: string;
  readonly status?: number;
};

type FixtureRoute = (request: RecordedRequest) => FixtureResponse;

type RepliesInOrderThenRepeatLast = ReadonlyArray<FixtureResponse>;

const parseJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown));

const parseErrorEnvelope = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Struct({ error: Schema.Unknown })),
);

const notFound: FixtureResponse = {
  body: {
    error_message: "No fixture route",
    error_type: "NOT_FOUND",
    status: "ERROR",
    status_code: 404,
  },
  status: 404,
};

const readBody = async (request: IncomingMessage) => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks);
  const contentType = request.headers["content-type"] ?? "";

  if (raw.length === 0) return {};

  if (contentType.startsWith("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw.toString("utf8")));
  }

  if (contentType.startsWith("multipart/form-data")) {
    const form = await new Response(raw, { headers: { "content-type": contentType } }).formData();
    const fields: Record<string, string> = {};

    for (const [key, value] of form) {
      fields[key] = value instanceof File ? await value.text() : value;
    }

    return fields;
  }

  return { raw: raw.toString("utf8") };
};

/**
 * A local put.io API stand-in. Routes answer with synthetic responses shaped
 * like the API's; every request is recorded. It answers on two origins, one for
 * the API and one for uploads; fetches to any other origin fail and are recorded
 * in `blocked`.
 */
export const startFixtureApi = async () => {
  const routes = new Map<string, FixtureRoute>();
  const requests: RecordedRequest[] = [];
  const blocked: string[] = [];

  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? "/", "http://fixture.invalid");

      const recorded: RecordedRequest = {
        authorization: request.headers.authorization,
        body: await readBody(request),
        method: request.method ?? "GET",
        origin: request.headers.host?.startsWith("localhost:") ? "upload" : "api",
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
      };

      requests.push(recorded);
      const route = routes.get(`${recorded.method} ${recorded.path}`);
      const reply = route ? route(recorded) : notFound;
      const contentType = reply.contentType ?? "application/json";
      response.writeHead(reply.status ?? 200, { "content-type": contentType });
      response.end(
        contentType === "application/json" ? JSON.stringify(reply.body) : String(reply.body),
      );
    })();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  if (address === null || Predicate.isString(address)) {
    throw new Error("Fixture API did not bind a TCP port.");
  }

  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const uploadBaseUrl = `http://localhost:${port}`;
  const realFetch = globalThis.fetch;

  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));

    if (url.origin === baseUrl || url.origin === uploadBaseUrl) return realFetch(input, init);
    blocked.push(url.origin);

    return Promise.reject(new Error(`Fixture API blocks network access to ${url.origin}`));
  };

  return {
    baseUrl,
    blocked,
    uploadBaseUrl,
    close: () =>
      new Promise<void>((resolve, reject) => {
        globalThis.fetch = realFetch;
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    requests,
    reset: () => {
      routes.clear();
      requests.length = 0;
      blocked.length = 0;
    },
    route: (
      methodAndPath: string,
      reply: FixtureResponse | RepliesInOrderThenRepeatLast | FixtureRoute,
    ) => {
      if (Predicate.isFunction(reply)) {
        routes.set(methodAndPath, reply);

        return;
      }

      const replies = Array.isArray(reply) ? [...reply] : [reply];
      routes.set(
        methodAndPath,
        () => (replies.length > 1 ? replies.shift() : replies[0]) ?? notFound,
      );
    },
  };
};

export type FixtureApi = Awaited<ReturnType<typeof startFixtureApi>>;

const keyPress = (name: string, input?: string): Terminal.UserInput => ({
  input: Option.fromUndefinedOr(input),
  key: { ctrl: false, meta: false, name, shift: false },
});

const scriptedTerminalLayer = (typed: string, displayed: string[]) =>
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      display: (text) => Effect.sync(() => void displayed.push(text)),
      readInput: Effect.gen(function* () {
        const input = yield* Queue.unbounded<Terminal.UserInput, Cause.Done>();
        yield* Queue.offerAll(input, [
          ...typed.split("").map((character) => keyPress(character, character)),
          keyPress("enter"),
        ]);

        return input;
      }),
      readLine: Effect.succeed(typed),
      rows: Effect.succeed(24),
      size: Queue.unbounded<Terminal.Size, Cause.Done>(),
    }),
  );

export type CliRun = {
  /** The persisted config after the run, parsed; undefined when no file exists. */
  readonly config: unknown;
  readonly configPath: string;
  readonly exitCode: number;
  readonly openedUrls: ReadonlyArray<string>;
  readonly stderr: string;
  readonly stdout: string;
  readonly terminalDisplay: string;
};

/**
 * Runs the CLI entry the way `bin.ts` composes it, with captured streams,
 * a scratch config, and the API and upload base URLs pointed at the fixture API.
 */
export const runPutio = async (
  api: FixtureApi,
  args: ReadonlyArray<string>,
  options: {
    readonly configContents?: string;
    readonly env?: Record<string, string | undefined>;
    readonly isInteractiveTerminal?: boolean;
    readonly stdin?: string;
    readonly terminalInput?: string;
  } = {},
): Promise<CliRun> => {
  const configDir = await mkdtemp(join(tmpdir(), "putio-cli-test-"));
  const configPath = join(configDir, "config.json");
  const argv = ["node", "putio", ...args];
  const stdout: string[] = [];
  const stderr: string[] = [];
  const openedUrls: string[] = [];
  const terminalDisplay: string[] = [];
  let exitCode = 0;

  const env = Object.fromEntries(
    Object.entries({
      PUTIO_CLI_API_BASE_URL: api.baseUrl,
      PUTIO_CLI_CONFIG_PATH: configPath,
      PUTIO_CLI_TOKEN: FIXTURE_TOKEN,
      PUTIO_CLI_UPLOAD_BASE_URL: api.uploadBaseUrl,
      XDG_CONFIG_HOME: configDir,
      ...options.env,
    }).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );

  const capture =
    (chunks: string[]) =>
    (...values: ReadonlyArray<unknown>) =>
      chunks.push(`${values.map(String).join(" ")}\n`);

  const console_: Console.Console = Object.assign(Object.create(console), {
    error: capture(stderr),
    log: capture(stdout),
  });

  const runtimeLayer = cliRuntimeLayer({
    argv,
    homeDirectory: configDir,
    hostName: "fixture-host",
    isInteractiveTerminal: options.isInteractiveTerminal ?? false,
    isSingleExecutable: false,
    openExternal: (url) => {
      openedUrls.push(url);

      return true;
    },
    setExitCode: (code) => {
      exitCode = code;
    },
    writeStderr: (message) => stderr.push(message),
    writeStdout: (message) => stdout.push(message),
  });

  const stdioLayer = Stdio.layerTest({
    stdin:
      options.stdin === undefined
        ? Stream.empty
        : Stream.make(new TextEncoder().encode(options.stdin)),
  });

  const terminalLayer =
    options.terminalInput === undefined
      ? Layer.empty
      : scriptedTerminalLayer(options.terminalInput, terminalDisplay);

  try {
    if (options.configContents !== undefined) {
      await writeFile(configPath, options.configContents, "utf8");
    }

    await Effect.runPromise(
      Effect.scoped(
        runCli(argv).pipe(
          Effect.catchCause(handleCliCause),
          Effect.provide(
            CliServicesLive.pipe(
              Layer.provideMerge(runtimeLayer),
              Layer.merge(CrashReportingDisabledLive),
              Layer.merge(stdioLayer),
              Layer.merge(terminalLayer),
            ),
          ),
        ),
      ).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
        Effect.provideService(Console.Console, console_),
      ),
    );

    const config = await readFile(configPath, "utf8").then(
      (contents) => parseJson(contents),
      () => undefined,
    );

    return {
      config,
      configPath,
      exitCode,
      openedUrls,
      stderr: stderr.join(""),
      stdout: stdout.join(""),
      terminalDisplay: terminalDisplay.join(""),
    };
  } finally {
    await rm(configDir, { force: true, recursive: true });
  }
};

/** Parses each stdout line as one JSON document. */
export const stdoutLines = (run: CliRun) =>
  run.stdout
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => parseJson(line));

export const stdoutJson = (run: CliRun) => parseJson(run.stdout);

export const stderrJson = (run: CliRun) => parseErrorEnvelope(run.stderr);
