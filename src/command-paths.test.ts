import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Effect } from "effect";

import { resetCommandPathMocks } from "./test-support/command-path-mocks.js";
import { runCliInTest } from "./test-support/run-cli.js";

const uploadFixtureDirectories = new Set<string>();

const makeUploadFixtureDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), "putio-cli-upload-"));
  uploadFixtureDirectories.add(directory);
  return directory;
};

afterEach(async () => {
  const directories = [...uploadFixtureDirectories];
  uploadFixtureDirectories.clear();
  await Promise.all(
    directories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

const mocks = vi.hoisted(() => {
  type FileListItem = {
    readonly file_type?: string;
    readonly id: number;
    readonly name?: string;
    readonly size?: number;
  };
  type FileListPage = {
    readonly cursor: string | null;
    readonly files: ReadonlyArray<FileListItem>;
    readonly total?: number;
  };
  type TransferListItem = {
    readonly id: number;
    readonly name: string;
    readonly percent_done?: number;
    readonly status?: string;
  };
  type TransferListPage = {
    readonly cursor: string | null;
    readonly transfers: ReadonlyArray<TransferListItem>;
  };
  const emptyFileListPage: FileListPage = {
    cursor: null,
    files: [],
    total: 1,
  };
  const emptyTransferListPage: TransferListPage = {
    cursor: null,
    transfers: [],
  };
  const defaultFileListPage: FileListPage = {
    cursor: null,
    files: [
      {
        file_type: "FOLDER",
        id: 1,
        name: "Movies",
        size: 0,
      },
    ],
    total: 1,
  };
  const defaultSearchFilesPage: FileListPage = {
    cursor: null,
    files: [
      {
        file_type: "VIDEO",
        id: 2,
        name: "movie.mkv",
        size: 42,
      },
    ],
  };
  const defaultTransferListPage: TransferListPage = {
    cursor: null,
    transfers: [
      {
        id: 7,
        name: "ubuntu.iso",
        percent_done: 50,
        status: "DOWNLOADING",
      },
    ],
  };
  const writeOutputMock = vi.fn(() => Effect.void);
  const withTerminalLoaderMock = vi.fn((_options, program) => program);
  const withAuthedSdkMock = vi.fn((program) =>
    program({
      auth: {
        apiBaseUrl: "https://api.put.io",
        configPath: "/tmp/putio-cli.json",
        source: "env",
        token: "token-123",
      },
      sdk: fakeSdk,
    }),
  );
  const provideSdkMock = vi.fn((_config, program) => program);
  const getCodeMock = vi.fn(() => Effect.succeed({ code: "PUTIO1" }));
  const checkCodeMatchMock = vi.fn(() => Effect.succeed("token-123"));
  const linkDeviceMock = vi.fn(() =>
    Effect.succeed({
      description: "Living room TV",
      has_icon: false,
      id: 77,
      name: "put.io TV",
      website: "https://put.io",
    }),
  );
  const continueTransfersMock = vi.fn((_cursor?: string) => Effect.succeed(emptyTransferListPage));
  const listTransfersMock = vi.fn(() => Effect.succeed(defaultTransferListPage));
  const addTransfersMock = vi.fn(() =>
    Effect.succeed({
      errors: [],
      transfers: [
        {
          id: 7,
          name: "ubuntu.iso",
          percent_done: 0,
          status: "WAITING",
        },
      ],
    }),
  );
  const cancelTransfersMock = vi.fn(() => Effect.succeed({}));
  const retryTransferMock = vi.fn(() =>
    Effect.succeed({
      id: 7,
      name: "ubuntu.iso",
      percent_done: 0,
      status: "WAITING",
    }),
  );
  const reannounceTransferMock = vi.fn(() => Effect.void);
  const getTransferMock = vi.fn(() =>
    Effect.succeed({
      id: 7,
      name: "ubuntu.iso",
      percent_done: 100,
      status: "COMPLETED",
    }),
  );
  const createFolderMock = vi.fn(() =>
    Effect.succeed({
      id: 42,
      name: "Projects",
      parent_id: 9,
    }),
  );
  const moveFilesMock = vi.fn(() => Effect.succeed([]));
  const renameFileMock = vi.fn(() => Effect.void);
  const deleteFilesMock = vi.fn(() => Effect.succeed({ skipped: 1 }));
  const continueFilesMock = vi.fn((_cursor?: string) => Effect.succeed(emptyFileListPage));
  const continueSearchFilesMock = vi.fn((_cursor?: string) => Effect.succeed(emptyFileListPage));
  const listFilesMock = vi.fn(() => Effect.succeed(defaultFileListPage));
  const searchFilesMock = vi.fn(() => Effect.succeed(defaultSearchFilesPage));
  const uploadFileMock = vi.fn(() =>
    Effect.succeed({
      file: { id: 88, name: "movie.mp4" },
      type: "file" as const,
    }),
  );
  const getHlsMasterPlaylistMock = vi.fn(() =>
    Effect.succeed(
      [
        "#EXTM3U",
        '#EXT-X-STREAM-INF:BANDWIDTH=2376462,CODECS="avc1.42c01e,mp4a.40.2",VIDEO-RANGE=PQ',
        "https://api.put.io/hls/playlist/abc/index-v1-a1.m3u8?oauth_token=token-123",
      ].join("\n"),
    ),
  );
  const getStartFromMock = vi.fn(() => Effect.succeed(90));
  const setStartFromMock = vi.fn(() => Effect.succeed({ status: "OK" }));
  const resetStartFromMock = vi.fn(() => Effect.succeed({ status: "OK" }));
  const getAccountInfoMock = vi.fn(() =>
    Effect.succeed({
      account_status: "ACTIVE",
      disk: {
        avail: 700,
        size: 1_000,
        used: 300,
      },
      family_owner: null,
      is_sub_account: false,
      mail: "user@example.com",
      settings: {
        theme: "system",
        two_factor_enabled: true,
      },
      trash_size: 25,
      username: "example-user",
    }),
  );
  const listEventsMock = vi.fn(() =>
    Effect.succeed({
      events: [
        {
          created_at: "2026-03-15T12:00:00Z",
          id: 101,
          transfer_name: "ubuntu.iso",
          type: "transfer_completed",
        },
        {
          created_at: "2026-03-15T12:05:00Z",
          file_name: "movie.mkv",
          id: 102,
          type: "upload",
        },
      ],
    }),
  );
  const createDownloadLinksMock = vi.fn(() => Effect.succeed({ id: 55 }));
  const getDownloadLinksMock = vi.fn(() =>
    Effect.succeed({
      error_msg: null,
      id: 55,
      links: {
        download_links: ["https://download.put.io/file-1"],
        media_links: ["https://media.put.io/file-1"],
        mp4_links: [],
      },
      links_status: "COMPLETED",
    }),
  );
  const cleanTransfersMock = vi.fn(() => Effect.succeed({ deleted_ids: [8, 9] }));
  const getAuthStatusMock = vi.fn(() =>
    Effect.succeed({
      apiBaseUrl: "https://api.put.io",
      authenticated: false,
      configPath: "/tmp/putio-cli.json",
      defaultProfile: null,
      profile: null,
      source: null,
    }),
  );
  const listProfilesMock = vi.fn(() =>
    Effect.succeed({
      configPath: "/tmp/putio-cli.json",
      defaultProfile: null,
      profiles: [],
    }),
  );
  const removeProfileMock = vi.fn((profile: string) =>
    Effect.succeed({
      configPath: "/tmp/putio-cli.json",
      profile,
      removed: true,
    }),
  );
  const useProfileMock = vi.fn((profile: string) =>
    Effect.succeed({
      configPath: "/tmp/putio-cli.json",
      profile,
    }),
  );
  const savePersistedStateMock = vi.fn(
    (_state, _configPath, selection?: { readonly profile?: string }) =>
      Effect.succeed({
        configPath: "/tmp/putio-cli.json",
        profile: selection?.profile ?? null,
        state: {
          api_base_url: "https://api.put.io",
          auth_token: "token-123",
          profiles:
            selection?.profile === undefined
              ? undefined
              : {
                  [selection.profile]: {
                    api_base_url: "https://api.put.io",
                    auth_token: "token-123",
                  },
                },
        },
      }),
  );
  const clearPersistedStateMock = vi.fn((_configPath, selection?: { readonly profile?: string }) =>
    Effect.succeed({
      cleared: true,
      configPath: "/tmp/putio-cli.json",
      profile: selection?.profile ?? null,
    }),
  );
  const resolveCliRuntimeConfigMock = vi.fn(() =>
    Effect.succeed({
      apiBaseUrl: "https://api.put.io",
      configPath: "/tmp/putio-cli.json",
      token: undefined,
    }),
  );
  const resolveAuthFlowConfigMock = vi.fn(() =>
    Effect.succeed({
      appId: 8993,
      clientName: "putio-cli-test",
      webAppUrl: "https://app.put.io",
    }),
  );
  const waitForDeviceTokenMock = vi.fn(() => Effect.succeed("token-123"));
  const openBrowserMock = vi.fn(() => Effect.succeed(true));

  const fakeSdk = {
    account: {
      getInfo: getAccountInfoMock,
    },
    auth: {
      checkCodeMatch: checkCodeMatchMock,
      getCode: getCodeMock,
      linkDevice: linkDeviceMock,
    },
    downloadLinks: {
      create: createDownloadLinksMock,
      get: getDownloadLinksMock,
    },
    events: {
      list: listEventsMock,
    },
    files: {
      continue: continueFilesMock,
      continueSearch: continueSearchFilesMock,
      createFolder: createFolderMock,
      delete: deleteFilesMock,
      getHlsMasterPlaylist: getHlsMasterPlaylistMock,
      getStartFrom: getStartFromMock,
      list: listFilesMock,
      move: moveFilesMock,
      rename: renameFileMock,
      resetStartFrom: resetStartFromMock,
      search: searchFilesMock,
      upload: uploadFileMock,
      setStartFrom: setStartFromMock,
    },
    transfers: {
      addMany: addTransfersMock,
      cancel: cancelTransfersMock,
      clean: cleanTransfersMock,
      continue: continueTransfersMock,
      get: getTransferMock,
      list: listTransfersMock,
      reannounce: reannounceTransferMock,
      retry: retryTransferMock,
    },
  };

  return {
    addTransfersMock,
    cancelTransfersMock,
    cleanTransfersMock,
    clearPersistedStateMock,
    continueFilesMock,
    continueSearchFilesMock,
    continueTransfersMock,
    createDownloadLinksMock,
    createFolderMock,
    deleteFilesMock,
    fakeSdk,
    getDownloadLinksMock,
    getAccountInfoMock,
    getAuthStatusMock,
    checkCodeMatchMock,
    getCodeMock,
    getHlsMasterPlaylistMock,
    getStartFromMock,
    getTransferMock,
    listEventsMock,
    listFilesMock,
    listProfilesMock,
    listTransfersMock,
    linkDeviceMock,
    moveFilesMock,
    openBrowserMock,
    provideSdkMock,
    renameFileMock,
    resetStartFromMock,
    reannounceTransferMock,
    removeProfileMock,
    resolveAuthFlowConfigMock,
    resolveCliRuntimeConfigMock,
    retryTransferMock,
    savePersistedStateMock,
    searchFilesMock,
    setStartFromMock,
    useProfileMock,
    uploadFileMock,
    waitForDeviceTokenMock,
    withAuthedSdkMock,
    withTerminalLoaderMock,
    writeOutputMock,
  };
});

vi.mock("./internal/output-service.js", async () => {
  const actual = await vi.importActual<typeof import("./internal/output-service.js")>(
    "./internal/output-service.js",
  );

  return {
    ...actual,
    writeOutput: mocks.writeOutputMock,
  };
});

vi.mock("./internal/loader-service.js", () => ({
  withTerminalLoader: mocks.withTerminalLoaderMock,
}));

vi.mock("./internal/command.js", async () => {
  const actual =
    await vi.importActual<typeof import("./internal/command.js")>("./internal/command.js");

  return {
    ...actual,
    withAuthedSdk: mocks.withAuthedSdkMock,
  };
});

vi.mock("./internal/sdk.js", async () => {
  const actual = await vi.importActual<typeof import("./internal/sdk.js")>("./internal/sdk.js");

  return {
    ...actual,
    provideSdk: mocks.provideSdkMock,
    sdk: mocks.fakeSdk,
  };
});

vi.mock("./internal/state.js", async () => {
  const actual = await vi.importActual<typeof import("./internal/state.js")>("./internal/state.js");

  return {
    ...actual,
    clearPersistedState: mocks.clearPersistedStateMock,
    getAuthStatus: mocks.getAuthStatusMock,
    listProfiles: mocks.listProfilesMock,
    removeProfile: mocks.removeProfileMock,
    savePersistedState: mocks.savePersistedStateMock,
    useProfile: mocks.useProfileMock,
  };
});

vi.mock("./internal/config.js", async () => {
  const actual =
    await vi.importActual<typeof import("./internal/config.js")>("./internal/config.js");

  return {
    ...actual,
    resolveCliRuntimeConfig: mocks.resolveCliRuntimeConfigMock,
  };
});

vi.mock("./internal/auth-flow.js", async () => {
  const actual =
    await vi.importActual<typeof import("./internal/auth-flow.js")>("./internal/auth-flow.js");

  return {
    ...actual,
    openBrowser: mocks.openBrowserMock,
    resolveAuthFlowConfig: mocks.resolveAuthFlowConfigMock,
    waitForDeviceToken: mocks.waitForDeviceTokenMock,
  };
});

type WriteOutputCall = readonly [
  value: unknown,
  output: string | undefined,
  renderTerminalValue: (value: unknown) => string,
];

const getWriteOutputCall = (index: number): WriteOutputCall => {
  const call = mocks.writeOutputMock.mock.calls.at(index);

  if (!call) {
    throw new Error(`Expected writeOutput mock call at index ${index}`);
  }

  return call as unknown as WriteOutputCall;
};

const renderWriteOutputValue = <T>(index: number, value: T) => {
  const [, , renderTerminalValue] = getWriteOutputCall(index);

  return renderTerminalValue(value);
};

const getWaitForDeviceTokenOptions = () => {
  const call = mocks.waitForDeviceTokenMock.mock.calls.at(0) as unknown;

  if (!Array.isArray(call) || call.length === 0 || !call[0]) {
    throw new Error("Expected waitForDeviceToken mock call");
  }

  return call[0] as { readonly checkCodeMatch: (code: string) => Effect.Effect<string> };
};

describe("cli command paths", () => {
  beforeEach(() => {
    resetCommandPathMocks(mocks);
  });

  it("executes auth login through the happy path", async () => {
    const stderrChunks: string[] = [];

    mocks.waitForDeviceTokenMock.mockImplementationOnce(() => {
      expect(stderrChunks.join("")).toContain("https://app.put.io/link?code=PUTIO1");
      expect(stderrChunks.join("")).toContain("code: PUTIO1");

      return Effect.succeed("token-123");
    });

    await expect(
      runCliInTest(["putio", "auth", "login", "--output", "json", "--timeout-seconds", "1"], {
        writeStderr: (message) => {
          stderrChunks.push(message);
        },
      }),
    ).resolves.toBeUndefined();

    expect(mocks.getCodeMock).toHaveBeenCalled();
    expect(mocks.waitForDeviceTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: "PUTIO1", timeoutMs: 1_000 }),
    );
    await Effect.runPromise(getWaitForDeviceTokenOptions().checkCodeMatch("MATCH"));
    expect(mocks.checkCodeMatchMock).toHaveBeenCalledWith("MATCH");
    expect(mocks.savePersistedStateMock).toHaveBeenCalledWith(
      {
        apiBaseUrl: "https://api.put.io",
        token: "token-123",
      },
      undefined,
      { profile: undefined },
    );
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticated: true,
        browserOpened: false,
      }),
      "json",
      expect.any(Function),
    );

    expect(
      renderWriteOutputValue(-1, {
        apiBaseUrl: "https://api.put.io",
        browserOpened: false,
        configPath: "/tmp/putio-cli.json",
        profile: null,
      }),
    ).toContain("authenticated and saved token");
  });

  it("executes auth login with --open", async () => {
    await expect(
      runCliInTest([
        "putio",
        "auth",
        "login",
        "--open",
        "--output",
        "json",
        "--timeout-seconds",
        "1",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.openBrowserMock).toHaveBeenCalledWith("https://app.put.io/link?code=PUTIO1");
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticated: true,
        browserOpened: true,
      }),
      "json",
      expect.any(Function),
    );
  });

  it("executes auth login for a named profile", async () => {
    await expect(
      runCliInTest([
        "putio",
        "auth",
        "login",
        "--profile",
        "automation",
        "--output",
        "json",
        "--timeout-seconds",
        "1",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.savePersistedStateMock).toHaveBeenCalledWith(
      {
        apiBaseUrl: "https://api.put.io",
        token: "token-123",
      },
      undefined,
      { profile: "automation" },
    );
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticated: true,
        configPath: "/tmp/putio-cli.json",
        profile: "automation",
      }),
      "json",
      expect.any(Function),
    );
  });

  it("executes auth status without a token", async () => {
    await expect(
      runCliInTest(["putio", "auth", "status", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.getAuthStatusMock).toHaveBeenCalled();
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticated: false,
        source: null,
      }),
      "json",
      expect.any(Function),
    );

    expect(
      renderWriteOutputValue(-1, {
        apiBaseUrl: "https://api.put.io",
        authenticated: true,
        configPath: "/tmp/putio-cli.json",
        defaultProfile: null,
        profile: null,
        source: "env",
      }),
    ).toContain("authenticated: yes");
  });

  it("executes auth status for a named profile", async () => {
    await expect(
      runCliInTest(["putio", "auth", "status", "--profile", "automation", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.getAuthStatusMock).toHaveBeenCalledWith({ profile: "automation" });
  });

  it("executes auth preview", async () => {
    await expect(
      runCliInTest(["putio", "auth", "preview", "--code", "HELLO1", "--open", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        browserOpened: true,
        code: "HELLO1",
        linkUrl: "https://app.put.io/link?code=HELLO1",
      },
      "json",
      expect.any(Function),
    );

    expect(
      renderWriteOutputValue(-1, {
        browserOpened: false,
        code: "HELLO1",
        linkUrl: "https://app.put.io/link?code=HELLO1",
      }),
    ).toContain("HELLO1");
  });

  it("approves a device code with the authenticated account", async () => {
    await expect(
      runCliInTest(["putio", "auth", "approve", "HELLO1", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.linkDeviceMock).toHaveBeenCalledWith("HELLO1");
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 77, name: "put.io TV" }),
      "json",
      expect.any(Function),
    );
  });

  it("previews device approval from raw json without hitting the sdk", async () => {
    await expect(
      runCliInTest([
        "putio",
        "auth",
        "approve",
        "--json",
        '{"code":"  HELLO1  "}',
        "--dry-run",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.linkDeviceMock).not.toHaveBeenCalled();
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        command: "auth approve",
        dryRun: true,
        request: { code: "HELLO1" },
      },
      "json",
      expect.any(Function),
    );
  });

  it("executes auth logout", async () => {
    await expect(
      runCliInTest(["putio", "auth", "logout", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.clearPersistedStateMock).toHaveBeenCalled();
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        cleared: true,
        configPath: "/tmp/putio-cli.json",
        profile: null,
      },
      "json",
      expect.any(Function),
    );
  });

  it("executes auth logout for a named profile", async () => {
    await expect(
      runCliInTest(["putio", "auth", "logout", "--profile", "automation", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.clearPersistedStateMock).toHaveBeenCalledWith(undefined, {
      profile: "automation",
    });
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        cleared: true,
        configPath: "/tmp/putio-cli.json",
        profile: "automation",
      },
      "json",
      expect.any(Function),
    );
  });

  it("executes auth profiles commands", async () => {
    await expect(
      runCliInTest(["putio", "auth", "profiles", "list", "--output", "json"]),
    ).resolves.toBeUndefined();
    expect(mocks.listProfilesMock).toHaveBeenCalled();
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        profiles: [],
      }),
      "json",
      expect.any(Function),
    );

    await expect(
      runCliInTest(["putio", "auth", "profiles", "use", "automation", "--output", "json"]),
    ).resolves.toBeUndefined();
    expect(mocks.useProfileMock).toHaveBeenCalledWith("automation");
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        configPath: "/tmp/putio-cli.json",
        profile: "automation",
      },
      "json",
      expect.any(Function),
    );

    await expect(
      runCliInTest(["putio", "auth", "profiles", "remove", "automation", "--output", "json"]),
    ).resolves.toBeUndefined();
    expect(mocks.removeProfileMock).toHaveBeenCalledWith("automation");
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        configPath: "/tmp/putio-cli.json",
        profile: "automation",
        removed: true,
      },
      "json",
      expect.any(Function),
    );
  });

  it("rejects auth preview codes with query fragments", async () => {
    await expect(
      runCliInTest(["putio", "auth", "preview", "--code", "PUTIO1?debug=1", "--output", "json"]),
    ).rejects.toMatchObject({
      message: "`auth preview --code` cannot include `?` or `#` fragments.",
    });

    expect(mocks.writeOutputMock).not.toHaveBeenCalled();
  });

  it("rejects device approval codes with query fragments", async () => {
    await expect(
      runCliInTest(["putio", "auth", "approve", "PUTIO1?debug=1", "--output", "json"]),
    ).rejects.toMatchObject({
      message: "`auth approve` code cannot include `?` or `#` fragments.",
    });

    expect(mocks.linkDeviceMock).not.toHaveBeenCalled();
  });

  it("executes whoami", async () => {
    await expect(runCliInTest(["putio", "whoami", "--output", "json"])).resolves.toBeUndefined();

    expect(mocks.getAccountInfoMock).toHaveBeenCalledWith({});
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: {
          apiBaseUrl: "https://api.put.io",
          source: "env",
        },
        info: expect.objectContaining({
          mail: "user@example.com",
          username: "example-user",
        }),
      }),
      "json",
      expect.any(Function),
    );
  });

  it("selects top-level whoami fields for json output", async () => {
    await expect(
      runCliInTest(["putio", "whoami", "--fields", "info", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        info: expect.objectContaining({
          username: "example-user",
        }),
      },
      "json",
      expect.any(Function),
    );
  });

  it("executes events list with filtering", async () => {
    await expect(
      runCliInTest([
        "putio",
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
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.listEventsMock).toHaveBeenCalledWith({
      before: 44,
      per_page: 5,
    });
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        events: [
          expect.objectContaining({
            id: 101,
            type: "transfer_completed",
          }),
        ],
      },
      "json",
      expect.any(Function),
    );
  });

  it("selects top-level event list fields for json output", async () => {
    await expect(
      runCliInTest(["putio", "events", "list", "--fields", "events", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        events: expect.arrayContaining([expect.objectContaining({ id: 101 })]),
      },
      "json",
      expect.any(Function),
    );
  });

  it("executes download-links create", async () => {
    await expect(
      runCliInTest([
        "putio",
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
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.createDownloadLinksMock).toHaveBeenCalledWith({
      cursor: undefined,
      excludeIds: [9],
      ids: [1, 2],
    });
    expect(mocks.writeOutputMock).toHaveBeenCalledWith({ id: 55 }, "json", expect.any(Function));

    expect(renderWriteOutputValue(-1, { id: 55 })).toBe("download-links job id: 55");
  });

  it("executes download-links create dry-run from raw json without hitting the sdk", async () => {
    await expect(
      runCliInTest([
        "putio",
        "download-links",
        "create",
        "--json",
        '{"ids":[1,2],"excludeIds":[9]}',
        "--dry-run",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.createDownloadLinksMock).not.toHaveBeenCalled();
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        command: "download-links create",
        dryRun: true,
        request: {
          cursor: undefined,
          excludeIds: [9],
          ids: [1, 2],
        },
      },
      "json",
      expect.any(Function),
    );
  });

  it("executes download-links get", async () => {
    await expect(
      runCliInTest(["putio", "download-links", "get", "--id", "55", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.getDownloadLinksMock).toHaveBeenCalledWith(55);
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 55,
        links_status: "COMPLETED",
      }),
      "json",
      expect.any(Function),
    );

    expect(
      renderWriteOutputValue(-1, {
        error_msg: null,
        links: {
          download_links: ["https://download.put.io/file-1"],
          media_links: ["https://media.put.io/file-1"],
          mp4_links: [],
        },
        links_status: "COMPLETED",
      }),
    ).toContain('"links_status": "COMPLETED"');
  });

  it("selects top-level download-links fields for json output", async () => {
    await expect(
      runCliInTest([
        "putio",
        "download-links",
        "get",
        "--id",
        "55",
        "--fields",
        "links_status",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        links_status: "COMPLETED",
      },
      "json",
      expect.any(Function),
    );
  });

  it("executes brand and version commands", async () => {
    await expect(runCliInTest(["putio", "brand", "--output", "json"])).resolves.toBeUndefined();
    await expect(runCliInTest(["putio", "version", "--output", "json"])).resolves.toBeUndefined();

    const brandCall = getWriteOutputCall(-2);
    const versionCall = getWriteOutputCall(-1);

    expect(brandCall[0]).toEqual(
      expect.objectContaining({
        brand: "put.io",
      }),
    );
    expect(versionCall[0]).toEqual(
      expect.objectContaining({
        binary: "putio",
      }),
    );

    expect(brandCall[2]({})).toContain("■");
    expect(versionCall[2]({ version: "0.0.0" })).toContain("version 0.0.0");
  });

  it("executes files mkdir with the mocked sdk", async () => {
    await expect(
      runCliInTest([
        "putio",
        "files",
        "mkdir",
        "--name",
        "Projects",
        "--parent-id",
        "9",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.createFolderMock).toHaveBeenCalledWith({
      name: "Projects",
      parent_id: 9,
    });
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        id: 42,
        name: "Projects",
        parent_id: 9,
      },
      "json",
      expect.any(Function),
    );
  });

  it("reads a file watch position", async () => {
    await expect(
      runCliInTest([
        "putio",
        "files",
        "start-from",
        "get",
        "42",
        "--fields",
        "start_from",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.getStartFromMock).toHaveBeenCalledWith(42);
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      { start_from: 90 },
      "json",
      expect.any(Function),
    );
  });

  it("sets a file watch position", async () => {
    await expect(
      runCliInTest(["putio", "files", "start-from", "set", "42", "95", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.setStartFromMock).toHaveBeenCalledWith({ file_id: 42, time: 95 });
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      { file_id: 42, start_from: 95, status: "OK" },
      "json",
      expect.any(Function),
    );
  });

  it("resets a file watch position from raw json", async () => {
    await expect(
      runCliInTest([
        "putio",
        "files",
        "start-from",
        "reset",
        "--json",
        '{"file_id":42}',
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.resetStartFromMock).toHaveBeenCalledWith(42);
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      { file_id: 42, start_from: 0, status: "OK" },
      "json",
      expect.any(Function),
    );
  });

  it("previews a watch-position update without hitting the sdk", async () => {
    await expect(
      runCliInTest([
        "putio",
        "files",
        "start-from",
        "set",
        "--json",
        '{"file_id":42,"time":95}',
        "--dry-run",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.setStartFromMock).not.toHaveBeenCalled();
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        command: "files start-from set",
        dryRun: true,
        request: { file_id: 42, time: 95 },
      },
      "json",
      expect.any(Function),
    );
  });

  it("uploads a readable local file with the mocked sdk", async () => {
    const directory = await makeUploadFixtureDirectory();
    const path = join(directory, "movie.mp4");
    await writeFile(path, "video fixture");

    await expect(
      runCliInTest([
        "putio",
        "files",
        "upload",
        "--path",
        path,
        "--parent-id",
        "42",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.uploadFileMock).toHaveBeenCalledWith({
      file: expect.any(Blob),
      fileName: "movie.mp4",
      parentId: 42,
    });
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        file: { id: 88, name: "movie.mp4" },
        type: "file",
      },
      "json",
      expect.any(Function),
    );
  });

  it("previews a local file upload from raw json without hitting the sdk", async () => {
    const directory = await makeUploadFixtureDirectory();
    const path = join(directory, "movie.mp4");
    await writeFile(path, "video fixture");

    await expect(
      runCliInTest([
        "putio",
        "files",
        "upload",
        "--json",
        JSON.stringify({ file_name: "fixture.mp4", parent_id: 42, path }),
        "--dry-run",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.uploadFileMock).not.toHaveBeenCalled();
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        command: "files upload",
        dryRun: true,
        request: {
          file_name: "fixture.mp4",
          parent_id: 42,
          path,
          size: 13,
        },
      },
      "json",
      expect.any(Function),
    );
  });

  it("rejects directory paths before file upload", async () => {
    const directory = await makeUploadFixtureDirectory();

    await expect(
      runCliInTest(["putio", "files", "upload", "--path", directory, "--output", "json"]),
    ).rejects.toMatchObject({
      message: "Expected the upload path to point to a regular file.",
    });

    expect(mocks.uploadFileMock).not.toHaveBeenCalled();
  });

  it.skipIf(typeof process.getuid === "function" && process.getuid() === 0)(
    "rejects unreadable files before previewing an upload",
    async () => {
      const directory = await makeUploadFixtureDirectory();
      const path = join(directory, "private.mp4");
      await writeFile(path, "video fixture", { mode: 0o000 });

      await expect(
        runCliInTest(["putio", "files", "upload", "--path", path, "--dry-run", "--output", "json"]),
      ).rejects.toMatchObject({
        message:
          "Unable to read the local upload file. Verify that the path exists and is readable.",
      });

      expect(mocks.uploadFileMock).not.toHaveBeenCalled();
    },
  );

  it("rejects a blank upload filename before hitting the sdk", async () => {
    const directory = await makeUploadFixtureDirectory();
    const path = join(directory, "movie.mp4");
    await writeFile(path, "video fixture");

    await expect(
      runCliInTest([
        "putio",
        "files",
        "upload",
        "--path",
        path,
        "--file-name",
        "   ",
        "--output",
        "json",
      ]),
    ).rejects.toMatchObject({
      message: "Expected `files upload --file-name` to be a non-empty string.",
    });

    expect(mocks.uploadFileMock).not.toHaveBeenCalled();
  });

  it("rejects invalid upload options before filesystem work", async () => {
    await expect(
      runCliInTest([
        "putio",
        "files",
        "upload",
        "--path",
        "/missing/upload-fixture",
        "--file-name",
        "../movie.mp4",
        "--output",
        "json",
      ]),
    ).rejects.toMatchObject({
      message:
        "`files upload --file-name` cannot contain path traversal segments like `../` or `%2e`.",
    });

    await expect(
      runCliInTest([
        "putio",
        "files",
        "upload",
        "--json",
        '{"path":"/missing/upload-fixture","parent_id":-1}',
        "--output",
        "json",
      ]),
    ).rejects.toMatchObject({
      message: "Expected `--json` to match the command input schema.",
    });

    expect(mocks.uploadFileMock).not.toHaveBeenCalled();
  });

  it("propagates sdk upload failures", async () => {
    const directory = await makeUploadFixtureDirectory();
    const path = join(directory, "private.mp4");
    await writeFile(path, "video fixture");
    mocks.uploadFileMock.mockImplementationOnce(() => Effect.fail(new Error("upload failed")));

    await expect(
      runCliInTest(["putio", "files", "upload", "--path", path, "--output", "json"]),
    ).rejects.toThrow("upload failed");

    expect(mocks.uploadFileMock).toHaveBeenCalledOnce();
  });

  it("executes files delete with repeated ids", async () => {
    await expect(
      runCliInTest([
        "putio",
        "files",
        "delete",
        "--id",
        "1",
        "--id",
        "2",
        "--skip-trash",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.deleteFilesMock).toHaveBeenCalledWith([1, 2], { skipTrash: true });
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        ids: [1, 2],
        skipTrash: true,
        skipped: 1,
      },
      "json",
      expect.any(Function),
    );
  });

  it("executes files delete from raw json with api-style keys", async () => {
    await expect(
      runCliInTest([
        "putio",
        "files",
        "delete",
        "--json",
        '{"ids":[1,2],"skip_trash":true}',
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.deleteFilesMock).toHaveBeenCalledWith([1, 2], { skipTrash: true });
  });

  it("executes files list", async () => {
    await expect(
      runCliInTest(["putio", "files", "list", "--per-page", "5", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.listFilesMock).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        per_page: 5,
        total: 1,
      }),
    );
  });

  it("invokes a JSON-compatible sdk operation with explicit execution", async () => {
    await expect(
      runCliInTest([
        "putio",
        "sdk",
        "call",
        "--operation",
        "files.list",
        "--args",
        '[0,{"per_page":10}]',
        "--execute",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.listFilesMock).toHaveBeenCalledWith(0, { per_page: 10 });
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        operation: "files.list",
        result: expect.objectContaining({ total: 1 }),
      },
      "json",
      expect.any(Function),
    );
  });

  it("previews a raw-json sdk operation without authentication or invocation", async () => {
    await expect(
      runCliInTest([
        "putio",
        "sdk",
        "call",
        "--json",
        '{"operation":"files.list","args":[0]}',
        "--dry-run",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.withAuthedSdkMock).not.toHaveBeenCalled();
    expect(mocks.listFilesMock).not.toHaveBeenCalled();
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        command: "sdk call",
        dryRun: true,
        request: {
          args: [0],
          operation: "files.list",
        },
      },
      "json",
      expect.any(Function),
    );
  });

  it("requires explicit sdk call execution consent", async () => {
    await expect(
      runCliInTest(["putio", "sdk", "call", "--operation", "files.list", "--output", "json"]),
    ).rejects.toMatchObject({
      message: "Choose exactly one of `sdk call --dry-run` or `sdk call --execute`.",
    });

    expect(mocks.withAuthedSdkMock).not.toHaveBeenCalled();
  });

  it("rejects secret-bearing sdk operations before dry-run output", async () => {
    await expect(
      runCliInTest([
        "putio",
        "sdk",
        "call",
        "--operation",
        "auth.validateToken",
        "--args",
        '["secret-token"]',
        "--dry-run",
        "--output",
        "json",
      ]),
    ).rejects.toMatchObject({
      message:
        "SDK operation `auth.validateToken` is not JSON-callable: authentication operations can expose credentials or approval codes.",
    });

    expect(mocks.writeOutputMock).not.toHaveBeenCalled();
    expect(mocks.withAuthedSdkMock).not.toHaveBeenCalled();
  });

  it("strictly redacts sentinel-looking sdk secrets in dry-run plans", async () => {
    await expect(
      runCliInTest([
        "putio",
        "sdk",
        "call",
        "--operation",
        "files.list",
        "--args",
        '[0,{"password":"null"}]',
        "--dry-run",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        command: "sdk call",
        dryRun: true,
        request: {
          args: [0, { password: "[REDACTED]" }],
          operation: "files.list",
        },
      },
      "json",
      expect.any(Function),
    );
    expect(mocks.withAuthedSdkMock).not.toHaveBeenCalled();
  });

  it("strictly redacts sentinel-looking sdk secrets in execution results", async () => {
    mocks.listFilesMock.mockImplementationOnce(() =>
      Effect.succeed({
        download_token: "null",
        files: [],
        total: 0,
      }),
    );

    await expect(
      runCliInTest([
        "putio",
        "sdk",
        "call",
        "--operation",
        "files.list",
        "--args",
        "[0]",
        "--execute",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        operation: "files.list",
        result: {
          download_token: "[REDACTED]",
          files: [],
          total: 0,
        },
      },
      "json",
      expect.any(Function),
    );
  });

  it("selects top-level file list fields for json output", async () => {
    await expect(
      runCliInTest(["putio", "files", "list", "--fields", "files,total", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        files: expect.arrayContaining([expect.objectContaining({ id: 1 })]),
        total: 1,
      },
      "json",
      expect.any(Function),
    );
  });

  it("collects all file list pages when page-all is set", async () => {
    mocks.listFilesMock.mockReturnValueOnce(
      Effect.succeed({
        cursor: "cursor-1",
        files: [{ id: 1, name: "Movies" }],
        total: 3,
      }),
    );
    mocks.continueFilesMock.mockImplementationOnce((cursor) =>
      Effect.succeed({
        cursor: cursor === "cursor-1" ? "cursor-2" : null,
        files: cursor === "cursor-1" ? [{ id: 2, name: "Shows" }] : [{ id: 3, name: "Music" }],
        total: 3,
      }),
    );
    mocks.continueFilesMock.mockImplementationOnce(() =>
      Effect.succeed({
        cursor: null,
        files: [{ id: 3, name: "Music" }],
        total: 3,
      }),
    );

    await expect(
      runCliInTest(["putio", "files", "list", "--page-all", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.continueFilesMock).toHaveBeenCalledWith("cursor-1", { per_page: 20 });
    expect(mocks.continueFilesMock).toHaveBeenCalledWith("cursor-2", { per_page: 20 });
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        cursor: null,
        files: [
          { id: 1, name: "Movies" },
          { id: 2, name: "Shows" },
          { id: 3, name: "Music" },
        ],
        total: 3,
      },
      "json",
      expect.any(Function),
    );
  });

  it("streams file list pages as ndjson envelopes", async () => {
    mocks.listFilesMock.mockReturnValueOnce(
      Effect.succeed({
        cursor: "cursor-1",
        files: [{ id: 1, name: "Movies" }],
        total: 2,
      }),
    );
    mocks.continueFilesMock.mockReturnValueOnce(
      Effect.succeed({
        cursor: null,
        files: [{ id: 2, name: "Shows" }],
        total: 2,
      }),
    );

    await expect(
      runCliInTest(["putio", "files", "list", "--page-all", "--output", "ndjson"]),
    ).resolves.toBeUndefined();

    expect(mocks.writeOutputMock).toHaveBeenNthCalledWith(
      1,
      {
        cursor: "cursor-1",
        files: [{ id: 1, name: "Movies" }],
        total: 2,
      },
      "ndjson",
      expect.any(Function),
    );
    expect(mocks.writeOutputMock).toHaveBeenNthCalledWith(
      2,
      {
        cursor: null,
        files: [{ id: 2, name: "Shows" }],
        total: 2,
      },
      "ndjson",
      expect.any(Function),
    );
  });

  it("rejects repeated cursors while streaming file list pages", async () => {
    mocks.listFilesMock.mockReturnValueOnce(
      Effect.succeed({
        cursor: "cursor-1",
        files: [{ id: 1, name: "Movies" }],
        total: 2,
      }),
    );
    mocks.continueFilesMock.mockReturnValueOnce(
      Effect.succeed({
        cursor: "cursor-1",
        files: [{ id: 2, name: "Shows" }],
        total: 2,
      }),
    );

    await expect(
      runCliInTest(["putio", "files", "list", "--page-all", "--output", "ndjson"]),
    ).rejects.toMatchObject({
      message: "`files list` pagination returned a repeated cursor.",
    });

    expect(mocks.continueFilesMock).toHaveBeenCalledTimes(1);
    expect(mocks.writeOutputMock).toHaveBeenCalledTimes(1);
  });

  it("rejects cumulative item overflow while streaming file list pages", async () => {
    mocks.listFilesMock.mockReturnValueOnce(
      Effect.succeed({
        cursor: "cursor-1",
        files: Array.from({ length: 60_000 }, (_value, id) => ({ id })),
        total: 110_001,
      }),
    );
    mocks.continueFilesMock.mockReturnValueOnce(
      Effect.succeed({
        cursor: null,
        files: Array.from({ length: 50_001 }, (_value, id) => ({ id: id + 60_000 })),
        total: 110_001,
      }),
    );

    await expect(
      runCliInTest(["putio", "files", "list", "--page-all", "--output", "ndjson"]),
    ).rejects.toMatchObject({
      message: "`files list` pagination exceeded 100000 items.",
    });

    expect(mocks.continueFilesMock).toHaveBeenCalledTimes(1);
    expect(mocks.writeOutputMock).toHaveBeenCalledTimes(1);
  });

  it("executes files rename", async () => {
    await expect(
      runCliInTest([
        "putio",
        "files",
        "rename",
        "--id",
        "42",
        "--name",
        "Projects 2026",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.renameFileMock).toHaveBeenCalledWith({
      file_id: 42,
      name: "Projects 2026",
    });
  });

  it("executes files rename from raw json", async () => {
    await expect(
      runCliInTest([
        "putio",
        "files",
        "rename",
        "--json",
        '{"file_id":42,"name":"Projects 2027"}',
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.renameFileMock).toHaveBeenCalledWith({
      file_id: 42,
      name: "Projects 2027",
    });
  });

  it("rejects file rename names with path traversal segments", async () => {
    await expect(
      runCliInTest([
        "putio",
        "files",
        "rename",
        "--json",
        '{"file_id":42,"name":"../Projects"}',
        "--output",
        "json",
      ]),
    ).rejects.toMatchObject({
      message: "`files rename --name` cannot contain path traversal segments like `../` or `%2e`.",
    });

    expect(mocks.renameFileMock).not.toHaveBeenCalled();
  });

  it("executes files move", async () => {
    await expect(
      runCliInTest([
        "putio",
        "files",
        "move",
        "--id",
        "1",
        "--id",
        "2",
        "--parent-id",
        "9",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.moveFilesMock).toHaveBeenCalledWith([1, 2], 9);
  });

  it("executes files move from raw json with api-style keys", async () => {
    await expect(
      runCliInTest([
        "putio",
        "files",
        "move",
        "--json",
        '{"ids":[1,2],"parent_id":9}',
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.moveFilesMock).toHaveBeenCalledWith([1, 2], 9);
  });

  it("executes top-level search", async () => {
    await expect(
      runCliInTest(["putio", "search", "--query", "movie", "--per-page", "3", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.searchFilesMock).toHaveBeenCalledWith({
      per_page: 3,
      query: "movie",
    });
  });

  it("fetches the served HLS master playlist for the MP4 conversion by default", async () => {
    await expect(
      runCliInTest(["putio", "files", "hls-manifest", "42", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.getHlsMasterPlaylistMock).toHaveBeenCalledWith(42, {
      maxSubtitleCount: undefined,
      playOriginal: false,
    });
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        file_id: 42,
        manifest: expect.stringContaining('CODECS="avc1.42c01e,mp4a.40.2"'),
        original: false,
      }),
      "json",
      expect.any(Function),
    );
  });

  it("fetches the original HLS master playlist with subtitle options", async () => {
    await expect(
      runCliInTest([
        "putio",
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
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.getHlsMasterPlaylistMock).toHaveBeenCalledWith(42, {
      maxSubtitleCount: 2,
      playOriginal: true,
      subtitleLanguages: ["en", "tr"],
    });
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      { manifest: expect.stringContaining("#EXTM3U") },
      "json",
      expect.any(Function),
    );
  });

  it("rejects a non-positive hls-manifest file id", async () => {
    await expect(
      runCliInTest(["putio", "files", "hls-manifest", "0", "--output", "json"]),
    ).rejects.toThrow(/positive integer/);
    expect(mocks.getHlsMasterPlaylistMock).not.toHaveBeenCalled();
  });

  it("selects top-level file search fields for json output", async () => {
    await expect(
      runCliInTest([
        "putio",
        "files",
        "search",
        "--query",
        "movie",
        "--fields",
        "files",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        files: expect.arrayContaining([expect.objectContaining({ id: 2 })]),
      },
      "json",
      expect.any(Function),
    );
  });

  it("collects all file search pages when page-all is set", async () => {
    mocks.searchFilesMock.mockReturnValueOnce(
      Effect.succeed({
        cursor: "cursor-1",
        files: [{ id: 2, name: "movie-1.mkv" }],
      }),
    );
    mocks.continueSearchFilesMock.mockImplementationOnce((cursor) =>
      Effect.succeed({
        cursor: cursor === "cursor-1" ? "cursor-2" : null,
        files:
          cursor === "cursor-1"
            ? [{ id: 3, name: "movie-2.mkv" }]
            : [{ id: 4, name: "movie-3.mkv" }],
      }),
    );
    mocks.continueSearchFilesMock.mockImplementationOnce(() =>
      Effect.succeed({
        cursor: null,
        files: [{ id: 4, name: "movie-3.mkv" }],
      }),
    );

    await expect(
      runCliInTest([
        "putio",
        "files",
        "search",
        "--query",
        "movie",
        "--page-all",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.continueSearchFilesMock).toHaveBeenCalledWith("cursor-1", { per_page: 20 });
    expect(mocks.continueSearchFilesMock).toHaveBeenCalledWith("cursor-2", { per_page: 20 });
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        cursor: null,
        files: [
          { id: 2, name: "movie-1.mkv" },
          { id: 3, name: "movie-2.mkv" },
          { id: 4, name: "movie-3.mkv" },
        ],
      },
      "json",
      expect.any(Function),
    );
  });

  it("selects top-level search alias fields for json output", async () => {
    await expect(
      runCliInTest([
        "putio",
        "search",
        "--query",
        "movie",
        "--fields",
        "files",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        files: expect.arrayContaining([expect.objectContaining({ id: 2 })]),
      },
      "json",
      expect.any(Function),
    );
  });

  it("rejects fields in interactive terminal mode without calling the sdk", async () => {
    await expect(
      runCliInTest(["putio", "whoami", "--fields", "info"], { isInteractiveTerminal: true }),
    ).rejects.toMatchObject({
      message: "`--fields` requires structured output (`--output json` or `--output ndjson`).",
    });

    expect(mocks.getAccountInfoMock).not.toHaveBeenCalled();
    expect(mocks.writeOutputMock).not.toHaveBeenCalled();
  });

  it("rejects unknown fields with a tagged input error", async () => {
    await expect(
      runCliInTest(["putio", "files", "list", "--fields", "nope", "--output", "json"]),
    ).rejects.toMatchObject({
      message: expect.stringContaining("Unknown `--fields` value for `files list`"),
    });

    expect(mocks.writeOutputMock).not.toHaveBeenCalled();
  });

  it("executes transfers list", async () => {
    await expect(
      runCliInTest(["putio", "transfers", "list", "--per-page", "5", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.listTransfersMock).toHaveBeenCalledWith({ per_page: 5 });
  });

  it("selects top-level transfer list fields for json output", async () => {
    await expect(
      runCliInTest(["putio", "transfers", "list", "--fields", "transfers", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        transfers: expect.arrayContaining([expect.objectContaining({ id: 7 })]),
      },
      "json",
      expect.any(Function),
    );
  });

  it("collects all transfer pages when page-all is set", async () => {
    mocks.listTransfersMock.mockReturnValueOnce(
      Effect.succeed({
        cursor: "cursor-1",
        transfers: [{ id: 7, name: "ubuntu.iso" }],
      }),
    );
    mocks.continueTransfersMock.mockImplementationOnce((cursor) =>
      Effect.succeed({
        cursor: cursor === "cursor-1" ? "cursor-2" : null,
        transfers:
          cursor === "cursor-1" ? [{ id: 8, name: "fedora.iso" }] : [{ id: 9, name: "debian.iso" }],
      }),
    );
    mocks.continueTransfersMock.mockImplementationOnce(() =>
      Effect.succeed({
        cursor: null,
        transfers: [{ id: 9, name: "debian.iso" }],
      }),
    );

    await expect(
      runCliInTest(["putio", "transfers", "list", "--page-all", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.continueTransfersMock).toHaveBeenCalledWith("cursor-1", { per_page: 20 });
    expect(mocks.continueTransfersMock).toHaveBeenCalledWith("cursor-2", { per_page: 20 });
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        cursor: null,
        transfers: [
          { id: 7, name: "ubuntu.iso" },
          { id: 8, name: "fedora.iso" },
          { id: 9, name: "debian.iso" },
        ],
      },
      "json",
      expect.any(Function),
    );
  });

  it("executes transfers add", async () => {
    await expect(
      runCliInTest([
        "putio",
        "transfers",
        "add",
        "--url",
        "https://example.com/ubuntu.torrent",
        "--save-parent-id",
        "9",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.addTransfersMock).toHaveBeenCalledWith([
      {
        callback_url: undefined,
        save_parent_id: 9,
        url: "https://example.com/ubuntu.torrent",
      },
    ]);
  });

  it("executes transfers add from raw json", async () => {
    await expect(
      runCliInTest([
        "putio",
        "transfers",
        "add",
        "--json",
        '[{"callback_url":"https://example.com/callback","save_parent_id":9,"url":"https://example.com/fedora.torrent"}]',
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.addTransfersMock).toHaveBeenCalledWith([
      {
        callback_url: "https://example.com/callback",
        save_parent_id: 9,
        url: "https://example.com/fedora.torrent",
      },
    ]);
  });

  it("executes transfers cancel with repeated ids", async () => {
    await expect(
      runCliInTest(["putio", "transfers", "cancel", "--id", "8", "--id", "9", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.cancelTransfersMock).toHaveBeenCalledWith([8, 9]);
  });

  it("executes transfers cancel dry-run without hitting the sdk", async () => {
    await expect(
      runCliInTest([
        "putio",
        "transfers",
        "cancel",
        "--json",
        '{"ids":[8,9]}',
        "--dry-run",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.cancelTransfersMock).not.toHaveBeenCalled();
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        command: "transfers cancel",
        dryRun: true,
        request: {
          ids: [8, 9],
        },
      },
      "json",
      expect.any(Function),
    );
  });

  it("executes transfers retry", async () => {
    await expect(
      runCliInTest(["putio", "transfers", "retry", "--id", "7", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.retryTransferMock).toHaveBeenCalledWith(7);
  });

  it("executes transfers clean with repeated ids", async () => {
    await expect(
      runCliInTest(["putio", "transfers", "clean", "--id", "8", "--id", "9", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.cleanTransfersMock).toHaveBeenCalledWith([8, 9]);
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        deleted_ids: [8, 9],
      },
      "json",
      expect.any(Function),
    );
  });

  it("omits absent transfers clean ids from dry-run output", async () => {
    await expect(
      runCliInTest(["putio", "transfers", "clean", "--dry-run", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.cleanTransfersMock).not.toHaveBeenCalled();
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        command: "transfers clean",
        dryRun: true,
        request: {},
      },
      "json",
      expect.any(Function),
    );
  });

  it("executes transfers reannounce", async () => {
    await expect(
      runCliInTest(["putio", "transfers", "reannounce", "--id", "7", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.reannounceTransferMock).toHaveBeenCalledWith(7);
  });

  it("executes transfers watch and exits on terminal status", async () => {
    await expect(
      runCliInTest([
        "putio",
        "transfers",
        "watch",
        "--id",
        "7",
        "--interval-seconds",
        "1",
        "--timeout-seconds",
        "5",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.getTransferMock).toHaveBeenCalledWith(7);
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        timedOut: false,
        transfer: expect.objectContaining({
          id: 7,
          status: "COMPLETED",
        }),
      },
      "json",
      expect.any(Function),
    );
  });

  it("streams transfer watch observations as ndjson", async () => {
    await expect(
      runCliInTest(["putio", "transfers", "watch", "--id", "7", "--output", "ndjson"]),
    ).resolves.toBeUndefined();

    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        timedOut: false,
        transfer: expect.objectContaining({
          id: 7,
          status: "COMPLETED",
        }),
      },
      "ndjson",
      expect.any(Function),
    );
  });

  it("selects top-level transfer watch fields for json output", async () => {
    await expect(
      runCliInTest([
        "putio",
        "transfers",
        "watch",
        "--id",
        "7",
        "--fields",
        "transfer",
        "--output",
        "json",
      ]),
    ).resolves.toBeUndefined();

    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        transfer: expect.objectContaining({
          id: 7,
        }),
      },
      "json",
      expect.any(Function),
    );
  });
});
