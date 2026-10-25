# Reads

Prefer structured output:

```bash
putio whoami --fields auth --output json
putio files list --output json
```

Keep responses small with `--fields`:

```bash
putio whoami --fields auth --output json
putio files list --fields files,total --output json
putio files start-from get 42 --fields start_from --output json
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

Streamed pages wait for each stdout write before fetching the next page, so a
slow consumer slows page production. Commands with `capabilities.streaming` in
`describe` support `ndjson` streaming.

Notes:

- `--fields` takes top-level keys only and needs structured output.
- `events list` supports `--fields` but not `--page-all`.
- `files start-from get` returns `file_id` and `start_from` in seconds.
- `files hls-manifest <file-id>` returns `file_id`, `original`, and the raw
  `manifest` text of the HLS master playlist. Playlist URLs carry a redacted
  token. Read `CODECS` and `VIDEO-RANGE` from the `#EXT-X-STREAM-INF` line to
  learn what a player gets. `--original` asks for the original file instead of
  the MP4 conversion; put.io answers `INVALID_MEDIA` when it cannot serve the
  original as HLS.
- `files search` and `search` accept only `--query` and `--per-page`; put.io
  does not filter search results by file type.
