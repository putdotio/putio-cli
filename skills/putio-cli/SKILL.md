---
name: putio-cli
description: Use when an agent needs to operate the put.io CLI as a consumer, including discovering commands with `putio describe`, authenticating, reading stable JSON output, narrowing responses with `--fields`, paging safely with `--page-all`, and previewing writes with `--dry-run` and raw `--json`.
---

# putio-cli

Use this skill when you need to use `putio` itself, not when you are developing this repository.

## Quick Rules

- Start with `putio describe` to discover the current command contract.
- Prefer `--output json` for deterministic machine-readable output.
- Use `--fields` on large read responses to limit context.
- Use `--page-all` only when you really need the full dataset.
- Prefer `--dry-run` before mutating operations.
- Prefer raw `--json` payloads for writes when an operation supports them.

## Discovery

Inspect the CLI surface before guessing:

```bash
putio describe
```

Use the command metadata to check:

- available commands
- supported flags
- command capabilities
- auth requirements
- raw JSON input shape for write commands

## Auth

Check auth state first:

```bash
putio auth status --output json
```

For interactive login:

```bash
putio auth login
```

For headless usage, prefer `PUTIO_CLI_TOKEN`.

## Reads

Prefer JSON output:

```bash
putio whoami --output json
```

Narrow large responses with top-level fields only:

```bash
putio files list --fields files,total --output json
```

Use `--page-all` only on commands that advertise it and only when you need every page:

```bash
putio files search "movie" --page-all --fields files --output json
```

`--fields` is JSON-only and only supports top-level keys.

## Writes

Use `--dry-run` first when available:

```bash
putio transfers cancel --json '{"ids":[12,18]}' --dry-run --output json
```

When supported, prefer raw `--json` payloads over many positional flags:

```bash
putio files rename --json '{"file_id":42,"name":"Projects 2027"}' --output json
```

Check `putio describe` for the exact payload shape before constructing a request.

## Guardrails

- Prefer `--output json` for automation and agent workflows.
- Prefer `--dry-run` on writes before executing the real mutation.
- Prefer `--fields` for large responses to reduce context.
- Avoid `--page-all` unless you truly need the entire result set.
- Treat `describe` as the source of truth when there is any uncertainty.

## Fallback

If a command fails:

1. Re-run it with `--output json`.
2. Check `putio describe` for the command contract.
3. Reduce the response with `--fields` or retry without `--page-all` if the result is too large.
