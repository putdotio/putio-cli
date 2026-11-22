# Auth login

A user saves put.io credentials as the default auth or a named profile: by piping an existing token, typing it into a hidden prompt, or approving a device code in the browser. The CLI validates a supplied token before saving it and writes the config with mode `600`.

## Driving it with verify.sh

Preconditions: a fresh run, no config file (`verify.sh config` prints `no config file`).

- **Piped token.** `printf fixture-token | verify.sh cli login-stdin -- auth login --token-stdin --output json`. Exit `0`; stdout has `"authenticated": true` and `"authMethod": "token"`. `verify.sh config` shows mode `600` and `auth_token: fixture-token`; `verify.sh requests` shows `GET /v2/oauth2/validate`.
- **Hidden prompt.** `verify.sh pty start login-prompt -- auth login --token --profile web`, `pty wait 'input is hidden'`, `pty send fixture-token`, `pty capture typed`, `pty key Enter`, `pty wait 'auth method'`, `pty capture done`. `screen-typed.txt` lacks `fixture-token`; `screen-done.txt` shows profile `web`; `pane.txt` reads `1 0`.
- **Device link.** `verify.sh pty start login-device -- auth login --profile tv --timeout-seconds 20`, `pty wait VERIFY1`, `pty wait 'auth method'`, `pty capture`. The screen shows the code, `/link?code=VERIFY1`, then `auth method device`; `verify.sh requests` shows `GET /v2/oauth2/oob/code` and two polls.
- **Profiles kept.** After the three steps above, `verify.sh config` holds the default token plus `profiles.web` (`token`) and `profiles.tv` (`device`).
- **Rejected token.** `printf wrong | verify.sh cli login-rejected -- auth login --token-stdin --profile bad --output json`. Exit non-zero; stderr says put.io rejected the token; `verify.sh config` has no `bad` profile.
- **Inline token.** `verify.sh cli login-inline-token -- auth login --token=abc --output json`. Exit non-zero; stderr says the flags take no value; `verify.sh requests` shows no new request.

## Gotchas

- `--token` without a TTY fails by design; drive it only through `pty`.
