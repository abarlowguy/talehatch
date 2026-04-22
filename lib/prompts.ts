export const MIN_QUESTIONS = 5;
export const MAX_QUESTIONS = 20;

export const FIRST_PROMPT =
  "Let's begin… You are the main character. Tell me who you are, where you are, or what you're doing — anything that feels true.";

export const NEXT_CHAPTER_FIRST_PROMPT =
  "Where does the next chapter take place? Something changed at the end of the last one — where do we find ourselves now?";

// Elements gathered through questioning. Others (theme, climax, arc, etc.) emerge in the writing.
export const COLLECTABLE_ELEMENTS = [
  "character",
  "desire",
  "motivation",
  "setting",
  "inciting-incident",
  "obstacle",
  "internal-conflict",
  "stakes",
  "choice",
  "emotion",
] as const;

export type StoryElement = (typeof COLLECTABLE_ELEMENTS)[number];

export const TOTAL_COLLECTABLE = COLLECTABLE_ELEMENTS.length;

// Human-readable labels — used in chapter API context, not shown to the child
export const ELEMENT_LABELS: Record<StoryElement, string> = {
  character: "Who the character is",
  desire: "What they want",
  motivation: "Why they want it (deeper reason)",
  setting: "Where and when the story takes place",
  "inciting-incident": "The event that disrupts normal life and starts the story",
  obstacle: "What's blocking them",
  "internal-conflict": "Their fears, doubts, or emotional struggles",
  stakes: "What they stand to lose or gain",
  choice: "A key decision the character must make",
  emotion: "The emotional core — how it feels",
};

// Static fallback prompts (only used if API fails to return a reactive one)
export const guidedPrompts: string[] = [
  FIRST_PROMPT,
  "What does your character want more than anything?",
  "Why do they want it so badly?",
  "Describe where and when this story takes place.",
  "What unexpected thing happens that changes everything?",
  "What stands in their way?",
  "What are they afraid of, or what doubts are they carrying?",
  "What's at stake — what could they lose?",
  "What choice do they have to make?",
  "How does all of this feel — what's the emotional core?",
];
