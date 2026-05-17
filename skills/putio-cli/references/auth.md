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
putio auth login --profile devs-fe-auto
putio auth profiles use devs-fe-auto
```

For interactive login:

```bash
putio auth login
```

For put.io device approval or previewing a device link without logging in:

```bash
putio auth preview --code PUTIO1 --output json
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
