#!/usr/bin/env node
import { appendFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    log: { type: "string" },
    "port-file": { type: "string" },
  },
});

if (!values.log || !values["port-file"]) {
  process.stderr.write("usage: fixture-api.mjs --log <requests.jsonl> --port-file <file>\n");
  process.exit(2);
}

const VALID_TOKEN = "fixture-token";
const DEVICE_CODE = "VERIFY1";
const TIMESTAMP = "2026-03-15T12:00:00Z";

const file = (id, name, fields = {}) => ({
  content_type: null,
  created_at: TIMESTAMP,
  crc32: null,
  extension: null,
  file_type: "FOLDER",
  first_accessed_at: null,
  folder_type: "REGULAR",
  icon: null,
  id,
  is_hidden: false,
  is_mp4_available: false,
  is_shared: false,
  name,
  opensubtitles_hash: null,
  parent_id: 0,
  screenshot: null,
  size: 0,
  updated_at: TIMESTAMP,
  ...fields,
});

const accountInfo = {
  account_status: "active",
  avatar_url: "https://example.invalid/avatar.png",
  can_create_sub_account: false,
  disk: { avail: 700, size: 1_000, used: 300 },
  files_will_be_deleted_at: null,
  is_eligible_for_friend_invitation: false,
  is_sub_account: false,
  mail: "fixture@example.invalid",
  monthly_bandwidth_usage: 0,
  password_last_changed_at: null,
  private_download_host_ip: null,
  settings: {
    beta_user: false,
    callback_url: null,
    dark_theme: false,
    default_download_folder: 0,
    diagnostics_enabled: false,
    dont_autoselect_subtitles: false,
    fluid_layout: false,
    hide_subtitles: false,
    history_enabled: true,
    is_invisible: false,
    locale: null,
    login_mails_enabled: false,
    next_episode: false,
    product_analytics_enabled: false,
    pushover_token: null,
    show_optimistic_usage: false,
    sort_by: "NAME_ASC",
    start_from: false,
    subtitle_languages: [],
    theater_mode: false,
    theme: "auto",
    transfer_sort_by: null,
    trash_enabled: true,
    tunnel_route_name: null,
    two_factor_enabled: true,
    use_private_download_ip: false,
    use_start_from: false,
    video_player: null,
  },
  trash_size: 25,
  user_id: 1,
  username: "fixture-user",
  warnings: {},
};

const ok = (body = {}) => ({ status: 200, body: { status: "OK", ...body } });

const error = (status, errorType, message) => ({
  status,
  body: { error_message: message, error_type: errorType, status: "ERROR", status_code: status },
});

const authorized = (request) => request.authorization === `Token ${VALID_TOKEN}`;

let devicePolls = 0;

const routes = {
  "GET /__health": () => ok({ fixture: "verify-putio-cli" }),
  "GET /v2/oauth2/validate": (request) => {
    const valid = request.query.oauth_token === VALID_TOKEN;

    return ok({ result: valid, token_id: null, token_scope: "default", user_id: valid ? 1 : null });
  },
  "GET /v2/oauth2/oob/code": () => ok({ code: DEVICE_CODE, qr_code_url: "https://example.invalid/qr" }),
  [`GET /v2/oauth2/oob/code/${DEVICE_CODE}`]: () => {
    devicePolls += 1;

    return ok({ oauth_token: devicePolls < 2 ? null : VALID_TOKEN });
  },
  "GET /v2/account/info": (request) =>
    authorized(request) ? ok({ info: accountInfo }) : error(401, "invalid_grant", "Invalid token"),
  "GET /v2/files/list": (request) =>
    authorized(request)
      ? ok({ cursor: null, files: [file(1, "Movies")], parent: file(0, "Your Files"), total: 1 })
      : error(401, "invalid_grant", "Invalid token"),
};

const readBody = async (request) => {
  const chunks = [];

  for await (const chunk of request) chunks.push(chunk);

  return Buffer.concat(chunks).toString("utf8");
};

const server = createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? "/", "http://fixture.invalid");

    const recorded = {
      at: new Date().toISOString(),
      authorization: request.headers.authorization,
      body: await readBody(request),
      host: request.headers.host,
      method: request.method ?? "GET",
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
    };

    const route = routes[`${recorded.method} ${recorded.path}`];
    const reply = route ? route(recorded) : error(404, "NOT_FOUND", "No fixture route");

    if (recorded.path !== "/__health") {
      appendFileSync(values.log, `${JSON.stringify({ ...recorded, status: reply.status })}\n`);
    }

    response.writeHead(reply.status, { "content-type": "application/json" });
    response.end(JSON.stringify(reply.body));
  })();
});

server.listen(0, "127.0.0.1", () => {
  writeFileSync(values["port-file"], `${server.address().port}\n`);
});

const shutdown = () => server.close(() => process.exit(0));

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
