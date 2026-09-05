# Reads

Prefer structured output:

```bash
putio whoami --fields auth --output json
putio files list --output json
```

Use `--fields` with top-level keys only:

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

Streamed pages wait for stdout writes before fetching the next page, so a slow
pipe consumer constrains page production.

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
- `files start-from get` returns `file_id` and `start_from` in seconds.
- `files hls-manifest <file-id>` returns `file_id`, `original`, and the raw
  `manifest` text of the HLS master playlist. Playlist URLs inside it carry a
  redacted token; read `CODECS` and `VIDEO-RANGE` from the
  `#EXT-X-STREAM-INF` line to learn what a player would be served. Use
  `--original` for the original file instead of the MP4 conversion; put.io
  answers `INVALID_MEDIA` when the original cannot be served as HLS.
- `files search` and `search` accept `--query` and `--per-page` only; put.io
  does not filter search results by file type.
