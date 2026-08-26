import { createHmac } from "node:crypto";

import { Clock, Effect, Schema } from "effect";

const Base32SecretSchema = Schema.String.check(
  Schema.makeFilter((value) =>
    /^[A-Z2-7]+=*$/.test(value) ? undefined : "Expected a base32 TOTP secret",
  ),
);

class TotpError extends Schema.TaggedError<TotpError>()("TotpError", {
  message: Schema.String,
}) {}

const decodeBase32 = (secret: string) => {
  const normalized = Schema.decodeUnknownSync(Base32SecretSchema)(
    secret.replace(/[ -]/g, "").toUpperCase(),
  ).replace(/=+$/, "");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";

  for (const character of normalized) {
    bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8));

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2);
  }

  return bytes;
};

export const generateTotpAt = (input: {
  readonly digits?: number;
  readonly periodSeconds?: number;
  readonly secret: string;
  readonly timeMillis: number;
}) =>
  Effect.try({
    try: () => {
      const digits = input.digits ?? 6;
      const periodSeconds = input.periodSeconds ?? 30;
      const counter = Math.floor(input.timeMillis / 1_000 / periodSeconds);
      const counterBytes = Buffer.alloc(8);
      counterBytes.writeBigUInt64BE(BigInt(counter));

      const digest = createHmac("sha1", decodeBase32(input.secret)).update(counterBytes).digest();
      const offset = digest[digest.length - 1]! & 0x0f;
      const binary =
        ((digest[offset]! & 0x7f) << 24) |
        ((digest[offset + 1]! & 0xff) << 16) |
        ((digest[offset + 2]! & 0xff) << 8) |
        (digest[offset + 3]! & 0xff);

      return String(binary % 10 ** digits).padStart(digits, "0");
    },
    catch: () => new TotpError({ message: "Unable to generate a TOTP code." }),
  });

export const generateTotp = (secret: string) =>
  Effect.flatMap(Clock.currentTimeMillis, (timeMillis) => generateTotpAt({ secret, timeMillis }));
