import { describe, it, expect } from "vitest";
import * as api from "./index.js";

describe("api index exports", () => {
  it("re-exports services modules", () => {
    expect(api.TriggerEngine).toBeDefined();
    expect(api.PivotManager).toBeDefined();
  });
});
