import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

if (process.env.CI || process.env.GITHUB_ACTIONS) {
  process.exit(0);
}

const repoDir = ".repos/effect";
const repoUrl = "https://github.com/Effect-TS/effect-smol";

if (existsSync(`${repoDir}/.git`)) {
  process.exit(0);
}

mkdirSync(".repos", { recursive: true });
execFileSync("git", ["clone", repoUrl, repoDir], { stdio: "inherit" });
