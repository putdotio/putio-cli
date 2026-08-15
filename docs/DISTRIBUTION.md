# Distribution

## Delivery Model

Every merge to `main` should already be releasable.

GitHub Actions owns npm publishing, GitHub Releases, release assets, and Homebrew tap updates. The pipeline runs the repo's VitePlus commands before publishing:

1. `vp install`
2. `vp run verify`
3. `vp run smoke:pack`
4. `vp run build`
5. `semantic-release`

semantic-release publishes npm, writes the version tag, and creates a draft
GitHub Release. Binary jobs build from that exact tag and upload all six archive
and checksum assets while the Release is mutable. A final job verifies the exact
asset manifest before publishing, then reconciles the Homebrew formula to the
same tag.

## Release Environment

Release jobs declare the protected GitHub Environment named `release`.

Environment entries:

- secrets: `PUTIO_RELEASE_BOT_PRIVATE_KEY`
- variables: `PUTIO_RELEASE_BOT_CLIENT_ID`, `PUTIO_CLI_SENTRY_DSN`
- approval: none; releases are continuous after the `main` gate passes
- refs: release branch/tag policy constrains what can publish
- deployment records: disabled with `deployment: false` because this is package publishing, not an app deploy

`PUTIO_CLI_SENTRY_DSN` is a public routing key rather than an administration secret. The workflow
validates and injects it into npm and standalone artifacts at build time, and release builds fail if
it is absent or invalid. Local and pull-request builds intentionally omit it so verification cannot
send crash reports.

Release GitHub writes use `putio-releaser` for version sync commits, `v*` tags, GitHub Releases, binary asset uploads, and Homebrew tap formula commits. The app installation grants Contents read and write access to `putio-cli` and `homebrew-tap`; the Homebrew job mints an installation token scoped to those two repositories.

The npm package uses Trusted Publishing from GitHub Actions. On npm, configure owner `putdotio`, repository `putio-cli`, workflow `ci.yml`, and Environment named `release` for the package.

During the `@semantic-release/npm` publish step, npm detects the GitHub OIDC identity, mints short-lived publish credentials, and publishes provenance for the release job.

The workflow keeps dependency caches only on the secretless verify job. Secret-bearing release, binary asset, and Homebrew publish jobs use fresh installs or release tooling with package-manager caching disabled.

The release-bot remote is configured only after dependencies are installed and the package build completes.

## Recover

After a partial release failure, dispatch `CI` from current `main` with the
exact existing tag. The release job validates that tag against `main` and reads
its exact GitHub Release state:

- a draft rebuilds and replaces its binary assets, verifies all six names, and
  publishes once
- a published Release skips asset mutation, verifies the complete manifest,
  and reruns the idempotent Homebrew reconciliation
- a push with no new semantic-release output remains a no-op

An unavailable expected Release fails closed. Use the manual `Backfill Release
Assets` workflow only for an older published release created before draft-first
publication.

## Package Contents

The npm package includes `dist`, `README.md`, `docs`, `skills`, `AGENTS.md`,
`CONTRIBUTING.md`, and `SECURITY.md`. The distributed `skills/putio-cli`
library is part of the public package contract so consuming repos and agents can
install the same guidance that maintainers use from git.

The build bundles the pinned, compatibility-patched put.io SDK into `dist`.
Effect remains a package dependency so the CLI and its bundled SDK execute on
the same installed Effect runtime.

## Local Checks

Before changing distribution wiring, validate the repo-local guardrails the workflow depends on:

```bash
pnpm exec vp install
pnpm exec vp run verify
pnpm exec vp run smoke:pack
```
