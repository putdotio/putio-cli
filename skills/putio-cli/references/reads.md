# Reads

Prefer structured output:

```bash
putio whoami
putio files list --output json
```

Use `--fields` with top-level keys only:

```bash
putio whoami --fields auth,info
putio files list --fields files,total --output json
```

Use `--page-all` only when the command advertises it and you truly need every page:

```bash
putio files search --query movie --page-all --fields files --output json
putio transfers list --page-all --output ndjson
```

Use `ndjson` for large or continuous reads:

```bash
putio files list --page-all --output ndjson
putio search --query movie --output ndjson
putio transfers watch --id 7 --output ndjson
```

Current streaming-friendly commands:

- `files list`
- `files search`
- `search`
- `transfers list`
- `transfers watch`

Notes:

- `--fields` is only for top-level response keys.
- `--fields` requires structured output.
- `events list` supports `--fields`, but not `--page-all`.
