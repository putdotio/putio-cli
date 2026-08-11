import { openAsBlob } from "node:fs";

import { Effect, FileSystem, Path } from "effect";

import { CliCommandInputError } from "./command.js";

const unreadableUploadFile = () =>
  new CliCommandInputError({
    message: "Unable to read the local upload file. Verify that the path exists and is readable.",
  });

export const inspectLocalUpload = (inputPath: string) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const resolvedPath = yield* fileSystem
      .realPath(inputPath)
      .pipe(Effect.mapError(unreadableUploadFile));
    const info = yield* fileSystem.stat(resolvedPath).pipe(Effect.mapError(unreadableUploadFile));

    if (info.type !== "File") {
      return yield* Effect.fail(
        new CliCommandInputError({
          message: "Expected the upload path to point to a regular file.",
        }),
      );
    }

    yield* fileSystem
      .access(resolvedPath, { readable: true })
      .pipe(Effect.mapError(unreadableUploadFile));

    return {
      fileName: path.basename(resolvedPath),
      path: resolvedPath,
      size: Number(info.size),
    };
  });

export const openLocalUploadBlob = (path: string) =>
  Effect.tryPromise({
    try: () => openAsBlob(path),
    catch: unreadableUploadFile,
  });
