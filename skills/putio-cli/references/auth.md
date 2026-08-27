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
putio auth login --profile devs-fe-auto
putio auth profiles use devs-fe-auto
```

The named-profile login is a browser-backed device-code flow:

1. Run `putio auth login --profile devs-fe-auto` and keep the process running.
2. Open the printed URL in a browser.
3. If the shared account is not already signed in, get its credentials from
   the owning workspace's private credential vault and enter them only in the
   browser.
4. Enter and approve the CLI's printed device code.
5. Let the CLI finish storing the returned OAuth token, then select and verify
   the profile.

The CLI never accepts the account username, password, or one-time code. Do not
put credential values, private vault topology, approval codes, or approval URLs
in commands, logs, chat, or public documentation.

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
- Use `PUTIO_CLI_PROFILE=devs-fe-auto` to select a persisted profile without passing flags.
- Use `PUTIO_CLI_CONFIG_PATH` to isolate config for automation or tests.
- If no profile is specified, the configured default profile is used when present; otherwise legacy single-token config remains supported.
- Treat approval codes and URLs as sensitive operational data.
