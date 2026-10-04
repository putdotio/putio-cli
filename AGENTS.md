# Agent Guidelines

## Repo

- Standalone TypeScript package for the put.io CLI, `@putdotio/cli` with the `putio` binary; people and agents use it from npm, Homebrew, and standalone binaries
- Main code lives in `src/*`; layer rules in [Architecture](docs/ARCHITECTURE.md)
- Durable docs live in `docs/*`; release wiring in [Distribution](docs/DISTRIBUTION.md)
- Consumer-facing skills live in `skills/*`
- Contributor setup and validation in [Contributing](CONTRIBUTING.md)

## Commands

- `pnpm exec vp run verify`: the gate; pre-push and CI run it
- Focused checks are the `scripts` in [package.json](package.json); run them as `pnpm exec vp run <script>`
- `smoke:pack` writes its report to `.artifacts/smoke-packed-install.json`

## Worktrees

Run `pnpm exec vp install`, `pnpm exec vp config`, then
`pnpm exec vp run verify`.

## Development Guidance

- Keep `README.md` user-facing. Put contributor workflow in `CONTRIBUTING.md`, architecture in `docs/*`, and consumer usage patterns in `skills/*`.
- Keep command modules thin and move shared behavior into internal Effect-native helpers and services.
- Prefer `Effect`, services, layers, `Schema`, and tagged errors over ad hoc control flow.
- Treat JSON output as the machine contract and terminal output as a separate adapter layer.
- Update docs when flags, command behavior, or architecture boundaries change.
- When the public CLI surface or agent-facing setup flow changes, update [`README.md`](README.md) and [`skills/putio-cli/SKILL.md`](skills/putio-cli/SKILL.md) together so the copy-paste prompt and consumer guidance stay aligned.
- Keep docs free of volatile metrics.

## Effect

This repository uses the Effect TypeScript library. The installed version's own
guide is `node_modules/effect/AGENTS.md`; consult it for the APIs the change
touches, and search `node_modules/effect/src` for anything it does not cover.

## Proof

- Docs only: `pnpm exec vp check .`, plus `pnpm exec vp run skills:lint` for `skills/*`; no runtime proof.
- Source change: `pnpm exec vp run verify`. Prefer in-process tests unless the process boundary is the behavior under test; add command-path coverage when the `effect/cli` command boundary changes.
- Commands, flags, or output: also `pnpm exec vp run build`, then run `./dist/bin.mjs describe` and the changed command with `--output json`; for auth changes, `./dist/bin.mjs whoami --fields auth --output json`.
- Standalone binary bundling: `pnpm exec vp run build:sea`, then `pnpm exec vp run verify:sea`.

## Hazards

- The built binary uses the real auth in `~/.config/putio/config.json` (or under `XDG_CONFIG_HOME`). `describe` and `whoami` only read; file, transfer, and upload commands change that real account. Point `PUTIO_CLI_CONFIG_PATH` at a scratch file for isolated state.

## Delivery

Pull requests squash-merge to `main`. A push to `main` runs `verify`; when the commits since the last release include `feat`, `fix`, `perf`, or a breaking change, semantic-release publishes `@putdotio/cli` to npm, attaches the standalone binaries to the GitHub Release, and updates the `putdotio/homebrew-tap` formula. `docs`, `chore`, `test`, and `ci` release nothing. `install.sh` on `main` is the live installer that `curl | sh` users fetch, so a merge changes it at once. Partial-release recovery: [Distribution](docs/DISTRIBUTION.md#recover).

## Skills

- `skills/*` is for reusable consumer-facing skills, not repo onboarding.
- `skills/putio-cli/SKILL.md` is the router; surface-specific detail lives in the matching reference file.
- `skills/putio-cli/agents/openai.yaml` is the Codex picker display and default-prompt metadata; keep it aligned with the skill frontmatter.
- Refresh the skill and its references in the same change whenever `describe.version`, commands, output, auth, or `automation` change in a way consumers need to know.
