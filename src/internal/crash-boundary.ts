import type { CrashKind, CrashReporterService } from "./crash-reporting.js";

type ReplayFatal = (kind: CrashKind, reason: unknown) => void;
type UncaughtExceptionOrigin = "uncaughtException" | "unhandledRejection";
type UncaughtExceptionHandler = (error: Error, origin?: UncaughtExceptionOrigin) => void;
type UnhandledRejectionHandler = (reason: unknown) => void;
type UnhandledRejectionsMode = "none" | "strict" | "throw" | "warn" | "warn-with-error-code";

export type CrashBoundaryRuntime = {
  readonly addUncaughtExceptionHandler: (handler: UncaughtExceptionHandler) => void;
  readonly addUnhandledRejectionHandler: (handler: UnhandledRejectionHandler) => void;
  readonly removeUncaughtExceptionHandler: (handler: UncaughtExceptionHandler) => void;
  readonly removeUnhandledRejectionHandler: (handler: UnhandledRejectionHandler) => void;
};

export type CrashBoundaryOptions = {
  readonly runtime?: CrashBoundaryRuntime;
  readonly replayFatal?: ReplayFatal;
};

const nodeCrashBoundaryRuntime: CrashBoundaryRuntime = {
  addUncaughtExceptionHandler: (handler) => {
    process.on("uncaughtException", handler);
  },
  addUnhandledRejectionHandler: (handler) => {
    process.on("unhandledRejection", handler);
  },
  removeUncaughtExceptionHandler: (handler) => {
    process.removeListener("uncaughtException", handler);
  },
  removeUnhandledRejectionHandler: (handler) => {
    process.removeListener("unhandledRejection", handler);
  },
};

const unhandledRejectionsModePattern =
  /--unhandled-rejections(?:=|\s+)(?:(["'])(warn-with-error-code|strict|throw|warn|none)\1|(warn-with-error-code|strict|throw|warn|none))(?=\s|["']|$)/gu;

const isUnhandledRejectionsMode = (value: string | undefined): value is UnhandledRejectionsMode =>
  value === "none" ||
  value === "strict" ||
  value === "throw" ||
  value === "warn" ||
  value === "warn-with-error-code";

const getUnhandledRejectionsMode = (
  execArgv: ReadonlyArray<string> = process.execArgv,
  nodeOptions: string | undefined = process.env.NODE_OPTIONS,
): UnhandledRejectionsMode => {
  let mode: UnhandledRejectionsMode = "throw";

  for (const match of nodeOptions?.matchAll(unhandledRejectionsModePattern) ?? []) {
    const value = match[2] ?? match[3];
    if (isUnhandledRejectionsMode(value)) {
      mode = value;
    }
  }

  for (const [index, argument] of execArgv.entries()) {
    const inline = argument.match(/^--unhandled-rejections=(.+)$/u)?.[1];
    const value =
      inline ?? (argument === "--unhandled-rejections" ? execArgv[index + 1] : undefined);
    if (isUnhandledRejectionsMode(value)) {
      mode = value;
    }
  }

  return mode;
};

const replayFatalWithNode = (kind: CrashKind, reason: unknown) => {
  if (kind === "unhandled_rejection") {
    const mode = getUnhandledRejectionsMode();
    if (mode === "none" || mode === "warn") {
      return;
    }

    void Promise.reject(reason);
    return;
  }

  setImmediate(() => {
    throw reason;
  });
};

export const installCrashBoundary = (
  reporter: CrashReporterService,
  options: CrashBoundaryOptions = {},
) => {
  if (!reporter.decision.enabled) {
    return () => undefined;
  }

  const runtime = options.runtime ?? nodeCrashBoundaryRuntime;
  const replayFatal = options.replayFatal ?? replayFatalWithNode;
  let handling = false;

  const remove = () => {
    runtime.removeUncaughtExceptionHandler(onUncaughtException);
    runtime.removeUnhandledRejectionHandler(onUnhandledRejection);
  };

  const handle = (kind: CrashKind, reason: unknown) => {
    if (handling) {
      return;
    }

    handling = true;
    remove();

    void reporter.capture(kind).then(
      () => replayFatal(kind, reason),
      () => replayFatal(kind, reason),
    );
  };

  const onUncaughtException = (error: Error, origin?: UncaughtExceptionOrigin) => {
    if (origin === "unhandledRejection" && getUnhandledRejectionsMode() === "strict") {
      return;
    }

    handle("uncaught_exception", error);
  };
  const onUnhandledRejection = (reason: unknown) => {
    handle("unhandled_rejection", reason);
  };

  runtime.addUncaughtExceptionHandler(onUncaughtException);
  runtime.addUnhandledRejectionHandler(onUnhandledRejection);

  return remove;
};
