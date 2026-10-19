# Contributing

## Setup

Use the Node version required by [`package.json`](./package.json), then install dependencies:

```bash
pnpm exec vp install
```

Install the tracked pre-commit and pre-push hooks; pre-push runs the same `verify` gate as CI:

```bash
pnpm exec vp config
```

## Run Locally

Start the local build watcher:

```bash
pnpm exec vp run dev
```

Build the CLI once and try the shipped entrypoint:

```bash
pnpm exec vp run build
./dist/bin.mjs describe
```

## Validation

Run the main repository gate before opening or updating a pull request:

```bash
pnpm exec vp run verify
```

Run tests through the repo-local Vite+ binary (`pnpm exec vp test`) so the
runner and `vite-plus/test` imports share one Vitest runtime.

Focused checks are listed under [Commands in AGENTS.md](AGENTS.md#commands).

## Release Publishing

See [Distribution](docs/distribution.md) for release automation, credentials, and binary asset publishing.

## Development Notes

- `verify` is the delivery gate. It enforces the production Effect runtime boundary and dead-code checks, exercises the packed CLI through success and failure paths, and writes the smoke report to `.artifacts/smoke-packed-install.json`.
- Keep the exact Effect versions aligned with the `effect` version the pinned put.io SDK depends on; `smoke:pack` fails if the packed install resolves more than one. The build bundles the SDK so installed CLIs and the SDK share one Effect runtime; if an SDK release depends on an Effect API the pinned runtime lacks, add a pnpm patch under `patches/` and register it in `pnpm-workspace.yaml`.
- Doc placement rules: [Development Guidance in AGENTS.md](AGENTS.md#development-guidance).

## Pull Requests

- Keep changes focused and explicit.
- Add or update tests when behavior changes.
- Prefer small follow-up pull requests over mixing unrelated cleanup into one branch.
