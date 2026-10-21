import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Console, ConfigProvider, Effect } from "effect";

import { runCli } from "../cli.js";
import { makeCliAppLayer } from "../internal/app-layer.js";
import { handleCliCause } from "../internal/main.js";
import { makeCliRuntime } from "../internal/runtime.js";

export const FIXTURE_TOKEN = "fixture-token";

const UPLOAD_ORIGIN = "https://upload.put.io";

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
  for await (const chunk of request) chunks.push(chunk as Buffer);
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
      fields[key] = typeof value === "string" ? value : await value.text();
    }
    return fields;
  }
  return { raw: raw.toString("utf8") };
};

/**
 * A local put.io API stand-in. Routes answer with synthetic responses shaped
 * like the API's; every request is recorded. Fetches to any other host fail,
 * except the upload host, which the SDK does not derive from the API base URL
 * and is redirected here.
 */
export const startFixtureApi = async () => {
  const routes = new Map<string, FixtureRoute>();
  const requests: RecordedRequest[] = [];
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? "/", "http://fixture.invalid");
      const recorded: RecordedRequest = {
        authorization: request.headers.authorization,
        body: await readBody(request),
        method: request.method ?? "GET",
        origin: String(request.headers["x-fixture-origin"] ?? "api"),
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
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const realFetch = globalThis.fetch;

  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));

    if (url.origin === baseUrl) return realFetch(input, init);
    if (url.origin === UPLOAD_ORIGIN) {
      const headers = new Headers(init?.headers);
      headers.set("x-fixture-origin", "upload");
      return realFetch(`${baseUrl}${url.pathname}${url.search}`, { ...init, headers });
    }
    return Promise.reject(new Error(`Fixture API blocks network access to ${url.origin}`));
  };

  return {
    baseUrl,
    close: () =>
      new Promise<void>((resolve, reject) => {
        globalThis.fetch = realFetch;
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    requests,
    reset: () => {
      routes.clear();
      requests.length = 0;
    },
    /** Answer `METHOD /path`; a list answers successive requests in order, repeating the last. */
    route: (
      key: string,
      reply: FixtureResponse | ReadonlyArray<FixtureResponse> | FixtureRoute,
    ) => {
      if (typeof reply === "function") {
        routes.set(key, reply);
        return;
      }
      const replies = Array.isArray(reply) ? [...reply] : [reply];
      routes.set(key, () => (replies.length > 1 ? replies.shift() : replies[0]) ?? notFound);
    },
  };
};

export type FixtureApi = Awaited<ReturnType<typeof startFixtureApi>>;

export type CliRun = {
  /** The persisted config after the run, parsed; undefined when no file exists. */
  readonly config: unknown;
  readonly configPath: string;
  readonly exitCode: number;
  readonly openedUrls: ReadonlyArray<string>;
  readonly stderr: string;
  readonly stdout: string;
};

/**
 * Runs the CLI entry the way `bin.ts` composes it, with captured streams,
 * a scratch config, and the API base URL pointed at the fixture API.
 */
export const runPutio = async (
  api: FixtureApi,
  args: ReadonlyArray<string>,
  options: {
    readonly configContents?: string;
    readonly env?: Record<string, string | undefined>;
    readonly isInteractiveTerminal?: boolean;
  } = {},
): Promise<CliRun> => {
  const configDir = await mkdtemp(join(tmpdir(), "putio-cli-test-"));
  const configPath = join(configDir, "config.json");
  const argv = ["node", "putio", ...args];
  const stdout: string[] = [];
  const stderr: string[] = [];
  const openedUrls: string[] = [];
  let exitCode = 0;
  const env = Object.fromEntries(
    Object.entries({
      PUTIO_CLI_API_BASE_URL: api.baseUrl,
      PUTIO_CLI_CONFIG_PATH: configPath,
      PUTIO_CLI_TOKEN: FIXTURE_TOKEN,
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
  const runtime = {
    ...makeCliRuntime({
      argv,
      homeDirectory: configDir,
      hostName: "fixture-host",
      isInteractiveTerminal: options.isInteractiveTerminal ?? false,
      isSingleExecutable: false,
      writeStderr: (message) => stderr.push(message),
      writeStdout: (message) => stdout.push(message),
    }),
    openExternal: (url: string) =>
      Effect.sync(() => {
        openedUrls.push(url);
        return true;
      }),
    setExitCode: (code: number) =>
      Effect.sync(() => {
        exitCode = code;
      }),
  };

  try {
    if (options.configContents !== undefined) {
      await writeFile(configPath, options.configContents, "utf8");
    }
    await Effect.runPromise(
      Effect.scoped(
        runCli(argv).pipe(
          Effect.catchCause(handleCliCause),
          Effect.provide(makeCliAppLayer(runtime)),
        ),
      ).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
        Effect.provideService(Console.Console, console_),
      ),
    );
    const config = await readFile(configPath, "utf8").then(
      (contents) => JSON.parse(contents) as unknown,
      () => undefined,
    );
    return {
      config,
      configPath,
      exitCode,
      openedUrls,
      stderr: stderr.join(""),
      stdout: stdout.join(""),
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
    .map((line) => JSON.parse(line) as unknown);

export const stdoutJson = (run: CliRun) => JSON.parse(run.stdout) as unknown;

export const stderrJson = (run: CliRun) => JSON.parse(run.stderr) as { readonly error: unknown };
