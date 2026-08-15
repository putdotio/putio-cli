import assert from "node:assert/strict";
import { execFile as execFileCallback, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import process from "node:process";
import test from "node:test";
import { promisify } from "node:util";
import {
  createInterruptionController,
  ownedProcessExists,
  resolveLifecycleOutcome,
  terminateOwnedProcess,
} from "./process-lifecycle.mts";

const execFile = promisify(execFileCallback);

const fixtureSource = `
process.on("SIGTERM", () => process.exit(0));
process.stdout.write("ready\\n");
setInterval(() => undefined, 1_000);
`;

const stubbornGroupSource = `
const { spawn } = require("node:child_process");
const descendant = spawn(
  process.execPath,
  ["-e", 'process.on("SIGTERM", () => undefined); process.stdout.write("ready\\\\n"); setInterval(() => undefined, 1_000);'],
  { stdio: ["ignore", "pipe", "ignore"] },
);
descendant.stdout.once("data", () => process.stdout.write(String(descendant.pid) + "\\n"));
process.on("SIGTERM", () => process.exit(0));
setInterval(() => undefined, 1_000);
`;

const processExists = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
};

const readLine = (child: ChildProcess) =>
  new Promise<string>((resolve, reject) => {
    let stdout = "";
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      reject(new Error(`Child exited before readiness with code ${code} and signal ${signal}.`));
    });
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
      const newline = stdout.indexOf("\n");
      if (newline >= 0) resolve(stdout.slice(0, newline));
    });
  });

const runSignalFixture = async () => {
  const interruptionController = createInterruptionController();
  const child = spawn(process.execPath, ["-e", fixtureSource], {
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "inherit"],
  });
  let primaryError: unknown;
  const cleanupErrors: unknown[] = [];

  try {
    await readLine(child);
    process.stdout.write(`ready ${child.pid ?? "unknown"}\n`);
    await interruptionController.interruption;
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      await terminateOwnedProcess(child);
    } catch (error) {
      cleanupErrors.push(error);
    }
    interruptionController.dispose();
  }

  const exitCode = resolveLifecycleOutcome({
    cleanupErrors,
    interruptedBy: interruptionController.interruptedBy(),
    primaryError,
  });
  if (exitCode !== undefined) process.exitCode = exitCode;
};

const runCommandInterruptionFixture = async () => {
  const interruptionController = createInterruptionController();
  let primaryError: unknown;

  try {
    const runningCommand = execFile(
      process.execPath,
      ["-e", "setTimeout(() => process.exit(7), 1_000)"],
      { signal: interruptionController.signal },
    );
    process.stdout.write("ready\n");
    await Promise.race([runningCommand, interruptionController.interruption]);
  } catch (error) {
    primaryError = error;
  } finally {
    interruptionController.dispose();
  }

  const exitCode = resolveLifecycleOutcome({
    cleanupErrors: [],
    interruptedBy: interruptionController.interruptedBy(),
    primaryError,
  });
  if (exitCode !== undefined) process.exitCode = exitCode;
};

const interruptFixture = async (signal: "SIGINT" | "SIGTERM", expectedExitCode: number) => {
  const fixture = spawn(process.execPath, [fileURLToPath(import.meta.url), "--fixture"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const ready = await readLine(fixture);
  const match = /^ready (\d+)$/.exec(ready);
  assert.ok(match, `Expected fixture readiness with a child PID, received ${ready}.`);
  const childPid = Number(match[1]);

  fixture.kill(signal);
  const [exitCode, exitSignal] = (await once(fixture, "exit")) as [number | null, string | null];

  assert.equal(exitSignal, null);
  assert.equal(exitCode, expectedExitCode);
  assert.equal(processExists(childPid), false, "owned child survived fixture exit");
};

if (process.argv[2] === "--fixture") {
  await runSignalFixture();
} else if (process.argv[2] === "--command-fixture") {
  await runCommandInterruptionFixture();
} else {
  test(
    "SIGINT reaps the owned child before returning exit 130",
    { skip: process.platform === "win32" },
    () => interruptFixture("SIGINT", 130),
  );

  test(
    "SIGTERM reaps the owned child before returning exit 143",
    { skip: process.platform === "win32" },
    () => interruptFixture("SIGTERM", 143),
  );

  test(
    "termination escalates until the owned process group is absent",
    { skip: process.platform === "win32" },
    async () => {
      const leader = spawn(process.execPath, ["-e", stubbornGroupSource], {
        detached: true,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const descendantPid = Number(await readLine(leader));
      assert.ok(Number.isInteger(descendantPid) && descendantPid > 0);

      await terminateOwnedProcess(leader, { forceTimeoutMs: 2_000, gracefulTimeoutMs: 100 });

      assert.equal(ownedProcessExists(leader), false);
      assert.equal(processExists(descendantPid), false, "owned descendant survived cleanup return");
    },
  );

  test("primary failures are not masked by cleanup failures", () => {
    const primaryError = new Error("primary failure");
    assert.throws(
      () =>
        resolveLifecycleOutcome({
          cleanupErrors: [new Error("cleanup failure")],
          interruptedBy: undefined,
          primaryError,
        }),
      (error) => error === primaryError,
    );
  });

  test("interruption exit status is not masked by cleanup failures", () => {
    assert.equal(
      resolveLifecycleOutcome({
        cleanupErrors: [new Error("cleanup failure")],
        interruptedBy: "SIGTERM",
        primaryError: new Error("interrupted"),
      }),
      143,
    );
  });

  test("cleanup-only failures remain visible", () => {
    assert.throws(
      () =>
        resolveLifecycleOutcome({
          cleanupErrors: [new Error("cleanup failure")],
          interruptedBy: undefined,
          primaryError: undefined,
        }),
      AggregateError,
    );
  });

  test(
    "a signal during a child command keeps its interruption exit status",
    { skip: process.platform === "win32" },
    async () => {
      const fixture = spawn(
        process.execPath,
        [fileURLToPath(import.meta.url), "--command-fixture"],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      assert.equal(await readLine(fixture), "ready");
      assert.equal(fixture.kill("SIGTERM"), true);

      const [exitCode, exitSignal] = (await once(fixture, "exit")) as [
        number | null,
        string | null,
      ];
      assert.equal(exitSignal, null);
      assert.equal(exitCode, 143);
    },
  );
}
