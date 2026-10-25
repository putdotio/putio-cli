# Writes

Check `putio describe --output json` before constructing a payload, then prefer raw `--json` when supported.

Dry-run first:

```bash
putio transfers cancel --json '{"ids":[12,18]}' --dry-run --output json
putio files rename --json '{"file_id":42,"name":"Projects 2027"}' --dry-run --output json
putio files upload --json '{"path":"./movie.mp4","parent_id":42}' --dry-run --output json
putio files start-from set --json '{"file_id":42,"time":95}' --dry-run --output json
putio auth approve --json '{"code":"PUTIO1"}' --dry-run --output json
```

Run for real only after the dry-run request looks right:

```bash
putio download-links create --json '{"ids":[1,2]}' --output json
putio files mkdir --json '{"name":"Projects","parent_id":9}' --output json
putio files upload --json '{"path":"./movie.mp4","parent_id":42}' --output json
putio files start-from reset --json '{"file_id":42}' --output json
putio transfers add --json '[{"url":"https://example.com/file.torrent"}]' --output json
putio sdk call --json '{"operation":"files.get","args":[42]}' --dry-run --output json
putio sdk call --json '{"operation":"files.get","args":[42]}' --execute --output json
```

Rules:

- Take required keys from `describe`; never guess names.
- Treat every `sdk call` operation as potentially mutating and inspect its dry-run before `--execute`.
- `files upload` sends to `PUTIO_CLI_UPLOAD_BASE_URL`, or upload.put.io with the default API base. With a custom `PUTIO_CLI_API_BASE_URL` and no upload base, it fails before sending anything; set both together.
