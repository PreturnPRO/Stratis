/**
 * The locale tag every date and time in the app formats against.
 *
 * The UI translates to Thai but every date stayed English — "Aug 9, 03:13 PM"
 * under a Thai heading — because each formatter passed `undefined` and got the
 * browser's locale, which for a Thai team on a laptop bought anywhere is
 * usually en-US.
 *
 * Read from `document.documentElement.lang`, which `useLang` already sets, so
 * this needs no context and cannot drift from the language actually showing.
 * Buddhist-era years are deliberately not requested: th-TH formats with them by
 * default via `th-TH-u-ca-buddhist` only when asked, and B.E. dates next to a
 * meeting someone booked in Gregorian would be its own bug.
 */
export function localeTag(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.documentElement.lang === "th" ? "th-TH" : undefined;
}
