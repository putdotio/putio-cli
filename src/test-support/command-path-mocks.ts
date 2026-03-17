import { Effect } from "effect";
import { vi } from "vitest";

const defaultAccountInfo = () => ({
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
});

const defaultEventsResponse = () => ({
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
});

const defaultDownloadLinksJob = () => ({
  error_msg: null,
  id: 55,
  links: {
    download_links: ["https://download.put.io/file-1"],
    media_links: ["https://media.put.io/file-1"],
    mp4_links: [],
  },
  links_status: "COMPLETED",
});

const createCommandPathMocks = () => {
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
  const listTransfersMock = vi.fn(() =>
    Effect.succeed({
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
  const listFilesMock = vi.fn(() =>
    Effect.succeed({
      files: [
        {
          file_type: "FOLDER",
          id: 1,
          name: "Movies",
          size: 0,
        },
      ],
    }),
  );
  const searchFilesMock = vi.fn(() =>
    Effect.succeed({
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
  const getAccountInfoMock = vi.fn(() => Effect.succeed(defaultAccountInfo()));
  const listEventsMock = vi.fn(() => Effect.succeed(defaultEventsResponse()));
  const createDownloadLinksMock = vi.fn(() => Effect.succeed({ id: 55 }));
  const getDownloadLinksMock = vi.fn(() => Effect.succeed(defaultDownloadLinksJob()));
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
};

export const resetCommandPathMocks = (mocks: ReturnType<typeof createCommandPathMocks>) => {
  vi.clearAllMocks();

  mocks.writeOutputMock.mockImplementation(() => Effect.void);
  mocks.withTerminalLoaderMock.mockImplementation((_options, program) => program);
  mocks.withAuthedSdkMock.mockImplementation((program) =>
    program({
      auth: {
        apiBaseUrl: "https://api.put.io",
        configPath: "/tmp/putio-cli.json",
        source: "env",
        token: "token-123",
      },
      sdk: mocks.fakeSdk,
    }),
  );
  mocks.provideSdkMock.mockImplementation((_config, program) => program);
  mocks.getCodeMock.mockImplementation(() => Effect.succeed({ code: "PUTIO1" }));
  mocks.checkCodeMatchMock.mockImplementation(() => Effect.succeed("token-123"));
  mocks.createFolderMock.mockImplementation(() =>
    Effect.succeed({
      id: 42,
      name: "Projects",
      parent_id: 9,
    }),
  );
  mocks.moveFilesMock.mockImplementation(() => Effect.succeed([]));
  mocks.renameFileMock.mockImplementation(() => Effect.void);
  mocks.deleteFilesMock.mockImplementation(() => Effect.succeed({ skipped: 1 }));
  mocks.listFilesMock.mockImplementation(() =>
    Effect.succeed({
      files: [
        {
          file_type: "FOLDER",
          id: 1,
          name: "Movies",
          size: 0,
        },
      ],
    }),
  );
  mocks.searchFilesMock.mockImplementation(() =>
    Effect.succeed({
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
  mocks.getAccountInfoMock.mockImplementation(() => Effect.succeed(defaultAccountInfo()));
  mocks.listEventsMock.mockImplementation(() => Effect.succeed(defaultEventsResponse()));
  mocks.createDownloadLinksMock.mockImplementation(() => Effect.succeed({ id: 55 }));
  mocks.getDownloadLinksMock.mockImplementation(() => Effect.succeed(defaultDownloadLinksJob()));
  mocks.cleanTransfersMock.mockImplementation(() => Effect.succeed({ deleted_ids: [8, 9] }));
  mocks.listTransfersMock.mockImplementation(() =>
    Effect.succeed({
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
  mocks.addTransfersMock.mockImplementation(() =>
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
  mocks.cancelTransfersMock.mockImplementation(() => Effect.succeed({}));
  mocks.retryTransferMock.mockImplementation(() =>
    Effect.succeed({
      id: 7,
      name: "ubuntu.iso",
      percent_done: 0,
      status: "WAITING",
    }),
  );
  mocks.reannounceTransferMock.mockImplementation(() => Effect.void);
  mocks.getTransferMock.mockImplementation(() =>
    Effect.succeed({
      id: 7,
      name: "ubuntu.iso",
      percent_done: 100,
      status: "COMPLETED",
    }),
  );
  mocks.getAuthStatusMock.mockImplementation(() =>
    Effect.succeed({
      apiBaseUrl: "https://api.put.io",
      authenticated: false,
      configPath: "/tmp/putio-cli.json",
      source: null,
    }),
  );
  mocks.savePersistedStateMock.mockImplementation(() =>
    Effect.succeed({
      configPath: "/tmp/putio-cli.json",
      state: {
        api_base_url: "https://api.put.io",
        auth_token: "token-123",
      },
    }),
  );
  mocks.clearPersistedStateMock.mockImplementation(() =>
    Effect.succeed({
      configPath: "/tmp/putio-cli.json",
    }),
  );
  mocks.resolveCliRuntimeConfigMock.mockImplementation(() =>
    Effect.succeed({
      apiBaseUrl: "https://api.put.io",
      configPath: "/tmp/putio-cli.json",
      token: undefined,
    }),
  );
  mocks.resolveAuthFlowConfigMock.mockImplementation(() =>
    Effect.succeed({
      appId: 8993,
      clientName: "putio-cli-test",
      webAppUrl: "https://app.put.io",
    }),
  );
  mocks.waitForDeviceTokenMock.mockImplementation(() => Effect.succeed("token-123"));
  mocks.openBrowserMock.mockImplementation(() => Effect.succeed(true));
};
