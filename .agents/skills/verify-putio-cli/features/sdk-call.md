# SDK call

`putio sdk call` runs any SDK operation with JSON arguments. It validates the arguments against the operation's input schema before a dry run or a request, so a wrong shape fails locally with the operation and issue named.

## Driving it with verify.sh

Preconditions: a fresh run, signed in with `printf fixture-token | verify.sh cli login-stdin -- auth login --token-stdin --output json`.

- **Execute.** `verify.sh cli sdk-call -- sdk call --operation account.getInfo --args '[]' --execute --output json`. Exit `0`; stdout carries the fixture account; `verify.sh requests` shows `GET /v2/account/info`.
- **Dry run.** `verify.sh cli sdk-call-dry-run -- sdk call --operation files.list --args '[0]' --dry-run --output json`. Exit `0`; `verify.sh requests` shows no new request.
- **Invalid args.** `verify.sh cli sdk-call-invalid -- sdk call --operation files.get --args '[42]' --execute --output json`. Exit non-zero; stderr titled `Invalid SDK arguments`, naming `files.get`; `verify.sh requests` shows no new request.

## Gotchas

- Count requests before and after each step; "no new request" is the proof for dry runs and invalid args.
- Operations without a fixture route reach the fixture's `404`; add a route to `scripts/fixture-api.mjs` before treating that as a CLI failure.
