# Agent Guidelines

## Repo

- `@putdotio/cli`, the `putio` binary, shipped through npm, Homebrew, and standalone binaries.
- `README.md` is for users, [`CONTRIBUTING.md`](CONTRIBUTING.md) for contributors, `skills/putio-cli` for consumer agents; that skill ships in the npm package.

## Commands

- Setup, worktrees included: `pnpm exec vp install`, then `pnpm exec vp config`.
- `pnpm exec vp run verify`: the gate.
- Focused checks are the `scripts` in [package.json](package.json); run them as `pnpm exec vp run <script>`.

## Development Guidance

- Keep command modules thin; shared behavior goes in Effect services and layers with `Schema` boundaries and tagged errors.
- JSON output is the machine contract; terminal output is a separate adapter.
- When commands, flags, output, auth, `automation`, or `describe.version` change in a way consumers need, update [`README.md`](README.md), [`skills/putio-cli/SKILL.md`](skills/putio-cli/SKILL.md), and its references in the same change.

## Effect

The installed version's guide is `node_modules/effect/AGENTS.md`; consult it for
the APIs the change touches, and search `node_modules/effect/src` for anything it
does not cover. Keep the pinned `effect` version.

`@effect/tsgo` adds Effect diagnostics to lint. Bare `vp check` cannot load them
and stops at `Unknown plugin: effecttsgo`; use `pnpm exec vp run check`. Rule
overrides are in [vite.config.ts](vite.config.ts), the unstable modules the CLI
accepts in [tsconfig.json](tsconfig.json).

## Proof

- Docs only: `pnpm exec vp run check`, plus `pnpm exec vp run skills:lint` for `skills/*`; no runtime proof.
- Source change: `pnpm exec vp run verify`. Prefer in-process tests unless the process boundary is the behavior under test; add command-path coverage when the `effect/cli` command boundary changes.
- Commands, flags, output, auth, or config persistence: also `pnpm exec vp run build`, then drive the changed command with the `verify-putio-cli` skill, which sandboxes the binary against a fixture API.
- Standalone binary bundling: `pnpm exec vp run build:sea`, then `pnpm exec vp run verify:sea`.

## Hazards

- The built binary authenticates with `PUTIO_CLI_TOKEN` when it is set, otherwise with the profile in `~/.config/putio/config.json` (or under `XDG_CONFIG_HOME`). `describe` and `whoami` only read; file, transfer, and upload commands change that real account. For isolated state, unset `PUTIO_CLI_TOKEN` and point `PUTIO_CLI_CONFIG_PATH` at a scratch file.
- README `Crash Reporting` is a public privacy promise. Any change to what a crash event carries or when it is sent updates that section in the same change.

## Delivery

- Pull requests squash-merge to `main`; every merge must be releasable.
- The squash commit's type decides the release ([`.releaserc.json`](https://github.com/putdotio/putio-cli/blob/main/.releaserc.json)).
- [`install.sh`](https://github.com/putdotio/putio-cli/blob/main/install.sh) on `main` is the live `curl | sh` installer; a merge changes it at once.

## Skills

- `skills/putio-cli/SKILL.md` routes; surface detail lives in the matching reference file.
- `skills/putio-cli/agents/openai.yaml` is the Codex picker metadata; keep it aligned with the skill frontmatter.
