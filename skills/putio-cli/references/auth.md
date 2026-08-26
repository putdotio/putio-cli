# Auth

Check auth state first:

```bash
putio auth status --profile devs-fe-auto --output json
```

For the selected default profile or legacy token state:

```bash
putio auth status --output json
```

For a stable agent or test-harness session:

```bash
putio auth status --profile devs-fe-auto --output json
putio auth profiles use devs-fe-auto
```

Validate the saved token with an authenticated read. If it expired, inject the approved account,
OAuth client, and base32 TOTP values through the process environment, then mint a replacement:

```bash
putio auth login --from-env --profile devs-fe-auto --output json
```

`--from-env` requires all five `PUTIO_CLI_LOGIN_*` variables and a named profile. It does not
accept credential flags and persists only the resulting OAuth token. Do not switch an unattended
workflow to device login or browser automation when its credential payload is available.

For interactive login:

```bash
putio auth login
```

Preview a device-link URL without requesting or approving a real code:

```bash
putio auth preview --code PUTIO1 --output json
```

Approve a code displayed by another device with the authenticated account:

```bash
putio auth approve PUTIO1 --dry-run --output json
putio auth approve PUTIO1 --output json
```

List or remove named profiles:

```bash
putio auth profiles list --output json
putio auth profiles remove devs-fe-auto
```

Headless usage rules:

- Prefer `PUTIO_CLI_TOKEN` when a browser flow is not appropriate; it overrides persisted config and selected profiles.
- Prefer `auth login --from-env --profile devs-fe-auto` when the approved credential payload is available and the saved profile is missing or expired.
- Use `PUTIO_CLI_PROFILE=devs-fe-auto` to select a persisted profile without passing flags.
- Use `PUTIO_CLI_CONFIG_PATH` to isolate config for automation or tests.
- If no profile is specified, the configured default profile is used when present; otherwise legacy single-token config remains supported.
- Treat approval codes and URLs as sensitive operational data.
