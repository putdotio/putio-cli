# Contributing

Thanks for contributing to `putio-cli`.

## Setup

Install the required toolchain and then install dependencies:

```bash
pnpm install
```

## Run Locally

Start the local build watcher:

```bash
pnpm run dev
```

Build the CLI once:

```bash
pnpm run build
```

## Validation

Run the repo checks before opening or updating a pull request:

```bash
pnpm run check
pnpm run test
pnpm run build
pnpm run coverage
pnpm run verify
```

## Development Notes

- `verify` is the repository delivery gate.
- Keep top-level user docs in `README.md` and contributor workflow here.
- Put deeper implementation detail in `docs/` instead of growing the top-level docs.

## Pull Requests

- Keep changes focused and explicit.
- Add or update tests when behavior changes.
- Prefer small follow-up pull requests over mixing unrelated cleanup into one branch.
