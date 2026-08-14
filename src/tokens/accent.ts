export type Theme = "light" | "dark";

/**
 * The colour maths behind the workspace accent, kept apart from the React hook
 * that consumes it.
 *
 * Not only for tidiness: these are the parts worth testing, and the test runner
 * strips types from .ts but cannot parse the JSX in a .tsx. Colour rules that
 * cannot be tested are how a default theme ships at 2.57:1.
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Keeps the hue the workspace chose, moves only what has to move.
 *
 * `accent` is used for text as well as fills, so an unconstrained pick — a
 * bright yellow on white, a navy on black — makes labels unreadable. Rather
 * than reject the colour, the lightness is clamped into a band that reads on
 * this theme, and saturation is floored so the result stays a colour rather
 * than a grey.
 */
export function adaptAccent(hex: string, theme: Theme): string {
  const { h, s, l } = hexToHsl(hex);
  const saturation = Math.min(1, Math.max(0.5, s));
  const lightness =
    theme === "light"
      ? Math.min(0.44, Math.max(0.3, l))
      : Math.min(0.72, Math.max(0.58, l));
  return hslToHex(h, saturation, lightness);
}


/**
 * Ink that survives whatever accent the workspace picked.
 *
 * `onAccent` was a fixed token per theme while `accent` is adapted per choice,
 * so the two could not agree: on the default light theme with the default
 * matcha the near-white token landed on mid-green at 2.57:1, and the near-black
 * literal in ui.tsx failed just as badly on cobalt, violet and indigo. Deriving
 * it from the adapted fill is the only version that holds for all nine.
 */
export function inkOn(hex: string): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const channel = (pair: string) => {
    const v = parseInt(pair, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(full.slice(0, 2)) +
    0.7152 * channel(full.slice(2, 4)) +
    0.0722 * channel(full.slice(4, 6));

  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  return contrastWithBlack >= contrastWithWhite ? "#10160b" : "#f7f8f2";
}
