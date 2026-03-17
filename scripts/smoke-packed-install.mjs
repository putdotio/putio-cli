import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = process.cwd();
const artifactsDir = join(root, ".artifacts");
const installDir = mkdtempSync(join(tmpdir(), "putio-cli-install-"));

const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });

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
} finally {
  rmSync(installDir, { force: true, recursive: true });
}
