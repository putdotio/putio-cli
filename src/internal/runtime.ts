import { spawn } from "node:child_process";
import { homedir, hostname } from "node:os";
import { dirname, join } from "node:path";

import { Context, Effect, Layer } from "effect";

export type CliSpinner = {
  readonly stop: Effect.Effect<void>;
};

export type CliRuntimeService = {
  readonly argv: ReadonlyArray<string>;
  readonly isInteractiveTerminal: boolean;
  readonly setExitCode: (code: number) => Effect.Effect<void>;
  readonly writeStdout: (message: string) => Effect.Effect<void>;
  readonly writeStderr: (message: string) => Effect.Effect<void>;
  readonly openExternal: (url: string) => Effect.Effect<boolean>;
  readonly startSpinner: (message: string) => Effect.Effect<CliSpinner>;
  readonly getHomeDirectory: Effect.Effect<string>;
  readonly getHostname: Effect.Effect<string>;
  readonly joinPath: (...segments: ReadonlyArray<string>) => string;
  readonly dirname: (path: string) => string;
};

export class CliRuntime extends Context.Service<CliRuntime, CliRuntimeService>()(
  "@putdotio/cli/CliRuntime",
) {}

const openExternalWithPlatform = (platform: NodeJS.Platform, url: string) => {
  const command =
    platform === "darwin"
      ? { file: "open", args: [url] }
      : platform === "win32"
        ? { file: "cmd", args: ["/c", "start", "", url] }
        : { file: "xdg-open", args: [url] };

  try {
    const child = spawn(command.file, command.args, {
      detached: true,
      stdio: "ignore",
    });

    child.unref();

    return true;
  } catch {
    return false;
  }
};

export const makeCliRuntime = (
  options: {
    readonly argv?: ReadonlyArray<string>;
    readonly isInteractiveTerminal?: boolean;
    readonly platform?: NodeJS.Platform;
    readonly homeDirectory?: string;
    readonly hostName?: string;
    readonly writeStdout?: (message: string) => void;
    readonly writeStderr?: (message: string) => void;
  } = {},
): CliRuntimeService => {
  const argv = options.argv ?? process.argv;
  const platform = options.platform ?? process.platform;
  const homeDirectory = options.homeDirectory ?? homedir();
  const hostName = options.hostName ?? hostname();
  const isInteractiveTerminal =
    options.isInteractiveTerminal ?? Boolean(process.stdout.isTTY && process.stdin.isTTY);
  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

  return {
    argv,
    isInteractiveTerminal,
    setExitCode: (code) =>
      Effect.sync(() => {
        process.exitCode = code;
      }),
    writeStdout: (message) =>
      Effect.sync(() => {
        if (options.writeStdout) {
          options.writeStdout(message);
          return;
        }

        process.stdout.write(message);
      }),
    writeStderr: (message) =>
      Effect.sync(() => {
        if (options.writeStderr) {
          options.writeStderr(message);
          return;
        }

        process.stderr.write(message);
      }),
    openExternal: (url) => Effect.sync(() => openExternalWithPlatform(platform, url)),
    startSpinner: (message) =>
      Effect.sync(() => {
        let frameIndex = 0;
        const render = () => {
          process.stdout.write(`\r\x1b[K${spinnerFrames[frameIndex]} ${message}`);
          frameIndex = (frameIndex + 1) % spinnerFrames.length;
        };

        render();

        const interval = setInterval(render, 80);
        let stopped = false;

        return {
          stop: Effect.sync(() => {
            if (stopped) {
              return;
            }

            stopped = true;
            clearInterval(interval);
            process.stdout.write("\r\x1b[K");
          }),
        } satisfies CliSpinner;
      }),
    getHomeDirectory: Effect.succeed(homeDirectory),
    getHostname: Effect.succeed(hostName),
    joinPath: (...segments) => join(...segments),
    dirname: (path) => dirname(path),
  };
};

export const CliRuntimeLive = Layer.sync(CliRuntime, () => makeCliRuntime());
