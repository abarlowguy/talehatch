import type { AgeRange } from "@/lib/prompts";

const AGE_BASE_STYLE: Record<AgeRange, string> = {
  tiny: "soft pastel picture book illustration, rounded shapes, gentle watercolour wash, warm and cozy",
  young: "bright gouache illustration, bold outlines, flat colour, lively children's adventure book",
  middle: "detailed ink and watercolour, dynamic composition, middle-grade adventure illustration",
  older: "dramatic graphite and ink, detailed crosshatching, cinematic lighting, young adult novel illustration",
};

const GENRE_STYLE_MODIFIER: Record<string, string> = {
  fantasy: "enchanted magical world, glowing runes, ethereal mist",
  "sci-fi": "sleek metallic surfaces, neon accents, futuristic technology",
  mystery: "moody shadows, candlelit atmosphere, noir-inspired palette",
  adventure: "lush natural environments, dynamic action, golden hour lighting",
  cozy: "warm hearth light, soft textures, intimate homey atmosphere",
  historical: "period-accurate details, aged parchment tones, classical composition",
};

export function buildStyleSuffix(ageRange: AgeRange, genre: string): string {
  const base = AGE_BASE_STYLE[ageRange];
  const modifier = GENRE_STYLE_MODIFIER[genre.toLowerCase()] ?? "";
  return modifier
    ? `, ${base}, ${modifier}, highly detailed`
    : `, ${base}, highly detailed`;
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
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=512&model=turbo&seed=${seed}`;
}

export function buildImageUrl(
  scenePrompt: string,
  artStyle: string,
  characterAnchor?: string
): string {
  const prefix = characterAnchor ? `${characterAnchor}. ` : "";
  const prompt = `${prefix}${scenePrompt}${artStyle}`;
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=512&model=turbo&seed=${seed}`;
}
