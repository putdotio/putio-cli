# Contributing

Thanks for contributing to `putio-cli`.

## Setup

Use the Node version required by [`package.json`](./package.json), then install dependencies:

```bash
pnpm install
```

## Run Locally

Start the local build watcher:

```bash
pnpm run dev
```

Build the CLI once and try the shipped entrypoint:

```bash
pnpm run build
./dist/bin.mjs describe
```

## Validation

Run the main repository gate before opening or updating a pull request:

```bash
pnpm run verify
```

Run focused checks when they match your change:

```bash
pnpm run smoke:pack
pnpm run build:sea
pnpm run verify:sea
```

## Development Notes

- `verify` is the repository delivery gate.
- Keep top-level user docs in `README.md` and contributor workflow here.
- Put deeper implementation detail in `docs/` instead of growing the top-level docs.
- Keep `AGENTS.md` as repo-development guidance and `skills/*` as consumer-facing agent guidance.
- When the public CLI surface changes, update `skills/putio-cli/*` in the same change.

## Pull Requests

- Keep changes focused and explicit.
- Add or update tests when behavior changes.
- Prefer small follow-up pull requests over mixing unrelated cleanup into one branch.
