import { Argument, Command, Prompt } from "effect/cli";
import * as Stdio from "effect/Stdio";
import * as Terminal from "effect/Terminal";
import { Cause, Console, Effect, Fiber, Option, Queue, Redacted, Schema, Stream } from "effect";

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
  dryRunOption,
  getOption,
  jsonOption,
  outputOption,
  resolveMutationInput,
  validateResourceIdentifier,
  withAuthedSdk,
  writeDryRunPlan,
  CliCommandInputError,
} from "../internal/command.js";
import {
  dryRunFlag,
  jsonFlag,
  jsonInputSpecFromSchema,
  outputFlag,
  stringArgument,
  type CommandSpec,
} from "../internal/command-specs.js";
import { resolveCliRuntimeConfig } from "../internal/config.js";
import { withTerminalLoader } from "../internal/loader-service.js";
import { normalizeOutputMode, writeOutput } from "../internal/output-service.js";
import { CliRuntime } from "../internal/runtime.js";
import { provideSdk, sdk } from "../internal/sdk.js";
import {
  AuthStateError,
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

const tokenConfig = defineBooleanOption("token", {
  defaultValue: false,
  description: "Prompt for an existing put.io token without echoing it, then save it.",
});

const tokenStdinConfig = defineBooleanOption("token-stdin", {
  defaultValue: false,
  description: "Read an existing put.io token from standard input, then save it.",
});

const profileConfig = defineTextOption("profile", {
  description: AUTH_PROFILE_NAME_DESCRIPTION,
  optional: true,
});

const openOption = openConfig.option;
const timeoutSecondsOption = timeoutSecondsConfig.option;
const previewCodeOption = previewCodeConfig.option;
const profileOption = profileConfig.option;
const tokenOption = tokenConfig.option;
const tokenStdinOption = tokenStdinConfig.option;
const profileArgument = Argument.String("profile");
const approveCodeArgument = Argument.String("code").pipe(Argument.optional);

const profileCommandArgument = stringArgument("profile", {
  description: AUTH_PROFILE_NAME_DESCRIPTION,
  required: true,
});

const NonBlankStringSchema = Schema.String.check(
  Schema.makeFilter((value) =>
    value.trim().length > 0 ? undefined : "Expected a non-empty string",
  ),
);

const AuthApproveInputSchema = Schema.Struct({
  code: NonBlankStringSchema,
});

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

const TOKEN_FLAGS = ["--token", "--token-stdin"] as const;

const isTokenFlag = (arg: string | undefined) => TOKEN_FLAGS.some((flag) => arg === flag);

const hasInlineTokenValue = (args: ReadonlyArray<string>) =>
  args.some(
    (arg, index) =>
      TOKEN_FLAGS.some((flag) => arg.startsWith(`${flag}=`)) ||
      (isTokenFlag(args[index - 1]) && !arg.startsWith("-")),
  );

export const rejectInlineAuthToken = (commandArgs: ReadonlyArray<string>) =>
  commandArgs[0] === "auth" && commandArgs[1] === "login" && hasInlineTokenValue(commandArgs)
    ? Effect.fail(
        new CliCommandInputError({
          message:
            "`--token` and `--token-stdin` take no value. Run `putio auth login --token` to be prompted, or pipe the token into `putio auth login --token-stdin`.",
        }),
      )
    : Effect.void;

const readTokenFromStdin = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio;

  return yield* stdio.stdin.pipe(
    Stream.decodeText(),
    Stream.mkString,
    Effect.mapError(
      () => new CliCommandInputError({ message: "Unable to read the token from standard input." }),
    ),
  );
});

const promptForToken = Effect.gen(function* () {
  const runtimeService = yield* CliRuntime;

  if (!runtimeService.isInteractiveTerminal) {
    return yield* Effect.fail(
      new CliCommandInputError({
        message:
          "`auth login --token` needs an interactive terminal. Pipe the token into `auth login --token-stdin` instead.",
      }),
    );
  }

  const token = yield* Prompt.run(
    Prompt.Hidden({ message: translate("cli.auth.login.tokenPrompt") }),
  );

  return Redacted.value(token);
});

const validateExistingToken = (apiBaseUrl: string, token: string) =>
  provideSdk({ apiBaseUrl }, sdk.auth.validateToken(token)).pipe(
    Effect.mapError(
      () =>
        new AuthStateError({
          message: "Unable to validate the token with put.io. Check your connection and retry.",
        }),
    ),
    Effect.flatMap((result) =>
      result.result
        ? Effect.void
        : Effect.fail(
            new AuthStateError({
              message: "put.io rejected the token. Check that it is current and complete.",
            }),
          ),
    ),
  );

const loginWithExistingToken = (options: {
  readonly output: Option.Option<"json" | "text" | "ndjson">;
  readonly profile: Option.Option<string>;
  readonly source: "prompt" | "stdin";
}) =>
  Effect.gen(function* () {
    const runtime = yield* resolveCliRuntimeConfig();
    const apiBaseUrl = runtime.apiBaseUrl;

    const selectedProfile = yield* Effect.try({
      try: () => resolveProfileInput(options.profile),
      catch: (error) => error,
    });

    const rawToken = yield* options.source === "stdin" ? readTokenFromStdin : promptForToken;
    const token = rawToken.trim();

    if (token.length === 0) {
      return yield* Effect.fail(
        new CliCommandInputError({ message: "No token was provided to `auth login`." }),
      );
    }

    yield* validateExistingToken(apiBaseUrl, token);

    const {
      configPath,
      profile: savedProfile,
      state,
    } = yield* savePersistedState({ apiBaseUrl, authMethod: "token", token }, undefined, {
      profile: selectedProfile,
    });

    yield* writeOutput(
      {
        apiBaseUrl: savedProfile
          ? (state.profiles?.[savedProfile]?.api_base_url ?? state.api_base_url)
          : state.api_base_url,
        authMethod: "token" as const,
        authenticated: true,
        configPath,
        profile: savedProfile,
      },
      getOption(options.output),
      renderAuthLoginSuccessTerminal,
    );
  });

const renderAuthStatus = (status: AuthStatus) =>
  status.authenticated
    ? [
        translate("cli.auth.status.authenticatedYes"),
        translate("cli.auth.status.source", {
          value: status.source ?? translate("cli.auth.status.unknown"),
        }),
        ...(status.authMethod === null
          ? []
          : [translate("cli.auth.status.authMethod", { value: status.authMethod })]),
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
    token: tokenOption,
    tokenStdin: tokenStdinOption,
  },
  ({ open, output, profile, timeoutSeconds, token: tokenPrompt, tokenStdin }) =>
    Effect.gen(function* () {
      if (tokenPrompt || tokenStdin) {
        if (tokenPrompt && tokenStdin) {
          return yield* Effect.fail(
            new CliCommandInputError({
              message: "Use either `--token` or `--token-stdin` for `auth login`, not both.",
            }),
          );
        }

        if (open || Option.isSome(timeoutSeconds)) {
          return yield* Effect.fail(
            new CliCommandInputError({
              message:
                "`--open` and `--timeout-seconds` apply to the device-link flow, not to `--token` or `--token-stdin`.",
            }),
          );
        }

        return yield* loginWithExistingToken({
          output,
          profile,
          source: tokenStdin ? "stdin" : "prompt",
        });
      }

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
      } = yield* savePersistedState({ apiBaseUrl, authMethod: "device", token }, undefined, {
        profile: selectedProfile,
      });

      yield* writeOutput(
        {
          apiBaseUrl: savedProfile
            ? (state.profiles?.[savedProfile]?.api_base_url ?? state.api_base_url)
            : state.api_base_url,
          authMethod: "device" as const,
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

      const {
        cleared,
        configPath,
        profile: clearedProfile,
      } = yield* clearPersistedState(undefined, {
        profile: selectedProfile,
      });

      yield* writeOutput(
        { cleared, configPath, profile: clearedProfile },
        getOption(output),
        (value) =>
          value.cleared
            ? translate("cli.auth.logout.cleared", { configPath: value.configPath })
            : value.profile
              ? translate("cli.auth.profiles.notFound", { profile: value.profile })
              : translate("cli.auth.logout.notFound", { configPath: value.configPath }),
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

const authApprove = Command.make(
  "approve",
  {
    code: approveCodeArgument,
    dryRun: dryRunOption,
    json: jsonOption,
    output: outputOption,
  },
  ({ code, dryRun, json, output }) =>
    Effect.gen(function* () {
      const input = yield* resolveMutationInput({
        buildFromFlags: () => {
          const value = getOption(code);

          if (value === undefined) {
            throw new CliCommandInputError({
              message: "Provide a device code or `--json` for `auth approve`.",
            });
          }

          return { code: value };
        },
        json,
        schema: AuthApproveInputSchema,
      });

      const approvedCode = validateResourceIdentifier("`auth approve` code", input.code.trim());

      if (dryRun) {
        return yield* writeDryRunPlan("auth approve", { code: approvedCode }, getOption(output));
      }

      const result = yield* withAuthedSdk(({ sdk }) => sdk.auth.linkDevice(approvedCode));

      yield* writeOutput(result, getOption(output), (value) =>
        translate("cli.auth.approve.approved", { id: value.id, name: value.name }),
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
                profile.authMethod ?? translate("cli.common.none"),
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

export const authCommand = Command.make("auth", {}, () =>
  Console.log(translate("cli.root.chooseAuthSubcommand")),
).pipe(
  Command.withSubcommands([
    authStatus,
    authLogin,
    authLogout,
    authPreview,
    authApprove,
    authProfiles,
  ]),
);

export const authCommandSpecs = [
  {
    auth: { required: true },
    capabilities: {
      dryRun: true,
      fieldSelection: false,
      rawJsonInput: true,
      streaming: false,
    },
    command: "auth approve",
    input: {
      arguments: [
        stringArgument("code", {
          description: "Short code displayed by the device requesting authorization.",
          required: false,
        }),
      ],
      flags: [dryRunFlag(), jsonFlag(), outputFlag()],
      json: jsonInputSpecFromSchema(AuthApproveInputSchema),
    },
    kind: "write",
    purpose: translate("cli.metadata.authApprove"),
  },
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
        openConfig.flag,
        outputFlag(),
        profileConfig.flag,
        timeoutSecondsConfig.flag,
        tokenConfig.flag,
        tokenStdinConfig.flag,
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
