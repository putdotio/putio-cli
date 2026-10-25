# Auth

Check auth first:

```bash
putio auth status --output json
```

Set up a stable agent or test-harness profile. Login prints a URL and a code;
the human opens the URL, enters the code, and approves:

```bash
putio auth status --profile automation --output json
putio auth login --profile automation
putio auth profiles use automation
```

`--timeout-seconds` bounds the wait, pending polls included. A timeout saves no
partial auth state.

Preview a device-link URL without requesting or approving a real code:

```bash
putio auth preview --code PUTIO1 --output json
```

Approve a code shown by another device with the signed-in account:

```bash
putio auth approve PUTIO1 --dry-run --output json
putio auth approve PUTIO1 --output json
```

List or remove profiles:

```bash
putio auth profiles list --output json
putio auth profiles remove automation
```

Headless rules:

- `PUTIO_CLI_TOKEN` skips the browser flow and overrides persisted config and profiles.
- `PUTIO_CLI_PROFILE=automation` selects a persisted profile without `--profile`.
- `PUTIO_CLI_CONFIG_PATH` isolates config for automation or tests.
- Without a selected profile, the CLI uses the default profile, then the legacy single-token config.
- Treat approval codes and URLs as sensitive.
