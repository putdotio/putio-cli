# putio-cli verification map

Each feature file is a recipe for [SKILL.md](../SKILL.md)'s `verify.sh`: `.agents/skills/verify-putio-cli/scripts/verify.sh`, run from the repo root. Every recipe starts from a fresh run: `pnpm exec vp run build` after the last source change, `verify.sh start`, and `verify.sh doctor` printing only `ok` lines.

- Commands are literal. Keep flags and quoting unchanged.
- A step's name, such as `login-stdin`, names its evidence directory.
- A mutation needs a second view of the state: `verify.sh config` or `verify.sh requests`.
- Report an unreachable path with its command and the unmet precondition.

## Features

- [Auth login](./auth-login.md): token from stdin, hidden prompt, device link, profiles, rejected tokens.
- [Account reads](./account-reads.md): `whoami`, `auth status`, and `files list` with saved or missing auth.
- [SDK call](./sdk-call.md): `sdk call` argument validation, dry run, and execution.
- [Transfers watch](./transfers-watch.md): `transfers watch` until a transfer finishes or the deadline passes.

A new feature file has an H1, one paragraph of user-visible behavior, then `Driving it with verify.sh` and `Gotchas`.
