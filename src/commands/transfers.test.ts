import { describe, expect, it } from "vitest";

import {
  isTerminalTransferStatus,
  renderTransferAddResult,
  renderTransferWatchFinishedTerminal,
  renderTransfers,
} from "./transfers.js";

describe("renderTransfers", () => {
  it("renders transfers as tab-separated rows", () => {
    expect(
      renderTransfers([
        {
          id: 7,
          status: "COMPLETED",
          percent_done: 100,
          name: "ubuntu.iso",
        },
      ]),
    ).toBe("7\tCOMPLETED\t100\tubuntu.iso");
  });
});

describe("renderTransferAddResult", () => {
  it("renders successful additions without an error section", () => {
    expect(
      renderTransferAddResult({
        transfers: [
          {
            id: 7,
            status: "WAITING",
            percent_done: 0,
            name: "ubuntu.iso",
          },
        ],
        errors: [],
      }),
    ).toBe("transfers: 1\n7\tWAITING\t0\tubuntu.iso");
  });

  it("includes the error section when some URLs fail", () => {
    expect(
      renderTransferAddResult({
        transfers: [],
        errors: [
          {
            status_code: 400,
            error_type: "INVALID_URL",
            url: "bad://url",
          },
        ],
      }),
    ).toBe("transfers: 0\nerrors: 1\n400\tINVALID_URL\tbad://url");
  });
});

describe("transfer watch helpers", () => {
  it("detects terminal statuses", () => {
    expect(isTerminalTransferStatus("COMPLETED")).toBe(true);
    expect(isTerminalTransferStatus("SEEDING")).toBe(true);
    expect(isTerminalTransferStatus("DOWNLOADING")).toBe(false);
  });

  it("renders final watch feedback", () => {
    expect(
      renderTransferWatchFinishedTerminal({
        id: 7,
        status: "COMPLETED",
        timedOut: false,
      }),
    ).toBe("transfer 7 reached COMPLETED");
  });

  it("renders timeout watch feedback", () => {
    expect(
      renderTransferWatchFinishedTerminal({
        id: 7,
        status: "DOWNLOADING",
        timedOut: true,
      }),
    ).toBe("stopped watching transfer 7 at DOWNLOADING");
  });
});
