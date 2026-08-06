import { describe, expect, it } from "vitest";
import { isSameOriginMutation, rejectCrossOrigin } from "./origin";

function mockRequest(
  method: string,
  origin: string | null,
  requestOrigin = "http://localhost:3000",
) {
  return {
    method,
    headers: {
      get: (name: string) => (name.toLowerCase() === "origin" ? origin : null),
    },
    nextUrl: { origin: requestOrigin },
  } as unknown as Parameters<typeof isSameOriginMutation>[0];
}

describe("origin guards", () => {
  it("allows safe methods without origin checks", () => {
    expect(
      isSameOriginMutation(mockRequest("GET", "https://evil.example")),
    ).toBe(true);
  });

  it("allows same-origin mutations", () => {
    expect(
      isSameOriginMutation(mockRequest("POST", "http://localhost:3000")),
    ).toBe(true);
  });

  it("rejects cross-origin mutations", () => {
    expect(
      isSameOriginMutation(mockRequest("POST", "https://evil.example")),
    ).toBe(false);
  });

  it("detects cross-origin for logout-style checks", () => {
    expect(rejectCrossOrigin(mockRequest("POST", "https://evil.example"))).toBe(
      true,
    );
    expect(
      rejectCrossOrigin(mockRequest("POST", "http://localhost:3000")),
    ).toBe(false);
  });
});
