#!/bin/sh

set -eu

REPO_OWNER="${PUTIO_CLI_REPO_OWNER:-putdotio}"
REPO_NAME="${PUTIO_CLI_REPO_NAME:-putio-cli}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${PUTIO_CLI_VERSION:-latest}"

fail() {
  printf '%s\n' "putio installer: $*" >&2
  exit 1
}

need_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

detect_platform() {
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin) platform="darwin" ;;
    Linux) platform="linux" ;;
    *)
      fail "unsupported operating system: $os"
      ;;
  esac

  case "$arch" in
    arm64|aarch64) architecture="arm64" ;;
    x86_64|amd64) architecture="x64" ;;
    *)
      fail "unsupported architecture: $arch"
      ;;
  esac

  asset_name="putio-${platform}-${architecture}"
}

checksum_command() {
  if command -v shasum >/dev/null 2>&1; then
    printf '%s\n' "shasum"
    return
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s\n' "sha256sum"
    return
  fi

  if command -v openssl >/dev/null 2>&1; then
    printf '%s\n' "openssl"
    return
  fi

  fail "missing checksum tool: install shasum, sha256sum, or openssl"
}

download_url() {
  asset="$1"

  if [ -n "${PUTIO_CLI_DOWNLOAD_BASE_URL:-}" ]; then
    printf '%s/%s\n' "${PUTIO_CLI_DOWNLOAD_BASE_URL%/}" "$asset"
    return
  fi

  repo_base="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases"

  if [ "$VERSION" = "latest" ]; then
    printf '%s/latest/download/%s\n' "$repo_base" "$asset"
    return
  fi

  printf '%s/download/v%s/%s\n' "$repo_base" "${VERSION#v}" "$asset"
}

download_file() {
  url="$1"
  destination="$2"

  if command -v curl >/dev/null 2>&1; then
    curl --fail --location --silent --show-error "$url" --output "$destination"
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget --quiet --output-document="$destination" "$url"
    return
  fi

  fail "missing downloader: install curl or wget"
}

verify_checksum() {
  checksum_tool="$(checksum_command)"
  checksum_file="$1"
  binary_file="$2"

  case "$checksum_tool" in
    shasum)
      (cd "$(dirname "$binary_file")" && shasum -a 256 -c "$(basename "$checksum_file")")
      ;;
    sha256sum)
      (cd "$(dirname "$binary_file")" && sha256sum -c "$(basename "$checksum_file")")
      ;;
    openssl)
      expected="$(awk '{print $1}' "$checksum_file")"
      actual="$(openssl dgst -sha256 "$binary_file" | awk '{print $NF}')"
      [ "$expected" = "$actual" ] || fail "checksum mismatch for $(basename "$binary_file")"
      ;;
  esac
}

ensure_install_dir() {
  mkdir -p "$INSTALL_DIR"
  [ -w "$INSTALL_DIR" ] || fail "install directory is not writable: $INSTALL_DIR"
}

print_path_hint() {
  case ":$PATH:" in
    *":$INSTALL_DIR:"*) return ;;
  esac

  printf '\n%s\n' "putio installer: add $INSTALL_DIR to your PATH if it is not already there."
}

need_command uname
need_command mktemp
need_command chmod
need_command mv

detect_platform
ensure_install_dir

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT INT TERM

binary_path="$work_dir/$asset_name"
checksum_path="$work_dir/$asset_name.sha256"

printf '%s\n' "putio installer: downloading $asset_name"
download_file "$(download_url "$asset_name")" "$binary_path"
download_file "$(download_url "$asset_name.sha256")" "$checksum_path"

printf '%s\n' "putio installer: verifying checksum"
verify_checksum "$checksum_path" "$binary_path"

chmod +x "$binary_path"
mv "$binary_path" "$INSTALL_DIR/putio"

printf '%s\n' "putio installer: installed to $INSTALL_DIR/putio"
print_path_hint
printf '%s\n' "putio installer: run 'putio version' to confirm the install."
