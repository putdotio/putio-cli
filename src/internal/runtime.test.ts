import { Effect, Fiber } from "effect";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

import { makeCliRuntime } from "./runtime.js";

describe("makeCliRuntime", () => {
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    vi.useFakeTimers();
    spawnMock.mockReset();
    process.exitCode = originalExitCode;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.exitCode = originalExitCode;
  });

  it("opens URLs with the right command for each platform", async () => {
    spawnMock.mockImplementation(() => {
      const child = new EventEmitter() as EventEmitter & {
        pid: number;
        unref: ReturnType<typeof vi.fn>;
      };
      child.pid = 123;
      child.unref = vi.fn();
      queueMicrotask(() => child.emit("spawn"));
      return child;
    });

    const darwin = makeCliRuntime({ platform: "darwin" });
    const linux = makeCliRuntime({ platform: "linux" });
    const win32 = makeCliRuntime({ platform: "win32" });

    await Effect.runPromise(darwin.openExternal("https://app.put.io"));
    await Effect.runPromise(linux.openExternal("https://app.put.io"));
    await Effect.runPromise(win32.openExternal("https://app.put.io"));

    expect(spawnMock).toHaveBeenNthCalledWith(
      1,
      "open",
      ["https://app.put.io"],
      expect.objectContaining({ detached: true, signal: expect.any(AbortSignal), stdio: "ignore" }),
    );
    expect(spawnMock).toHaveBeenNthCalledWith(
      2,
      "xdg-open",
      ["https://app.put.io"],
      expect.objectContaining({ detached: true, signal: expect.any(AbortSignal), stdio: "ignore" }),
    );
    expect(spawnMock).toHaveBeenNthCalledWith(
      3,
      "cmd",
      ["/c", "start", "", "https://app.put.io"],
      expect.objectContaining({ detached: true, signal: expect.any(AbortSignal), stdio: "ignore" }),
    );
  });

  it("returns false when opening a URL throws", async () => {
    spawnMock.mockImplementation(() => {
      throw new Error("boom");
    });

    const runtime = makeCliRuntime({ platform: "linux" });

    await expect(Effect.runPromise(runtime.openExternal("https://app.put.io"))).resolves.toBe(
      false,
    );
  });

  it("returns false when the opener emits an asynchronous spawn error", async () => {
    const unref = vi.fn();
    spawnMock.mockImplementation(() => {
      const child = new EventEmitter() as EventEmitter & {
        pid: undefined;
        unref: ReturnType<typeof vi.fn>;
      };
      child.pid = undefined;
      child.unref = unref;
      queueMicrotask(() => child.emit("error", new Error("missing opener")));
      return child;
    });

    const runtime = makeCliRuntime({ platform: "linux" });

    await expect(Effect.runPromise(runtime.openExternal("https://app.put.io"))).resolves.toBe(
      false,
    );
    expect(unref).not.toHaveBeenCalled();
  });

  it("aborts opener startup without leaving AbortError unhandled", async () => {
    const child = new EventEmitter() as EventEmitter & {
      unref: ReturnType<typeof vi.fn>;
    };
    child.unref = vi.fn();
    let spawnSignal: AbortSignal | undefined;
    spawnMock.mockImplementation((_file, _args, options: { signal: AbortSignal }) => {
      spawnSignal = options.signal;
      options.signal.addEventListener(
        "abort",
        () => queueMicrotask(() => child.emit("error", new Error("aborted"))),
        { once: true },
      );
      return child;
    });

    const runtime = makeCliRuntime({ platform: "linux" });
    const fiber = Effect.runFork(runtime.openExternal("https://app.put.io"));

    await Effect.runPromise(Fiber.interrupt(fiber));
    await Promise.resolve();

    expect(spawnSignal?.aborted).toBe(true);
    expect(child.listenerCount("error")).toBe(0);
    expect(child.listenerCount("spawn")).toBe(0);
    expect(child.listenerCount("close")).toBe(0);
    expect(child.unref).not.toHaveBeenCalled();
  });

  it("starts and stops a spinner and clears the terminal line", async () => {
    spawnMock.mockReturnValue({ unref: vi.fn() });
    const writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const runtime = makeCliRuntime();

    const spinner = await Effect.runPromise(runtime.startSpinner("Loading"));

    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining("Loading"));

    vi.advanceTimersByTime(160);
    await Effect.runPromise(spinner.stop);

    expect(writeSpy).toHaveBeenLastCalledWith("\r\x1b[K");
  });

  it("exposes process/path helpers through the runtime interface", async () => {
    const runtime = makeCliRuntime({
      argv: ["node", "putio", "version"],
      homeDirectory: "/tmp/putio-home",
      hostName: "putio-host",
    });

    await Effect.runPromise(runtime.setExitCode(7));

    expect(process.exitCode).toBe(7);
    await expect(Effect.runPromise(runtime.getHomeDirectory)).resolves.toBe("/tmp/putio-home");
    await expect(Effect.runPromise(runtime.getHostname)).resolves.toBe("putio-host");
    expect(runtime.joinPath("/tmp", "putio", "state.json")).toContain("putio");
    expect(runtime.dirname("/tmp/putio/state.json")).toBe("/tmp/putio");
    expect(runtime.argv).toEqual(["node", "putio", "version"]);
  });
});
