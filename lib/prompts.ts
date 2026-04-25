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

// ── Age range ─────────────────────────────────────────────────────────────────

export type AgeRange = "tiny" | "young" | "middle" | "older";

export interface AgeTierConfig {
  label: string;
  readerDescription: string;
  elements: string[];
  readyElements: string[];
  minQuestions: number;
  maxQuestions: number;
  chapterWords: string;
  questionStyle: string;
  fallbackPrompts: string[];
}

export const AGE_RANGE_CONFIG: Record<AgeRange, AgeTierConfig> = {
  tiny: {
    label: "Under 6",
    readerDescription: "a very young reader (under 6)",
    elements: ["character", "setting", "problem"],
    readyElements: ["character", "setting", "problem"],
    minQuestions: 3,
    maxQuestions: 5,
    chapterWords: "200 to 300",
    questionStyle:
      "Use the simplest possible words — like you're talking to a 4-year-old. Ask one tiny thing at a time. Very short questions. Concrete and visual only: what things look like, where they are, what the problem is. Sound warm, gentle, and encouraging.",
    fallbackPrompts: [
      "Tell me about your character — what do they look like?",
      "Where does your character live?",
      "What is the problem in the story?",
      "Who helps your character?",
      "How does the story end happily?",
    ],
  },
  young: {
    label: "Ages 6–8",
    readerDescription: "a young reader (ages 6–8)",
    elements: ["character", "setting", "desire", "obstacle"],
    readyElements: ["character", "setting", "desire", "obstacle"],
    minQuestions: 4,
    maxQuestions: 8,
    chapterWords: "400 to 600",
    questionStyle:
      "Use very simple words a 6-year-old can understand. Ask about things you can SEE — what things look like, where they are, what they want, what's in the way. Never ask about emotions, motivations, or inner conflict. One concrete question at a time. Sound warm and excited.",
    fallbackPrompts: [
      "Tell me about your main character — what do they look like?",
      "Where does your character live? Describe the place.",
      "What does your character really want?",
      "What is getting in their way?",
      "Who helps your character?",
      "What is the most exciting thing that happens?",
      "How does the story end?",
    ],
  },
  middle: {
    label: "Ages 9–11",
    readerDescription: "a reader aged 9–11",
    elements: ["character", "setting", "desire", "obstacle", "inciting-incident", "stakes"],
    readyElements: ["character", "setting", "desire", "obstacle", "inciting-incident", "stakes"],
    minQuestions: 5,
    maxQuestions: 12,
    chapterWords: "700 to 900",
    questionStyle:
      "Use clear, engaging language. Questions can explore what characters want, what stands in their way, and simple feelings. Avoid abstract concepts like inner motivation or psychological conflict.",
    fallbackPrompts: [
      "Tell me about your main character.",
      "Where and when does this story take place?",
      "What does your character want more than anything?",
      "What unexpected thing happens that changes everything?",
      "What stands in their way?",
      "What could they lose if they fail?",
    ],
  },
  older: {
    label: "Ages 12+",
    readerDescription: "a reader aged 12 and up",
    elements: [...COLLECTABLE_ELEMENTS],
    readyElements: [
      "character",
      "desire",
      "motivation",
      "setting",
      "inciting-incident",
      "obstacle",
      "internal-conflict",
      "stakes",
    ],
    minQuestions: MIN_QUESTIONS,
    maxQuestions: MAX_QUESTIONS,
    chapterWords: "1,200 to 1,500",
    questionStyle:
      "Ask deep, specific questions. Explore motivation, inner conflict, stakes, and emotional complexity. Short, punchy questions that feel like curiosity, not an interview.",
    fallbackPrompts: [
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
    ],
  },
};
