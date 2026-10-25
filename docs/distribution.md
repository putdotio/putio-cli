# Distribution

Every merge to `main` must be releasable. [`ci.yml`](../.github/workflows/ci.yml)
runs `verify` without secrets, then semantic-release publishes npm, tags, and
opens a draft GitHub Release. Binary jobs build from that tag and upload their
archives and checksums. A final job checks the exact asset manifest, publishes
the Release, and reconciles the `putdotio/homebrew-tap` formula to the same tag.

Dispatch `CI` without a tag to verify and scan without releasing.

## Provider Setup

These settings live outside the repository; the workflow fails without them.

- GitHub Environment `release`: secret `PUTIO_CI_APP_PRIVATE_KEY`, variables
  `PUTIO_CI_APP_CLIENT_ID` and `PUTIO_CLI_SENTRY_DSN`, no approval, `main` only.
- The `putio-ci` GitHub App needs Contents read and write on `putio-cli` and
  `homebrew-tap`. It writes the version commit, tags, Releases, asset uploads,
  and formula commits.
- npm Trusted Publishing for `@putdotio/cli`: owner `putdotio`, repository
  `putio-cli`, workflow `ci.yml`, environment `release`. npm mints publish
  credentials from the job's OIDC identity and records provenance.

`PUTIO_CLI_SENTRY_DSN` is a public routing key, not an admin secret. Release
builds fail when it is missing or invalid. Local and pull-request builds omit
it, so they cannot send crash reports.

Keep dependency caches off every job that holds a release credential.

## Recover

After a partial release failure, dispatch `CI` from current `main` with the
exact existing tag. The release job refuses a tag that is off `main` or older
than the newest stable release, so recovery cannot roll the formula back. It
then acts on the tag's GitHub Release:

- draft: rebuild and replace the binary assets, check the manifest, publish once
- published: leave assets alone, check the manifest, rerun the Homebrew
  reconciliation
- missing: fail

Use the manual `Backfill Release Assets` workflow only for a published release
created before draft-first publishing.

## Package Contents

The `files` list in [`package.json`](../package.json) sets the npm contents.
`skills/putio-cli` ships on purpose, so consumers install the same guidance as
the git source. The build bundles the pinned put.io SDK into `dist`; `effect`
stays a runtime dependency so the CLI and the bundled SDK share one Effect
runtime.
