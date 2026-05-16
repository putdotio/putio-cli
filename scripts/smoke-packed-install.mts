import { execFileSync } from "node:child_process";
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

const run = (command: string, args: ReadonlyArray<string>, options: object = {}) =>
  execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
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
    }),
  ) as A;

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
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
      stdio: "pipe",
    },
  );

  const binaryPath = join(installDir, "node_modules", ".bin", "putio");
  const versionOutput = execFileSync(binaryPath, ["version"], {
    cwd: installDir,
    encoding: "utf8",
    stdio: "pipe",
  });

  JSON.parse(versionOutput);

  const describeOutput = execFileSync(binaryPath, ["describe"], {
    cwd: installDir,
    encoding: "utf8",
    stdio: "pipe",
  });

  JSON.parse(describeOutput);
  smokeAuthProfiles(binaryPath);
} finally {
  rmSync(installDir, { force: true, recursive: true });
}
