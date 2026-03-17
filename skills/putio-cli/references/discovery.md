# Discovery

Start every task with:

```bash
putio describe
```

Use it to discover:

- available commands
- supported flags
- output capabilities
- auth requirements
- raw JSON input shapes for write commands
- validation notes that matter to agents

Structured output defaults:

- interactive TTY: `text`
- non-interactive / piped: `json`
- explicit `--output json`, `--output ndjson`, or `--output text` always wins

Use `ndjson` when:

- the command advertises streaming support
- you want one structured record per page or observation
- a full aggregated JSON object would waste context
