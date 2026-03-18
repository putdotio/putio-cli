import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Effect } from "effect";

import { resetCommandPathMocks } from "./test-support/command-path-mocks.js";
import { runCliInTest } from "./test-support/run-cli.js";

const mocks = vi.hoisted(() => {
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
  const continueTransfersMock = vi.fn(() =>
    Effect.succeed({
      cursor: null,
      transfers: [],
    }),
  );
  const listTransfersMock = vi.fn(() =>
    Effect.succeed({
      cursor: null,
      transfers: [
        {
          id: 7,
          name: "ubuntu.iso",
          percent_done: 50,
          status: "DOWNLOADING",
        },
      ],
    }),
  );
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
  const continueFilesMock = vi.fn(() =>
    Effect.succeed({
      cursor: null,
      files: [],
      total: 1,
    }),
  );
  const continueSearchFilesMock = vi.fn(() =>
    Effect.succeed({
      cursor: null,
      files: [],
    }),
  );
  const listFilesMock = vi.fn(() =>
    Effect.succeed({
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
    }),
  );
  const searchFilesMock = vi.fn(() =>
    Effect.succeed({
      cursor: null,
      files: [
        {
          file_type: "VIDEO",
          id: 2,
          name: "movie.mkv",
          size: 42,
        },
      ],
    }),
  );
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
      mail: "altay@put.io",
      settings: {
        theme: "system",
        two_factor_enabled: true,
      },
      trash_size: 25,
      username: "altay",
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
      source: null,
    }),
  );
  const savePersistedStateMock = vi.fn(() =>
    Effect.succeed({
      configPath: "/tmp/putio-cli.json",
      state: {
        api_base_url: "https://api.put.io",
        auth_token: "token-123",
      },
    }),
  );
  const clearPersistedStateMock = vi.fn(() =>
    Effect.succeed({
      configPath: "/tmp/putio-cli.json",
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
      list: listFilesMock,
      move: moveFilesMock,
      rename: renameFileMock,
      search: searchFilesMock,
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
    getTransferMock,
    listEventsMock,
    listFilesMock,
    listTransfersMock,
    moveFilesMock,
    openBrowserMock,
    provideSdkMock,
    renameFileMock,
    reannounceTransferMock,
    resolveAuthFlowConfigMock,
    resolveCliRuntimeConfigMock,
    retryTransferMock,
    savePersistedStateMock,
    searchFilesMock,
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
    savePersistedState: mocks.savePersistedStateMock,
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
    await expect(
      runCliInTest(["putio", "auth", "login", "--output", "json", "--timeout-seconds", "1"]),
    ).resolves.toBeUndefined();

    expect(mocks.getCodeMock).toHaveBeenCalled();
    expect(mocks.waitForDeviceTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: "PUTIO1", timeoutMs: 1_000 }),
    );
    await Effect.runPromise(getWaitForDeviceTokenOptions().checkCodeMatch("MATCH"));
    expect(mocks.checkCodeMatchMock).toHaveBeenCalledWith("MATCH");
    expect(mocks.savePersistedStateMock).toHaveBeenCalledWith({
      apiBaseUrl: "https://api.put.io",
      token: "token-123",
    });
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
        source: "env",
      }),
    ).toContain("authenticated: yes");
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

  it("executes auth logout", async () => {
    await expect(
      runCliInTest(["putio", "auth", "logout", "--output", "json"]),
    ).resolves.toBeUndefined();

    expect(mocks.clearPersistedStateMock).toHaveBeenCalled();
    expect(mocks.writeOutputMock).toHaveBeenCalledWith(
      {
        cleared: true,
        configPath: "/tmp/putio-cli.json",
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
          mail: "altay@put.io",
          username: "altay",
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
          username: "altay",
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
      type: undefined,
    });
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
