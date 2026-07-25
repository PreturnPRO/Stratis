
const STOPWORDS = new Set([
  "the", "a", "an", "to", "of", "in", "on", "for", "and", "or", "is", "are",
  "was", "were", "be", "been", "being", "we", "do", "does", "did", "should",
  "would", "could", "can", "will", "shall", "what", "why", "how", "when", "who",
  "which", "whom", "whose", "this", "that", "it", "have", "has", "had", "with",
  "our", "you", "your", "i", "they", "them", "about", "if", "so", "but", "as",
  "at", "from", "by", "into", "than", "then", "us", "there", "their",
]);

export function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ").replace(/[?.!]+$/g, "");
}

const THAI_RANGE = /[฀-๿]/;
const THAI_NGRAM = 3;

const THAI_STOPWORDS = [
  "ครับ", "ค่ะ", "คะ", "นะ", "น่ะ", "แล้ว", "ที่", "และ", "หรือ", "แต่", "เรา",
  "ของ", "ให้", "ได้", "ไหม", "มั้ย", "อะไร", "ทำไม", "อย่างไร", "ยังไง", "ใคร",
  "เมื่อไหร่", "ไหน", "ควร", "จะ", "คือ", "เป็น", "มี", "ใน", "กับ", "การ",
];

function thaiNgrams(run: string, out: Set<string>): void {
  let cleaned = run;
  for (const sw of THAI_STOPWORDS) cleaned = cleaned.split(sw).join("");
  if (cleaned.length === 0) return;
  if (cleaned.length <= THAI_NGRAM) {
    out.add(cleaned);
    return;
  }
  for (let i = 0; i + THAI_NGRAM <= cleaned.length; i += 1) {
    out.add(cleaned.slice(i, i + THAI_NGRAM));
  }
}

export function contentTokens(text: string): string[] {
  const out = new Set<string>();
  const lower = text.toLowerCase();

  for (const raw of lower.replace(/[^a-z0-9]+/g, " ").split(/\s+/)) {
    if (!raw) continue;
    if (STOPWORDS.has(raw)) continue;
    if (raw.length < 2 && !/[0-9]/.test(raw)) continue;
    out.add(raw);
  }

  if (THAI_RANGE.test(lower)) {
    for (const run of lower.match(/[฀-๿]+/g) ?? []) {
      const grams = new Set<string>();
      thaiNgrams(run, grams);
      for (const g of grams) out.add(`th:${g}`);
    }
  }

  return [...out];
}

export function jaccardSimilarity(a: string, b: string): number {
  const A = new Set(contentTokens(a));
  const B = new Set(contentTokens(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return inter / union;
}

export const DEFAULT_NEAR_DUP_THRESHOLD = 0.6;

export function isNearDuplicate(
  a: string,
  b: string,
  threshold: number = DEFAULT_NEAR_DUP_THRESHOLD,
): boolean {
  if (normalizeText(a) === normalizeText(b)) return true;
  return jaccardSimilarity(a, b) >= threshold;
}
