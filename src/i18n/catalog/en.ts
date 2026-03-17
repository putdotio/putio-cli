export const en = {
  app: {
    auth: {
      failed: {
        title: "Authentication failed",
        message: "Please sign in again to continue.",
      },
      sessionExpired: {
        title: "Your session expired",
        message: "Please sign in again to continue.",
      },
    },
    error: {
      unknown: {
        title: "Something went exceptionally wrong",
        description:
          "We are truly sorry for that, and notified our team about the issue.\n{{errorId}}",
      },
    },
    network: {
      error: {
        title: "Network error",
        message: "Please check your internet connection and try again.",
      },
      timeout: {
        title: "Timeout error",
        message: "Your request has timed out.",
      },
    },
    page: {
      load: {
        retryLabel: "Reload",
      },
    },
    rateLimit: {
      error: {
        title: "Too many requests",
        message: "Please wait a moment before trying again.",
      },
    },
  },
  cli: {
    auth: {
      login: {
        activationCode: "activation code",
        autoOpened: "opened automatically in your browser",
        cancelShortcut: "press {{key}} to cancel",
        directLinkPrompt: "Open this URL to authorize the CLI on any device:",
        openShortcut: "press {{key}} to open browser",
        title: "┌( ಠ‿ಠ)┘ welcome!",
        waiting: "Waiting for authorization...",
      },
      logout: {
        cleared: "cleared persisted auth state at {{configPath}}",
      },
      preview: {
        browserOpened: "opened automatically in your browser",
      },
      status: {
        apiBaseUrl: "api base url: {{value}}",
        authenticatedNo: "authenticated: no",
        authenticatedYes: "authenticated: yes",
        configPath: "config path: {{value}}",
        source: "source: {{value}}",
        unknown: "unknown",
      },
      success: {
        apiBaseUrl: "api base url   {{value}}",
        browserOpened: "browser opened {{value}}",
        configPath: "config path    {{value}}",
        savedToken: "authenticated and saved token",
      },
    },
    brand: {
      binary: "putio",
      name: "put.io",
      versionLabel: "version {{version}}",
    },
    common: {
      no: "no",
      none: "none",
      table: {
        created: "Created",
        id: "ID",
        name: "Name",
        resource: "Resource",
        size: "Size",
        status: "Status",
        type: "Type",
      },
      yes: "yes",
    },
    error: {
      auth: {
        loginHint: "Run `putio auth login` to sign in again.",
        statusHint: "If you expected a saved session, run `putio auth status` to inspect it.",
      },
      authFlow: {
        title: "Device login failed",
        message: "The CLI could not complete the device authorization flow.",
        finishHint: "Make sure you finish the code flow at `put.io/link`.",
        retryHint: "Retry `putio auth login` if the code expired.",
      },
      commandFailed: {
        title: "Command failed",
        message: "Command failed.",
      },
      config: {
        title: "Configuration error",
        message: "The CLI configuration is invalid or incomplete.",
        envHint: "Check the relevant `PUTIO_CLI_*` environment variables and try again.",
        configHint: "If you use a persisted config file, verify that its JSON is valid.",
      },
      downloadLinks: {
        badRequest: {
          title: "That download-links request is not valid",
          message: "Review the file ids or cursor and try again.",
        },
        concurrentLimit: {
          title: "Too many download-links jobs are already running",
          message: "Wait for an active download-links job to finish, then try again.",
        },
        notFound: {
          title: "Download-links job not found",
          message: "The job may have expired or the id may be incorrect.",
        },
        tooManyChildrenRequested: {
          title: "Too many nested files were requested",
          message: "Narrow the selection before creating download links.",
        },
        tooManyFilesRequested: {
          title: "Too many files were requested for one download-links job",
          message: "Request fewer files at a time and try again.",
        },
      },
      files: {
        searchTooLong: {
          title: "Search query is too long",
          message: "Use a shorter search query and try again.",
        },
      },
      network: {
        title: "Network request failed",
        message: "The CLI could not reach put.io successfully.",
        checkConnection: "Check your internet connection.",
        checkApiBaseUrl: "If you overrode the API base URL, verify that it is correct.",
      },
      rateLimit: {
        title: "Rate limited",
        message: "Rate limited because of too many requests!",
        captchaNeeded: "Complete the captcha in the browser to unlock this IP sooner.",
        retryAfter: "Wait about {{seconds}}s and try again.",
        retryAt: "Wait until {{resetAt}} and try again.",
        retrySoon: "Wait a moment and try again.",
        avoidRepeating: "Avoid repeating the same command rapidly, especially `putio auth login`.",
      },
      transfers: {
        add: {
          emptyUrl: {
            title: "Transfer URL is required",
            message: "Provide at least one valid URL to add a transfer.",
            hint: "Use `putio transfers add --url <url>` to add a transfer.",
          },
          tooManyUrls: {
            title: "Too many transfer URLs were submitted at once",
            message: "Split the request into smaller batches and try again.",
            hint: "Retry with fewer `--url` values in one command.",
          },
        },
        badRequest: {
          title: "That transfer request is not valid",
          message: "Review the transfer id or input and try again.",
          hint: "Check the transfer id, URL, and current transfer state.",
        },
        forbidden: {
          title: "That transfer action is not allowed",
          message: "The current transfer cannot be changed in its current state.",
        },
        notFound: {
          title: "Transfer not found",
          message: "The transfer may have already finished, been removed, or the id may be wrong.",
        },
      },
      validation: {
        title: "Unexpected response from put.io",
        message: "put.io returned data the CLI did not expect.",
        retryHint: "Retry the command once in case the response was transient.",
        reportHint: "If it keeps happening, report it with the command and output.",
      },
      terminal: {
        tryThis: "Try this",
      },
    },
    events: {
      command: {
        loading: "Loading events...",
      },
      terminal: {
        empty: "No events found.",
        resourceFallback: "—",
        summary: "Showing {{count}} event(s).",
      },
    },
    files: {
      command: {
        creatingFolder: 'Creating folder "{{name}}"...',
        deleting: "Deleting {{count}} file(s)...",
        loading: "Loading files...",
        moving: "Moving {{count}} file(s) to parent {{parentId}}...",
        renaming: 'Renaming file {{id}} to "{{name}}"...',
        searching: 'Searching files for "{{query}}"...',
      },
      terminal: {
        created: 'created folder "{{name}}" (id {{id}}, parent {{parentId}})',
        empty: "No files found.",
        emptyInParent: "No files found in {{name}}.",
        deleted: "deleted file ids: {{ids}}",
        moveErrorLine: "{{statusCode}}  {{errorType}}  file {{fileId}}",
        moveErrors: "move errors: {{count}}",
        moved: "moved file ids: {{ids}} to parent {{parentId}}",
        renamed: 'renamed file {{fileId}} to "{{name}}"',
        skipTrashEnabled: "skip trash: yes",
        skipped: "skipped: {{count}}",
        summary: "Showing {{count}} file(s){{totalSuffix}}.",
        summaryInParent: "Showing {{count}} file(s) in {{name}}{{totalSuffix}}.",
        totalSuffix: " ({{total}} total)",
      },
    },
    metadata: {
      authLogin:
        "Authorize the CLI through the put.io device-link flow and persist the resulting token.",
      authLogout: "Remove the persisted CLI auth state.",
      authPreview: "Render the auth screen locally without requesting a real device code.",
      authStatus: "Report the currently resolved auth state.",
      brand: "Render the put.io CLI brand mark without making any API calls.",
      describe: "Print machine-readable CLI metadata for agents and scripts.",
      downloadLinksCreate: "Create a browser-link generation job for files or a cursor selection.",
      downloadLinksGet: "Inspect a download-links generation job and read completed links.",
      eventsList: "List account history events, with optional client-side type filtering.",
      filesList: "List files for a parent directory.",
      filesDelete: "Delete one or more files by id.",
      filesMkdir: "Create a folder under a parent directory.",
      filesMove: "Move one or more files to a parent directory.",
      filesRename: "Rename a file by id.",
      filesSearch: "Search files by query and optional file type.",
      search: "Top-level alias for file search.",
      transfersAdd: "Add one or more transfers from URLs or magnet links.",
      transfersCancel: "Cancel one or more transfers.",
      transfersClean: "Clean all transfers or a selected set of transfer ids.",
      transfersList: "List current transfers.",
      transfersReannounce: "Reannounce a torrent transfer to its trackers.",
      transfersRetry: "Retry a failed transfer.",
      transfersWatch: "Watch a transfer until it finishes or the watch times out.",
      version: "Print the CLI version and render the brand mark in terminal mode.",
      whoami: "Read broad account information through the official SDK.",
    },
    root: {
      chooseAuthSubcommand: "Choose `status`, `login`, `logout`, or `preview`.",
      help: "Use `putio describe` or `putio --help`.",
    },
    transfers: {
      command: {
        adding: "Adding {{count}} transfer(s)...",
        cancelled: "cancelled: {{ids}}",
        cleaningDeleted: "deleted ids: {{ids}}",
        cleaningNone: "deleted ids: none",
        loading: "Loading transfers...",
        reannounced: "reannounced transfer {{id}}",
        reannouncing: "Reannouncing transfer {{id}}...",
        retrying: "Retrying transfer {{id}}...",
        watchFinished: "transfer {{id}} reached {{status}}",
        watchTimedOut: "stopped watching transfer {{id}} at {{status}}",
        watching: "Watching transfer {{id}}...",
      },
      terminal: {
        add: {
          errors: "errors: {{count}}",
          transfers: "transfers: {{count}}",
        },
        empty: "No active transfers.",
        summary: "Showing {{count}} transfer(s).",
        table: {
          done: "Done",
        },
      },
    },
    whoami: {
      terminal: {
        account: "Account",
        apiBaseUrl: "API base URL",
        auth: "Auth",
        available: "Available",
        disabled: "Disabled",
        email: "Email",
        enabled: "Enabled",
        familyOwner: "Family owner",
        source: "Source",
        status: "Status",
        storage: "Storage",
        subAccount: "Sub-account",
        theme: "Theme",
        total: "Total",
        trash: "Trash",
        twoFactor: "2FA",
        used: "Used",
        username: "Username",
      },
    },
    downloadLinks: {
      terminal: {
        error: "Error: {{value}}",
        linksSection: "{{title}} ({{count}})",
        mediaLabel: "media",
        mediaLinks: "Media links",
        mp4Label: "mp4",
        mp4Links: "MP4 links",
        readySummary:
          "Ready links: {{downloadCount}} download, {{mediaCount}} media, {{mp4Count}} mp4.",
        status: "Status: {{value}}",
        downloadLabel: "download",
        downloadLinks: "Download links",
      },
    },
  },
  files: {
    badRequest: {
      title: "That file request is not valid",
      message: "Please retry from the previous screen.",
    },
    lost: {
      title: "This file is no longer available",
      message: "It may have been removed or expired.",
    },
    notFound: {
      title: "File not found",
      message: "The file you requested is not available.",
    },
    notReachable: {
      title: "We temporarily cannot access this file",
      message: "For updates, visit status.put.io.",
    },
  },
  generic: {
    error503: {
      title: "put.io is temporarily unavailable",
      message: "Please try again in a moment.",
    },
  },
  validators: {
    lengthBetween: "Please use between {{min}} and {{max}} characters.",
    lengthExact: "Please use exactly {{length}} characters.",
    required: "This field is required.",
  },
} as const;
