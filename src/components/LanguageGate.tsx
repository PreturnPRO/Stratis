import { FONT, LETTER_SPACING, RADIUS, SPACE } from "../constants";
import { useTheme } from "../hooks/useTheme";
import { useLang, type Lang } from "../hooks/useLang";

/**
 * The first thing a new visitor sees.
 *
 * Stratis is built in and for Chiang Mai, and Thai is the language most of its
 * meetings happen in — but the app opened in English and left ไทย to be
 * discovered in a menu afterwards. That is the wrong way round: a Thai team's
 * first impression should not be a translation they had to go looking for.
 *
 * Shown once, only when no preference has ever been stored. Both options are
 * given equal weight — there is no "default" being nudged.
 */
export default function LanguageGate() {
  const { colors } = useTheme();
  const { setLang } = useLang();

  const options: Array<{ code: Lang; label: string; sub: string }> = [
    { code: "th", label: "ไทย", sub: "ใช้งาน Stratis เป็นภาษาไทย" },
    { code: "en", label: "English", sub: "Use Stratis in English" },
  ];

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.bg,
        color: colors.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: SPACE[3],
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div
          style={{
            fontSize: FONT.size.caption,
            letterSpacing: LETTER_SPACING.eyebrow,
            textTransform: "uppercase",
            color: colors.accent,
            fontWeight: FONT.weight.bold,
            marginBottom: SPACE[1],
          }}
        >
          Stratis
        </div>

        <h1 style={{ fontSize: FONT.size.title, margin: `0 0 ${SPACE[1]}px`, fontWeight: 500 }}>
          เลือกภาษา / Choose your language
        </h1>
        <p style={{ margin: `0 0 ${SPACE[3]}px`, color: colors.textMuted, fontSize: FONT.size.body }}>
          เปลี่ยนได้ทีหลังในหน้าตั้งค่า · You can change this later in Settings.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1.5] }}>
          {options.map((option) => (
            <button
              key={option.code}
              type="button"
              onClick={() => setLang(option.code)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "16px 18px",
                borderRadius: RADIUS.md,
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text,
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: FONT.size.subheading, fontWeight: 500 }}>{option.label}</div>
              <div style={{ fontSize: FONT.size.label, color: colors.textMuted, marginTop: 2 }}>
                {option.sub}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
