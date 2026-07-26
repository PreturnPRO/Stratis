// Explicit .ts extension: this module is covered by `node --test`, which type-
// strips rather than resolving like a bundler. tsconfig sets
// allowImportingTsExtensions, so tsc accepts it too.
import { isNearDuplicate, normalizeText } from "./textSimilarity.ts";

/**
 * Rolling memory is a living document, not an append log.
 *
 * The model is asked to merge each update into the previous memory and keep it
 * tight. Models drift from that: they re-list points already recorded in
 * slightly different words, so the memory grows, the same fact appears three
 * ways, and every later prompt carries the bloat — the live-card call, the
 * decision extract, and the document patch all read it. Repetition inside it
 * also teaches the model that repeating is expected, which compounds.
 *
 * So the prompt asks, and this enforces: near-duplicate bullets collapse and
 * the list is capped. Near-duplicate detection is the Thai-aware matcher used
 * for the suggestion stack, so this works in the product's primary market.
 */

/** Beyond this the memory is costing more context than it carries. */
export const MAX_BULLETS_PER_SECTION = 8;
export const MAX_TOTAL_BULLETS = 12;

/** A rewrite this similar to what we already have is not worth a write. */
const MEMORY_CHURN_THRESHOLD = 0.92;

/**
 * Lower than the suggestion stack's 0.6, because a restated bullet is not a
 * restated question. Measured on real phrasings: "We ship the beta on Friday"
 * vs "The beta ships on Friday" scores 0.50, "Mai owns the migration" vs
 * "Migration is owned by Mai" 0.50, the Thai equivalents 0.52 — all under 0.6,
 * so the stack's threshold let every one of them through. Genuinely different
 * points from the same meeting score at or below 0.17, so 0.45 sits in open
 * space between the two bands.
 *
 * The asymmetry is deliberate: merging two distinct cards hides a question the
 * facilitator never sees, while merging two bullets that say the same thing is
 * the entire purpose of this file.
 */
const MEMORY_DUP_THRESHOLD = 0.45;

interface Section {
  heading: string;
  lead: string[];
  bullets: string[];
}

function isBullet(line: string): boolean {
  return /^[-*]\s+/.test(line.trim());
}

function bulletText(line: string): string {
  return line.trim().replace(/^[-*]\s+/, "");
}

function parseSections(markdown: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    if (/^#{1,6}\s/.test(line.trim())) {
      current = { heading: line.trim(), lead: [], bullets: [] };
      sections.push(current);
      continue;
    }
    if (!line.trim()) continue;
    if (!current) {
      current = { heading: "", lead: [], bullets: [] };
      sections.push(current);
    }
    if (isBullet(line)) current.bullets.push(bulletText(line));
    else current.lead.push(line.trim());
  }

  return sections;
}

/**
 * Collapse near-duplicate bullets and cap the list. First mention wins: the
 * earliest phrasing is the one the room actually used, and later restatements
 * are what we are trying to remove.
 */
export function dedupeMemory(markdown: string): string {
  const sections = parseSections(markdown);
  if (sections.length === 0) return markdown.trim();

  const kept: string[] = [];
  let total = 0;

  const out: string[] = [];
  for (const section of sections) {
    const bullets: string[] = [];
    for (const bullet of section.bullets) {
      if (total >= MAX_TOTAL_BULLETS) break;
      if (bullets.length >= MAX_BULLETS_PER_SECTION) break;
      if (kept.some((seen) => isNearDuplicate(bullet, seen, MEMORY_DUP_THRESHOLD))) continue;
      kept.push(bullet);
      bullets.push(bullet);
      total += 1;
    }

    // A heading whose bullets all collapsed carries nothing.
    if (section.heading && bullets.length === 0 && section.lead.length === 0) continue;

    if (section.heading) out.push(section.heading);
    for (const lead of section.lead) out.push(lead);
    for (const bullet of bullets) out.push(`- ${bullet}`);
    out.push("");
  }

  return out.join("\n").trim();
}

/**
 * Whether an update earns a write. Rejects empties and rewrites that say what
 * the current memory already says — those produce a DB write and a notes push
 * to every client for no new information.
 */
export function shouldReplaceMemory(
  previous: string | null | undefined,
  next: string,
): boolean {
  const clean = next.trim();
  if (!clean) return false;
  if (!previous?.trim()) return true;
  if (normalizeText(previous) === normalizeText(clean)) return false;
  return !isNearDuplicate(previous, clean, MEMORY_CHURN_THRESHOLD);
}
