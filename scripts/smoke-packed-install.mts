import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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

const root = process.cwd();
const artifactsDir = join(root, ".artifacts");
const installDir = mkdtempSync(join(tmpdir(), "putio-cli-install-"));
const configPath = join(installDir, "putio-config.json");
const commandTimeoutMs = 120_000;

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
    defaultList.profiles.find((profile) => profile.name === "devs-fe-auto")?.current === false,
    "Expected `devs-fe-auto` not to be current before selection.",
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
    PUTIO_CLI_PROFILE: "devs-fe-auto",
  });
  assert(envStatus.authenticated, "Expected env-selected profile status to be authenticated.");
  assert(envStatus.profile === "devs-fe-auto", "Expected env selection to use `devs-fe-auto`.");
  assert(
    envStatus.apiBaseUrl === "https://staging.put.io",
    "Expected env-selected profile to use its profile-specific API base URL.",
  );

  const useResult = runPutioJson<{ readonly profile: string }>(binaryPath, [
    "auth",
    "profiles",
    "use",
    "devs-fe-auto",
    "--output",
    "json",
  ]);
  assert(useResult.profile === "devs-fe-auto", "Expected `profiles use` to select dev profile.");

  const selectedList = runPutioJson<ProfileList>(binaryPath, [
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

  const logoutResult = runPutioJson<LogoutResult>(binaryPath, [
    "auth",
    "logout",
    "--profile",
    "devs-fe-auto",
    "--output",
    "json",
  ]);
  assert(logoutResult.cleared, "Expected profile logout to report a cleared token.");
  assert(logoutResult.profile === "devs-fe-auto", "Expected logout to report selected profile.");

  const devAfterLogout = runPutioJson<AuthStatus>(binaryPath, [
    "auth",
    "status",
    "--profile",
    "devs-fe-auto",
    "--output",
    "json",
  ]);
  assert(!devAfterLogout.authenticated, "Expected dev profile to be unauthenticated after logout.");

  const humanAfterDevLogout = runPutioJson<AuthStatus>(binaryPath, [
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
    finalList.profiles.some((profile) => profile.name === "devs-fe-auto"),
    "Expected dev profile to remain after removing human.",
  );
  assert(
    !finalList.profiles.some((profile) => profile.name === "human"),
    "Expected human profile to be removed.",
  );
};

try {
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
} finally {
  rmSync(installDir, { force: true, recursive: true });
}
