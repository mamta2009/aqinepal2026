import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "./error";

describe("apiErrorMessage", () => {
  it("uses FastAPI detail strings", () => {
    expect(apiErrorMessage({ detail: "Not available" }, "Fallback")).toBe(
      "Not available",
    );
  });

  it("joins FastAPI validation messages", () => {
    expect(
      apiErrorMessage(
        { detail: [{ msg: "Email is required" }, { msg: "Phone is invalid" }] },
        "Fallback",
      ),
    ).toBe("Email is required; Phone is invalid");
  });

  it("falls back for unknown payloads", () => {
    expect(apiErrorMessage(null, "Try again")).toBe("Try again");
  });
});
