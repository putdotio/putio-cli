# Contributing

## Setup

Use the Node version in [`.node-version`](./.node-version), then install
dependencies and the tracked Git hooks. Pre-push runs the same `verify` gate as
CI.

```bash
pnpm exec vp install
pnpm exec vp config
```

## Run Locally

Watch and rebuild:

```bash
pnpm exec vp run dev
```

Build once and run the shipped entrypoint:

```bash
pnpm exec vp run build
./dist/bin.mjs describe
```

## Checks

Run the gate before opening or updating a pull request:

```bash
pnpm exec vp run verify
```

Run tests through `pnpm exec vp test` so the runner and `vite-plus/test` imports
share one Vitest runtime. Focused checks and which one proves which change are
in [AGENTS.md](AGENTS.md#proof).

## Effect Versions

Pin `effect` to the version the pinned put.io SDK depends on; `smoke:pack` fails
if the packed install resolves more than one. The build bundles the SDK, so the
CLI and SDK share one Effect runtime. If an SDK release needs an Effect API the
pinned runtime lacks, add a pnpm patch and register it in
[`pnpm-workspace.yaml`](./pnpm-workspace.yaml).

## Releases

[Distribution](docs/distribution.md) owns release automation, credentials, and
binary assets.
