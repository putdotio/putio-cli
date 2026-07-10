# Contributing

Thanks for contributing to `putio-cli`.

## Setup

Use the Node version required by [`package.json`](./package.json), then install dependencies:

```bash
vp install
```

Then install the stock VitePlus hook wiring for this clone:

```bash
vp config
```

## Run Locally

Start the local build watcher:

```bash
vp run dev
```

Build the CLI once and try the shipped entrypoint:

```bash
vp run build
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
pnpm exec vp run smoke:pack
pnpm exec vp run build:sea
pnpm exec vp run verify:sea
```

## Release Publishing

See [Distribution](docs/DISTRIBUTION.md) for release automation, credentials, and binary asset publishing.

## Development Notes

- `verify` is the repository delivery gate.
- Prefer `vp install`, `vp test`, and `vp check` for day-to-day local loops.
- Keep top-level user docs in `README.md` and contributor workflow here.
- Put deeper implementation detail in `docs/` instead of growing the top-level docs.
- Keep `AGENTS.md` as repo-development guidance and `skills/*` as consumer-facing agent guidance.
- When the public CLI surface or agent setup flow changes, update `README.md` and `skills/putio-cli/*` in the same change.

## Pull Requests

- Keep changes focused and explicit.
- Add or update tests when behavior changes.
- Prefer small follow-up pull requests over mixing unrelated cleanup into one branch.
