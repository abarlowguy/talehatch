import { describe, it, expect } from "bun:test";
import { buildHintPrompt } from "../pages/api/hints";

describe("buildHintPrompt", () => {
  it("includes the question in answer-type prompts", () => {
    const prompt = buildHintPrompt("answer", "What does Gus find?", "", [], [], []);
    expect(prompt).toContain("What does Gus find?");
  });

  it("includes entity names when provided", () => {
    const prompt = buildHintPrompt("answer", "What happens?", "", ["Gus", "Badger"], [], []);
    expect(prompt).toContain("Gus");
    expect(prompt).toContain("Badger");
  });

  it("includes prior chapter cliffhangers with recency context", () => {
    const history = [
      { chapterNumber: 1, title: "The Tunnel", cliffhanger: "Gus heard a rumble" },
      { chapterNumber: 2, title: "The River", cliffhanger: "The badger appeared" },
    ];
    const prompt = buildHintPrompt("answer", "What now?", "", [], history, []);
    expect(prompt).toContain("The badger appeared");
    expect(prompt).toContain("Gus heard a rumble");
  });

  it("moral type prompt does not include the question field", () => {
    const prompt = buildHintPrompt("moral", "", "Gus's story", ["Gus"], [], []);
    expect(prompt).not.toContain('The question is:');
    expect(prompt).toContain("moral");
  });

  it("includes previous answers in context", () => {
    const prompt = buildHintPrompt("answer", "Next step?", "", [], [], ["Gus ran fast", "He found a door"]);
    expect(prompt).toContain("Gus ran fast");
    expect(prompt).toContain("He found a door");
  });
});
