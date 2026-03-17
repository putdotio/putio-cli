export declare const en: {
  readonly app: {
    readonly auth: {
      readonly failed: {
        readonly title: "Authentication failed";
        readonly message: "Please sign in again to continue.";
      };
      readonly sessionExpired: {
        readonly title: "Your session expired";
        readonly message: "Please sign in again to continue.";
      };
    };
    readonly error: {
      readonly unknown: {
        readonly title: "Something went exceptionally wrong";
        readonly description: "We are truly sorry for that, and notified our team about the issue.\n{{errorId}}";
      };
    };
    readonly network: {
      readonly error: {
        readonly title: "Network error";
        readonly message: "Please check your internet connection and try again.";
      };
      readonly timeout: {
        readonly title: "Timeout error";
        readonly message: "Your request has timed out.";
      };
    };
    readonly page: {
      readonly load: {
        readonly retryLabel: "Reload";
      };
    };
    readonly rateLimit: {
      readonly error: {
        readonly title: "Too many requests";
        readonly message: "Please wait a moment before trying again.";
      };
    };
  };
  readonly cli: {
    readonly auth: {
      readonly login: {
        readonly activationCode: "activation code";
        readonly autoOpened: "opened automatically in your browser";
        readonly cancelShortcut: "press {{key}} to cancel";
        readonly directLinkPrompt: "Open this URL to authorize the CLI on any device:";
        readonly openShortcut: "press {{key}} to open browser";
        readonly title: "┌( ಠ‿ಠ)┘ welcome!";
        readonly waiting: "Waiting for authorization...";
      };
      readonly logout: {
        readonly cleared: "cleared persisted auth state at {{configPath}}";
      };
      readonly preview: {
        readonly browserOpened: "opened automatically in your browser";
      };
      readonly status: {
        readonly apiBaseUrl: "api base url: {{value}}";
        readonly authenticatedNo: "authenticated: no";
        readonly authenticatedYes: "authenticated: yes";
        readonly configPath: "config path: {{value}}";
        readonly source: "source: {{value}}";
        readonly unknown: "unknown";
      };
      readonly success: {
        readonly apiBaseUrl: "api base url   {{value}}";
        readonly browserOpened: "browser opened {{value}}";
        readonly configPath: "config path    {{value}}";
        readonly savedToken: "authenticated and saved token";
      };
    };
    readonly brand: {
      readonly binary: "putio";
      readonly name: "put.io";
      readonly versionLabel: "version {{version}}";
    };
    readonly common: {
      readonly no: "no";
      readonly none: "none";
      readonly table: {
        readonly created: "Created";
        readonly id: "ID";
        readonly name: "Name";
        readonly resource: "Resource";
        readonly size: "Size";
        readonly status: "Status";
        readonly type: "Type";
      };
      readonly yes: "yes";
    };
    readonly error: {
      readonly auth: {
        readonly loginHint: "Run `putio auth login` to sign in again.";
        readonly statusHint: "If you expected a saved session, run `putio auth status` to inspect it.";
      };
      readonly authFlow: {
        readonly title: "Device login failed";
        readonly message: "The CLI could not complete the device authorization flow.";
        readonly finishHint: "Make sure you finish the code flow at `put.io/link`.";
        readonly retryHint: "Retry `putio auth login` if the code expired.";
      };
      readonly commandFailed: {
        readonly title: "Command failed";
        readonly message: "Command failed.";
      };
      readonly downloadLinks: {
        readonly badRequest: {
          readonly title: "That download-links request is not valid";
          readonly message: "Review the file ids or cursor and try again.";
        };
        readonly concurrentLimit: {
          readonly title: "Too many download-links jobs are already running";
          readonly message: "Wait for an active download-links job to finish, then try again.";
        };
        readonly notFound: {
          readonly title: "Download-links job not found";
          readonly message: "The job may have expired or the id may be incorrect.";
        };
        readonly tooManyChildrenRequested: {
          readonly title: "Too many nested files were requested";
          readonly message: "Narrow the selection before creating download links.";
        };
        readonly tooManyFilesRequested: {
          readonly title: "Too many files were requested for one download-links job";
          readonly message: "Request fewer files at a time and try again.";
        };
      };
      readonly files: {
        readonly searchTooLong: {
          readonly title: "Search query is too long";
          readonly message: "Use a shorter search query and try again.";
        };
      };
      readonly network: {
        readonly title: "Network request failed";
        readonly message: "The CLI could not reach put.io successfully.";
        readonly checkConnection: "Check your internet connection.";
        readonly checkApiBaseUrl: "If you overrode the API base URL, verify that it is correct.";
      };
      readonly rateLimit: {
        readonly title: "Rate limited";
        readonly message: "Rate limited because of too many requests!";
        readonly captchaNeeded: "Complete the captcha in the browser to unlock this IP sooner.";
        readonly retryAfter: "Wait about {{seconds}}s and try again.";
        readonly retryAt: "Wait until {{resetAt}} and try again.";
        readonly retrySoon: "Wait a moment and try again.";
        readonly avoidRepeating: "Avoid repeating the same command rapidly, especially `putio auth login`.";
      };
      readonly transfers: {
        readonly add: {
          readonly emptyUrl: {
            readonly title: "Transfer URL is required";
            readonly message: "Provide at least one valid URL to add a transfer.";
            readonly hint: "Use `putio transfers add --url <url>` to add a transfer.";
          };
          readonly tooManyUrls: {
            readonly title: "Too many transfer URLs were submitted at once";
            readonly message: "Split the request into smaller batches and try again.";
            readonly hint: "Retry with fewer `--url` values in one command.";
          };
        };
        readonly badRequest: {
          readonly title: "That transfer request is not valid";
          readonly message: "Review the transfer id or input and try again.";
          readonly hint: "Check the transfer id, URL, and current transfer state.";
        };
        readonly forbidden: {
          readonly title: "That transfer action is not allowed";
          readonly message: "The current transfer cannot be changed in its current state.";
        };
        readonly notFound: {
          readonly title: "Transfer not found";
          readonly message: "The transfer may have already finished, been removed, or the id may be wrong.";
        };
      };
      readonly validation: {
        readonly title: "Unexpected response from put.io";
        readonly message: "put.io returned data the CLI did not expect.";
        readonly retryHint: "Retry the command once in case the response was transient.";
        readonly reportHint: "If it keeps happening, report it with the command and output.";
      };
      readonly terminal: {
        readonly tryThis: "Try this";
      };
    };
    readonly events: {
      readonly command: {
        readonly loading: "Loading events...";
      };
      readonly terminal: {
        readonly empty: "No events found.";
        readonly resourceFallback: "—";
        readonly summary: "Showing {{count}} event(s).";
      };
    };
    readonly files: {
      readonly command: {
        readonly creatingFolder: 'Creating folder "{{name}}"...';
        readonly deleting: "Deleting {{count}} file(s)...";
        readonly loading: "Loading files...";
        readonly moving: "Moving {{count}} file(s) to parent {{parentId}}...";
        readonly renaming: 'Renaming file {{id}} to "{{name}}"...';
        readonly searching: 'Searching files for "{{query}}"...';
      };
      readonly terminal: {
        readonly created: 'created folder "{{name}}" (id {{id}}, parent {{parentId}})';
        readonly empty: "No files found.";
        readonly emptyInParent: "No files found in {{name}}.";
        readonly deleted: "deleted file ids: {{ids}}";
        readonly moveErrorLine: "{{statusCode}}  {{errorType}}  file {{fileId}}";
        readonly moveErrors: "move errors: {{count}}";
        readonly moved: "moved file ids: {{ids}} to parent {{parentId}}";
        readonly renamed: 'renamed file {{fileId}} to "{{name}}"';
        readonly skipTrashEnabled: "skip trash: yes";
        readonly skipped: "skipped: {{count}}";
        readonly summary: "Showing {{count}} file(s){{totalSuffix}}.";
        readonly summaryInParent: "Showing {{count}} file(s) in {{name}}{{totalSuffix}}.";
        readonly totalSuffix: " ({{total}} total)";
      };
    };
    readonly metadata: {
      readonly authLogin: "Authorize the CLI through the put.io device-link flow and persist the resulting token.";
      readonly authLogout: "Remove the persisted CLI auth state.";
      readonly authPreview: "Render the auth screen locally without requesting a real device code.";
      readonly authStatus: "Report the currently resolved auth state.";
      readonly brand: "Render the put.io CLI brand mark without making any API calls.";
      readonly describe: "Print machine-readable CLI metadata for agents and scripts.";
      readonly downloadLinksCreate: "Create a browser-link generation job for files or a cursor selection.";
      readonly downloadLinksGet: "Inspect a download-links generation job and read completed links.";
      readonly eventsList: "List account history events, with optional client-side type filtering.";
      readonly filesList: "List files for a parent directory.";
      readonly filesDelete: "Delete one or more files by id.";
      readonly filesMkdir: "Create a folder under a parent directory.";
      readonly filesMove: "Move one or more files to a parent directory.";
      readonly filesRename: "Rename a file by id.";
      readonly filesSearch: "Search files by query and optional file type.";
      readonly search: "Top-level alias for file search.";
      readonly transfersAdd: "Add one or more transfers from URLs or magnet links.";
      readonly transfersCancel: "Cancel one or more transfers.";
      readonly transfersClean: "Clean all transfers or a selected set of transfer ids.";
      readonly transfersList: "List current transfers.";
      readonly transfersReannounce: "Reannounce a torrent transfer to its trackers.";
      readonly transfersRetry: "Retry a failed transfer.";
      readonly transfersWatch: "Watch a transfer until it finishes or the watch times out.";
      readonly version: "Print the CLI version and render the brand mark in terminal mode.";
      readonly whoami: "Read broad account information through the official SDK.";
    };
    readonly root: {
      readonly chooseAuthSubcommand: "Choose `status`, `login`, `logout`, or `preview`.";
      readonly help: "Use `putio describe` or `putio --help`.";
    };
    readonly transfers: {
      readonly command: {
        readonly adding: "Adding {{count}} transfer(s)...";
        readonly cancelled: "cancelled: {{ids}}";
        readonly cleaningDeleted: "deleted ids: {{ids}}";
        readonly cleaningNone: "deleted ids: none";
        readonly loading: "Loading transfers...";
        readonly reannounced: "reannounced transfer {{id}}";
        readonly reannouncing: "Reannouncing transfer {{id}}...";
        readonly retrying: "Retrying transfer {{id}}...";
        readonly watchFinished: "transfer {{id}} reached {{status}}";
        readonly watchTimedOut: "stopped watching transfer {{id}} at {{status}}";
        readonly watching: "Watching transfer {{id}}...";
      };
      readonly terminal: {
        readonly add: {
          readonly errors: "errors: {{count}}";
          readonly transfers: "transfers: {{count}}";
        };
        readonly empty: "No active transfers.";
        readonly summary: "Showing {{count}} transfer(s).";
        readonly table: {
          readonly done: "Done";
        };
      };
    };
    readonly whoami: {
      readonly terminal: {
        readonly account: "Account";
        readonly apiBaseUrl: "API base URL";
        readonly auth: "Auth";
        readonly available: "Available";
        readonly disabled: "Disabled";
        readonly email: "Email";
        readonly enabled: "Enabled";
        readonly familyOwner: "Family owner";
        readonly source: "Source";
        readonly status: "Status";
        readonly storage: "Storage";
        readonly subAccount: "Sub-account";
        readonly theme: "Theme";
        readonly total: "Total";
        readonly trash: "Trash";
        readonly twoFactor: "2FA";
        readonly used: "Used";
        readonly username: "Username";
      };
    };
    readonly downloadLinks: {
      readonly terminal: {
        readonly error: "Error: {{value}}";
        readonly linksSection: "{{title}} ({{count}})";
        readonly mediaLabel: "media";
        readonly mediaLinks: "Media links";
        readonly mp4Label: "mp4";
        readonly mp4Links: "MP4 links";
        readonly readySummary: "Ready links: {{downloadCount}} download, {{mediaCount}} media, {{mp4Count}} mp4.";
        readonly status: "Status: {{value}}";
        readonly downloadLabel: "download";
        readonly downloadLinks: "Download links";
      };
    };
  };
  readonly files: {
    readonly badRequest: {
      readonly title: "That file request is not valid";
      readonly message: "Please retry from the previous screen.";
    };
    readonly lost: {
      readonly title: "This file is no longer available";
      readonly message: "It may have been removed or expired.";
    };
    readonly notFound: {
      readonly title: "File not found";
      readonly message: "The file you requested is not available.";
    };
    readonly notReachable: {
      readonly title: "We temporarily cannot access this file";
      readonly message: "For updates, visit status.put.io.";
    };
  };
  readonly generic: {
    readonly error503: {
      readonly title: "put.io is temporarily unavailable";
      readonly message: "Please try again in a moment.";
    };
  };
  readonly validators: {
    readonly lengthBetween: "Please use between {{min}} and {{max}} characters.";
    readonly lengthExact: "Please use exactly {{length}} characters.";
    readonly required: "This field is required.";
  };
};
