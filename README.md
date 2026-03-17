<div align="center">
  <p>
    <img src="https://static.put.io/images/putio-boncuk.png" width="72">
  </p>

  <h1>putio-cli</h1>

  <p>Agent-first official CLI for the put.io API.</p>
  <p>Built for deterministic automation first, with readable terminal output when humans are driving.</p>

  <p>
    <a href="https://github.com/putdotio/putio-cli/actions/workflows/ci.yml?query=branch%3Amain" style="text-decoration:none;"><img src="https://img.shields.io/github/actions/workflow/status/putdotio/putio-cli/ci.yml?branch=main&style=flat&label=ci&colorA=000000&colorB=000000" alt="CI"></a>
  </p>
</div>

## Local Setup

```bash
pnpm install
pnpm build
```

The build outputs the executable entrypoint at `./dist/bin.mjs`.

## Quick Start

Inspect the command surface:

```bash
./dist/bin.mjs describe
```

Check the currently resolved auth state:

```bash
./dist/bin.mjs auth status --output json
```

Render the brand and version:

```bash
./dist/bin.mjs version
```

## Development

Use the repo-local commands directly:

```bash
pnpm run check
pnpm run build
pnpm run test
pnpm run coverage
pnpm run verify
```

`verify` is the delivery gate for the repository. Every merge to `main` should already pass it.

## Output Modes

The CLI defaults to terminal-friendly text output.

Use `--output json` when you want a stable machine-readable contract for scripts, agents, and automation.

## Auth And Config

Auth resolution order:

1. `PUTIO_CLI_TOKEN`
2. Persisted config file

Useful environment variables:

- `PUTIO_CLI_TOKEN`
- `PUTIO_CLI_CONFIG_PATH`
- `PUTIO_CLI_API_BASE_URL`
- `PUTIO_CLI_CLIENT_NAME`
- `PUTIO_CLI_WEB_APP_URL`

Persisted config path resolution:

1. `PUTIO_CLI_CONFIG_PATH`
2. `$XDG_CONFIG_HOME/putio/config.json`
3. `~/.config/putio/config.json`

Persisted config shape:

```json
{
  "api_base_url": "https://api.put.io",
  "auth_token": "..."
}
```

`putio auth login` always prints the approval URL and code so it works in headless and remote environments. Use `--open` when you also want it to try opening a local browser.

## Repo Shape

- `src/commands` contains public command definitions
- `src/i18n` contains the temporarily vendored translations surface
- `src/internal` contains runtime, auth, config, metadata, output, and shared command helpers
- `src/internal/localizers` contains CLI-owned SDK error localization
- `src/internal/terminal` contains terminal renderers and layout helpers

## Delivery Model

- Pull requests and `main` pushes run `verify`
- Releases run on `main` after `verify` passes
- Versioning and npm publishing are driven by semantic-release
