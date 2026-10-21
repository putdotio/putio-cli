import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import {
  FIXTURE_TOKEN,
  runPutio,
  startFixtureApi,
  stderrJson,
  stdoutJson,
  stdoutLines,
  type CliRun,
  type FixtureApi,
} from "./test-support/run-cli.js";

// Request shapes follow the put.io API routes the SDK documents; response
// bodies are synthetic but satisfy the SDK's response schemas.

const AUTHORIZATION = `Token ${FIXTURE_TOKEN}`;
const TIMESTAMP = "2026-03-15T12:00:00Z";

const file = (id: number, name: string, fields: Record<string, unknown> = {}) => ({
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

const transfer = (id: number, name: string, status = "DOWNLOADING") => ({
  availability: null,
  callback_url: null,
  client_ip: null,
  completion_percent: null,
  created_at: TIMESTAMP,
  created_torrent: false,
  current_ratio: null,
  down_speed: null,
  download_id: null,
  downloaded: null,
  error_message: null,
  estimated_time: null,
  file_id: null,
  finished_at: null,
  hash: null,
  id,
  is_private: false,
  name,
  peers_connected: null,
  peers_getting_from_us: null,
  peers_sending_to_us: null,
  percent_done: status === "COMPLETED" ? 100 : 50,
  save_parent_id: 0,
  seconds_seeding: null,
  simulated: false,
  size: null,
  source: `https://example.com/${name}.torrent`,
  started_at: null,
  status,
  subscription_id: null,
  torrent_link: null,
  tracker: null,
  tracker_message: null,
  type: "URL",
  up_speed: null,
  uploaded: null,
});

const accountInfo = {
  account_status: "active",
  avatar_url: "https://example.invalid/avatar.png",
  can_create_sub_account: false,
  disk: { avail: 700, size: 1_000, used: 300 },
  files_will_be_deleted_at: null,
  is_eligible_for_friend_invitation: false,
  is_sub_account: false,
  mail: "user@example.com",
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
  username: "example-user",
  warnings: {},
};

const hlsManifest = [
  "#EXTM3U",
  '#EXT-X-STREAM-INF:BANDWIDTH=2376462,CODECS="avc1.42c01e,mp4a.40.2",VIDEO-RANGE=PQ',
  `https://api.put.io/hls/playlist/abc/index-v1-a1.m3u8?oauth_token=${FIXTURE_TOKEN}`,
].join("\n");

const ok = (body: Record<string, unknown> = {}) => ({ body: { status: "OK", ...body } });

const routeReads = (api: FixtureApi) => {
  api.route("GET /v2/account/info", ok({ info: accountInfo }));
  api.route(
    "GET /v2/events/list",
    ok({
      events: [
        {
          created_at: TIMESTAMP,
          file_id: 5,
          id: 101,
          source: "https://example.com/ubuntu.torrent",
          transfer_name: "ubuntu.iso",
          transfer_size: 42,
          type: "transfer_completed",
          user_id: 1,
        },
        {
          created_at: TIMESTAMP,
          file_id: 6,
          file_name: "movie.mkv",
          file_size: 42,
          id: 102,
          type: "upload",
          user_id: 1,
        },
      ],
      has_more: false,
    }),
  );
  api.route(
    "GET /v2/download_links/55",
    ok({
      error_msg: null,
      links: {
        download_links: ["https://download.put.io/file-1"],
        media_links: ["https://media.put.io/file-1"],
        mp4_links: [],
      },
      links_status: "DONE",
    }),
  );
  api.route(
    "GET /v2/files/list",
    ok({ cursor: null, files: [file(1, "Movies")], parent: file(0, "Your Files"), total: 1 }),
  );
  api.route(
    "GET /v2/files/search",
    ok({ cursor: null, files: [file(2, "movie.mkv", { file_type: "VIDEO", size: 42 })], total: 1 }),
  );
  api.route("GET /v2/transfers/list", ok({ cursor: null, transfers: [transfer(7, "ubuntu.iso")] }));
  api.route("GET /v2/transfers/7", ok({ transfer: transfer(7, "ubuntu.iso", "COMPLETED") }));
};

const expectFailure = (run: CliRun, message: string | RegExp) => {
  expect(run.exitCode).toBe(1);
  expect(run.stdout).toBe("");
  expect(stderrJson(run).error).toMatchObject({
    message: typeof message === "string" ? message : expect.stringMatching(message),
  });
};

let api: FixtureApi;
const putio = (...args: ReadonlyArray<string>) => runPutio(api, args);
const requestsTo = (method: string, path: string) =>
  api.requests.filter((request) => request.method === method && request.path === path);

const fixtureDirectories: string[] = [];
const makeUploadFixture = async (name = "movie.mp4", mode?: number) => {
  const directory = await mkdtemp(join(tmpdir(), "putio-cli-upload-"));
  fixtureDirectories.push(directory);
  const path = join(directory, name);
  await writeFile(path, "video fixture", mode === undefined ? undefined : { mode });
  return { directory, path };
};

beforeAll(async () => {
  api = await startFixtureApi();
});

afterEach(async () => {
  api.reset();
  await Promise.all(
    fixtureDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

afterAll(() => api.close());

describe("auth", () => {
  const routeDeviceLink = () => {
    api.route(
      "GET /v2/oauth2/oob/code",
      ok({ code: "PUTIO1", qr_code_url: "https://example.invalid/qr" }),
    );
    api.route("GET /v2/oauth2/oob/code/PUTIO1", ok({ oauth_token: "linked-token" }));
  };

  it("logs in through the device link and saves the token", async () => {
    routeDeviceLink();

    const run = await runPutio(
      api,
      ["auth", "login", "--output", "json", "--timeout-seconds", "1"],
      {
        env: { PUTIO_CLI_TOKEN: undefined },
      },
    );

    expect(run.exitCode).toBe(0);
    expect(run.stderr).toContain("https://app.put.io/link?code=PUTIO1");
    expect(run.stderr).toContain("code: PUTIO1");
    expect(stdoutJson(run)).toMatchObject({
      apiBaseUrl: api.baseUrl,
      authenticated: true,
      browserOpened: false,
      linkUrl: "https://app.put.io/link?code=PUTIO1",
      profile: null,
    });
    expect(run.stdout).not.toContain("linked-token");
    expect(run.config).toMatchObject({ api_base_url: api.baseUrl, auth_token: "linked-token" });
    expect(
      api.requests.map(({ authorization, method, path, query }) => ({
        authorization,
        method,
        path,
        query,
      })),
    ).toEqual([
      {
        authorization: undefined,
        method: "GET",
        path: "/v2/oauth2/oob/code",
        query: { app_id: "8993", client_name: "putio-cli@fixture-host" },
      },
      { authorization: undefined, method: "GET", path: "/v2/oauth2/oob/code/PUTIO1", query: {} },
    ]);
  });

  it("opens the link and saves a named profile on login", async () => {
    routeDeviceLink();

    const run = await runPutio(
      api,
      ["auth", "login", "--open", "--profile", "automation", "--output", "json"],
      { env: { PUTIO_CLI_TOKEN: undefined } },
    );

    expect(run.exitCode).toBe(0);
    expect(run.openedUrls).toEqual(["https://app.put.io/link?code=PUTIO1"]);
    expect(stdoutJson(run)).toMatchObject({ browserOpened: true, profile: "automation" });
    expect(run.config).toMatchObject({
      profiles: { automation: { auth_token: "linked-token" } },
    });
  });

  it("logs out of the legacy token without touching named profiles", async () => {
    const run = await runPutio(api, ["auth", "logout", "--output", "json"], {
      configContents: JSON.stringify({
        api_base_url: "https://api.put.io",
        auth_token: "legacy-token",
        profiles: { automation: { auth_token: "profile-token" } },
      }),
      env: { PUTIO_CLI_TOKEN: undefined },
    });

    expect(stdoutJson(run)).toEqual({ cleared: true, configPath: run.configPath, profile: null });
    expect(run.config).not.toHaveProperty("auth_token");
    expect(run.config).toMatchObject({ profiles: { automation: { auth_token: "profile-token" } } });
    expect(api.requests).toEqual([]);
  });

  it("renders text auth status for an env token", async () => {
    const run = await putio("auth", "status", "--output", "text");

    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("authenticated: yes");
    expect(run.stdout).not.toContain(FIXTURE_TOKEN);
  });

  it("approves a device code with the authenticated account", async () => {
    api.route(
      "POST /v2/oauth2/oob/code",
      ok({
        app: {
          description: "Living room TV",
          has_icon: false,
          id: 77,
          name: "put.io TV",
          website: "https://put.io",
        },
      }),
    );

    const run = await putio("auth", "approve", "HELLO1", "--output", "json");

    expect(stdoutJson(run)).toMatchObject({ id: 77, name: "put.io TV" });
    expect(requestsTo("POST", "/v2/oauth2/oob/code")).toEqual([
      expect.objectContaining({ authorization: AUTHORIZATION, body: { code: "HELLO1" } }),
    ]);
  });

  it("previews device approval from raw json without calling the API", async () => {
    const run = await putio(
      "auth",
      "approve",
      "--json",
      '{"code":"  HELLO1  "}',
      "--dry-run",
      "--output",
      "json",
    );

    expect(stdoutJson(run)).toEqual({
      command: "auth approve",
      dryRun: true,
      request: { code: "HELLO1" },
    });
    expect(api.requests).toEqual([]);
  });

  it.each([
    [
      ["auth", "preview", "--code", "PUTIO1?debug=1"],
      "`auth preview --code` cannot include `?` or `#` fragments.",
    ],
    [
      ["auth", "approve", "PUTIO1?debug=1"],
      "`auth approve` code cannot include `?` or `#` fragments.",
    ],
  ])("rejects device codes with query fragments: %j", async (args, message) => {
    expectFailure(await putio(...args, "--output", "json"), message);
    expect(api.requests).toEqual([]);
  });
});

describe("reads", () => {
  it("prints whoami with the auth source and without the token", async () => {
    routeReads(api);

    const run = await putio("whoami", "--output", "json");

    expect(stdoutJson(run)).toMatchObject({
      auth: { apiBaseUrl: api.baseUrl, source: "env" },
      info: { mail: "user@example.com", username: "example-user" },
    });
    expect(run.stdout).not.toContain(FIXTURE_TOKEN);
    expect(api.requests).toEqual([
      expect.objectContaining({
        authorization: AUTHORIZATION,
        path: "/v2/account/info",
        query: {},
      }),
    ]);
  });

  it("filters events by type after paging by id", async () => {
    routeReads(api);

    const run = await putio(
      "events",
      "list",
      "--before",
      "44",
      "--per-page",
      "5",
      "--type",
      "transfer_completed",
      "--output",
      "json",
    );

    expect(stdoutJson(run)).toMatchObject({
      events: [{ id: 101, type: "transfer_completed" }],
    });
    expect(requestsTo("GET", "/v2/events/list")).toEqual([
      expect.objectContaining({ query: { before: "44", per_page: "5" } }),
    ]);
  });

  it("gets a download-links job", async () => {
    routeReads(api);

    const run = await putio("download-links", "get", "--id", "55", "--output", "json");

    expect(stdoutJson(run)).toMatchObject({
      links: { download_links: ["https://download.put.io/file-1"] },
      links_status: "DONE",
    });
    expect(requestsTo("GET", "/v2/download_links/55")).toHaveLength(1);
  });

  it("lists files under the root with the requested page size", async () => {
    routeReads(api);

    const run = await putio("files", "list", "--per-page", "5", "--output", "json");

    expect(stdoutJson(run)).toMatchObject({ files: [{ id: 1, name: "Movies" }], total: 1 });
    expect(api.requests).toEqual([
      expect.objectContaining({
        authorization: AUTHORIZATION,
        path: "/v2/files/list",
        query: { parent_id: "0", per_page: "5", total: "1" },
      }),
    ]);
  });

  it("searches files through the top-level alias", async () => {
    routeReads(api);

    const run = await putio("search", "--query", "movie", "--per-page", "3", "--output", "json");

    expect(stdoutJson(run)).toMatchObject({ files: [{ id: 2, name: "movie.mkv" }] });
    expect(requestsTo("GET", "/v2/files/search")).toEqual([
      expect.objectContaining({ query: { per_page: "3", query: "movie" } }),
    ]);
  });

  it("lists transfers with the requested page size", async () => {
    routeReads(api);

    const run = await putio("transfers", "list", "--per-page", "5", "--output", "json");

    expect(stdoutJson(run)).toMatchObject({ transfers: [{ id: 7, name: "ubuntu.iso" }] });
    expect(requestsTo("GET", "/v2/transfers/list")).toEqual([
      expect.objectContaining({ query: { per_page: "5" } }),
    ]);
  });

  it.each([
    ["json", (run: CliRun) => stdoutJson(run)],
    ["ndjson", (run: CliRun) => stdoutLines(run)[0]],
  ] as const)("watches a transfer until a terminal status in %s", async (output, parse) => {
    routeReads(api);

    const run = await putio("transfers", "watch", "--id", "7", "--output", output);

    expect(parse(run)).toMatchObject({
      timedOut: false,
      transfer: { id: 7, status: "COMPLETED" },
    });
    expect(requestsTo("GET", "/v2/transfers/7")).toHaveLength(1);
  });

  it.each([
    [["whoami"], "info"],
    [["events", "list"], "events"],
    [["download-links", "get", "--id", "55"], "links_status"],
    [["files", "list"], "files,total"],
    [["files", "search", "--query", "movie"], "files"],
    [["search", "--query", "movie"], "files"],
    [["transfers", "list"], "transfers"],
    [["transfers", "watch", "--id", "7"], "transfer"],
  ])("selects top-level fields for %j", async (command, fields) => {
    routeReads(api);

    const run = await putio(...command, "--fields", fields, "--output", "json");

    expect(Object.keys(stdoutJson(run) as object).sort()).toEqual(fields.split(",").sort());
  });

  it("rejects unknown fields", async () => {
    routeReads(api);

    expectFailure(
      await putio("files", "list", "--fields", "nope", "--output", "json"),
      /Unknown `--fields` value for `files list`/,
    );
  });

  it("rejects fields in interactive terminal mode before calling the API", async () => {
    const run = await runPutio(api, ["whoami", "--fields", "info"], {
      isInteractiveTerminal: true,
    });

    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain(
      "`--fields` requires structured output (`--output json` or `--output ndjson`).",
    );
    expect(api.requests).toEqual([]);
  });
});

describe("pagination", () => {
  it.each([
    {
      args: ["files", "list"],
      continuePath: "/v2/files/list/continue",
      first: { path: "GET /v2/files/list", page: { parent: file(0, "Your Files"), total: 3 } },
      itemKey: "files",
      items: [file(1, "Movies"), file(2, "Shows"), file(3, "Music")],
    },
    {
      args: ["files", "search", "--query", "movie"],
      continuePath: "/v2/files/search/continue",
      first: { path: "GET /v2/files/search", page: { total: 3 } },
      itemKey: "files",
      items: [file(2, "movie-1.mkv"), file(3, "movie-2.mkv"), file(4, "movie-3.mkv")],
    },
    {
      args: ["transfers", "list"],
      continuePath: "/v2/transfers/list/continue",
      first: { path: "GET /v2/transfers/list", page: {} },
      itemKey: "transfers",
      items: [transfer(7, "ubuntu.iso"), transfer(8, "fedora.iso"), transfer(9, "debian.iso")],
    },
  ])("collects every page of $args with --page-all", async (fixture) => {
    const [one, two, three] = fixture.items;
    const continuationExtras = fixture.itemKey === "files" ? { total: 3 } : {};
    api.route(
      fixture.first.path,
      ok({ ...fixture.first.page, cursor: "cursor-1", [fixture.itemKey]: [one] }),
    );
    api.route(`POST ${fixture.continuePath}`, [
      ok({ ...continuationExtras, cursor: "cursor-2", [fixture.itemKey]: [two] }),
      ok({ ...continuationExtras, cursor: null, [fixture.itemKey]: [three] }),
    ]);

    const run = await putio(...fixture.args, "--page-all", "--output", "json");

    expect(stdoutJson(run)).toMatchObject({ cursor: null, [fixture.itemKey]: fixture.items });
    expect(
      requestsTo("POST", fixture.continuePath).map(({ body, query }) => ({ body, query })),
    ).toEqual([
      { body: { cursor: "cursor-1" }, query: { per_page: "20" } },
      { body: { cursor: "cursor-2" }, query: { per_page: "20" } },
    ]);
  });

  it("streams each file list page as one ndjson line", async () => {
    api.route(
      "GET /v2/files/list",
      ok({ cursor: "cursor-1", files: [file(1, "Movies")], parent: null, total: 2 }),
    );
    api.route("POST /v2/files/list/continue", ok({ cursor: null, files: [file(2, "Shows")] }));

    const run = await putio("files", "list", "--page-all", "--output", "ndjson");

    expect(run.exitCode).toBe(0);
    expect(stdoutLines(run)).toMatchObject([
      { cursor: "cursor-1", files: [{ id: 1, name: "Movies" }] },
      { cursor: null, files: [{ id: 2, name: "Shows" }] },
    ]);
  });

  it("stops streaming when a page repeats a cursor", async () => {
    api.route(
      "GET /v2/files/list",
      ok({ cursor: "cursor-1", files: [file(1, "Movies")], parent: null, total: 2 }),
    );
    api.route(
      "POST /v2/files/list/continue",
      ok({ cursor: "cursor-1", files: [file(2, "Shows")] }),
    );

    const run = await putio("files", "list", "--page-all", "--output", "ndjson");

    expect(run.exitCode).toBe(1);
    expect(stdoutLines(run)).toHaveLength(1);
    expect(stderrJson(run).error).toMatchObject({
      message: "`files list` pagination returned a repeated cursor.",
    });
    expect(requestsTo("POST", "/v2/files/list/continue")).toHaveLength(1);
  });
});

describe("file writes", () => {
  it("creates a folder", async () => {
    api.route("POST /v2/files/create-folder", ok({ file: file(42, "Projects", { parent_id: 9 }) }));

    const run = await putio(
      "files",
      "mkdir",
      "--name",
      "Projects",
      "--parent-id",
      "9",
      "--output",
      "json",
    );

    expect(stdoutJson(run)).toMatchObject({ id: 42, name: "Projects", parent_id: 9 });
    expect(api.requests).toEqual([
      expect.objectContaining({
        authorization: AUTHORIZATION,
        body: { name: "Projects", parent_id: "9" },
      }),
    ]);
  });

  it.each([
    ["flags", ["--id", "1", "--id", "2", "--skip-trash"]],
    ["raw json", ["--json", '{"ids":[1,2],"skip_trash":true}']],
  ])("deletes files from %s", async (_input, args) => {
    api.route("POST /v2/files/delete", ok({ cursor: null, skipped: 1 }));

    const run = await putio("files", "delete", ...args, "--output", "json");

    expect(stdoutJson(run)).toMatchObject({ ids: [1, 2], skipTrash: true, skipped: 1 });
    expect(api.requests).toEqual([
      expect.objectContaining({
        body: { file_ids: "1,2" },
        query: expect.objectContaining({ skip_trash: "true" }),
      }),
    ]);
  });

  it.each([
    ["flags", ["--id", "42", "--name", "Projects 2026"]],
    ["raw json", ["--json", '{"file_id":42,"name":"Projects 2026"}']],
  ])("renames a file from %s", async (_input, args) => {
    api.route("POST /v2/files/rename", ok());

    const run = await putio("files", "rename", ...args, "--output", "json");

    expect(run.exitCode).toBe(0);
    expect(api.requests).toEqual([
      expect.objectContaining({ body: { file_id: "42", name: "Projects 2026" } }),
    ]);
  });

  it("rejects rename names with path traversal segments", async () => {
    expectFailure(
      await putio(
        "files",
        "rename",
        "--json",
        '{"file_id":42,"name":"../Projects"}',
        "--output",
        "json",
      ),
      "`files rename --name` cannot contain path traversal segments like `../` or `%2e`.",
    );
    expect(api.requests).toEqual([]);
  });

  it.each([
    ["flags", ["--id", "1", "--id", "2", "--parent-id", "9"]],
    ["raw json", ["--json", '{"ids":[1,2],"parent_id":9}']],
  ])("moves files from %s", async (_input, args) => {
    api.route("POST /v2/files/move", ok({ errors: [] }));

    const run = await putio("files", "move", ...args, "--output", "json");

    expect(run.exitCode).toBe(0);
    expect(api.requests).toEqual([
      expect.objectContaining({ body: { file_ids: "1,2", parent_id: "9" } }),
    ]);
  });

  it("reads a watch position", async () => {
    api.route("GET /v2/files/42/start-from", ok({ start_from: 90 }));

    const run = await putio(
      "files",
      "start-from",
      "get",
      "42",
      "--fields",
      "start_from",
      "--output",
      "json",
    );

    expect(stdoutJson(run)).toEqual({ start_from: 90 });
  });

  it("sets a watch position", async () => {
    api.route("POST /v2/files/42/start-from", ok());

    const run = await putio("files", "start-from", "set", "42", "95", "--output", "json");

    expect(stdoutJson(run)).toEqual({ file_id: 42, start_from: 95, status: "OK" });
    expect(api.requests).toEqual([expect.objectContaining({ body: { time: "95" } })]);
  });

  it("resets a watch position from raw json", async () => {
    api.route("POST /v2/files/42/start-from/delete", ok());

    const run = await putio(
      "files",
      "start-from",
      "reset",
      "--json",
      '{"file_id":42}',
      "--output",
      "json",
    );

    expect(stdoutJson(run)).toEqual({ file_id: 42, start_from: 0, status: "OK" });
    expect(requestsTo("POST", "/v2/files/42/start-from/delete")).toHaveLength(1);
  });

  it("fetches the MP4 HLS master playlist by default and redacts its token", async () => {
    api.route("GET /v2/files/42/hls/media.m3u8", {
      body: hlsManifest,
      contentType: "application/vnd.apple.mpegurl",
    });

    const run = await putio("files", "hls-manifest", "42", "--output", "json");

    expect(stdoutJson(run)).toMatchObject({
      file_id: 42,
      manifest: expect.stringContaining('CODECS="avc1.42c01e,mp4a.40.2"'),
      original: false,
    });
    expect(run.stdout).not.toContain(FIXTURE_TOKEN);
    expect(api.requests).toEqual([expect.objectContaining({ query: { original: "0" } })]);
  });

  it("fetches the original HLS master playlist with subtitle options", async () => {
    api.route("GET /v2/files/42/hls/media.m3u8", {
      body: hlsManifest,
      contentType: "application/vnd.apple.mpegurl",
    });

    const run = await putio(
      "files",
      "hls-manifest",
      "42",
      "--original",
      "--max-subtitle-count",
      "2",
      "--subtitle-language",
      "en",
      "--subtitle-language",
      "tr",
      "--fields",
      "manifest",
      "--output",
      "json",
    );

    expect(stdoutJson(run)).toEqual({ manifest: expect.stringContaining("#EXTM3U") });
    expect(api.requests).toEqual([
      expect.objectContaining({
        query: { max_subtitle_count: "2", original: "1", subtitle_languages: "en,tr" },
      }),
    ]);
  });

  it("rejects a non-positive hls-manifest file id", async () => {
    expectFailure(
      await putio("files", "hls-manifest", "0", "--output", "json"),
      /positive integer/,
    );
    expect(api.requests).toEqual([]);
  });

  it("previews a watch-position update without calling the API", async () => {
    const run = await putio(
      "files",
      "start-from",
      "set",
      "--json",
      '{"file_id":42,"time":95}',
      "--dry-run",
      "--output",
      "json",
    );

    expect(stdoutJson(run)).toEqual({
      command: "files start-from set",
      dryRun: true,
      request: { file_id: 42, time: 95 },
    });
    expect(api.requests).toEqual([]);
  });
});

describe("files upload", () => {
  it("uploads a local file to the upload host", async () => {
    const { path } = await makeUploadFixture();
    api.route("POST /v2/files/upload", ok({ file: file(88, "movie.mp4", { file_type: "VIDEO" }) }));

    const run = await putio(
      "files",
      "upload",
      "--path",
      path,
      "--parent-id",
      "42",
      "--output",
      "json",
    );

    expect(stdoutJson(run)).toMatchObject({ file: { id: 88, name: "movie.mp4" }, type: "file" });
    expect(api.requests).toEqual([
      expect.objectContaining({
        body: { file: "video fixture", filename: "movie.mp4", parent_id: "42" },
        origin: "upload",
        query: { oauth_token: FIXTURE_TOKEN },
      }),
    ]);
  });

  it("refuses to upload through a custom API base without an upload base", async () => {
    const { path } = await makeUploadFixture();

    expectFailure(
      await runPutio(api, ["files", "upload", "--path", path, "--output", "json"], {
        env: { PUTIO_CLI_UPLOAD_BASE_URL: undefined },
      }),
      `Set PUTIO_CLI_UPLOAD_BASE_URL to upload while the API base URL is ${api.baseUrl}.`,
    );
    expect(api.requests).toEqual([]);
    expect(api.blocked).toEqual([]);
  });

  it("refuses to upload through a persisted API base that is not a URL", async () => {
    const { path } = await makeUploadFixture();

    expectFailure(
      await runPutio(api, ["files", "upload", "--path", path, "--output", "json"], {
        configContents: JSON.stringify({ api_base_url: "not a url", auth_token: "legacy-token" }),
        env: {
          PUTIO_CLI_API_BASE_URL: undefined,
          PUTIO_CLI_TOKEN: undefined,
          PUTIO_CLI_UPLOAD_BASE_URL: undefined,
        },
      }),
      "Set PUTIO_CLI_UPLOAD_BASE_URL to upload while the API base URL is not a url.",
    );
    expect(api.requests).toEqual([]);
    expect(api.blocked).toEqual([]);
  });

  it("uploads to upload.put.io when the API base is the default", async () => {
    const { path } = await makeUploadFixture();

    const run = await runPutio(api, ["files", "upload", "--path", path, "--output", "json"], {
      env: { PUTIO_CLI_API_BASE_URL: undefined, PUTIO_CLI_UPLOAD_BASE_URL: undefined },
    });

    expect(run.exitCode).toBe(1);
    expect(api.blocked).toEqual(["https://upload.put.io"]);
  });

  it("previews a local file upload from raw json without calling the API", async () => {
    const { path } = await makeUploadFixture();

    const run = await putio(
      "files",
      "upload",
      "--json",
      JSON.stringify({ file_name: "fixture.mp4", parent_id: 42, path }),
      "--dry-run",
      "--output",
      "json",
    );

    expect(stdoutJson(run)).toEqual({
      command: "files upload",
      dryRun: true,
      request: { file_name: "fixture.mp4", parent_id: 42, path, size: "video fixture".length },
    });
    expect(api.requests).toEqual([]);
  });

  it("reports an upload host failure", async () => {
    const { path } = await makeUploadFixture();
    api.route("POST /v2/files/upload", {
      body: {
        error_message: "upload failed",
        error_type: "UPLOAD_FAILED",
        status: "ERROR",
        status_code: 500,
      },
      status: 500,
    });

    const run = await putio("files", "upload", "--path", path, "--output", "json");

    expect(run.exitCode).toBe(1);
    expect(stderrJson(run).error).toMatchObject({ httpStatusCode: 500 });
  });

  it("rejects a directory path before uploading", async () => {
    const { directory } = await makeUploadFixture();

    expectFailure(
      await putio("files", "upload", "--path", directory, "--output", "json"),
      "Expected the upload path to point to a regular file.",
    );
    expect(api.requests).toEqual([]);
  });

  it.skipIf(typeof process.getuid === "function" && process.getuid() === 0)(
    "rejects an unreadable file before previewing an upload",
    async () => {
      const { path } = await makeUploadFixture("private.mp4", 0o000);

      expectFailure(
        await putio("files", "upload", "--path", path, "--dry-run", "--output", "json"),
        "Unable to read the local upload file. Verify that the path exists and is readable.",
      );
    },
  );

  it("rejects a blank upload filename before uploading", async () => {
    const { path } = await makeUploadFixture();

    expectFailure(
      await putio("files", "upload", "--path", path, "--file-name", "   ", "--output", "json"),
      "Expected `files upload --file-name` to be a non-empty string.",
    );
    expect(api.requests).toEqual([]);
  });

  it.each([
    [
      ["--path", "/missing/upload-fixture", "--file-name", "../movie.mp4"],
      "`files upload --file-name` cannot contain path traversal segments like `../` or `%2e`.",
    ],
    [
      ["--json", '{"path":"/missing/upload-fixture","parent_id":-1}'],
      "Expected `--json` to match the command input schema.",
    ],
  ])("rejects invalid upload options before filesystem work: %j", async (args, message) => {
    expectFailure(await putio("files", "upload", ...args, "--output", "json"), message);
    expect(api.requests).toEqual([]);
  });
});

describe("download-links create", () => {
  it("creates a job for the selected files", async () => {
    api.route("POST /v2/download_links/create", ok({ id: 55 }));

    const run = await putio(
      "download-links",
      "create",
      "--id",
      "1",
      "--id",
      "2",
      "--exclude-id",
      "9",
      "--output",
      "json",
    );

    expect(stdoutJson(run)).toEqual({ id: 55 });
    expect(api.requests).toEqual([
      expect.objectContaining({ body: { exclude_ids: "9", file_ids: "1,2" } }),
    ]);
  });

  it("previews a job from raw json without calling the API", async () => {
    const run = await putio(
      "download-links",
      "create",
      "--json",
      '{"ids":[1,2],"excludeIds":[9]}',
      "--dry-run",
      "--output",
      "json",
    );

    expect(stdoutJson(run)).toEqual({
      command: "download-links create",
      dryRun: true,
      request: { excludeIds: [9], ids: [1, 2] },
    });
    expect(api.requests).toEqual([]);
  });
});

describe("sdk call", () => {
  it("invokes a JSON-compatible operation with explicit execution", async () => {
    routeReads(api);

    const run = await putio(
      "sdk",
      "call",
      "--operation",
      "files.list",
      "--args",
      '[0,{"per_page":10}]',
      "--execute",
      "--output",
      "json",
    );

    expect(stdoutJson(run)).toMatchObject({ operation: "files.list", result: { total: 1 } });
    expect(api.requests).toEqual([
      expect.objectContaining({
        path: "/v2/files/list",
        query: { parent_id: "0", per_page: "10" },
      }),
    ]);
  });

  it("previews a raw-json operation without calling the API", async () => {
    const run = await putio(
      "sdk",
      "call",
      "--json",
      '{"operation":"files.list","args":[0]}',
      "--dry-run",
      "--output",
      "json",
    );

    expect(stdoutJson(run)).toEqual({
      command: "sdk call",
      dryRun: true,
      request: { args: [0], operation: "files.list" },
    });
    expect(api.requests).toEqual([]);
  });

  it("requires choosing dry-run or execute", async () => {
    expectFailure(
      await putio("sdk", "call", "--operation", "files.list", "--output", "json"),
      "Choose exactly one of `sdk call --dry-run` or `sdk call --execute`.",
    );
    expect(api.requests).toEqual([]);
  });

  it("rejects secret-bearing operations before a dry-run plan", async () => {
    expectFailure(
      await putio(
        "sdk",
        "call",
        "--operation",
        "auth.validateToken",
        "--args",
        '["secret-token"]',
        "--dry-run",
        "--output",
        "json",
      ),
      "SDK operation `auth.validateToken` is not JSON-callable: authentication operations can expose credentials or approval codes.",
    );
    expect(api.requests).toEqual([]);
  });

  it("redacts sentinel-looking secrets in dry-run plans", async () => {
    const run = await putio(
      "sdk",
      "call",
      "--operation",
      "files.list",
      "--args",
      '[0,{"password":"null"}]',
      "--dry-run",
      "--output",
      "json",
    );

    expect(stdoutJson(run)).toEqual({
      command: "sdk call",
      dryRun: true,
      request: { args: [0, { password: "[REDACTED]" }], operation: "files.list" },
    });
    expect(api.requests).toEqual([]);
  });

  it("redacts sentinel-looking secrets in execution results", async () => {
    api.route("GET /v2/account/info", ok({ info: { ...accountInfo, download_token: "null" } }));

    const run = await putio(
      "sdk",
      "call",
      "--operation",
      "account.getInfo",
      "--args",
      '[{"download_token":1}]',
      "--execute",
      "--output",
      "json",
    );

    expect(stdoutJson(run)).toMatchObject({
      operation: "account.getInfo",
      result: { download_token: "[REDACTED]" },
    });
    expect(api.requests).toEqual([expect.objectContaining({ query: { download_token: "1" } })]);
  });
});

describe("transfer writes", () => {
  const added = ok({ errors: [], transfers: [transfer(7, "ubuntu.iso", "WAITING")] });

  it.each([
    [
      ["--url", "https://example.com/ubuntu.torrent", "--save-parent-id", "9"],
      [{ save_parent_id: 9, url: "https://example.com/ubuntu.torrent" }],
    ],
    [
      [
        "--json",
        '[{"callback_url":"https://example.com/callback","save_parent_id":9,"url":"https://example.com/fedora.torrent"}]',
      ],
      [
        {
          callback_url: "https://example.com/callback",
          save_parent_id: 9,
          url: "https://example.com/fedora.torrent",
        },
      ],
    ],
  ])("adds transfers from %j", async (args, urls) => {
    api.route("POST /v2/transfers/add-multi", added);

    const run = await putio("transfers", "add", ...args, "--output", "json");

    expect(stdoutJson(run)).toMatchObject({ transfers: [{ id: 7 }] });
    expect(api.requests).toHaveLength(1);
    expect(JSON.parse(api.requests[0]?.body.urls ?? "null")).toEqual(urls);
  });

  it("cancels transfers by repeated ids", async () => {
    api.route("POST /v2/transfers/cancel", ok());

    const run = await putio("transfers", "cancel", "--id", "8", "--id", "9", "--output", "json");

    expect(run.exitCode).toBe(0);
    expect(api.requests).toEqual([
      expect.objectContaining({ authorization: AUTHORIZATION, body: { transfer_ids: "8,9" } }),
    ]);
  });

  it("cleans transfers by repeated ids", async () => {
    api.route("POST /v2/transfers/clean", ok({ deleted_ids: [8, 9] }));

    const run = await putio("transfers", "clean", "--id", "8", "--id", "9", "--output", "json");

    expect(stdoutJson(run)).toEqual({ deleted_ids: [8, 9] });
    expect(api.requests).toEqual([expect.objectContaining({ body: { transfer_ids: "8,9" } })]);
  });

  it.each([
    ["retry", "/v2/transfers/retry", ok({ transfer: transfer(7, "ubuntu.iso", "WAITING") })],
    ["reannounce", "/v2/transfers/reannounce", ok()],
  ])("sends %s for one transfer", async (command, path, reply) => {
    api.route(`POST ${path}`, reply);

    const run = await putio("transfers", command, "--id", "7", "--output", "json");

    expect(run.exitCode).toBe(0);
    expect(api.requests).toEqual([expect.objectContaining({ body: { id: "7" }, path })]);
  });

  it.each([
    [
      ["cancel", "--json", '{"ids":[8,9]}'],
      { command: "transfers cancel", request: { ids: [8, 9] } },
    ],
    [["clean"], { command: "transfers clean", request: {} }],
  ])("previews transfers %j without calling the API", async (args, plan) => {
    const run = await putio("transfers", ...args, "--dry-run", "--output", "json");

    expect(stdoutJson(run)).toEqual({ ...plan, dryRun: true });
    expect(api.requests).toEqual([]);
  });
});

describe("utility commands", () => {
  it("prints the brand", async () => {
    const run = await putio("brand", "--output", "json");

    expect(stdoutJson(run)).toMatchObject({ brand: "put.io" });
  });
});
