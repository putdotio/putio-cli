# Agent Guidelines

Development instructions for agents working on this repository.

## Repo

- Standalone TypeScript package for the put.io CLI
- Main code lives in `src/*`
- Durable docs live in `docs/*`
- Consumer-facing skills live in `skills/*`

## Start Here

- user docs: [README.md](README.md)
- contributor workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Commands

Primary:

- `pnpm run verify`

Focused:

- `pnpm run check`
- `pnpm run build`
- `pnpm run test`
- `pnpm run coverage`

Runtime proofs:

- `./dist/bin.mjs describe`
- `./dist/bin.mjs whoami --output json`

## Development Guidance

- Keep `README.md` user-facing. Put contributor workflow in `CONTRIBUTING.md`, architecture in `docs/*`, and consumer usage patterns in `skills/*`.
- Keep command modules thin and move shared behavior into internal Effect-native helpers and services.
- Prefer `Effect`, services, layers, `Schema`, and tagged errors over ad hoc control flow.
- Treat JSON output as the machine contract and terminal output as a separate adapter layer.
- Update docs when flags, command behavior, or architecture boundaries change.
- When the public CLI surface changes, update [`skills/putio-cli/SKILL.md`](skills/putio-cli/SKILL.md) so consumer-facing agent guidance stays accurate.
- Do not hardcode volatile metrics in docs.

## Testing

- Prefer in-process tests unless the process boundary is the behavior under test.
- Add command-path coverage when the `@effect/cli` boundary changes.
- Run repo guardrails before closing work, then prove important command-surface changes with the built binary.

## Skills

- `skills/*` is for reusable consumer-facing skills, not repo onboarding.
- `CLAUDE.md` should remain a symlink to this file.
