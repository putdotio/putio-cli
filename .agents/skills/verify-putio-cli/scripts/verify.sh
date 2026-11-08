#!/usr/bin/env bash
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(git -C "$SKILL_DIR" rev-parse --show-toplevel)"
BASE="$ROOT/.evidence/verify-putio-cli"
BIN="$ROOT/dist/bin.mjs"

usage() {
  cat <<'EOF'
usage: verify.sh <command>
  start                     new isolated run: scratch HOME/config, fixture API on loopback
  doctor                    read-only health check of the current run; exits 1 on any failure
  cli <name> -- <args...>   run the built binary without a TTY; stdin passes through
  pty start <name> -- <args...>   run the built binary in a real PTY (tmux)
  pty send <text>           type literal text into the PTY
  pty key <key>             send one tmux key name (Enter, C-c)
  pty wait <regex> [secs]   wait until the screen matches (default 10s); exits 1 on timeout
  pty capture [label]       save the screen (screen-<label>.txt) and pane state as evidence, print them
  config                    print the scratch config file and its mode
  requests                  print the fixture API request log
  stop                      stop what this run started, delete scratch, keep evidence
Select a run with VERIFY_RUN=<id>; default is the latest run.
EOF
}

run_dir() {
  local id="${VERIFY_RUN:-}"

  if [[ -z "$id" && -f "$BASE/latest" ]]; then
    id="$(cat "$BASE/latest")"
  fi

  if [[ -z "$id" || ! -d "$BASE/$id" ]]; then
    echo "no run found; run: verify.sh start" >&2
    exit 1
  fi

  echo "$BASE/$id"
}

socket_name() { echo "verify-putio-cli-$(basename "$1")"; }

child_env() {
  local run="$1"
  local port
  port="$(cat "$run/scratch/port")"

  printf '%s\n' \
    "PATH=$PATH" \
    "HOME=$run/scratch/home" \
    "XDG_CONFIG_HOME=$run/scratch/home/.config" \
    "TMPDIR=$run/scratch/tmp" \
    "TERM=xterm-256color" \
    "LANG=en_US.UTF-8" \
    "PUTIO_CLI_CONFIG_PATH=$run/scratch/config.json" \
    "PUTIO_CLI_API_BASE_URL=http://127.0.0.1:$port" \
    "PUTIO_CLI_UPLOAD_BASE_URL=http://127.0.0.1:$port" \
    "PUTIO_CLI_WEB_APP_URL=http://127.0.0.1:$port"
}

step_dir() {
  local run="$1" name="$2"
  local n
  n="$(find "$run/evidence" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  local dir
  dir="$run/evidence/$(printf '%03d' "$((n + 1))")-$name"
  mkdir -p "$dir"
  echo "$dir"
}

cmd_start() {
  [[ -f "$BIN" ]] || { echo "missing $BIN; run: pnpm exec vp run build" >&2; exit 1; }

  local id
  id="$(date +%Y%m%d-%H%M%S)-$$"
  local run="$BASE/$id"
  mkdir -p "$run/scratch/home/.config" "$run/scratch/tmp" "$run/evidence"

  node "$SKILL_DIR/scripts/fixture-api.mjs" \
    --log "$run/evidence/requests.jsonl" \
    --port-file "$run/scratch/port" \
    >"$run/scratch/fixture.log" 2>&1 &
  echo $! >"$run/scratch/fixture.pid"

  for _ in $(seq 1 50); do
    [[ -s "$run/scratch/port" ]] && break
    sleep 0.1
  done

  [[ -s "$run/scratch/port" ]] || { echo "fixture API did not start; see $run/scratch/fixture.log" >&2; exit 1; }

  {
    echo "revision: $(git -C "$ROOT" rev-parse HEAD)"
    echo "dirty: $(git -C "$ROOT" status --porcelain | wc -l | tr -d ' ') paths"
    echo "binary_sha256: $(shasum -a 256 "$BIN" | cut -d' ' -f1)"
    echo "started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } >"$run/evidence/run.txt"

  echo "$id" >"$BASE/latest"
  echo "run: $id"
  echo "evidence: $run/evidence"
}

cmd_doctor() {
  local run
  run="$(run_dir)"
  local failed=0
  check() {
    if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; failed=1; fi
  }

  local pid port
  pid="$(cat "$run/scratch/fixture.pid")"
  port="$(cat "$run/scratch/port")"

  check "built binary exists" "[[ -f '$BIN' ]]"
  check "binary built after the last src change" "[[ -z \"\$(find '$ROOT/src' -newer '$BIN' -type f | head -1)\" ]]"
  check "binary has no crash-reporting DSN" "! grep -rqE 'https://[A-Za-z0-9]+@[A-Za-z0-9.-]+/[0-9]+' '$ROOT/dist'"
  check "fixture API process is ours and alive" "kill -0 '$pid' 2>/dev/null"
  check "fixture API answers on 127.0.0.1:$port" "curl -fsS 'http://127.0.0.1:$port/__health' | grep -q verify-putio-cli"
  check "child env has no PUTIO_CLI_TOKEN" "! child_env '$run' | grep -q '^PUTIO_CLI_TOKEN='"
  check "config path is inside the run" "child_env '$run' | grep -q '^PUTIO_CLI_CONFIG_PATH=$run/scratch/'"
  check "every API URL is loopback" "! child_env '$run' | grep -E '^PUTIO_CLI_(API|UPLOAD|WEB_APP)' | grep -vq '=http://127.0.0.1:'"

  return "$failed"
}

run_child() {
  local run="$1"
  shift
  local -a envs=()
  while IFS= read -r line; do envs+=("$line"); done < <(child_env "$run")
  env -i "${envs[@]}" node "$BIN" "$@"
}

cmd_cli() {
  local run name
  run="$(run_dir)"
  name="${1:?name required}"
  shift
  [[ "${1:-}" == "--" ]] && shift

  local dir
  dir="$(step_dir "$run" "$name")"
  printf 'putio %s\n' "$*" >"$dir/command.txt"

  local code=0
  run_child "$run" "$@" >"$dir/stdout.txt" 2>"$dir/stderr.txt" || code=$?
  echo "$code" >"$dir/exit.txt"

  echo "--- exit $code ($dir)"
  echo "--- stdout"; cat "$dir/stdout.txt"
  echo "--- stderr"; cat "$dir/stderr.txt"
}

cmd_pty() {
  local run sub sock
  run="$(run_dir)"
  sock="$(socket_name "$run")"
  sub="${1:?pty subcommand required}"
  shift

  case "$sub" in
    start)
      local name="${1:?name required}"
      shift
      [[ "${1:-}" == "--" ]] && shift
      local dir
      dir="$(step_dir "$run" "$name")"
      printf 'putio %s\n' "$*" >"$dir/command.txt"
      echo "$dir" >"$run/scratch/pty-step"

      local -a envs=()
      while IFS= read -r line; do envs+=("$line"); done < <(child_env "$run")
      local cmd
      cmd="$(printf '%q ' env -i "${envs[@]}" node "$BIN" "$@")"
      tmux -L "$sock" kill-server 2>/dev/null || true
      tmux -L "$sock" -f /dev/null new-session -d -s putio -x 120 -y 40 "$cmd"
      tmux -L "$sock" set-option -t putio remain-on-exit on >/dev/null
      echo "pty started: $dir"
      ;;
    send)
      tmux -L "$sock" send-keys -t putio -l "${1:?text required}"
      ;;
    key)
      tmux -L "$sock" send-keys -t putio "${1:?key required}"
      ;;
    wait)
      local pattern="${1:?regex required}" secs="${2:-10}"
      for _ in $(seq 1 "$((secs * 10))"); do
        tmux -L "$sock" capture-pane -p -t putio | grep -qE "$pattern" && { echo "matched: $pattern"; return 0; }
        sleep 0.1
      done
      echo "timeout after ${secs}s waiting for: $pattern" >&2
      tmux -L "$sock" capture-pane -p -t putio >&2
      return 1
      ;;
    capture)
      local dir label="${1:-final}"
      dir="$(cat "$run/scratch/pty-step")"
      tmux -L "$sock" capture-pane -p -S - -t putio >"$dir/screen-$label.txt"
      tmux -L "$sock" display-message -p -t putio '#{pane_dead} #{pane_dead_status}' >"$dir/pane.txt"
      echo "--- pane (dead status): $(cat "$dir/pane.txt") ($dir)"
      cat "$dir/screen-$label.txt"
      ;;
    *)
      usage
      exit 2
      ;;
  esac
}

cmd_config() {
  local run cfg
  run="$(run_dir)"
  cfg="$run/scratch/config.json"

  if [[ -f "$cfg" ]]; then
    echo "--- mode $(stat -f '%Lp' "$cfg" 2>/dev/null || stat -c '%a' "$cfg")"
    cat "$cfg"
  else
    echo "--- no config file"
  fi
}

cmd_requests() {
  local run
  run="$(run_dir)"
  cat "$run/evidence/requests.jsonl" 2>/dev/null || echo "--- no requests"
}

cmd_stop() {
  local run
  run="$(run_dir)"
  tmux -L "$(socket_name "$run")" kill-server 2>/dev/null || true

  if [[ -f "$run/scratch/fixture.pid" ]]; then
    kill "$(cat "$run/scratch/fixture.pid")" 2>/dev/null || true
  fi

  [[ -f "$run/scratch/config.json" ]] && cp "$run/scratch/config.json" "$run/evidence/final-config.json"
  rm -rf "$run/scratch"
  echo "stopped; evidence kept at $run/evidence"
}

case "${1:-}" in
  start) cmd_start ;;
  doctor) cmd_doctor ;;
  cli) shift; cmd_cli "$@" ;;
  pty) shift; cmd_pty "$@" ;;
  config) cmd_config ;;
  requests) cmd_requests ;;
  stop) cmd_stop ;;
  *) usage; exit 2 ;;
esac
