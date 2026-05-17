# Discovery

Start every task with:

```bash
putio describe --output json
```

Use it to discover:

- available commands
- supported flags
- output capabilities
- `agentDx` scorecard and safety posture
- auth requirements
- raw JSON input shapes for write commands
- validation notes that matter to agents

Structured output defaults:

- interactive TTY: `text`
- non-interactive / piped: `json`
- explicit `--output json`, `--output ndjson`, or `--output text` always wins

Use `agentDx.dimensions` to decide how defensive to be. A score below 3 names the current gap; do not paper over it with assumptions.

Use `ndjson` when:

- the command advertises streaming support
- you want one structured record per page or observation
- a full aggregated JSON object would waste context
