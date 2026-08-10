# Contributing

Thanks for contributing to `putio-cli`.

## Setup

Use the Node version required by [`package.json`](./package.json), then install dependencies:

```bash
pnpm exec vp install
```

Then install the stock VitePlus hook wiring for this clone:

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

Use the repo-local Vite+ binary for test-bearing commands so the runner and
`vite-plus/test` imports share one Vitest runtime.

Run focused checks when they match your change:

```bash
pnpm exec vp run check:dead-code
pnpm exec vp run smoke:pack
pnpm exec vp run build:sea
pnpm exec vp run verify:sea
```

## Release Publishing

See [Distribution](docs/DISTRIBUTION.md) for release automation, credentials, and binary asset publishing.

## Development Notes

- `verify` is the repository delivery gate.
- `verify` enforces the production Effect runtime boundary and dead-code checks, exercises the packed CLI through success and failure paths, and writes the smoke report to `.artifacts/smoke-packed-install.json`.
- `pnpm exec vp config` installs the tracked pre-commit and pre-push hooks; pre-push runs the same `verify` gate as CI.
- Prefer `pnpm exec vp install`, `pnpm exec vp test`, and `pnpm exec vp check` for day-to-day local loops.
- Keep the exact Effect versions, the Effect override, and the pnpm SDK compatibility patch aligned. The patch updates the SDK's schema-backed error constructor for the installed Effect runtime.
- Keep top-level user docs in `README.md` and contributor workflow here.
- Put deeper implementation detail in `docs/` instead of growing the top-level docs.
- Keep `AGENTS.md` as repo-development guidance and `skills/*` as consumer-facing agent guidance.
- When the public CLI surface or agent setup flow changes, update `README.md` and `skills/putio-cli/*` in the same change.

## Pull Requests

- Keep changes focused and explicit.
- Add or update tests when behavior changes.
- Prefer small follow-up pull requests over mixing unrelated cleanup into one branch.
