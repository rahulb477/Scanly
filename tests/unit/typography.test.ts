import { describe, expect, it } from "vitest";
import { businessFontStack } from "@/lib/typography";
describe("real self-hosted customer fonts", () => {
  it("matches the variable font CSS family names", () => {
    expect(businessFontStack("Lora")).toContain('"Lora Variable"');
    expect(businessFontStack("Plus Jakarta Sans")).toContain('"Plus Jakarta Sans Variable"');
    expect(businessFontStack("DM Serif Display")).toContain('"DM Serif Display"');
  });
  it("safely falls back for unknown or prototype property names", () => {
    for (const font of [null, "unknown", "constructor", "__proto__", 'bad"family']) expect(businessFontStack(font)).toBe('"Inter Variable", system-ui, sans-serif');
  });
});
