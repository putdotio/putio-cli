# Account reads

A user checks who they are signed in as, where the auth comes from, and lists files. Without auth, each read fails with a structured error that tells the user how to sign in.

## Sub-features

- `whoami-anon` fails with the sign-in hint when no token is configured.
- `whoami` returns account info and the auth source.
- `whoami-fields` narrows output with `--fields`.
- `auth-status` reports the profile, auth method, and config path.
- `files-list` lists the root folder.

## How to get to it (user POV)

- `putio whoami`, optionally `--fields auth`.
- `putio auth status`, optionally `--profile <name>`.
- `putio files list`.

## Driving it with verify.sh

Preconditions: a fresh run. For signed-in steps, first `printf fixture-token | verify.sh cli login-stdin -- auth login --token-stdin --output json`.

- **Signed out.** Before login: `verify.sh cli whoami-anon -- whoami --output json`. Exit `1`; stderr JSON `error.message` names `PUTIO_CLI_TOKEN` and `putio auth login`.
- **Who am I.** `verify.sh cli whoami -- whoami --output json`. Exit `0`; stdout `auth.source` is `config` and `info.username` is `fixture-user`; `verify.sh requests` shows `GET /v2/account/info` with `Token fixture-token`.
- **Field selection.** `verify.sh cli whoami-fields -- whoami --fields auth --output json`. Stdout has `auth` and no `info`.
- **Auth status.** `verify.sh cli auth-status -- auth status --output json`. Stdout has `"authenticated": true`, `"authMethod": "token"`, and the scratch `configPath`.
- **List files.** `verify.sh cli files-list -- files list --output json`. Stdout lists `Movies` under `Your Files`.
- **Terminal view.** `verify.sh pty start whoami-terminal -- whoami`, `pty wait fixture-user`, `pty capture`. The screen shows the account in terminal layout.

## Gotchas

- The fixture answers `401` to any token but `fixture-token`; a `401` here means the saved token is wrong, not that the CLI is.
- `files list` is a streaming read; `--output ndjson` changes the shape, so assert per mode.
