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

## Install

Install the CLI globally:

```bash
npm install --global @putdotio/cli
```

Then run it as:

```bash
putio version
```

## Quick Start

Inspect the machine-readable command surface:

```bash
putio describe
```

Check the currently resolved auth state:

```bash
putio auth status --output json
```

Start the login flow:

```bash
putio auth login
```

`putio auth login` always prints the approval URL and code, so it works in headless and remote environments too.

## Usage Notes

- Use `--output json` when you want a stable machine-readable contract for scripts, agents, and automation.
- Set `PUTIO_CLI_TOKEN` when you want fully headless auth.
- Use `PUTIO_CLI_CONFIG_PATH` to override the default config location.

## Docs

- [Architecture](/Users/altay/projects/putdotio/putio-cli/docs/ARCHITECTURE.md)
- [Contributing](/Users/altay/projects/putdotio/putio-cli/CONTRIBUTING.md)
- [Security](/Users/altay/projects/putdotio/putio-cli/SECURITY.md)

## Contributing

Contributor setup, development workflow, and validation live in [CONTRIBUTING.md](/Users/altay/projects/putdotio/putio-cli/CONTRIBUTING.md).

## License

This project is available under the MIT license. See [LICENSE](/Users/altay/projects/putdotio/putio-cli/LICENSE).
