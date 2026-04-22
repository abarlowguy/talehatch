// Simple noun extraction — finds capitalized words and common story nouns
const STOP_WORDS = new Set([
  "i", "me", "my", "we", "our", "you", "your", "he", "she", "it", "they",
  "them", "his", "her", "its", "their", "a", "an", "the", "and", "but",
  "or", "so", "yet", "for", "nor", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "that", "this",
  "these", "those", "what", "who", "where", "when", "why", "how",
  "something", "anything", "everything", "nothing", "someone",
  "close", "eyes", "first", "thing", "notice", "makes", "different",
  "want", "more", "than", "unexpected", "happens", "next",
]);

export function extractNouns(text: string): string[] {
  const words = text
    .replace(/[^a-zA-Z\s'-]/g, "")
    .split(/\s+/)
    .map((w) => w.toLowerCase().trim())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  return [...new Set(words)];
}

export function mergeEntities(existing: string[], incoming: string[]): string[] {
  const combined = [...existing, ...incoming];
  return [...new Set(combined)];
}
