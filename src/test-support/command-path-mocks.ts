import { Effect } from "effect";
import { vi } from "vite-plus/test";

const defaultAccountInfo = () => ({
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

const defaultHlsManifest = [
  "#EXTM3U",
  '#EXT-X-STREAM-INF:BANDWIDTH=2376462,CODECS="avc1.42c01e,mp4a.40.2",VIDEO-RANGE=PQ',
  "https://api.put.io/hls/playlist/abc/index-v1-a1.m3u8?oauth_token=token-123",
].join("\n");

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
  const getHlsMasterPlaylistMock = vi.fn(() => Effect.succeed(defaultHlsManifest));
  const getStartFromMock = vi.fn(() => Effect.succeed(90));
  const setStartFromMock = vi.fn(() => Effect.succeed({ status: "OK" }));
  const resetStartFromMock = vi.fn(() => Effect.succeed({ status: "OK" }));
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
    getHlsMasterPlaylistMock,
    getAccountInfoMock,
    getAuthStatusMock,
    checkCodeMatchMock,
    getCodeMock,
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
  mocks.linkDeviceMock.mockImplementation(() =>
    Effect.succeed({
      description: "Living room TV",
      has_icon: false,
      id: 77,
      name: "put.io TV",
      website: "https://put.io",
    }),
  );
  mocks.continueTransfersMock.mockImplementation(() =>
    Effect.succeed({
      cursor: null,
      transfers: [],
    }),
  );
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
  mocks.continueFilesMock.mockImplementation(() =>
    Effect.succeed({
      cursor: null,
      files: [],
      total: 1,
    }),
  );
  mocks.continueSearchFilesMock.mockImplementation(() =>
    Effect.succeed({
      cursor: null,
      files: [],
    }),
  );
  mocks.listFilesMock.mockImplementation(() =>
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
  mocks.searchFilesMock.mockImplementation(() =>
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
  mocks.uploadFileMock.mockImplementation(() =>
    Effect.succeed({
      file: { id: 88, name: "movie.mp4" },
      type: "file" as const,
    }),
  );
  mocks.getHlsMasterPlaylistMock.mockImplementation(() => Effect.succeed(defaultHlsManifest));
  mocks.getStartFromMock.mockImplementation(() => Effect.succeed(90));
  mocks.setStartFromMock.mockImplementation(() => Effect.succeed({ status: "OK" }));
  mocks.resetStartFromMock.mockImplementation(() => Effect.succeed({ status: "OK" }));
  mocks.getAccountInfoMock.mockImplementation(() => Effect.succeed(defaultAccountInfo()));
  mocks.listEventsMock.mockImplementation(() => Effect.succeed(defaultEventsResponse()));
  mocks.createDownloadLinksMock.mockImplementation(() => Effect.succeed({ id: 55 }));
  mocks.getDownloadLinksMock.mockImplementation(() => Effect.succeed(defaultDownloadLinksJob()));
  mocks.cleanTransfersMock.mockImplementation(() => Effect.succeed({ deleted_ids: [8, 9] }));
  mocks.listTransfersMock.mockImplementation(() =>
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
      defaultProfile: null,
      profile: null,
      source: null,
    }),
  );
  mocks.listProfilesMock.mockImplementation(() =>
    Effect.succeed({
      configPath: "/tmp/putio-cli.json",
      defaultProfile: null,
      profiles: [],
    }),
  );
  mocks.removeProfileMock.mockImplementation((profile: string) =>
    Effect.succeed({
      configPath: "/tmp/putio-cli.json",
      profile,
      removed: true,
    }),
  );
  mocks.useProfileMock.mockImplementation((profile: string) =>
    Effect.succeed({
      configPath: "/tmp/putio-cli.json",
      profile,
    }),
  );
  mocks.savePersistedStateMock.mockImplementation(
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
  mocks.clearPersistedStateMock.mockImplementation(
    (_configPath, selection?: { readonly profile?: string }) =>
      Effect.succeed({
        cleared: true,
        configPath: "/tmp/putio-cli.json",
        profile: selection?.profile ?? null,
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
