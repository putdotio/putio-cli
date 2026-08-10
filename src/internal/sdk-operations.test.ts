import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { CliCommandInputError } from "./command.js";
import {
  invokeSdkOperation,
  listSdkOperations,
  normalizeSdkOperationResult,
  resolveSdkOperation,
} from "./sdk-operations.js";

describe("sdk operations", () => {
  it("discovers nested own callables without invoking accessors", () => {
    let getterCalls = 0;
    const files = {
      get: () => Effect.succeed({ id: 42 }),
    };
    Object.defineProperty(files, "secret", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return () => Effect.void;
      },
    });

    expect(listSdkOperations({ files })).toEqual({
      operations: ["files.get"],
      unsupported: [],
    });
    expect(getterCalls).toBe(0);
    expect(() => resolveSdkOperation({ files }, "files.secret")).toThrow(
      "SDK operation paths cannot resolve accessor properties.",
    );
    expect(getterCalls).toBe(0);
  });

  it("marks runtime-valued operations as unsupported", () => {
    const catalog = listSdkOperations({
      files: {
        get: () => Effect.void,
        upload: () => Effect.void,
      },
    });

    expect(catalog.operations).toEqual(["files.get"]);
    expect(catalog.unsupported).toEqual([
      {
        operation: "files.upload",
        reason: "requires a Blob-backed file input",
      },
    ]);
    expect(() =>
      resolveSdkOperation({ files: { upload: () => Effect.void } }, "files.upload"),
    ).toThrowError(CliCommandInputError);
  });

  it("excludes secret-bearing namespaces and scalar credential operations", () => {
    const catalog = listSdkOperations({
      account: {
        destroy: () => Effect.void,
      },
      auth: {
        validateToken: () => Effect.void,
      },
      oauth: {
        regenerateToken: () => Effect.succeed("secret-token"),
      },
    });

    expect(catalog.operations).toEqual([]);
    expect(catalog.unsupported).toEqual([
      {
        operation: "account.destroy",
        reason: "accepts a positional account password",
      },
      {
        operation: "auth.validateToken",
        reason: "authentication operations can expose credentials or approval codes",
      },
      {
        operation: "oauth.regenerateToken",
        reason: "returns a credential as a scalar value",
      },
    ]);
  });

  it("rejects prototype traversal and unknown paths", () => {
    const client = { files: { get: () => Effect.void } };

    expect(() => resolveSdkOperation(client, "files.__proto__.toString")).toThrow(
      "Expected `--operation` to be a dot-separated SDK path",
    );
    expect(() => resolveSdkOperation(client, "files.missing")).toThrow(
      "Unknown SDK operation: `files.missing`.",
    );
  });

  it("rejects non-enumerable methods that discovery does not advertise", () => {
    const files = {};
    Object.defineProperty(files, "privateCall", {
      enumerable: false,
      value: () => Effect.void,
    });
    const client = { files };

    expect(listSdkOperations(client).operations).toEqual([]);
    expect(() => resolveSdkOperation(client, "files.privateCall")).toThrow(
      "Unknown SDK operation: `files.privateCall`.",
    );
  });

  it("invokes Effect and pure JSON operations with positional arguments", async () => {
    const client = {
      files: {
        get: (id: number) => Effect.succeed({ id }),
      },
      helpers: {
        join: (left: string, right: string) => `${left}:${right}`,
      },
    };

    await expect(Effect.runPromise(invokeSdkOperation(client, "files.get", [42]))).resolves.toEqual(
      { id: 42 },
    );
    await expect(
      Effect.runPromise(invokeSdkOperation(client, "helpers.join", ["a", "b"])),
    ).resolves.toBe("a:b");
  });

  it("normalizes void to null and rejects non-JSON results", () => {
    expect(normalizeSdkOperationResult("family.join", undefined)).toBeNull();
    expect(() => normalizeSdkOperationResult("events.getTorrent", new Uint8Array([1]))).toThrow(
      "returned a value that cannot be represented as JSON",
    );
  });
});
