import { describe, expect, it } from "vitest";
import { SlatePathModel } from "../path";

describe("path", () => {
  it("a", () => {
    const path = [5];
    const another = [4, 1];

    const ok = SlatePathModel.isAncestor(path, another);
    expect(ok).toBe(false);
  });

  it("b", () => {
    const path = [5];
    const another = [4, 1];

    const ok = SlatePathModel.endsBefore(path, another);
    expect(ok).toBe(false);
  });
});
