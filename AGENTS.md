# Agent Guidelines

## Repo

- `@putdotio/cli`, the `putio` binary, shipped through npm, Homebrew, and standalone binaries.
- Code lives in `src/*`; layer rules are in [Architecture](docs/architecture.md).
- Release wiring and recovery are in [Distribution](docs/distribution.md).
- `skills/putio-cli` is the consumer skill that ships in the npm package.
- Contributor setup is in [Contributing](CONTRIBUTING.md).

## Commands

- `pnpm exec vp run verify`: the gate; pre-push and CI run it.
- Focused checks are the `scripts` in [package.json](package.json); run them as `pnpm exec vp run <script>`.
- `smoke:pack` writes its report to `.artifacts/smoke-packed-install.json`.

## Worktrees

Run `pnpm exec vp install`, `pnpm exec vp config`, then
`pnpm exec vp run verify`.

## Development Guidance

- `README.md` is for users, `CONTRIBUTING.md` for contributors, `docs/*` for architecture and release, `skills/*` for consumer usage.
- Keep command modules thin; shared behavior goes in Effect services and layers with `Schema` boundaries and tagged errors.
- JSON output is the machine contract; terminal output is a separate adapter.
- When commands, flags, output, auth, `automation`, or `describe.version` change in a way consumers need, update [`README.md`](README.md), [`skills/putio-cli/SKILL.md`](skills/putio-cli/SKILL.md), and its references in the same change.

## Effect

The installed version's guide is `node_modules/effect/AGENTS.md`; consult it for
the APIs the change touches, and search `node_modules/effect/src` for anything it
does not cover.

## Proof

- Docs only: `pnpm exec vp check .`, plus `pnpm exec vp run skills:lint` for `skills/*`; no runtime proof.
- Source change: `pnpm exec vp run verify`. Prefer in-process tests unless the process boundary is the behavior under test; add command-path coverage when the `effect/cli` command boundary changes.
- Commands, flags, or output: also `pnpm exec vp run build`, then run `./dist/bin.mjs describe` and the changed command with `--output json`; for auth changes, `./dist/bin.mjs whoami --fields auth --output json`.
- Standalone binary bundling: `pnpm exec vp run build:sea`, then `pnpm exec vp run verify:sea`.

## Hazards

- The built binary authenticates with `PUTIO_CLI_TOKEN` when it is set, otherwise with the profile in `~/.config/putio/config.json` (or under `XDG_CONFIG_HOME`). `describe` and `whoami` only read; file, transfer, and upload commands change that real account. For isolated state, unset `PUTIO_CLI_TOKEN` and point `PUTIO_CLI_CONFIG_PATH` at a scratch file.

## Delivery

Pull requests squash-merge to `main`. A push to `main` runs `verify`; when the commits since the last release include `feat`, `fix`, `perf`, a revert, or a breaking change, semantic-release publishes `@putdotio/cli` to npm, attaches the standalone binaries to the GitHub Release, and updates the `putdotio/homebrew-tap` formula. `docs`, `chore`, `test`, and `ci` release nothing. `install.sh` on `main` is the live installer that `curl | sh` users fetch, so a merge changes it at once. Partial-release recovery: [Distribution](docs/distribution.md#recover).

## Skills

- `skills/*` holds consumer skills, not repo onboarding.
- `skills/putio-cli/SKILL.md` routes; surface detail lives in the matching reference file.
- `skills/putio-cli/agents/openai.yaml` is the Codex picker metadata; keep it aligned with the skill frontmatter.
