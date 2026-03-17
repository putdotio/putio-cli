# Agent Guide

Fast-path guidance for AI agents using `putio-cli`.

## Start Here

1. Run `putio describe` first.
2. Prefer `--output json` unless a human explicitly wants terminal rendering.
3. On read commands, ask only for the fields you need with `--fields`.
4. On write commands, use `--dry-run` before the real call.
5. When a write command supports it, prefer raw `--json` input over translating through many bespoke flags.

## Read Commands

- Use `--fields` with top-level keys only.
- Use `--page-all` only when the full dataset is actually needed.
- Start with one page and tighter fields before escalating to `--page-all`.
- `whoami`, `download-links get`, `events list`, `files list`, `files search`, `search`, `transfers list`, and `transfers watch` support field selection.
- `files list`, `files search`, `search`, and `transfers list` support `--page-all`.

## Write Commands

- Prefer `--dry-run --output json` before a real mutation.
- Prefer `--json` when `putio describe` exposes a raw payload contract.
- Re-run without `--dry-run` only after the request shape looks correct.

## Guardrails

- `--fields` is JSON-only and rejects nested selectors, query fragments, and path-like traversal patterns.
- Identifier-like inputs reject query fragments and path traversal patterns before API calls.
- File and folder names reject control characters and path traversal patterns.
- Errors are machine-readable with `--output json`.

## Useful Patterns

```bash
putio whoami --fields auth --output json
putio files list --fields files --page-all --output json
putio files rename --json '{"file_id":42,"name":"Projects"}' --dry-run --output json
```

## Related Docs

- [Architecture](/Users/altay/projects/putdotio/putio-cli/docs/ARCHITECTURE.md)
