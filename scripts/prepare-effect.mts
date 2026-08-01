import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";

if (process.env.CI || process.env.GITHUB_ACTIONS) {
  process.exit(0);
}

const repoDir = ".repos/effect";
const repoUrl = "https://github.com/Effect-TS/effect.git";

const packageJson: unknown = JSON.parse(readFileSync("package.json", "utf8"));

if (
  typeof packageJson !== "object" ||
  packageJson === null ||
  !("dependencies" in packageJson) ||
  typeof packageJson.dependencies !== "object" ||
  packageJson.dependencies === null ||
  !("effect" in packageJson.dependencies) ||
  typeof packageJson.dependencies.effect !== "string"
) {
  throw new Error("Expected package.json dependencies.effect to own the Effect version.");
}

const effectVersion = packageJson.dependencies.effect;

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(effectVersion)) {
  throw new Error(`Expected an exact Effect version, received ${effectVersion}.`);
}

const effectRef = `effect@${effectVersion}`;

const git = (args: ReadonlyArray<string>) =>
  execFileSync("git", ["-C", repoDir, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const normalizeRepoUrl = (url: string) =>
  url
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");

if (!existsSync(`${repoDir}/.git`)) {
  mkdirSync(".repos", { recursive: true });
  execFileSync(
    "git",
    [
      "clone",
      "--branch",
      effectRef,
      "--depth",
      "1",
      "--filter=blob:none",
      "--single-branch",
      repoUrl,
      repoDir,
    ],
    { stdio: "inherit" },
  );
  process.exit(0);
}

const actualRepoUrl = git(["remote", "get-url", "origin"]);

if (normalizeRepoUrl(actualRepoUrl) !== normalizeRepoUrl(repoUrl)) {
  throw new Error(
    `Expected ${repoDir} origin to be ${repoUrl}, received ${actualRepoUrl}. ` +
      `Repair it with: git -C ${repoDir} remote set-url origin ${repoUrl}`,
  );
}

if (git(["status", "--porcelain"]).length > 0) {
  throw new Error(
    `Refusing to align ${repoDir} while it has local changes. Commit or stash them first.`,
  );
}

let resolvedRef: string;

try {
  resolvedRef = git(["rev-list", "-n", "1", effectRef]);
} catch {
  execFileSync(
    "git",
    [
      "-C",
      repoDir,
      "fetch",
      "--depth",
      "1",
      "origin",
      `refs/tags/${effectRef}:refs/tags/${effectRef}`,
    ],
    { stdio: "inherit" },
  );
  resolvedRef = git(["rev-list", "-n", "1", effectRef]);
}

if (git(["rev-parse", "HEAD"]) !== resolvedRef) {
  execFileSync("git", ["-C", repoDir, "checkout", "--detach", effectRef], {
    stdio: "inherit",
  });
}
