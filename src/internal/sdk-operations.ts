import type { PutioSdkContext } from "@putdotio/sdk";
import { Effect, Schema } from "effect";

import { CliCommandInputError } from "./command.js";

export type SdkJsonValue = Schema.Schema.Type<typeof Schema.Json>;

type SdkCallable = (...args: ReadonlyArray<SdkJsonValue>) => unknown;

type ResolvedSdkOperation = {
  readonly callable: SdkCallable;
  readonly receiver: object;
};

const unsupportedOperations = new Map<string, string>([
  ["account.destroy", "accepts a positional account password"],
  ["config.getKeyWith", "requires a runtime schema decoder"],
  ["config.readWith", "requires a runtime schema decoder"],
  ["events.getTorrent", "returns binary data"],
  ["files.createUploadRequest", "requires a Blob-backed file input"],
  ["files.upload", "requires a Blob-backed file input"],
  ["oauth.setIcon", "requires a Blob-backed icon input"],
  ["oauth.regenerateToken", "returns a credential as a scalar value"],
]);

const unsupportedNamespaces = new Map<string, string>([
  ["auth", "authentication operations can expose credentials or approval codes"],
  ["config", "arbitrary key-value operations can expose secret scalar values"],
]);

const operationSegmentPattern = /^[a-z][A-Za-z0-9]*$/u;
const blockedOperationSegments = new Set(["__proto__", "constructor", "prototype"]);

const isTraversableObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const operationError = (message: string) => new CliCommandInputError({ message });

const getUnsupportedReason = (operation: string) => {
  const exactReason = unsupportedOperations.get(operation);
  if (exactReason !== undefined) {
    return exactReason;
  }

  const [namespace] = operation.split(".");
  return namespace === undefined ? undefined : unsupportedNamespaces.get(namespace);
};

const validateOperationPath = (operation: string) => {
  const segments = operation.split(".");

  if (
    operation.trim() !== operation ||
    segments.length < 2 ||
    segments.some(
      (segment) => !operationSegmentPattern.test(segment) || blockedOperationSegments.has(segment),
    )
  ) {
    throw operationError(
      "Expected `--operation` to be a dot-separated SDK path such as `files.get`.",
    );
  }

  return segments;
};

export type SdkOperationCatalog = {
  readonly operations: ReadonlyArray<string>;
  readonly unsupported: ReadonlyArray<{
    readonly operation: string;
    readonly reason: string;
  }>;
};

export const listSdkOperations = (client: unknown): SdkOperationCatalog => {
  const operations: Array<string> = [];
  const discoveredUnsupported: Array<{ readonly operation: string; readonly reason: string }> = [];
  const ancestors = new WeakSet<object>();

  const visit = (value: unknown, path: ReadonlyArray<string>) => {
    if (!isTraversableObject(value) || ancestors.has(value)) {
      return;
    }

    ancestors.add(value);

    for (const key of Object.keys(value).toSorted()) {
      if (!operationSegmentPattern.test(key) || blockedOperationSegments.has(key)) {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) {
        continue;
      }

      const operationPath = [...path, key];
      const operation = operationPath.join(".");

      if (typeof descriptor.value === "function") {
        if (operationPath.length < 2) {
          continue;
        }

        const reason = getUnsupportedReason(operation);
        if (reason === undefined) {
          operations.push(operation);
        } else {
          discoveredUnsupported.push({ operation, reason });
        }
        continue;
      }

      visit(descriptor.value, operationPath);
    }

    ancestors.delete(value);
  };

  visit(client, []);

  return {
    operations: operations.toSorted(),
    unsupported: discoveredUnsupported.toSorted((left, right) =>
      left.operation.localeCompare(right.operation),
    ),
  };
};

export const resolveSdkOperation = (client: unknown, operation: string): ResolvedSdkOperation => {
  const segments = validateOperationPath(operation);
  const unsupportedReason = getUnsupportedReason(operation);

  if (unsupportedReason !== undefined) {
    throw operationError(
      `SDK operation \`${operation}\` is not JSON-callable: ${unsupportedReason}.`,
    );
  }

  let current: unknown = client;
  let receiver: object | undefined;

  for (const segment of segments) {
    if (!isTraversableObject(current)) {
      throw operationError(`Unknown SDK operation: \`${operation}\`.`);
    }

    const descriptor = Object.getOwnPropertyDescriptor(current, segment);
    if (!descriptor || descriptor.enumerable !== true) {
      throw operationError(`Unknown SDK operation: \`${operation}\`.`);
    }

    if (!("value" in descriptor)) {
      throw operationError(`SDK operation paths cannot resolve accessor properties.`);
    }

    receiver = current;
    current = descriptor.value;
  }

  if (receiver === undefined || typeof current !== "function") {
    throw operationError(`Unknown SDK operation: \`${operation}\`.`);
  }

  return {
    callable: current as SdkCallable,
    receiver,
  };
};

type DynamicSdkEffect = Effect.Effect<unknown, unknown, PutioSdkContext>;

export const invokeSdkOperation = (
  client: unknown,
  operation: string,
  args: ReadonlyArray<SdkJsonValue>,
): DynamicSdkEffect =>
  Effect.try({
    try: () => {
      const resolved = resolveSdkOperation(client, operation);
      return Reflect.apply(resolved.callable, resolved.receiver, args);
    },
    catch: (error) =>
      error instanceof CliCommandInputError
        ? error
        : operationError(`SDK operation \`${operation}\` rejected its arguments before execution.`),
  }).pipe(
    Effect.flatMap((result) =>
      Effect.isEffect(result) ? (result as DynamicSdkEffect) : Effect.succeed(result),
    ),
  );

export const normalizeSdkOperationResult = (operation: string, value: unknown): SdkJsonValue => {
  if (value === undefined) {
    return null;
  }

  try {
    return Schema.decodeUnknownSync(Schema.Json)(value);
  } catch {
    throw operationError(
      `SDK operation \`${operation}\` returned a value that cannot be represented as JSON.`,
    );
  }
};
