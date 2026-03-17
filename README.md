<div align="center">
  <p>
    <img src="https://static.put.io/images/putio-boncuk.png" width="72">
  </p>

  <h1>putio-cli</h1>

  <p>Agent-first CLI for the put.io API</p>
  <p>Built for deterministic automation first, with readable terminal output when humans are driving.</p>

  <p>
    <a href="https://github.com/putdotio/putio-cli/actions/workflows/ci.yml?query=branch%3Amain" style="text-decoration:none;"><img src="https://img.shields.io/github/actions/workflow/status/putdotio/putio-cli/ci.yml?branch=main&style=flat&label=ci&colorA=000000&colorB=000000" alt="CI"></a>
  </p>
</div>

## Install

Recommended on macOS and Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/putdotio/putio-cli/main/install.sh | sh
```

That installs the latest release to `~/.local/bin/putio`.

Install somewhere else:

```bash
curl -fsSL https://raw.githubusercontent.com/putdotio/putio-cli/main/install.sh | INSTALL_DIR=/usr/local/bin sh
```

If you want npm:

```bash
npm install --global @putdotio/cli
```

Requires Node `24.14+`.

Windows or manual install:

Download the matching archive from [GitHub Releases](https://github.com/putdotio/putio-cli/releases/latest), verify the `.sha256`, extract it, and put `putio` on your `PATH`.

Confirm the installed CLI:

```bash
putio version
```

## Quick Start

Inspect the live contract:

```bash
putio describe
```

Link your account:

```bash
putio auth login --open
```

Check the account:

```bash
putio whoami --output json
```

Read a small JSON result:

```bash
putio files list --per-page 5 --fields files,total --output json
```

Stream larger reads:

```bash
putio transfers list --page-all --output ndjson
```

## Tips

- Use `--output json` when you want a stable machine-readable contract for scripts, agents, and automation.
- Use `--output ndjson` for large or continuous read workflows.
- Use `--fields` to keep structured responses small.
- Use `--dry-run` before mutating commands.
- Set `PUTIO_CLI_TOKEN` for headless auth.
- Use `PUTIO_CLI_CONFIG_PATH` to override the default config location.

## Docs

- [Architecture](./docs/ARCHITECTURE.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)

## License

This project is available under the MIT license. See [LICENSE](./LICENSE).
