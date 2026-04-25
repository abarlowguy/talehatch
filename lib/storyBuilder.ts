export interface GenerateRequest {
  story: string;
  input: string;
  entities: string[];
  mode: "guided" | "dynamic";
  step?: number;
  coveredElements?: string[];
  questionCount?: number;
  chapterNumber?: number;
  previousCliffhanger?: string;
  conversationHistory?: Array<{ prompt: string; answer: string }>;
  ageRange?: string;
}

export interface GenerateResponse {
  story?: string;
  nextPrompt?: string;
  coveredElements?: string[];
  readyToWrite?: boolean;
  error?: string;
}

export interface ChapterRequest {
  inputs: string[];
  story: string;
  entities: string[];
  chapterNumber?: number;
  previousCliffhanger?: string;
  ageRange?: string;
}

export interface ChapterResponse {
  chapterTitle: string;
  chapter: string;
  cliffhanger: string;
  imageUrls: string[];
  error?: string;
}

export interface EditChapterRequest {
  chapter: string;
  editInstructions: string;
  cliffhanger: string;
}

export interface EditChapterResponse {
  chapter: string;
  error?: string;
}

export interface ChapterRecord {
  chapterNumber: number;
  title: string;
  chapter: string;
  imageUrls: string[];
  cliffhanger: string;
}

export async function generateStorySegment(
  req: GenerateRequest
): Promise<GenerateResponse> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) return { error: "Something went wrong. Try again." };
  return res.json();
}

export async function generateChapter(req: ChapterRequest): Promise<ChapterResponse> {
  const res = await fetch("/api/chapter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    return { chapterTitle: "", chapter: "", cliffhanger: "", imageUrls: [], error: "Could not generate chapter. Try again." };
  }
  return res.json();
}

export async function editChapter(req: EditChapterRequest): Promise<EditChapterResponse> {
  const res = await fetch("/api/edit-chapter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) return { chapter: req.chapter, error: "Could not apply edits. Try again." };
  return res.json();
}
