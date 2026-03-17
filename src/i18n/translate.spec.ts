import { describe, expect, it } from "vitest";

import { createTranslator, translate } from "./index.js";

describe("CLI translations", () => {
  it("translates plain keys", () => {
    expect(translate("app.network.error.title")).toBe("Network error");
  });

  it("interpolates typed parameters", () => {
    const t = createTranslator("en");

    expect(t("cli.error.rateLimit.retryAfter", { seconds: 42 })).toBe(
      "Wait about 42s and try again.",
    );
  });
});
