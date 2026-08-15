import { execFile as execFileCallback, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import {
  createInterruptionController,
  resolveLifecycleOutcome,
  terminateOwnedProcess,
} from "./process-lifecycle.mts";

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
let commandAbortSignal: AbortSignal;
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

const run = async (command: string, args: ReadonlyArray<string>, options: object = {}) =>
  (
    await execFile(command, [...args], {
      ...options,
      cwd: root,
      encoding: "utf8",
      signal: commandAbortSignal,
      timeout: commandTimeoutMs,
    })
  ).stdout;

const runPutioJson = async <A,>(
  binaryPath: string,
  args: ReadonlyArray<string>,
  env: Record<string, string> = {},
): Promise<A> =>
  JSON.parse(
    (
      await execFile(binaryPath, [...args], {
        cwd: installDir,
        encoding: "utf8",
        env: {
          ...process.env,
          ...env,
          PUTIO_CLI_CONFIG_PATH: configPath,
        },
        signal: commandAbortSignal,
        timeout: commandTimeoutMs,
      })
    ).stdout,
  ) as A;

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const startMockApi = () => {
  const child = spawn(process.execPath, ["--input-type=module", "--eval", mockApiSource], {
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const ready = new Promise<string>((resolve, reject) => {
    let stderr = "";
    let stdout = "";
    const timer = setTimeout(() => {
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
        reject(new Error(`Expected the API server to report a valid port. ${stderr}`.trim()));
        return;
      }

      resolve(`http://127.0.0.1:${port}`);
    });
  });

  return { child, ready } as const;
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

const runPutioFailure = async (
  binaryPath: string,
  args: ReadonlyArray<string>,
  configFile: string,
  env: Record<string, string> = {},
) => {
  try {
    await execFile(binaryPath, [...args], {
      cwd: installDir,
      encoding: "utf8",
      env: {
        ...process.env,
        ...env,
        PUTIO_CLI_CONFIG_PATH: configFile,
      },
      signal: commandAbortSignal,
      timeout: commandTimeoutMs,
    });
    throw new Error("Expected the CLI command to fail.");
  } catch (error) {
    const failure = error as Error & {
      readonly code?: number | string;
      readonly stderr?: string;
      readonly stdout?: string;
    };
    assert(failure.code === 1, `Expected CLI failure exit code 1, received ${failure.code}.`);

    const stdout = failure.stdout ?? "";
    const output = stdout.trim().length > 0 ? stdout : (failure.stderr ?? "");
    return readFailureMessage(JSON.parse(output));
  }
};

const smokeAuthProfiles = async (binaryPath: string) => {
  writeFileSync(
    configPath,
    `${JSON.stringify(
      {
        api_base_url: "https://api.put.io",
        default_profile: "human",
        profiles: {
          "devs-fe-auto": {
            api_base_url: "https://staging.put.io",
            auth_token: "dev-token",
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

  const defaultList = await runPutioJson<ProfileList>(binaryPath, [
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
    defaultList.profiles.find((profile) => profile.name === "devs-fe-auto")?.current === false,
    "Expected `devs-fe-auto` not to be current before selection.",
  );

  const defaultStatus = await runPutioJson<AuthStatus>(binaryPath, [
    "auth",
    "status",
    "--output",
    "json",
  ]);
  assert(defaultStatus.authenticated, "Expected default profile status to be authenticated.");
  assert(defaultStatus.profile === "human", "Expected default status to use `human`.");
  assert(defaultStatus.source === "profile", "Expected default status source to be `profile`.");

  const envStatus = await runPutioJson<AuthStatus>(
    binaryPath,
    ["auth", "status", "--output", "json"],
    {
      PUTIO_CLI_PROFILE: "devs-fe-auto",
    },
  );
  assert(envStatus.authenticated, "Expected env-selected profile status to be authenticated.");
  assert(envStatus.profile === "devs-fe-auto", "Expected env selection to use `devs-fe-auto`.");
  assert(
    envStatus.apiBaseUrl === "https://staging.put.io",
    "Expected env-selected profile to use its profile-specific API base URL.",
  );

  const useResult = await runPutioJson<{ readonly profile: string }>(binaryPath, [
    "auth",
    "profiles",
    "use",
    "devs-fe-auto",
    "--output",
    "json",
  ]);
  assert(useResult.profile === "devs-fe-auto", "Expected `profiles use` to select dev profile.");

  const selectedList = await runPutioJson<ProfileList>(binaryPath, [
    "auth",
    "profiles",
    "list",
    "--output",
    "json",
  ]);
  assert(
    selectedList.defaultProfile === "devs-fe-auto",
    "Expected `profiles use` to persist dev profile as default.",
  );
  assert(
    selectedList.profiles.find((profile) => profile.name === "devs-fe-auto")?.current === true,
    "Expected dev profile to be current after `profiles use`.",
  );

  const logoutResult = await runPutioJson<LogoutResult>(binaryPath, [
    "auth",
    "logout",
    "--profile",
    "devs-fe-auto",
    "--output",
    "json",
  ]);
  assert(logoutResult.cleared, "Expected profile logout to report a cleared token.");
  assert(logoutResult.profile === "devs-fe-auto", "Expected logout to report selected profile.");

  const devAfterLogout = await runPutioJson<AuthStatus>(binaryPath, [
    "auth",
    "status",
    "--profile",
    "devs-fe-auto",
    "--output",
    "json",
  ]);
  assert(!devAfterLogout.authenticated, "Expected dev profile to be unauthenticated after logout.");

  const humanAfterDevLogout = await runPutioJson<AuthStatus>(binaryPath, [
    "auth",
    "status",
    "--profile",
    "human",
    "--output",
    "json",
  ]);
  assert(
    humanAfterDevLogout.authenticated,
    "Expected human profile to remain authenticated after dev logout.",
  );

  const removeResult = await runPutioJson<RemoveResult>(binaryPath, [
    "auth",
    "profiles",
    "remove",
    "human",
    "--output",
    "json",
  ]);
  assert(removeResult.removed, "Expected `profiles remove human` to report removal.");

  const finalList = await runPutioJson<ProfileList>(binaryPath, [
    "auth",
    "profiles",
    "list",
    "--output",
    "json",
  ]);
  assert(
    finalList.profiles.some((profile) => profile.name === "devs-fe-auto"),
    "Expected dev profile to remain after removing human.",
  );
  assert(
    !finalList.profiles.some((profile) => profile.name === "human"),
    "Expected human profile to be removed.",
  );
};

const main = async () => {
  let mockApiProcess: ChildProcess | undefined;
  let didCreateInstallDir = false;
  const interruptionController = createInterruptionController();
  commandAbortSignal = interruptionController.signal;

  const throwIfInterrupted = async () => {
    await wait(0);
    const signal = interruptionController.interruptedBy();
    if (signal !== undefined) {
      throw new Error(`Packed-install smoke interrupted by ${signal}.`);
    }
  };

  const runSmoke = async () => {
    rmSync(artifactsDir, { force: true, recursive: true });
    await run("pnpm", ["pack", "--pack-destination", artifactsDir]);
    await throwIfInterrupted();

    const tarball = readdirSync(artifactsDir).find((file) => file.endsWith(".tgz"));

    if (!tarball) {
      throw new Error("Expected `pnpm pack` to produce a tarball.");
    }

    await execFile(
      "npm",
      ["install", "--no-package-lock", "--no-save", resolve(artifactsDir, tarball)],
      {
        cwd: installDir,
        encoding: "utf8",
        env: {
          ...process.env,
          npm_config_cache: join(installDir, "npm-cache"),
        },
        signal: commandAbortSignal,
        timeout: commandTimeoutMs,
      },
    );
    await throwIfInterrupted();

    const binaryPath = join(installDir, "node_modules", ".bin", "putio");
    const versionOutput = (
      await execFile(binaryPath, ["version"], {
        cwd: installDir,
        encoding: "utf8",
        signal: commandAbortSignal,
        timeout: commandTimeoutMs,
      })
    ).stdout;

    JSON.parse(versionOutput);

    const describeOutput = (
      await execFile(binaryPath, ["describe"], {
        cwd: installDir,
        encoding: "utf8",
        signal: commandAbortSignal,
        timeout: commandTimeoutMs,
      })
    ).stdout;

    JSON.parse(describeOutput);
    await smokeAuthProfiles(binaryPath);

    const effectInventory = JSON.parse(
      (
        await execFile("npm", ["query", '[name="effect"]', "--json"], {
          cwd: installDir,
          encoding: "utf8",
          signal: commandAbortSignal,
          timeout: commandTimeoutMs,
        })
      ).stdout,
    ) as ReadonlyArray<NpmPackageInventoryEntry>;
    const effectVersions = effectInventory.flatMap((entry) =>
      entry.version === undefined ? [] : [entry.version],
    );
    assert(
      effectVersions.length === 1 && effectVersions[0] === "4.0.0-rc.109",
      `Expected the package to install one Effect 4.0.0-rc.109 runtime, received ${effectVersions.join(", ")}.`,
    );
    await throwIfInterrupted();

    const mockApi = startMockApi();
    mockApiProcess = mockApi.child;
    const mockApiBaseUrl = await mockApi.ready;
    const transfers = await runPutioJson<TransfersList>(
      binaryPath,
      ["transfers", "list", "--output", "json"],
      {
        PUTIO_CLI_API_BASE_URL: mockApiBaseUrl,
        PUTIO_CLI_TOKEN: "packed-smoke-token",
      },
    );
    assert(transfers.transfers.length === 0, "Expected the SDK-backed transfer list to be empty.");
    assert(transfers.cursor === null, "Expected the SDK-backed transfer list cursor to be null.");
    assert(transfers.total === 0, "Expected the SDK-backed transfer list total to be zero.");
    await throwIfInterrupted();

    const missingAuthMessage = await runPutioFailure(
      binaryPath,
      ["whoami", "--fields", "auth", "--output", "json"],
      join(installDir, "missing-config.json"),
    );
    assert(
      missingAuthMessage.includes("Set PUTIO_CLI_TOKEN or run `putio auth login`."),
      "Expected missing authentication to include an actionable recovery step.",
    );

    const invalidConfigMessage = await runPutioFailure(
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
  };

  let primaryError: unknown;
  const cleanupErrors: unknown[] = [];
  try {
    installDir = mkdtempSync(join(tmpdir(), "putio-cli-install-"));
    didCreateInstallDir = true;
    configPath = join(installDir, "putio-config.json");
    await Promise.race([runSmoke(), interruptionController.interruption]);
  } catch (error) {
    primaryError = error;
  } finally {
    if (mockApiProcess !== undefined) {
      try {
        await terminateOwnedProcess(mockApiProcess);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (didCreateInstallDir) {
      try {
        rmSync(installDir, { force: true, recursive: true });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    interruptionController.dispose();
  }

  const interruptedBy = interruptionController.interruptedBy();
  if ((interruptedBy !== undefined || primaryError !== undefined) && cleanupErrors.length > 0) {
    for (const error of cleanupErrors) {
      console.error(`Packed-install smoke cleanup failed: ${String(error)}`);
    }
  }

  const exitCode = resolveLifecycleOutcome({ cleanupErrors, interruptedBy, primaryError });
  if (exitCode !== undefined) process.exitCode = exitCode;
};

await main();
