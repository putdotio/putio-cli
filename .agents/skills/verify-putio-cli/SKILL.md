---
name: verify-putio-cli
description: Drive the built `putio` binary in a sandbox, through a real PTY or plain pipes, against a loopback fixture API, and keep the evidence. Use to prove a change to commands, flags, output, auth, or config persistence the way a user meets it, or when AGENTS.md Proof asks you to run the changed command.
---

# Verify putio-cli

Every run is a **sandbox**: scratch `HOME` and config, a fixture put.io API on `127.0.0.1`, and a child environment built from nothing with `env -i`. The binary never sees `PUTIO_CLI_TOKEN`, `~/.config/putio/config.json`, or `api.put.io`. Keep it that way: drive only through `scripts/verify.sh`, which owns that environment.

## Launch

1. `pnpm exec vp run build`. The sandbox drives `dist/bin.mjs`, so rebuild after every source change.
2. `.agents/skills/verify-putio-cli/scripts/verify.sh start` prints the run id and evidence path, and points `latest` at the new run. To drive two runs at once, set `VERIFY_RUN=<id>` on every call.

Ready means `doctor` passes.

## Doctor

`verify.sh doctor` checks, read-only, that the binary is newer than every file in `src/`, carries no crash-reporting DSN, the fixture process is this run's and answers, and the child env holds no token and only loopback URLs. Run it after `start` and whenever a result looks wrong. Every line must say `ok`; a `FAIL` means the run proves nothing until fixed.

## Drive

- `verify.sh cli <name> -- <args>` runs the binary without a TTY, the agent and script path. Stdin passes through: `printf fixture-token | verify.sh cli login -- auth login --token-stdin --output json`.
- `verify.sh pty start <name> -- <args>` runs it in a real PTY (a private tmux server per run), the human path: prompts, hidden input, loaders, terminal rendering. Then `pty wait <regex> [secs]`, `pty send <text>`, `pty key Enter`, `pty capture [label]`.
- `verify.sh config` prints the scratch config and its file mode. `verify.sh requests` prints every request the fixture API saw.

The fixture API (`scripts/fixture-api.mjs`) accepts only `fixture-token`, answers device code `VERIFY1` with the token on the second poll, and serves `account/info` and `files/list`. Any other route returns 404 and is logged. Add a route there when a journey needs one; shape its body from the SDK schema or `src/command-paths.test.ts` fixtures.

[`features/README.md`](features/README.md) maps each user-facing feature to its journey. Drive every entry point the map lists for the feature you changed, and add or update its file when the change adds one.

## Evidence

`.evidence/verify-putio-cli/<run>/evidence/` (gitignored) holds `run.txt` (revision, dirty-path count, binary hash), `requests.jsonl`, and one numbered directory per step: `command.txt`, then `stdout.txt`, `stderr.txt`, `exit.txt` for pipes, or `screen-<label>.txt` and `pane.txt` (`dead status`) for a PTY.

A proof shows the action and the resulting state:

- Output: the JSON on stdout for `--output json`; errors land on stderr with a non-zero exit.
- Side effects: `verify.sh config` for what was saved, `verify.sh requests` for what reached the API. A login that prints success but saved nothing, or skipped `/v2/oauth2/validate`, fails.
- Secrets: a PTY capture taken after typing and before `Enter` must not show the typed token.

Report the run id, the revision from `run.txt`, and the step directories that carry each claim.

## Cleanup

`verify.sh stop` kills this run's tmux server and fixture PID, copies the config to `evidence/final-config.json`, and deletes `scratch/`. Evidence stays. Run it after every run, failed ones included.

## Gotchas

- The fixture's device poll counter lives for the whole run: the second device login in one run gets the token on its first poll.
- Never press `o` during device login and never pass `--open`: both call the OS browser opener (on a loopback URL, but still a real window on the user's desktop).
- The sandbox proves CLI behavior against put.io's contract as the fixture models it, not against the live API. Say so when you report.
- tmux sessions are 120×40; terminal boxes wider than that wrap in captures.
