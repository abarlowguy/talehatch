import { describe, it, expect } from "bun:test";
import { buildStyleSuffix, buildRegenPrompt, buildRegenUrl } from "./imageRegen";

describe("buildStyleSuffix", () => {
  it("returns a string containing age-range style for tiny", () => {
    const result = buildStyleSuffix("tiny", "");
    expect(result).toContain("pastel");
    expect(result).toContain("highly detailed");
  });

  it("returns a string containing age-range style for older", () => {
    const result = buildStyleSuffix("older", "");
    expect(result).toContain("graphite");
    expect(result).toContain("highly detailed");
  });

  it("appends genre modifier when genre is recognised", () => {
    const result = buildStyleSuffix("middle", "fantasy");
    expect(result).toContain("enchanted");
  });

  it("omits genre modifier for unrecognised genre", () => {
    const withUnknown = buildStyleSuffix("middle", "vampires");
    const withEmpty = buildStyleSuffix("middle", "");
    expect(withUnknown).toBe(withEmpty);
  });

  it("is case-insensitive for genre", () => {
    expect(buildStyleSuffix("older", "Fantasy")).toBe(buildStyleSuffix("older", "fantasy"));
  });
});

describe("buildRegenPrompt", () => {
  it("places user text before the original prompt", () => {
    const artStyle = buildStyleSuffix("older", "fantasy");
    const result = buildRegenPrompt("make it rainy", "Zara stands in a cave, warm glow", artStyle);
    expect(result).toMatch(/^make it rainy — Zara stands in a cave, warm glow/);
  });

  it("appends the artStyle suffix", () => {
    const artStyle = buildStyleSuffix("older", "fantasy");
    const result = buildRegenPrompt("darker", "forest scene", artStyle);
    expect(result).toContain(artStyle);
  });

  it("handles empty user text by using only original prompt + artStyle", () => {
    const artStyle = buildStyleSuffix("older", "");
    const result = buildRegenPrompt("", "original scene", artStyle);
    expect(result).toMatch(/^original scene/);
    expect(result).toContain("graphite");
  });
});

describe("buildRegenUrl", () => {
  it("returns a Pollinations URL", () => {
    const artStyle = buildStyleSuffix("older", "");
    const url = buildRegenUrl("make it rainy", "Zara stands in a cave", artStyle);
    expect(url).toMatch(/^https:\/\/image\.pollinations\.ai\/prompt\//);
  });

  it("includes width, height, model, and seed params", () => {
    const artStyle = buildStyleSuffix("older", "");
    const url = buildRegenUrl("darker", "forest", artStyle);
    expect(url).toContain("width=768");
    expect(url).toContain("height=512");
    expect(url).toContain("model=turbo");
    expect(url).toMatch(/seed=\d+/);
  });

  it("percent-encodes spaces in the prompt path", () => {
    const artStyle = buildStyleSuffix("older", "");
    const url = buildRegenUrl("make it rainy", "Zara's cave", artStyle);
    const path = url.split("?")[0];
    expect(path).not.toContain(" ");
  });
});
