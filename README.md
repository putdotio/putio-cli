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

Install the CLI globally with npm:

```bash
npm install --global @putdotio/cli
```

The npm package currently requires Node `24.14+`.

If you do not want to install Node, use a standalone binary from the GitHub Releases page when your platform asset is published there.

Check that the binary is available:

```bash
putio version
```

## Quick Start

Inspect the machine-readable command surface before guessing flags or payloads:

```bash
putio describe
```

Start the device-link login flow:

```bash
putio auth login --open
```

Then confirm the linked account:

```bash
putio whoami --output json
```

List a small structured file result:

```bash
putio files list --per-page 5 --fields files,total --output json
```

For larger reads, prefer streamed output:

```bash
putio transfers list --page-all --output ndjson
```

## Usage Notes

- Use `--output json` when you want a stable machine-readable contract for scripts, agents, and automation.
- Use `--output ndjson` for large or continuous read workflows.
- Use `--fields` to keep structured responses small.
- Use `--dry-run` before mutating commands.
- Set `PUTIO_CLI_TOKEN` when you want fully headless auth.
- Use `PUTIO_CLI_CONFIG_PATH` to override the default config location.
- `putio auth login` always prints the approval URL and code, so it still works in headless and remote environments.

## Docs

- [Architecture](./docs/ARCHITECTURE.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)

## Contributing

Contributor setup, development workflow, and validation live in [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

This project is available under the MIT license. See [LICENSE](./LICENSE).
