# Distribution

## Delivery Model

Every merge to `main` should already be releasable.

GitHub Actions owns npm publishing, GitHub Releases, release assets, and Homebrew tap updates. The pipeline runs the repo's VitePlus commands before publishing:

1. `vp install`
2. `vp run verify`
3. `vp run smoke:pack`
4. `vp run build`
5. `semantic-release`

Binary asset jobs build from the published release tag after semantic-release creates it.

## Release Environment

Release jobs declare the protected GitHub Environment named `release`.

Environment entries:

- secrets: `PUTIO_RELEASE_BOT_PRIVATE_KEY`, `HOMEBREW_TAP_TOKEN`
- variables: `PUTIO_RELEASE_BOT_CLIENT_ID`
- approval: none; releases are continuous after the `main` gate passes
- refs: release branch/tag policy constrains what can publish
- deployment records: disabled with `deployment: false` because this is package publishing, not an app deploy

Release GitHub writes use `putio-release-bot` for version sync commits, `v*` tags, GitHub Releases, and binary asset uploads.

The npm package uses Trusted Publishing from GitHub Actions. On npm, configure owner `putdotio`, repository `putio-cli`, workflow `ci.yml`, and Environment named `release` for the package.

During the `@semantic-release/npm` publish step, npm detects the GitHub OIDC identity, mints short-lived publish credentials, and publishes provenance for the release job.

The workflow keeps dependency caches only on the secretless verify job. Secret-bearing release, binary asset, and Homebrew publish jobs use fresh installs or release tooling with package-manager caching disabled.

The release-bot remote is configured only after dependencies are installed and the package build completes.

## Local Checks

Before changing distribution wiring, validate the repo-local guardrails the workflow depends on:

```bash
vp install
vp run verify
vp run smoke:pack
```
