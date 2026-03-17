import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const platform = process.platform;
const extension = platform === "win32" ? ".exe" : "";
const binaryPath = join(process.cwd(), ".artifacts", "sea", `putio${extension}`);

if (!existsSync(binaryPath)) {
  throw new Error(`Expected SEA binary at ${binaryPath}. Run \`pnpm run build:sea\` first.`);
}

const run = (args) =>
  execFileSync(binaryPath, args, {
    encoding: "utf8",
    stdio: "pipe",
  });

JSON.parse(run(["version"]));
JSON.parse(run(["describe"]));
JSON.parse(
  run(["transfers", "cancel", "--json", '{"ids":[12,18]}', "--dry-run", "--output", "json"]),
);
