import type { AgeRange } from "@/lib/prompts";

const GENRE_STYLE: Record<string, string> = {
  fantasy: "vibrant fantasy oil painting, magical glowing light, rich jewel tones, enchanted atmosphere, epic storybook illustration, highly detailed",
  "sci-fi": "Pixar 3D render, sleek futuristic design, neon accent lighting, metallic surfaces, cinematic depth, highly detailed",
  mystery: "atmospheric noir illustration, deep dramatic shadows, candlelit palette, ink and wash, moody and cinematic, highly detailed",
  adventure: "bold adventure illustration, dynamic energetic composition, vivid saturated colors, golden hour lighting, highly detailed",
  cozy: "warm cozy picture book illustration, soft rounded shapes, pastel palette, gentle gouache, intimate hearth lighting, highly detailed",
  historical: "detailed classical oil painting, period-accurate, aged warm tones, museum-quality composition, highly detailed",
  other: "vibrant children's storybook illustration, expressive characters, warm inviting lighting, richly colored, highly detailed",
};

// ageRange kept in signature for API compatibility but style is driven by genre
export function buildStyleSuffix(_ageRange: AgeRange, genre: string): string {
  const style = GENRE_STYLE[genre.toLowerCase()] ?? GENRE_STYLE.other;
  return `, ${style}`;
}

export function buildRegenPrompt(userText: string, originalPrompt: string, artStyle: string): string {
  const prefix = userText.trim() ? `${userText.trim()} — ` : "";
  return `${prefix}${originalPrompt}${artStyle}`;
}

export function buildRegenUrl(
  userText: string,
  originalPrompt: string,
  artStyle: string,
  characterAnchor?: string
): string {
  const prefix = characterAnchor ? `${characterAnchor}. ` : "";
  const prompt = buildRegenPrompt(userText, `${prefix}${originalPrompt}`, artStyle);
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&model=flux&seed=${seed}`;
}

export function buildImageUrl(
  scenePrompt: string,
  artStyle: string,
  characterAnchor?: string
): string {
  const prefix = characterAnchor ? `${characterAnchor}. ` : "";
  const prompt = `${prefix}${scenePrompt}${artStyle}`;
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&model=flux&seed=${seed}`;
}
