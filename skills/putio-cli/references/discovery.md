# Discovery

Start every task with:

```bash
putio describe --output json
```

It lists commands, flags, auth requirements, raw JSON input shapes for writes,
each command's capabilities, and the `automation` contract. Confirm a feature
there before you rely on it; a missing feature is a real gap.

`crashReporting` shows the effective reporting state, telemetry commands, flush
bound, and captured-field allowlist.

Output defaults to `text` at an interactive TTY and `json` when piped; an
explicit `--output` always wins.

When no dedicated command covers the API operation, inspect the pinned SDK:

```bash
putio sdk list --output json
```

Only paths under `operations` work with `sdk call`. Entries under `unsupported`
need runtime values, return binary data, or take credentials that cannot be
redacted safely. Keyed credential fields and token-bearing URLs are redacted in
plans and results.
