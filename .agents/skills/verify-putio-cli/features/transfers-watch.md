# Transfers watch

`putio transfers watch` polls one transfer until it reaches a finished status or the deadline passes, then prints the last transfer it saw and whether it timed out.

## Sub-features

- `watch-finished` returns at once for a finished transfer.
- `watch-deadline` stops at `--timeout-seconds`, even when `--interval-seconds` is longer.
- `watch-ndjson` streams one line per poll.

## How to get to it (user POV)

- `putio transfers watch --id <id>`, optionally `--timeout-seconds` and `--interval-seconds`.

## Driving it with verify.sh

Preconditions: a fresh run, signed in with `printf fixture-token | verify.sh cli login-stdin -- auth login --token-stdin --output json`. The fixture serves transfer `7` as always `DOWNLOADING` and transfer `8` as `COMPLETED`.

- **Finished.** `verify.sh cli watch-finished -- transfers watch --id 8 --output json`. Exit `0`; stdout has `"timedOut": false` and status `COMPLETED`; `verify.sh requests` shows one `GET /v2/transfers/8`.
- **Deadline.** `time verify.sh cli watch-deadline -- transfers watch --id 7 --timeout-seconds 3 --interval-seconds 60 --output json`. Exit `0` after about 3 seconds; stdout has `"timedOut": true`; `verify.sh requests` shows two `GET /v2/transfers/7`, about 3 seconds apart.
- **Stream.** `verify.sh cli watch-ndjson -- transfers watch --id 7 --timeout-seconds 2 --interval-seconds 1 --output ndjson`. Stdout has one JSON line per poll; only the last has `"timedOut": true`.

## Gotchas

- The request timestamps in `requests.jsonl` are the proof of the deadline; the wall time of `verify.sh` includes Node startup.
- Transfer `7` never finishes; a watch without `--timeout-seconds` runs for the default 300 seconds.
