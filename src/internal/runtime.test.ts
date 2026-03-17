import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    spawnMock.mockReturnValue({ unref: vi.fn() });

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
      expect.objectContaining({ detached: true, stdio: "ignore" }),
    );
    expect(spawnMock).toHaveBeenNthCalledWith(
      2,
      "xdg-open",
      ["https://app.put.io"],
      expect.objectContaining({ detached: true, stdio: "ignore" }),
    );
    expect(spawnMock).toHaveBeenNthCalledWith(
      3,
      "cmd",
      ["/c", "start", "", "https://app.put.io"],
      expect.objectContaining({ detached: true, stdio: "ignore" }),
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
