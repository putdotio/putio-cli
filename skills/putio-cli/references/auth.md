# Auth

Check auth state first:

```bash
putio auth status
```

For explicit machine output:

```bash
putio auth status --output json
```

For interactive login:

```bash
putio auth login
```

For previewing a device link without logging in:

```bash
putio auth preview --code PUTIO1 --output json
```

Headless usage rules:

- Prefer `PUTIO_CLI_TOKEN` when a browser flow is not appropriate.
- Use `PUTIO_CLI_CONFIG_PATH` to isolate config for automation or tests.
- Treat approval codes and URLs as sensitive operational data.
