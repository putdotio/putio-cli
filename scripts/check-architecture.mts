import { globSync, readFileSync } from "node:fs";

const requestedFiles = process.argv.slice(2);
const files =
  requestedFiles.length > 0
    ? requestedFiles
    : globSync("src/**/*.ts", {
        exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/test-support/**"],
      });
const effectRuntimePattern = /\bEffect\.run(?:Fork|Promise(?:Exit)?|Sync(?:Exit)?)\b/;
let violationCount = 0;

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");

  for (const [index, line] of lines.entries()) {
    if (!effectRuntimePattern.test(line)) {
      continue;
    }

    violationCount += 1;
    process.stderr.write(
      `${file}:${index + 1}: Effect.run* is forbidden in production modules. ` +
        "Return the Effect and execute it through NodeRuntime.runMain in src/bin.ts or src/sea.ts. " +
        "See docs/ARCHITECTURE.md.\n",
    );
  }
}

if (violationCount > 0) {
  process.exitCode = 1;
}
