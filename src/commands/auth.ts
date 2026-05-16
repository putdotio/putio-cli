import { Argument, Command } from "effect/unstable/cli";
import * as Terminal from "effect/Terminal";
import { Cause, Console, Effect, Fiber, Option, Queue } from "effect";

import { translate } from "../i18n/index.js";
import {
  buildDeviceLinkUrl,
  openBrowser,
  resolveAuthFlowConfig,
  waitForDeviceToken,
} from "../internal/auth-flow.js";
import {
  AUTH_PROFILE_NAME_DESCRIPTION,
  normalizeAuthProfileName,
} from "../internal/auth-profile.js";
import {
  defineBooleanOption,
  defineIntegerOption,
  defineTextOption,
  getOption,
  outputOption,
  validateResourceIdentifier,
  CliCommandInputError,
} from "../internal/command.js";
import { outputFlag, stringArgument, type CommandSpec } from "../internal/command-specs.js";
import type { CliConfig } from "../internal/config.js";
import { resolveCliRuntimeConfig } from "../internal/config.js";
import { withTerminalLoader } from "../internal/loader-service.js";
import type { CliOutput } from "../internal/output-service.js";
import { normalizeOutputMode, writeOutput } from "../internal/output-service.js";
import { CliRuntime } from "../internal/runtime.js";
import { provideSdk, sdk, type CliSdk } from "../internal/sdk.js";
import {
  type CliState,
  type AuthStatus,
  clearPersistedState,
  getAuthStatus,
  listProfiles,
  removeProfile,
  savePersistedState,
  useProfile,
} from "../internal/state.js";
import {
  renderAuthLoginSuccessTerminal,
  renderAuthLoginTerminal,
} from "../internal/terminal/auth-terminal.js";

const openConfig = defineBooleanOption("open", { defaultValue: false });
const timeoutSecondsConfig = defineIntegerOption("timeout-seconds", { optional: true });
const previewCodeConfig = defineTextOption("code", { defaultValue: "PUTIO1" });
const profileConfig = defineTextOption("profile", {
  description: AUTH_PROFILE_NAME_DESCRIPTION,
  optional: true,
});

const openOption = openConfig.option;
const timeoutSecondsOption = timeoutSecondsConfig.option;
const previewCodeOption = previewCodeConfig.option;
const profileOption = profileConfig.option;
const profileArgument = Argument.string("profile");
const profileCommandArgument = stringArgument("profile", {
  description: AUTH_PROFILE_NAME_DESCRIPTION,
  required: true,
});

type AuthCommandEnvironment =
  | Command.Environment
  | CliConfig
  | CliOutput
  | CliRuntime
  | CliSdk
  | CliState;

type EmptyCommandShape = Record<string, never>;
type AuthCommand = Command.Command<
  "auth",
  EmptyCommandShape,
  EmptyCommandShape,
  unknown,
  AuthCommandEnvironment
>;

const waitForOpenShortcut = (url: string) =>
  Effect.gen(function* () {
    const runtimeService = yield* CliRuntime;

    if (!runtimeService.isInteractiveTerminal) {
      return false;
    }

    const terminal = yield* Terminal.Terminal;
    const input = yield* terminal.readInput;

    while (true) {
      const event = yield* Queue.take(input);
      const keyInput = Option.getOrElse(event.input, () => "").toLowerCase();

      if (event.key.name === "o" || keyInput === "o") {
        return yield* runtimeService.openExternal(url);
      }
    }
  }).pipe(Effect.catchIf(Cause.isDone, () => Effect.succeed(false)));

const resolveProfileInput = (profile: Option.Option<string>) =>
  Option.match(profile, {
    onNone: () => undefined,
    onSome: (value) => {
      const normalized = normalizeAuthProfileName(value);

      if (normalized === null) {
        throw new CliCommandInputError({
          message: `Invalid auth profile \`${value}\`. ${AUTH_PROFILE_NAME_DESCRIPTION}`,
        });
      }

      return normalized;
    },
  });

const validateProfileArgument = (profile: string) => {
  const normalized = normalizeAuthProfileName(profile);

  if (normalized === null) {
    throw new CliCommandInputError({
      message: `Invalid auth profile \`${profile}\`. ${AUTH_PROFILE_NAME_DESCRIPTION}`,
    });
  }

  return normalized;
};

const renderAuthStatus = (status: AuthStatus) =>
  status.authenticated
    ? [
        translate("cli.auth.status.authenticatedYes"),
        translate("cli.auth.status.source", {
          value: status.source ?? translate("cli.auth.status.unknown"),
        }),
        translate("cli.auth.status.profile", {
          value: status.profile ?? translate("cli.common.none"),
        }),
        translate("cli.auth.status.defaultProfile", {
          value: status.defaultProfile ?? translate("cli.common.none"),
        }),
        translate("cli.auth.status.apiBaseUrl", { value: status.apiBaseUrl }),
        translate("cli.auth.status.configPath", { value: status.configPath }),
      ].join("\n")
    : [
        translate("cli.auth.status.authenticatedNo"),
        translate("cli.auth.status.profile", {
          value: status.profile ?? translate("cli.common.none"),
        }),
        translate("cli.auth.status.defaultProfile", {
          value: status.defaultProfile ?? translate("cli.common.none"),
        }),
        translate("cli.auth.status.apiBaseUrl", { value: status.apiBaseUrl }),
        translate("cli.auth.status.configPath", { value: status.configPath }),
      ].join("\n");

const authStatus = Command.make(
  "status",
  { output: outputOption, profile: profileOption },
  ({ output, profile }) =>
    Effect.gen(function* () {
      const selectedProfile = yield* Effect.try({
        try: () => resolveProfileInput(profile),
        catch: (error) => error,
      });
      const status = yield* getAuthStatus({ profile: selectedProfile });

      yield* writeOutput(status, getOption(output), renderAuthStatus);
    }),
);

const authLogin = Command.make(
  "login",
  {
    open: openOption,
    output: outputOption,
    profile: profileOption,
    timeoutSeconds: timeoutSecondsOption,
  },
  ({ open, output, profile, timeoutSeconds }) =>
    Effect.gen(function* () {
      const runtimeService = yield* CliRuntime;
      const outputMode = normalizeOutputMode(
        getOption(output),
        runtimeService.isInteractiveTerminal,
      );
      const runtime = yield* resolveCliRuntimeConfig();
      const apiBaseUrl = runtime.apiBaseUrl;
      const selectedProfile = yield* Effect.try({
        try: () => resolveProfileInput(profile),
        catch: (error) => error,
      });
      const timeoutMs = Option.getOrElse(timeoutSeconds, () => 120) * 1_000;
      const authFlow = yield* resolveAuthFlowConfig();
      const { code } = yield* provideSdk(
        { apiBaseUrl },
        sdk.auth.getCode({
          appId: authFlow.appId,
          clientName: authFlow.clientName,
        }),
      );
      const linkUrl = buildDeviceLinkUrl(code, authFlow.webAppUrl);
      const browserOpened = yield* open ? openBrowser(linkUrl) : Effect.succeed(false);
      const instructionMessage =
        outputMode === "terminal"
          ? renderAuthLoginTerminal({
              browserOpened,
              code,
              linkUrl,
            })
          : [
              browserOpened
                ? translate("cli.auth.login.autoOpened")
                : translate("cli.auth.login.directLinkPrompt"),
              linkUrl,
              `code: ${code}`,
              translate("cli.auth.login.waiting"),
            ].join("\n");

      yield* outputMode === "terminal"
        ? Console.log(instructionMessage)
        : runtimeService.writeStderr(`${instructionMessage}\n`);

      const openShortcutFiber =
        outputMode === "terminal" && !browserOpened
          ? yield* Effect.forkScoped(waitForOpenShortcut(linkUrl))
          : undefined;
      yield* Effect.addFinalizer(() =>
        openShortcutFiber ? Fiber.interrupt(openShortcutFiber) : Effect.void,
      );

      const token = yield* withTerminalLoader(
        {
          message: translate("cli.auth.login.waiting"),
          output: getOption(output),
        },
        waitForDeviceToken({
          code,
          timeoutMs,
          checkCodeMatch: (authCode) =>
            provideSdk({ apiBaseUrl }, sdk.auth.checkCodeMatch(authCode)),
        }),
      );
      const {
        configPath,
        profile: savedProfile,
        state,
      } = yield* savePersistedState({ apiBaseUrl, token }, undefined, { profile: selectedProfile });

      yield* writeOutput(
        {
          apiBaseUrl: savedProfile
            ? (state.profiles?.[savedProfile]?.api_base_url ?? state.api_base_url)
            : state.api_base_url,
          authenticated: true,
          browserOpened,
          configPath,
          profile: savedProfile,
          linkUrl,
        },
        getOption(output),
        (value) => renderAuthLoginSuccessTerminal(value),
      );
    }),
);

const authLogout = Command.make(
  "logout",
  { output: outputOption, profile: profileOption },
  ({ output, profile }) =>
    Effect.gen(function* () {
      const selectedProfile = yield* Effect.try({
        try: () => resolveProfileInput(profile),
        catch: (error) => error,
      });
      const { configPath, profile: clearedProfile } = yield* clearPersistedState(undefined, {
        profile: selectedProfile,
      });

      yield* writeOutput(
        { cleared: true, configPath, profile: clearedProfile },
        getOption(output),
        (value) => translate("cli.auth.logout.cleared", { configPath: value.configPath }),
      );
    }),
);

const authPreview = Command.make(
  "preview",
  { code: previewCodeOption, open: openOption, output: outputOption },
  ({ code, open, output }) =>
    Effect.gen(function* () {
      const authFlow = yield* resolveAuthFlowConfig();
      const previewCode = validateResourceIdentifier("`auth preview --code`", code);
      const linkUrl = buildDeviceLinkUrl(previewCode, authFlow.webAppUrl);

      yield* writeOutput(
        {
          browserOpened: open,
          code: previewCode,
          linkUrl,
        },
        getOption(output),
        renderAuthLoginTerminal,
      );
    }),
);

const authProfilesList = Command.make("list", { output: outputOption }, ({ output }) =>
  Effect.gen(function* () {
    const result = yield* listProfiles();

    yield* writeOutput(result, getOption(output), (value) =>
      value.profiles.length === 0
        ? translate("cli.auth.profiles.empty")
        : value.profiles
            .map((profile) =>
              [
                profile.current ? "*" : "-",
                profile.name,
                profile.authenticated ? translate("cli.common.yes") : translate("cli.common.no"),
                profile.apiBaseUrl,
              ].join("\t"),
            )
            .join("\n"),
    );
  }),
);

const authProfilesUse = Command.make(
  "use",
  { output: outputOption, profile: profileArgument },
  ({ output, profile }) =>
    Effect.gen(function* () {
      const selectedProfile = validateProfileArgument(profile);
      const result = yield* useProfile(selectedProfile);

      yield* writeOutput(result, getOption(output), (value) =>
        translate("cli.auth.profiles.used", { profile: value.profile }),
      );
    }),
);

const authProfilesRemove = Command.make(
  "remove",
  { output: outputOption, profile: profileArgument },
  ({ output, profile }) =>
    Effect.gen(function* () {
      const selectedProfile = validateProfileArgument(profile);
      const result = yield* removeProfile(selectedProfile);

      yield* writeOutput(result, getOption(output), (value) =>
        value.removed
          ? translate("cli.auth.profiles.removed", { profile: value.profile })
          : translate("cli.auth.profiles.notFound", { profile: value.profile }),
      );
    }),
);

const authProfiles = Command.make("profiles", {}, () => Effect.void).pipe(
  Command.withSubcommands([authProfilesList, authProfilesUse, authProfilesRemove]),
);

export const makeAuthCommand = (): AuthCommand =>
  Command.make("auth", {}, () => Console.log(translate("cli.root.chooseAuthSubcommand"))).pipe(
    Command.withSubcommands([authStatus, authLogin, authLogout, authPreview, authProfiles]),
  );

export const authCommandSpecs = [
  {
    auth: { required: false },
    capabilities: {
      dryRun: false,
      fieldSelection: false,
      rawJsonInput: false,
      streaming: false,
    },
    command: "auth login",
    input: {
      flags: [openConfig.flag, outputFlag(), profileConfig.flag, timeoutSecondsConfig.flag],
    },
    kind: "auth",
    purpose: translate("cli.metadata.authLogin"),
  },
  {
    auth: { required: false },
    capabilities: {
      dryRun: false,
      fieldSelection: false,
      rawJsonInput: false,
      streaming: false,
    },
    command: "auth status",
    input: { flags: [outputFlag(), profileConfig.flag] },
    kind: "auth",
    purpose: translate("cli.metadata.authStatus"),
  },
  {
    auth: { required: false },
    capabilities: {
      dryRun: false,
      fieldSelection: false,
      rawJsonInput: false,
      streaming: false,
    },
    command: "auth logout",
    input: { flags: [outputFlag(), profileConfig.flag] },
    kind: "auth",
    purpose: translate("cli.metadata.authLogout"),
  },
  {
    auth: { required: false },
    capabilities: {
      dryRun: false,
      fieldSelection: false,
      rawJsonInput: false,
      streaming: false,
    },
    command: "auth preview",
    input: {
      flags: [previewCodeConfig.flag, openConfig.flag, outputFlag()],
    },
    kind: "auth",
    purpose: translate("cli.metadata.authPreview"),
  },
  {
    auth: { required: false },
    capabilities: {
      dryRun: false,
      fieldSelection: false,
      rawJsonInput: false,
      streaming: false,
    },
    command: "auth profiles list",
    input: { flags: [outputFlag()] },
    kind: "auth",
    purpose: translate("cli.metadata.authProfilesList"),
  },
  {
    auth: { required: false },
    capabilities: {
      dryRun: false,
      fieldSelection: false,
      rawJsonInput: false,
      streaming: false,
    },
    command: "auth profiles use",
    input: { arguments: [profileCommandArgument], flags: [outputFlag()] },
    kind: "auth",
    purpose: translate("cli.metadata.authProfilesUse"),
  },
  {
    auth: { required: false },
    capabilities: {
      dryRun: false,
      fieldSelection: false,
      rawJsonInput: false,
      streaming: false,
    },
    command: "auth profiles remove",
    input: { arguments: [profileCommandArgument], flags: [outputFlag()] },
    kind: "auth",
    purpose: translate("cli.metadata.authProfilesRemove"),
  },
] satisfies ReadonlyArray<CommandSpec>;
