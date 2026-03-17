import { Options } from "@effect/cli";
import { Effect, Option } from "effect";

import type { ResolvedAuthState } from "./state.js";
import { provideSdk, sdk } from "./sdk.js";
import { resolveAuthState } from "./state.js";

export const outputOption = Options.choice("output", ["json", "text"] as const).pipe(
  Options.optional,
);

export const getOption = <A>(option: Option.Option<A>) => Option.getOrUndefined(option);

const integerPattern = /^-?\d+$/;

export const parseRepeatedIntegers = (
  values: ReadonlyArray<string>,
): Option.Option<ReadonlyArray<number>> => {
  const parsed: number[] = [];

  for (const value of values) {
    if (!integerPattern.test(value)) {
      return Option.none();
    }

    parsed.push(Number.parseInt(value, 10));
  }

  return Option.some(parsed);
};

export const parseRepeatedIntegerOption = (name: string) =>
  Options.text(name).pipe(
    Options.repeated,
    Options.filterMap(parseRepeatedIntegers, `Expected \`--${name}\` values to be integers.`),
  );

export const withAuthedSdk = <A, E, R>(
  program: (context: {
    readonly auth: ResolvedAuthState;
    readonly sdk: typeof sdk;
  }) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const auth = yield* resolveAuthState();

    return yield* provideSdk(
      {
        token: auth.token,
        apiBaseUrl: auth.apiBaseUrl,
      },
      program({
        auth,
        sdk,
      }),
    );
  });
