import { spawn } from "node:child_process";
import { homedir, hostname } from "node:os";
import { dirname, join } from "node:path";
import { isSea } from "node:sea";

import { Context, Effect, Layer, Match } from "effect";

type CliSpinner = {
  readonly stop: Effect.Effect<void>;
};

export type CliRuntimeService = {
  readonly argv: ReadonlyArray<string>;
  readonly isInteractiveTerminal: boolean;
  readonly isSingleExecutable: boolean;
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
  const command = Match.value(platform).pipe(
    Match.when("darwin", () => ({ file: "open", args: [url] })),
    Match.when("win32", () => ({ file: "cmd", args: ["/c", "start", "", url] })),
    Match.orElse(() => ({ file: "xdg-open", args: [url] })),
  );

  return Effect.callback<boolean>((resume, signal) => {
    let child: ReturnType<typeof spawn>;

    try {
      child = spawn(command.file, command.args, {
        detached: true,
        signal,
        stdio: "ignore",
      });
    } catch {
      resume(Effect.succeed(false));

      return;
    }

    const onError = () => {
      child.removeListener("spawn", onSpawn);
      child.removeListener("close", onClose);
      resume(Effect.succeed(false));
    };

    const onClose = () => {
      child.removeListener("error", onError);
      child.removeListener("spawn", onSpawn);
    };

    const onSpawn = () => {
      child.removeListener("error", onError);
      child.removeListener("close", onClose);
      child.unref();
      resume(Effect.succeed(true));
    };

    child.once("close", onClose);
    child.once("error", onError);
    child.once("spawn", onSpawn);

    return Effect.sync(() => {
      child.removeListener("spawn", onSpawn);
    });
  });
};

const writeStdout = (message: string): Effect.Effect<void> =>
  Effect.callback<void>((resume) => {
    let waiterInterrupted = false;
    let settled = false;
    let callbackOnlyFailure: ReturnType<typeof setImmediate> | undefined;

    const cleanup = () => {
      clearImmediate(callbackOnlyFailure);
      process.stdout.removeListener("error", onError);
      process.stdout.removeListener("close", onClose);
    };

    const onError = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (!waiterInterrupted) resume(Effect.die(error));
    };

    const onClose = () => onError(new Error("Standard output closed before the write completed"));

    const failAfterPendingErrorEvent = (error: Error) => {
      callbackOnlyFailure = setImmediate(() => onError(error));
    };

    process.stdout.once("error", onError);
    process.stdout.once("close", onClose);

    try {
      process.stdout.write(message, (error) => {
        if (settled) return;

        if (error) {
          failAfterPendingErrorEvent(error);

          return;
        }

        settled = true;
        cleanup();

        if (!waiterInterrupted) resume(Effect.void);
      });
    } catch (error) {
      cleanup();
      resume(Effect.die(error));
    }

    const stopWaitingButKeepObservingQueuedWrite = Effect.sync(() => {
      waiterInterrupted = true;
    });

    return stopWaitingButKeepObservingQueuedWrite;
  });

export type CliRuntimeOptions = {
  readonly argv?: ReadonlyArray<string>;
  readonly isInteractiveTerminal?: boolean;
  readonly isSingleExecutable?: boolean;
  readonly platform?: NodeJS.Platform;
  readonly homeDirectory?: string;
  readonly hostName?: string;
  readonly openExternal?: (url: string) => boolean;
  readonly setExitCode?: (code: number) => void;
  readonly writeStdout?: (message: string) => void;
  readonly writeStderr?: (message: string) => void;
};

export const makeCliRuntime = (options: CliRuntimeOptions = {}): CliRuntimeService => {
  const argv = options.argv ?? process.argv;
  const platform = options.platform ?? process.platform;
  const homeDirectory = options.homeDirectory ?? homedir();
  const hostName = options.hostName ?? hostname();

  const isInteractiveTerminal =
    options.isInteractiveTerminal ?? Boolean(process.stdout.isTTY && process.stdin.isTTY);

  const isSingleExecutable = options.isSingleExecutable ?? isSea();
  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

  return {
    argv,
    isInteractiveTerminal,
    isSingleExecutable,
    setExitCode: (code) =>
      Effect.sync(() => {
        if (options.setExitCode) {
          options.setExitCode(code);

          return;
        }

        process.exitCode = code;
      }),
    writeStdout: (message) =>
      options.writeStdout
        ? Effect.sync(() => options.writeStdout?.(message))
        : writeStdout(message),
    writeStderr: (message) =>
      Effect.sync(() => {
        if (options.writeStderr) {
          options.writeStderr(message);

          return;
        }

        process.stderr.write(message);
      }),
    openExternal: (url) => {
      const openExternal = options.openExternal;

      return openExternal
        ? Effect.sync(() => openExternal(url))
        : openExternalWithPlatform(platform, url);
    },
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

export const cliRuntimeLayer = (options: CliRuntimeOptions = {}) =>
  Layer.sync(CliRuntime, () => makeCliRuntime(options));

export const CliRuntimeLive = cliRuntimeLayer();
