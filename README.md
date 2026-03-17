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

Choose the install path that fits your environment.

Install with the macOS/Linux helper script:

```bash
curl -fsSL https://raw.githubusercontent.com/putdotio/putio-cli/main/install.sh | sh
```

The installer downloads the latest release binary, verifies the matching `.sha256` file, and installs `putio` into `~/.local/bin` by default.

Useful overrides:

```bash
curl -fsSL https://raw.githubusercontent.com/putdotio/putio-cli/main/install.sh | INSTALL_DIR=/usr/local/bin sh
curl -fsSL https://raw.githubusercontent.com/putdotio/putio-cli/main/install.sh | PUTIO_CLI_VERSION=1.0.0 sh
```

Install with npm if you already want the package through Node.js:

```bash
npm install --global @putdotio/cli
```

This path requires Node `24.14+`.

Install manually from GitHub Releases if you prefer to handle the archive yourself or you are on Windows:

1. Download the matching asset from [GitHub Releases](https://github.com/putdotio/putio-cli/releases/latest).
2. Download the matching `.sha256` file for that asset.
3. Verify the checksum.
4. Extract the archive and place `putio` on your `PATH`.

Example asset names:

- `putio-cli-1.0.2-darwin-arm64.tar.gz`
- `putio-cli-1.0.2-linux-amd64.tar.gz`
- `putio-cli-1.0.2-windows-amd64.zip`

Verify a release binary on macOS or Linux:

```bash
shasum -a 256 -c putio-cli-1.0.2-linux-amd64.tar.gz.sha256
tar -xzf putio-cli-1.0.2-linux-amd64.tar.gz
chmod +x putio
mv putio /usr/local/bin/putio
```

Verify a release binary on Windows PowerShell:

```powershell
$expected = (Get-Content .\putio-cli-1.0.2-windows-amd64.zip.sha256).Split()[0]
$actual = (Get-FileHash .\putio-cli-1.0.2-windows-amd64.zip -Algorithm SHA256).Hash.ToLower()
if ($actual -ne $expected) { throw "Checksum mismatch" }
```

Confirm the installed CLI:

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
