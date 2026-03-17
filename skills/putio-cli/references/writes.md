# Writes

Check `putio describe` before constructing a payload, then prefer raw `--json` when supported.

Dry-run first:

```bash
putio transfers cancel --json '{"ids":[12,18]}' --dry-run --output json
putio files rename --json '{"file_id":42,"name":"Projects 2027"}' --dry-run --output json
```

Execute for real only after the dry-run request shape looks correct.

Examples:

```bash
putio download-links create --json '{"ids":[1,2]}' --output json
putio files mkdir --json '{"name":"Projects","parent_id":9}' --output json
putio transfers add --json '[{"url":"https://example.com/file.torrent"}]' --output json
```

Rules:

- Prefer `--json` over translating through many bespoke flags.
- Prefer `--dry-run` before side effects.
- Re-check schema-required keys in `describe` instead of guessing names.
