import { describe, it, expect } from "bun:test";
import { buildRegenPrompt, buildRegenUrl } from "./imageRegen";

describe("buildRegenPrompt", () => {
  it("places user text before the original prompt", () => {
    const result = buildRegenPrompt("make it rainy", "Zara stands in a cave, warm glow");
    expect(result).toMatch(/^make it rainy — Zara stands in a cave, warm glow/);
  });

  it("appends the style suffix", () => {
    const result = buildRegenPrompt("darker", "forest scene");
    expect(result).toContain("children's book illustration");
    expect(result).toContain("watercolour and ink");
    expect(result).toContain("warm and magical");
    expect(result).toContain("highly detailed");
  });

  it("handles empty user text by using only original prompt + suffix", () => {
    const result = buildRegenPrompt("", "original scene");
    expect(result).toMatch(/^original scene/);
    expect(result).toContain("children's book illustration");
  });
});

describe("buildRegenUrl", () => {
  it("returns a Pollinations URL", () => {
    const url = buildRegenUrl("make it rainy", "Zara stands in a cave");
    expect(url).toMatch(/^https:\/\/image\.pollinations\.ai\/prompt\//);
  });

  it("includes width, height, model, and seed params", () => {
    const url = buildRegenUrl("darker", "forest");
    expect(url).toContain("width=768");
    expect(url).toContain("height=512");
    expect(url).toContain("model=turbo");
    expect(url).toMatch(/seed=\d+/);
  });

  it("percent-encodes spaces and special chars in the prompt path", () => {
    const url = buildRegenUrl("make it rainy", "Zara's cave");
    const path = url.split("?")[0];
    expect(path).not.toContain(" ");
    expect(path).not.toContain("'");
  });
});
