# Discovery

Start every task with:

```bash
putio describe --output json
```

Use it to discover:

- available commands
- supported flags
- output capabilities
- `automation` contract and safety features
- auth requirements
- raw JSON input shapes for write commands
- validation notes that matter to agents

Structured output defaults:

- interactive TTY: `text`
- non-interactive / piped: `json`
- explicit `--output json`, `--output ndjson`, or `--output text` always wins

Use `automation` to confirm concrete support such as dry-run on writes, raw JSON input, field selection, streaming reads, redaction, and untrusted-text annotations. Use `crashReporting` to inspect the effective reporting state, persisted telemetry commands, flush bound, and captured-field allowlist. Treat missing features as a real contract gap instead of assuming they exist.

When the required API operation has no dedicated command, inspect the pinned TypeScript SDK surface:

```bash
putio sdk list --output json
```

Only operation paths in `operations` are eligible for `sdk call`. Entries in `unsupported` need runtime values, produce binary data, or use positional or scalar credentials that cannot be safely redacted. Supported keyed credential fields and token-bearing URLs are redacted in plans and results.

Use `ndjson` when:

- the command advertises streaming support
- you want one structured record per page or observation
- a full aggregated JSON object would waste context
