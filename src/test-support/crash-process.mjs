import { installCrashBoundary } from "../internal/crash-boundary.ts";

const [kind, transport] = process.argv.slice(2);

const reporter = {
  capture: async (capturedKind) => {
    process.stderr.write(`captured:${capturedKind}\n`);
    if (transport === "reject") {
      throw new Error("transport failed");
    }
  },
  decision: { enabled: true },
};

installCrashBoundary(reporter);

if (kind === "uncaught_exception") {
  throw new Error("original uncaught marker");
}

if (kind === "unhandled_rejection") {
  void Promise.reject(new Error("original rejection marker"));
}
