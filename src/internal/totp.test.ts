import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { generateTotpAt } from "./totp.js";

const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("generateTotpAt", () => {
  it.each([
    [59_000, "94287082"],
    [1_111_111_109_000, "07081804"],
    [1_111_111_111_000, "14050471"],
    [1_234_567_890_000, "89005924"],
    [2_000_000_000_000, "69279037"],
    [20_000_000_000_000, "65353130"],
  ])("matches the RFC 6238 SHA-1 vector at %d", async (timeMillis, expected) => {
    const result = await Effect.runPromise(
      generateTotpAt({ digits: 8, secret: rfcSecret, timeMillis }),
    );

    expect(result).toBe(expected);
  });

  it("rejects invalid base32 secrets without exposing them", async () => {
    await expect(
      Effect.runPromise(generateTotpAt({ secret: "not a secret!", timeMillis: 59_000 })),
    ).rejects.toMatchObject({
      message: "Unable to generate a TOTP code.",
    });
  });

  it("accepts grouped base32 secrets", async () => {
    const result = await Effect.runPromise(
      generateTotpAt({
        digits: 8,
        secret: "GEZD-GNBV-GY3T-QOJQ-GEZD-GNBV-GY3T-QOJQ",
        timeMillis: 59_000,
      }),
    );

    expect(result).toBe("94287082");
  });
});
