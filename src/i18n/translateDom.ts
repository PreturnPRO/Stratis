import { TH } from "./th";

// Swapping the language rewrites the rendered DOM instead of threading a t()
// call through every component. Only whole text nodes (or whole phrases inside
// one element) that match a dictionary entry are replaced, so transcripts,
// names and other user data are never touched.
//
// Text node values are edited in place and nodes are never added or removed:
// replacing children is what breaks React's reconciliation.

const ATTRS = ["title", "aria-label", "placeholder", "alt"];
/** Nothing inside these is UI copy — but their own attributes (placeholder) are. */
const TEXT_SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE"]);

/**
 * Undo entries recorded while Thai is on, so switching back restores exactly
 * what React rendered. Each entry only fires if the value is still the one we
 * wrote — a later React render wins.
 * ponytail: grows for as long as Thai stays on; cleared on every switch back.
 * Bound it if a single session ever gets long enough for that to matter.
 */
let undo: Array<() => void> = [];

function setText(node: Node, value: string): void {
  const from = node.nodeValue ?? "";
  if (from === value) return;
  node.nodeValue = value;
  undo.push(() => {
    if (node.nodeValue === value) node.nodeValue = from;
  });
}

function setAttr(el: Element, attr: string, value: string): void {
  const from = el.getAttribute(attr) ?? "";
  if (from === value) return;
  el.setAttribute(attr, value);
  undo.push(() => {
    if (el.getAttribute(attr) === value) el.setAttribute(attr, from);
  });
}

/**
 * Exact match first, then the same string with every number replaced by {n} —
 * that is what covers "3 PROJECTS", "45 min", "18 of 60 min" and friends
 * without a dictionary entry per count.
 */
function translate(s: string): string | undefined {
  const exact = TH[s];
  if (exact !== undefined) return exact;
  const numbers: string[] = [];
  const pattern = s.replace(/\d+/g, (m) => {
    numbers.push(m);
    return "{n}";
  });
  if (!numbers.length) return undefined;
  const hit = TH[pattern];
  if (hit === undefined) return undefined;
  let i = 0;
  return hit.replace(/\{n\}/g, () => numbers[i++] ?? "");
}

/**
 * JSX splits `{count} meeting{s}` into several text nodes, so a phrase is
 * matched across all the text children of one element and written back into the
 * first node, blanking the rest.
 */
function translatePhrase(el: Element): void {
  const kids = el.childNodes;
  if (kids.length < 2) return;
  let joined = "";
  for (let i = 0; i < kids.length; i++) {
    if (kids[i].nodeType !== Node.TEXT_NODE) return;
    joined += kids[i].nodeValue ?? "";
  }
  const key = joined.replace(/\s+/g, " ").trim();
  if (!key) return;
  const hit = translate(key);
  if (hit === undefined) return;
  setText(kids[0], hit);
  for (let i = 1; i < kids.length; i++) setText(kids[i], "");
}

function translateText(node: Node): void {
  const raw = node.nodeValue;
  if (!raw) return;
  const trimmed = raw.trim();
  if (!trimmed) return;
  const hit = translate(trimmed) ?? translate(trimmed.replace(/\s+/g, " "));
  if (hit === undefined) return;
  setText(node, raw.replace(trimmed, hit));
}

/**
 * ponytail: walks the whole subtree on every batched mutation. Fine at this
 * app's DOM size; if a page ever gets huge, translate only the mutation
 * records' targets instead.
 */
export function translateTree(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      // FILTER_REJECT skips the whole subtree: editable regions hold user text,
      // and data-no-translate marks copy that stays English on purpose.
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.isContentEditable || el.hasAttribute("data-no-translate")) {
          return NodeFilter.FILTER_REJECT;
        }
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (parent && TEXT_SKIP_TAGS.has(parent.tagName)) return;
      translateText(node);
      return;
    }
    const el = node as Element;
    for (const attr of ATTRS) {
      const raw = el.getAttribute(attr);
      if (!raw) continue;
      const hit = translate(raw.trim());
      if (hit !== undefined) setAttr(el, attr, hit);
    }
    if (!TEXT_SKIP_TAGS.has(el.tagName)) translatePhrase(el);
  };

  // The root itself is not visited by the walker.
  visit(root);
  let node = walker.nextNode();
  while (node) {
    visit(node);
    node = walker.nextNode();
  }
}

/**
 * Translates the live DOM to Thai and keeps it translated as React re-renders.
 * Returns a teardown that stops observing and puts the DOM back to English.
 */
export function startDomTranslation(): () => void {
  // A timer, not requestAnimationFrame: rAF is paused while the tab is in the
  // background, which would leave a re-render sitting in English until the user
  // came back to the tab.
  let queued = 0;
  const flush = () => {
    queued = 0;
    // Stays connected while translating: disconnecting would drop anything
    // React renders during the pass. Our own edits trigger one more pass that
    // finds nothing left to translate, so this settles instead of looping.
    translateTree(document.body);
  };
  const observer = new MutationObserver(() => {
    if (!queued) queued = window.setTimeout(flush, 0);
  });

  translateTree(document.body);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });

  return () => {
    if (queued) clearTimeout(queued);
    observer.disconnect();
    for (let i = undo.length - 1; i >= 0; i--) undo[i]();
    undo = [];
  };
}
