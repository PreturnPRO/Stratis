import { test } from "node:test";
import assert from "node:assert/strict";
import { adaptAccent, inkOn } from "../tokens/accent.ts";

/**
 * Every accent, in both themes, must carry readable ink on a primary button.
 *
 * The two halves disagreed: `accent` is adapted to the theme per workspace
 * choice, while the ink was a fixed token in one place (`colors.onAccent`) and
 * a hardcoded near-black in another (`ui.tsx`). Out of the box — light theme,
 * matcha — the near-white token sat on mid-green at 2.57:1. The near-black
 * literal failed just as badly the other way, at 1.78:1 on indigo.
 *
 * 4.5:1 is the AA floor for the 13px text these buttons use.
 */

const ACCENT_SOURCES = [
  "#8FAE6D", // matcha, the default
  "#7F77DD", // violet
  "#D4537E", // magenta
  "#D85A30", // coral
  "#5B4BE0", // indigo
  "#0B63CE", // cobalt
  "#D69412", // amber
  "#12A594", // teal
  "#B3421F", // a custom pick, to prove it is not a lookup table
];

function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const channel = (pair: string) => {
    const v = parseInt(pair, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(clean.slice(0, 2)) +
    0.7152 * channel(clean.slice(2, 4)) +
    0.0722 * channel(clean.slice(4, 6))
  );
}

function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

test("primary button ink clears 4.5:1 on every accent, both themes", () => {
  const failures: string[] = [];

  for (const source of ACCENT_SOURCES) {
    for (const theme of ["light", "dark"] as const) {
      const fill = adaptAccent(source, theme);
      const ratio = contrast(fill, inkOn(fill));
      if (ratio < 4.5) {
        failures.push(`${source} (${theme}) → fill ${fill}, ink ${inkOn(fill)}: ${ratio.toFixed(2)}:1`);
      }
    }
  }

  assert.deepEqual(failures, [], `accents below the AA floor:\n${failures.join("\n")}`);
});

test("the check would catch the bug it was written for", () => {
  // Light matcha with the old fixed token: the case that shipped.
  const fill = adaptAccent("#8FAE6D", "light");
  assert.ok(contrast(fill, "#f7f8f2") < 4.5, "old onAccent token should fail here");
  assert.ok(contrast(fill, inkOn(fill)) >= 4.5, "derived ink should pass");
});
