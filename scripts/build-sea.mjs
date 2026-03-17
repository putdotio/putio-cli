import { execFileSync } from "node:child_process";
import { createWriteStream, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { request } from "node:https";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";

const root = process.cwd();
const artifactsDir = join(root, ".artifacts", "sea");
const buildDir = join(artifactsDir, "build");
const runtimeDir = join(artifactsDir, "runtime");

const platform = process.platform;
const arch = process.arch;
const extension = platform === "win32" ? ".exe" : "";
const outputBinary = join(artifactsDir, `putio-${platform}-${arch}${extension}`);
const seaEntry = join(buildDir, "putio-sea.cjs");
const seaBlob = join(buildDir, "putio-sea.blob");
const seaConfig = join(buildDir, "sea-config.json");
const seaSentinelFuse = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

const localBin = (name) =>
  join(root, "node_modules", ".bin", `${name}${platform === "win32" ? ".cmd" : ""}`);

const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
    ...options,
  });

const downloadFile = async (url, destination) => {
  await mkdir(dirname(destination), { recursive: true });

  await new Promise((resolve, reject) => {
    const req = request(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        typeof response.headers.location === "string"
      ) {
        response.resume();
        resolve(downloadFile(response.headers.location, destination));
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Unable to download ${url}. Received status ${response.statusCode}.`));
        return;
      }

      pipeline(response, createWriteStream(destination)).then(resolve, reject);
    });

    req.on("error", reject);
    req.end();
  });
};

const resolveOfficialNodeRuntime = async () => {
  if (process.env.SEA_NODE_BINARY) {
    return process.env.SEA_NODE_BINARY;
  }

  const version = process.version.slice(1);
  const platformLabel = platform === "win32" ? "win" : platform === "darwin" ? "darwin" : "linux";
  const archiveExtension = platform === "win32" ? "zip" : "tar.xz";
  const baseName = `node-v${version}-${platformLabel}-${arch}`;
  const archivePath = join(runtimeDir, `${baseName}.${archiveExtension}`);
  const extractDir = join(runtimeDir, baseName);
  const nodeBinary =
    platform === "win32" ? join(extractDir, "node.exe") : join(extractDir, "bin", "node");

  if (existsSync(nodeBinary)) {
    return nodeBinary;
  }

  await downloadFile(
    `https://nodejs.org/dist/v${version}/${baseName}.${archiveExtension}`,
    archivePath,
  );

  mkdirSync(runtimeDir, { recursive: true });
  run("tar", ["-xf", archivePath, "-C", runtimeDir]);
  await unlink(archivePath);

  if (!existsSync(nodeBinary)) {
    throw new Error(`Expected Node runtime at ${nodeBinary}.`);
  }

  return nodeBinary;
};

rmSync(artifactsDir, { force: true, recursive: true });
mkdirSync(buildDir, { recursive: true });

run(localBin("esbuild"), [
  "src/sea.ts",
  "--bundle",
  "--format=cjs",
  "--platform=node",
  "--target=node24",
  "--outfile=" + seaEntry,
]);

writeFileSync(
  seaConfig,
  JSON.stringify(
    {
      disableExperimentalSEAWarning: true,
      main: seaEntry,
      output: seaBlob,
      useCodeCache: false,
      useSnapshot: false,
    },
    null,
    2,
  ),
);

run(process.execPath, ["--experimental-sea-config", seaConfig]);

const officialNodeBinary = await resolveOfficialNodeRuntime();

cpSync(officialNodeBinary, outputBinary);

if (platform === "darwin") {
  try {
    run("codesign", ["--remove-signature", outputBinary]);
  } catch {
    // The downloaded Node binary may already be unsigned in CI/local environments.
  }
}

const postjectArgs = [outputBinary, "NODE_SEA_BLOB", seaBlob, "--sentinel-fuse", seaSentinelFuse];

if (platform === "darwin") {
  postjectArgs.push("--macho-segment-name", "NODE_SEA");
}

run(localBin("postject"), postjectArgs);

if (platform !== "win32") {
  run("chmod", ["+x", outputBinary]);
}

if (platform === "darwin") {
  run("codesign", ["--sign", "-", outputBinary]);
}

const latestLink = join(artifactsDir, `putio${extension}`);

rmSync(latestLink, { force: true });
cpSync(outputBinary, latestLink);

if (!existsSync(outputBinary)) {
  throw new Error(`Expected SEA binary at ${outputBinary}.`);
}
