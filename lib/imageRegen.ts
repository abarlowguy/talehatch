const STYLE_SUFFIX = ", children's book illustration, watercolour and ink, warm and magical, highly detailed";

export function buildRegenPrompt(userText: string, originalPrompt: string): string {
  const prefix = userText.trim() ? `${userText.trim()} — ` : "";
  return `${prefix}${originalPrompt}${STYLE_SUFFIX}`;
}

export function buildRegenUrl(userText: string, originalPrompt: string): string {
  const prompt = buildRegenPrompt(userText, originalPrompt);
  const seed = Math.floor(Math.random() * 999999);
  const encodedPrompt = encodeURIComponent(prompt).replace(/'/g, "%27");
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=768&height=512&model=turbo&seed=${seed}`;
}
