import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const artifactsDir = join(process.cwd(), ".artifacts", "sea");

const binaryNames = readdirSync(artifactsDir).filter((entry) => {
  if (!entry.startsWith("putio-")) {
    return false;
  }

  const fullPath = join(artifactsDir, entry);

  if (!statSync(fullPath).isFile()) {
    return false;
  }

  return !entry.endsWith(".sha256");
});

if (binaryNames.length === 0) {
  throw new Error(`No SEA binaries found in ${artifactsDir}.`);
}

for (const binaryName of binaryNames) {
  const binaryPath = join(artifactsDir, binaryName);
  const digest = createHash("sha256").update(readFileSync(binaryPath)).digest("hex");
  const checksumPath = join(artifactsDir, `${binaryName}.sha256`);

  writeFileSync(checksumPath, `${digest}  ${basename(binaryPath)}\n`);
}
