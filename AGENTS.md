# Agent Guidelines

Development instructions for agents working on this repository.

## Repo

- Standalone TypeScript package for the put.io CLI
- Main code lives in `src/*`
- Durable docs live in `docs/*`
- Consumer-facing skills live in `skills/*`

## Start Here

- [Overview](README.md)
- [Contributing](CONTRIBUTING.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Distribution](docs/DISTRIBUTION.md)

## Commands

Primary:

- `pnpm exec vp run verify`

Focused:

- `pnpm exec vp run check`
- `pnpm exec vp run build`
- `pnpm exec vp run test`
- `pnpm exec vp run coverage`

Runtime proofs:

- `./dist/bin.mjs describe`
- `./dist/bin.mjs whoami --fields auth --output json`

## Worktrees

`.worktreeinclude` reuses `.repos`; Claude symlinks it to avoid another copy.
Run `vp install`, `vp config`, then `pnpm exec vp run verify`. No Infisical
setup is required.

## Development Guidance

- Keep `README.md` user-facing. Put contributor workflow in `CONTRIBUTING.md`, architecture in `docs/*`, and consumer usage patterns in `skills/*`.
- Keep command modules thin and move shared behavior into internal Effect-native helpers and services.
- Prefer `Effect`, services, layers, `Schema`, and tagged errors over ad hoc control flow.
- Treat JSON output as the machine contract and terminal output as a separate adapter layer.
- Update docs when flags, command behavior, or architecture boundaries change.
- When the public CLI surface or agent-facing setup flow changes, update [`README.md`](README.md) and [`skills/putio-cli/SKILL.md`](skills/putio-cli/SKILL.md) together so the copy-paste prompt and consumer guidance stay aligned.
- Keep docs free of volatile metrics.

## Testing

- Prefer in-process tests unless the process boundary is the behavior under test.
- Add command-path coverage when the `@effect/cli` boundary changes.
- Run repo guardrails before closing work, then prove important command-surface changes with the built binary.

## Skills

- `skills/*` is for reusable consumer-facing skills, not repo onboarding.
- `CLAUDE.md` should remain a symlink to this file.
