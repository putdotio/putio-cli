import { Command, Options } from "@effect/cli";
import * as Terminal from "@effect/platform/Terminal";
import { Console, Effect, Fiber, Option } from "effect";

import { translate } from "../i18n/index.js";
import {
  buildDeviceLinkUrl,
  openBrowser,
  resolveAuthFlowConfig,
  waitForDeviceToken,
} from "../internal/auth-flow.js";
import { getOption, outputOption, validateResourceIdentifier } from "../internal/command.js";
import {
  booleanFlag,
  integerFlag,
  outputFlag,
  stringFlag,
  type CommandSpec,
} from "../internal/command-specs.js";
import { resolveCliRuntimeConfig } from "../internal/config.js";
import { withTerminalLoader } from "../internal/loader-service.js";
import { normalizeOutputMode, writeOutput } from "../internal/output-service.js";
import { CliRuntime } from "../internal/runtime.js";
import { provideSdk, sdk } from "../internal/sdk.js";
import {
  type AuthStatus,
  clearPersistedState,
  getAuthStatus,
  savePersistedState,
} from "../internal/state.js";
import {
  renderAuthLoginSuccessTerminal,
  renderAuthLoginTerminal,
} from "../internal/terminal/auth-terminal.js";

const openOption = Options.boolean("open").pipe(Options.withDefault(false));
const timeoutSecondsOption = Options.integer("timeout-seconds").pipe(Options.optional);
const previewCodeOption = Options.text("code").pipe(Options.withDefault("PUTIO1"));

const waitForOpenShortcut = (url: string) =>
  Effect.gen(function* () {
    const runtimeService = yield* CliRuntime;

    if (!runtimeService.isInteractiveTerminal) {
      return false;
    }

    const terminal = yield* Terminal.Terminal;
    const isTTY = yield* terminal.isTTY;

    if (!isTTY) {
      return false;
    }

    const input = yield* terminal.readInput;

    while (true) {
      const event = yield* input.take;
      const keyInput = Option.getOrElse(event.input, () => "").toLowerCase();

      if (event.key.name === "o" || keyInput === "o") {
        return yield* runtimeService.openExternal(url);
      }
    }
  }).pipe(Effect.catchTag("NoSuchElementException", () => Effect.succeed(false)));

const renderAuthStatus = (status: AuthStatus) =>
  status.authenticated
    ? [
        translate("cli.auth.status.authenticatedYes"),
        translate("cli.auth.status.source", {
          value: status.source ?? translate("cli.auth.status.unknown"),
        }),
        translate("cli.auth.status.apiBaseUrl", { value: status.apiBaseUrl }),
        translate("cli.auth.status.configPath", { value: status.configPath }),
      ].join("\n")
    : [
        translate("cli.auth.status.authenticatedNo"),
        translate("cli.auth.status.apiBaseUrl", { value: status.apiBaseUrl }),
        translate("cli.auth.status.configPath", { value: status.configPath }),
      ].join("\n");

const authStatus = Command.make("status", { output: outputOption }, ({ output }) =>
  Effect.gen(function* () {
    const status = yield* getAuthStatus();

    yield* writeOutput(status, getOption(output), renderAuthStatus);
  }),
);

const authLogin = Command.make(
  "login",
  { open: openOption, output: outputOption, timeoutSeconds: timeoutSecondsOption },
  ({ open, output, timeoutSeconds }) =>
    Effect.gen(function* () {
      const runtimeService = yield* CliRuntime;
      const outputMode = normalizeOutputMode(
        getOption(output),
        runtimeService.isInteractiveTerminal,
      );
      const runtime = yield* resolveCliRuntimeConfig();
      const apiBaseUrl = runtime.apiBaseUrl;
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
        : Console.error(instructionMessage);

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
      const { configPath, state } = yield* savePersistedState({ apiBaseUrl, token });

      yield* writeOutput(
        {
          apiBaseUrl: state.api_base_url,
          authenticated: true,
          browserOpened,
          configPath,
          linkUrl,
        },
        getOption(output),
        (value) => renderAuthLoginSuccessTerminal(value),
      );
    }),
);

const authLogout = Command.make("logout", { output: outputOption }, ({ output }) =>
  Effect.gen(function* () {
    const { configPath } = yield* clearPersistedState();

    yield* writeOutput({ cleared: true, configPath }, getOption(output), (value) =>
      translate("cli.auth.logout.cleared", { configPath: value.configPath }),
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

export const makeAuthCommand = () =>
  Command.make("auth", {}, () => Console.log(translate("cli.root.chooseAuthSubcommand"))).pipe(
    Command.withSubcommands([authStatus, authLogin, authLogout, authPreview]),
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
      flags: [
        booleanFlag("open", { defaultValue: false }),
        outputFlag(),
        integerFlag("timeout-seconds"),
      ],
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
    input: { flags: [outputFlag()] },
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
    input: { flags: [outputFlag()] },
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
      flags: [
        stringFlag("code", { defaultValue: "PUTIO1" }),
        booleanFlag("open", { defaultValue: false }),
        outputFlag(),
      ],
    },
    kind: "auth",
    purpose: translate("cli.metadata.authPreview"),
  },
] satisfies ReadonlyArray<CommandSpec>;
