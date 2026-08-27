import {
  execFile as execFileCallback,
  execFileSync,
  spawn,
  spawnSync,
  type ChildProcess,
} from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { promisify } from "node:util";

type AuthStatus = {
  readonly apiBaseUrl: string;
  readonly authenticated: boolean;
  readonly profile: string | null;
  readonly source: string | null;
};

type ProfileList = {
  readonly defaultProfile: string | null;
  readonly profiles: ReadonlyArray<{
    readonly current: boolean;
    readonly name: string;
  }>;
};

type LogoutResult = {
  readonly cleared: boolean;
  readonly profile: string | null;
};

type RemoveResult = {
  readonly profile: string;
  readonly removed: boolean;
};

type TransfersList = {
  readonly cursor: string | null;
  readonly total: number;
  readonly transfers: ReadonlyArray<unknown>;
};

type NpmPackageInventoryEntry = {
  readonly version?: string;
};

const root = process.cwd();
const artifactsDir = join(root, ".artifacts");
let installDir: string;
let configPath: string;
const commandTimeoutMs = 120_000;
const execFile = promisify(execFileCallback);

const mockApiSource = `
import { createServer } from "node:http";

const server = createServer((request, response) => {
  const isExpectedRequest =
    request.method === "GET" &&
    request.url?.startsWith("/v2/transfers/list?") === true &&
    request.headers.authorization === "Token packed-smoke-token";

  response.statusCode = isExpectedRequest ? 200 : 400;
  response.setHeader("content-type", "application/json");
  response.end(
    JSON.stringify(
      isExpectedRequest
        ? { cursor: null, status: "OK", total: 0, transfers: [] }
        : { error_message: "Unexpected packed-install request", error_type: "BAD_REQUEST" },
    ),
  );
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (typeof address !== "object" || address === null) process.exit(1);
  process.stdout.write(String(address.port) + "\\n");
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
`;

const run = (command: string, args: ReadonlyArray<string>, options: object = {}) =>
  execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    timeout: commandTimeoutMs,
    ...options,
  });

const runPutioJson = <A,>(
  binaryPath: string,
  args: ReadonlyArray<string>,
  env: Record<string, string> = {},
): A =>
  JSON.parse(
    execFileSync(binaryPath, args, {
      cwd: installDir,
      encoding: "utf8",
      env: {
        ...process.env,
        ...env,
        PUTIO_CLI_CONFIG_PATH: configPath,
      },
      stdio: "pipe",
      timeout: commandTimeoutMs,
    }),
  ) as A;

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const startMockApi = () => {
  const child = spawn(process.execPath, ["--input-type=module", "--eval", mockApiSource], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const ready = new Promise<string>((resolve, reject) => {
    let stderr = "";
    let stdout = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Timed out starting the packed-install API server. ${stderr}`.trim()));
    }, 10_000);

    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Packed-install API server exited with code ${code}. ${stderr}`.trim()));
    });
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
      const newline = stdout.indexOf("\n");

      if (newline < 0) return;

      const port = Number(stdout.slice(0, newline));
      clearTimeout(timer);

      if (!Number.isInteger(port) || port <= 0) {
        child.kill();
        reject(new Error(`Expected the API server to report a valid port. ${stderr}`.trim()));
        return;
      }

      resolve(`http://127.0.0.1:${port}`);
    });
  });

  return { child, ready } as const;
};

const waitForExit = async (child: ChildProcess, timeoutMs: number) => {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return Promise.race([
    once(child, "exit").then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);
};

const stopMockApi = async (child: ChildProcess) => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  if (await waitForExit(child, 2_000)) return;
  child.kill("SIGKILL");
  if (!(await waitForExit(child, 2_000))) {
    throw new Error(`Packed-install API server ${child.pid ?? "unknown"} did not stop.`);
  }
};

const readFailureMessage = (value: unknown) => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("error" in value) ||
    typeof value.error !== "object" ||
    value.error === null ||
    !("message" in value.error) ||
    typeof value.error.message !== "string"
  ) {
    throw new Error("Expected the CLI failure to use the structured error contract.");
  }

  return value.error.message;
};

const runPutioFailure = (
  binaryPath: string,
  args: ReadonlyArray<string>,
  configFile: string,
  env: Record<string, string> = {},
) => {
  const result = spawnSync(binaryPath, args, {
    cwd: installDir,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
      PUTIO_CLI_CONFIG_PATH: configFile,
    },
    stdio: "pipe",
    timeout: commandTimeoutMs,
  });

  assert(result.error === undefined, `Expected the CLI process to start: ${result.error?.message}`);
  assert(result.status === 1, `Expected CLI failure exit code 1, received ${result.status}.`);

  const output = result.stdout.trim().length > 0 ? result.stdout : result.stderr;
  return readFailureMessage(JSON.parse(output));
};

const smokeAuthProfiles = (binaryPath: string) => {
  writeFileSync(
    configPath,
    `${JSON.stringify(
      {
        api_base_url: "https://api.put.io",
        default_profile: "human",
        profiles: {
          automation: {
            api_base_url: "https://staging.put.io",
            auth_token: "automation-token",
          },
          human: {
            auth_token: "human-token",
          },
        },
      },
      null,
      2,
    )}\n`,
  );

  const defaultList = runPutioJson<ProfileList>(binaryPath, [
    "auth",
    "profiles",
    "list",
    "--output",
    "json",
  ]);
  assert(
    defaultList.profiles.find((profile) => profile.name === "human")?.current === true,
    "Expected default profile `human` to be current.",
  );
  assert(
    defaultList.profiles.find((profile) => profile.name === "automation")?.current === false,
    "Expected `automation` not to be current before selection.",
  );

  const defaultStatus = runPutioJson<AuthStatus>(binaryPath, [
    "auth",
    "status",
    "--output",
    "json",
  ]);
  assert(defaultStatus.authenticated, "Expected default profile status to be authenticated.");
  assert(defaultStatus.profile === "human", "Expected default status to use `human`.");
  assert(defaultStatus.source === "profile", "Expected default status source to be `profile`.");

  const envStatus = runPutioJson<AuthStatus>(binaryPath, ["auth", "status", "--output", "json"], {
    PUTIO_CLI_PROFILE: "automation",
  });
  assert(envStatus.authenticated, "Expected env-selected profile status to be authenticated.");
  assert(envStatus.profile === "automation", "Expected env selection to use `automation`.");
  assert(
    envStatus.apiBaseUrl === "https://staging.put.io",
    "Expected env-selected profile to use its profile-specific API base URL.",
  );

  const useResult = runPutioJson<{ readonly profile: string }>(binaryPath, [
    "auth",
    "profiles",
    "use",
    "automation",
    "--output",
    "json",
  ]);
  assert(
    useResult.profile === "automation",
    "Expected `profiles use` to select the `automation` profile.",
  );

  const selectedList = runPutioJson<ProfileList>(binaryPath, [
    "auth",
    "profiles",
    "list",
    "--output",
    "json",
  ]);
  assert(
    selectedList.defaultProfile === "automation",
    "Expected `profiles use` to persist the `automation` profile as default.",
  );
  assert(
    selectedList.profiles.find((profile) => profile.name === "automation")?.current === true,
    "Expected the `automation` profile to be current after `profiles use`.",
  );

  const logoutResult = runPutioJson<LogoutResult>(binaryPath, [
    "auth",
    "logout",
    "--profile",
    "automation",
    "--output",
    "json",
  ]);
  assert(logoutResult.cleared, "Expected profile logout to report a cleared token.");
  assert(logoutResult.profile === "automation", "Expected logout to report selected profile.");

  const automationAfterLogout = runPutioJson<AuthStatus>(binaryPath, [
    "auth",
    "status",
    "--profile",
    "automation",
    "--output",
    "json",
  ]);
  assert(
    !automationAfterLogout.authenticated,
    "Expected the `automation` profile to be unauthenticated after logout.",
  );

  const humanAfterAutomationLogout = runPutioJson<AuthStatus>(binaryPath, [
    "auth",
    "status",
    "--profile",
    "human",
    "--output",
    "json",
  ]);
  assert(
    humanAfterAutomationLogout.authenticated,
    "Expected the human profile to remain authenticated after automation logout.",
  );

  const removeResult = runPutioJson<RemoveResult>(binaryPath, [
    "auth",
    "profiles",
    "remove",
    "human",
    "--output",
    "json",
  ]);
  assert(removeResult.removed, "Expected `profiles remove human` to report removal.");

  const finalList = runPutioJson<ProfileList>(binaryPath, [
    "auth",
    "profiles",
    "list",
    "--output",
    "json",
  ]);
  assert(
    finalList.profiles.some((profile) => profile.name === "automation"),
    "Expected the `automation` profile to remain after removing human.",
  );
  assert(
    !finalList.profiles.some((profile) => profile.name === "human"),
    "Expected human profile to be removed.",
  );
};

let mockApiProcess: ChildProcess | undefined;
let didCreateInstallDir = false;
let interruptedBy: NodeJS.Signals | undefined;
const commandController = new AbortController();
const interruptHandlers = new Map<NodeJS.Signals, () => void>();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  const handler = () => {
    interruptedBy ??= signal;
    commandController.abort();
  };
  interruptHandlers.set(signal, handler);
  process.on(signal, handler);
}

let primaryError: unknown;
let cleanupError: unknown;
try {
  installDir = mkdtempSync(join(tmpdir(), "putio-cli-install-"));
  didCreateInstallDir = true;
  configPath = join(installDir, "putio-config.json");
  rmSync(artifactsDir, { force: true, recursive: true });
  run("pnpm", ["pack", "--pack-destination", artifactsDir]);

  const tarball = readdirSync(artifactsDir).find((file) => file.endsWith(".tgz"));

  if (!tarball) {
    throw new Error("Expected `pnpm pack` to produce a tarball.");
  }

  execFileSync(
    "npm",
    ["install", "--no-package-lock", "--no-save", resolve(artifactsDir, tarball)],
    {
      cwd: installDir,
      encoding: "utf8",
      env: {
        ...process.env,
        npm_config_cache: join(installDir, "npm-cache"),
      },
      stdio: "pipe",
      timeout: commandTimeoutMs,
    },
  );

  const binaryPath = join(installDir, "node_modules", ".bin", "putio");
  const versionOutput = execFileSync(binaryPath, ["version"], {
    cwd: installDir,
    encoding: "utf8",
    stdio: "pipe",
    timeout: commandTimeoutMs,
  });

  JSON.parse(versionOutput);

  const describeOutput = execFileSync(binaryPath, ["describe"], {
    cwd: installDir,
    encoding: "utf8",
    stdio: "pipe",
    timeout: commandTimeoutMs,
  });

  JSON.parse(describeOutput);
  smokeAuthProfiles(binaryPath);

  const effectInventory = JSON.parse(
    execFileSync("npm", ["query", '[name="effect"]', "--json"], {
      cwd: installDir,
      encoding: "utf8",
      stdio: "pipe",
      timeout: commandTimeoutMs,
    }),
  ) as ReadonlyArray<NpmPackageInventoryEntry>;
  const effectVersions = effectInventory.flatMap((entry) =>
    entry.version === undefined ? [] : [entry.version],
  );
  assert(
    effectVersions.length === 1 && effectVersions[0] === "4.0.0-rc.109",
    `Expected the package to install one Effect 4.0.0-rc.109 runtime, received ${effectVersions.join(", ")}.`,
  );

  const mockApi = startMockApi();
  mockApiProcess = mockApi.child;
  const mockApiBaseUrl = await mockApi.ready;
  const transfers = JSON.parse(
    (
      await execFile(binaryPath, ["transfers", "list", "--output", "json"], {
        cwd: installDir,
        encoding: "utf8",
        env: {
          ...process.env,
          PUTIO_CLI_API_BASE_URL: mockApiBaseUrl,
          PUTIO_CLI_CONFIG_PATH: configPath,
          PUTIO_CLI_TOKEN: "packed-smoke-token",
        },
        signal: commandController.signal,
        timeout: commandTimeoutMs,
      })
    ).stdout,
  ) as TransfersList;
  assert(transfers.transfers.length === 0, "Expected the SDK-backed transfer list to be empty.");
  assert(transfers.cursor === null, "Expected the SDK-backed transfer list cursor to be null.");
  assert(transfers.total === 0, "Expected the SDK-backed transfer list total to be zero.");

  const missingAuthMessage = runPutioFailure(
    binaryPath,
    ["whoami", "--fields", "auth", "--output", "json"],
    join(installDir, "missing-config.json"),
  );
  assert(
    missingAuthMessage.includes("Set PUTIO_CLI_TOKEN or run `putio auth login`."),
    "Expected missing authentication to include an actionable recovery step.",
  );

  const invalidConfigMessage = runPutioFailure(
    binaryPath,
    ["auth", "status", "--output", "json"],
    join(installDir, "invalid-config.json"),
    { PUTIO_CLI_API_BASE_URL: "not-a-url" },
  );
  assert(
    invalidConfigMessage.includes("Expected a valid absolute URL"),
    "Expected invalid configuration to identify the malformed URL.",
  );

  writeFileSync(
    join(artifactsDir, "smoke-packed-install.json"),
    `${JSON.stringify(
      {
        proofs: [
          "packaged-install",
          "version",
          "describe",
          "single-effect-runtime",
          "authenticated-sdk-request",
          "auth-profile-round-trip",
          "missing-auth-failure",
          "invalid-config-failure",
        ],
        status: "passed",
        tarball,
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  primaryError = error;
} finally {
  if (mockApiProcess !== undefined) {
    try {
      await stopMockApi(mockApiProcess);
    } catch (error) {
      cleanupError = error;
    }
  }
  if (didCreateInstallDir) rmSync(installDir, { force: true, recursive: true });
  for (const [signal, handler] of interruptHandlers) process.off(signal, handler);
}

if (interruptedBy !== undefined) {
  if (cleanupError !== undefined) console.error(`Packed-install cleanup failed: ${cleanupError}`);
  process.exitCode = interruptedBy === "SIGINT" ? 130 : 143;
} else if (primaryError !== undefined) {
  if (cleanupError !== undefined) console.error(`Packed-install cleanup failed: ${cleanupError}`);
  throw primaryError;
} else if (cleanupError !== undefined) {
  throw cleanupError;
}
