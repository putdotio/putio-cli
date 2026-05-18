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

Use `automation` to confirm concrete support such as dry-run on writes, raw JSON input, field selection, streaming reads, redaction, and untrusted-text annotations. Treat missing features as a real contract gap instead of assuming they exist.

Versioning rules:

- The skill library follows the CLI contract exposed by `putio describe --output json`.
- If `describe.version`, `commands`, `output`, `auth`, or `automation` changes in a way agents need to know, refresh `SKILL.md` and the relevant reference file in the same change.
- Keep `SKILL.md` as the router and put surface-specific detail in the matching reference.

Use `ndjson` when:

- the command advertises streaming support
- you want one structured record per page or observation
- a full aggregated JSON object would waste context
