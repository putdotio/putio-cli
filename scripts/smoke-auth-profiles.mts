import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
const workDir = mkdtempSync(join(tmpdir(), "putio-cli-auth-profiles-"));
const configPath = join(workDir, "config.json");

const runJson = <A,>(args: ReadonlyArray<string>, env: Record<string, string> = {}): A =>
  JSON.parse(
    execFileSync(process.execPath, [join(root, "dist", "bin.mjs"), ...args], {
      cwd: root,
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

try {
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

  const defaultList = runJson<ProfileList>(["auth", "profiles", "list", "--output", "json"]);
  assert(
    defaultList.profiles.find((profile) => profile.name === "human")?.current === true,
    "Expected default profile `human` to be current.",
  );
  assert(
    defaultList.profiles.find((profile) => profile.name === "devs-fe-auto")?.current === false,
    "Expected `devs-fe-auto` not to be current before selection.",
  );

  const defaultStatus = runJson<AuthStatus>(["auth", "status", "--output", "json"]);
  assert(defaultStatus.authenticated, "Expected default profile status to be authenticated.");
  assert(defaultStatus.profile === "human", "Expected default status to use `human`.");
  assert(defaultStatus.source === "profile", "Expected default status source to be `profile`.");

  const envStatus = runJson<AuthStatus>(["auth", "status", "--output", "json"], {
    PUTIO_CLI_PROFILE: "devs-fe-auto",
  });
  assert(envStatus.authenticated, "Expected env-selected profile status to be authenticated.");
  assert(envStatus.profile === "devs-fe-auto", "Expected env selection to use `devs-fe-auto`.");
  assert(
    envStatus.apiBaseUrl === "https://staging.put.io",
    "Expected env-selected profile to use its profile-specific API base URL.",
  );

  const useResult = runJson<{ readonly profile: string }>([
    "auth",
    "profiles",
    "use",
    "devs-fe-auto",
    "--output",
    "json",
  ]);
  assert(useResult.profile === "devs-fe-auto", "Expected `profiles use` to select dev profile.");

  const selectedList = runJson<ProfileList>(["auth", "profiles", "list", "--output", "json"]);
  assert(
    selectedList.defaultProfile === "devs-fe-auto",
    "Expected `profiles use` to persist dev profile as default.",
  );
  assert(
    selectedList.profiles.find((profile) => profile.name === "devs-fe-auto")?.current === true,
    "Expected dev profile to be current after `profiles use`.",
  );

  const logoutResult = runJson<LogoutResult>([
    "auth",
    "logout",
    "--profile",
    "devs-fe-auto",
    "--output",
    "json",
  ]);
  assert(logoutResult.cleared, "Expected profile logout to report a cleared token.");
  assert(logoutResult.profile === "devs-fe-auto", "Expected logout to report selected profile.");

  const devAfterLogout = runJson<AuthStatus>([
    "auth",
    "status",
    "--profile",
    "devs-fe-auto",
    "--output",
    "json",
  ]);
  assert(!devAfterLogout.authenticated, "Expected dev profile to be unauthenticated after logout.");

  const humanAfterDevLogout = runJson<AuthStatus>([
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

  const removeResult = runJson<RemoveResult>([
    "auth",
    "profiles",
    "remove",
    "human",
    "--output",
    "json",
  ]);
  assert(removeResult.removed, "Expected `profiles remove human` to report removal.");

  const finalList = runJson<ProfileList>(["auth", "profiles", "list", "--output", "json"]);
  assert(
    finalList.profiles.some((profile) => profile.name === "devs-fe-auto"),
    "Expected dev profile to remain after removing human.",
  );
  assert(
    !finalList.profiles.some((profile) => profile.name === "human"),
    "Expected human profile to be removed.",
  );

  console.log(
    JSON.stringify({
      checked: [
        "default profile selection",
        "env profile selection",
        "profiles use",
        "scoped profile logout",
        "independent profile remains authenticated",
        "profiles remove",
      ],
      configPath,
    }),
  );
} finally {
  rmSync(workDir, { force: true, recursive: true });
}
