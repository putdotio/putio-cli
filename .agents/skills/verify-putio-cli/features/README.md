# putio-cli verification map

The maintained source for proving user-facing behavior of the `putio` binary. Read this index, then use the matching feature file as the recipe.

## Baseline preconditions

- `pnpm exec vp run build` ran after the last source change.
- `verify.sh start` created the run and `verify.sh doctor` prints only `ok` lines.
- The scratch config is empty unless a recipe's preconditions say otherwise.
- `verify.sh` means `.agents/skills/verify-putio-cli/scripts/verify.sh`, run from the repo root.

## Driving conventions

- Pipes (`verify.sh cli`) are the agent path; JSON is the default there. The PTY (`verify.sh pty`) is the human path.
- Name each step after the sub-feature ID, so evidence directories map back to this file.
- Commands are literal. Keep flags and quoting unchanged.

## Proof and skip reporting

- Pipe proof: `command.txt`, `stdout.txt`, `stderr.txt`, `exit.txt` from the step directory.
- PTY proof: `screen-<label>.txt` before and after the action, and `pane.txt`.
- Mutation proof: `verify.sh config` or `verify.sh requests`, a second view of the state.
- An unreachable path is reported with its command and the unmet precondition, never as verified through another path.

## Feature entry contract

Each feature file starts with an H1 and one paragraph of user-visible behavior, then exactly four H2s in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with verify.sh`, `Gotchas`.

## Features

- [Auth login](./auth-login.md): token from stdin, hidden prompt, device link, profiles, rejected tokens.
- [Account reads](./account-reads.md): `whoami`, `auth status`, and `files list` with saved or missing auth.
- [SDK call](./sdk-call.md): `sdk call` argument validation, dry run, and execution.
