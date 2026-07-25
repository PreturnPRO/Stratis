import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Zap, ChevronDown, Sun, Moon } from 'lucide-react'
import { FONT, LETTER_SPACING, RADIUS, SPACE } from '../tokens/colors'
import { Button } from '../components/ui'
import { useTheme } from '../hooks/useTheme'
import AmbientBackground from '../components/AmbientBackground'

type Colors = ReturnType<typeof useTheme>['colors']
type Shadow = ReturnType<typeof useTheme>['shadow']

interface Props {
  onNavigate: (page: 'login' | 'register') => void
}

// ── Demo content (a scripted "live meeting") ─────────────────────────────────
const TRANSCRIPT = [
  { who: 'Sarah K.', color: '#e0533f', text: 'We missed Q2 by 12% — root cause looks like enterprise pricing.' },
  { who: 'Mike R.', color: '#2ab0d4', text: 'Agreed, but the sales cycle lengthened too.' },
  { who: 'Alex T.', color: '#1fae8a', text: '8 of 12 churned customers cited pricing. That’s signal.' },
]

// colorKey indexes into the themed `colors` object at render time, rather than
// baking in a static hex, so the demo card accents follow the active theme.
const CARDS: { tag: string; colorKey: 'accent' | 'teal'; q: string; r: string }[] = [
  { tag: 'QUESTION', colorKey: 'accent', q: 'Who owns the pricing decision before next meeting?', r: 'Discussed, but no owner was named.' },
  { tag: 'ASSUMPTION', colorKey: 'teal', q: 'Has anyone validated SMB accepts metered billing?', r: 'A core assumption no one has tested.' },
]

// Marquee phrases — 4 are directly legible in the handoff screenshot; the 5th
// ("Flags u...") is completed as "Flags drift" per the existing DRIFT_ALERT
// vocabulary in SuggestionCardStack.tsx.
const MARQUEE_ITEMS = [
  'Listens live',
  'Suggests privately',
  'Updates the PM doc',
  'Remembers every decision',
  'Flags drift',
]

const HOW_IT_WORKS = [
  { n: '01', title: 'Listen', body: 'Stratis joins your meeting and captures the live transcript — every speaker, every claim, in real time.' },
  { n: '02', title: 'Suggest', body: 'Facilitator-only cards surface the question nobody thought to ask, flag untested assumptions, and mark them answered when the room gets there.' },
  { n: '03', title: 'Record', body: 'Afterward, Stratis writes the participant summary and proposes changes to the living PM document — decisions, assumptions, risks.' },
]

// Step timeline (loops): 0 reset · 1 line0 · 2 line1 · 3 card0 · 4 line2 · 5 card1 · 6 card0 answered · 7 hold
const STEP_COUNT = 8
const STEP_MS = 1700
// The "settled" end state — everything shown, first card answered. Used as a
// static frame for prefers-reduced-motion so the demo still reads correctly
// without the endless auto-playing loop (WCAG 2.2.2: auto-updating content
// that runs longer than 5s needs a way to stop it).
const SETTLED_STEP = STEP_COUNT - 1

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

// Per-word blur-to-sharp reveal, staggered — trionn.com's load-in reference.
// prefers-reduced-motion: skip the animation and render the settled end state.
function wordRevealStyle(index: number, reducedMotion: boolean): CSSProperties {
  return {
    display: 'inline-block',
    animation: reducedMotion ? undefined : `wordReveal 0.6s ease ${index * 0.08}s both`,
  }
}

function LiveLatency() {
  const [ms, setMs] = useState(0.4);

  useEffect(() => {
    const t = setInterval(() => setMs(0.28 + Math.random() * 0.35), 400);
    return () => clearInterval(t);
  }, []);

  return <span>LATENCY {ms.toFixed(2)}s</span>;
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function Landing({ onNavigate }: Props) {
  const { theme, toggleTheme, colors, shadow } = useTheme()
  const reducedMotion = usePrefersReducedMotion()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (reducedMotion) return
    const t = setInterval(() => setStep((s) => (s + 1) % STEP_COUNT), STEP_MS)
    return () => clearInterval(t)
  }, [reducedMotion])

  const effectiveStep = reducedMotion ? SETTLED_STEP : step
  const linesVisible = effectiveStep >= 4 ? 3 : effectiveStep >= 2 ? 2 : effectiveStep >= 1 ? 1 : 0
  const card0Visible = effectiveStep >= 3
  const card1Visible = effectiveStep >= 5
  const card0Answered = effectiveStep >= 6
  const [pastHero, setPastHero] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const heroTextRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reducedMotion) return
    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2
      const ny = (e.clientY / window.innerHeight - 0.5) * 2
      heroTextRef.current?.style.setProperty('transform', `translate(${nx * 1.4}px, ${ny * 1}px)`)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [reducedMotion])

  useEffect(() => {
    const root = scrollRef.current
    const target = document.getElementById('how-it-works')
    if (!root || !target) return
    const observer = new IntersectionObserver(
      ([entry]) => setPastHero(entry.isIntersecting),
      { root, threshold: 0 }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={scrollRef}
      style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', background: colors.bg }}
    >
      {/* ── NAV ────────────────────────────────────────────────────────────── */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 32px',
          borderBottom: `1px solid ${colors.border}`,
          background: colors.bg,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            color: colors.accent,
            fontSize: FONT.size.label,
            letterSpacing: LETTER_SPACING.eyebrow,
            fontWeight: FONT.weight.bold,
          }}
        >
          <Zap size={15} strokeWidth={2.2} />
          STRATIS
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <button
            onClick={() => scrollToId('how-it-works')}
            style={navLinkStyle(colors)}
          >
            How it works
          </button>
          <button
            onClick={() => scrollToId('live-demo')}
            style={navLinkStyle(colors)}
          >
            See it live
          </button>
          <button
            onClick={() => onNavigate('login')}
            style={navLinkStyle(colors)}
          >
            Sign in
          </button>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title="Toggle theme"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: RADIUS.sm,
              background: 'transparent',
              border: 'none',
              color: colors.textMuted,
              cursor: 'pointer',
            }}
          >
            {theme === 'dark' ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
          </button>
          <div data-magnet style={{ display: 'inline-block' }}>
            <Button variant="primary" size="sm" onClick={() => onNavigate('register')}>
              Get started
            </Button>
          </div>
        </div>
      </nav>

      {/* ── HERO (1c Kinetic mono) ───────────────────────────────────────────── */}
      <section
        className="landing-hero"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: colors.bg }}
      >
        <AmbientBackground theme={theme} constellation reducedMotion={reducedMotion} />

        <div
          ref={heroTextRef}
          style={{
            position: 'relative',
            zIndex: 2,
            textAlign: 'left',
            width: '100%',
            maxWidth: 900,
            padding: '0 32px',
            marginTop: '-6vh', // sit slightly high so the demo can peek at the bottom
            transition: 'transform 0.6s ease-out',
          }}
        >
          {/* column hairlines — decorative, loosely evoke a 3-col grid */}
          <div aria-hidden style={{ position: 'absolute', left: '50%', top: -40, bottom: -40, width: 1, background: colors.border }} />
          <div aria-hidden style={{ position: 'absolute', left: '100%', top: -40, bottom: -40, width: 1, background: colors.border }} />

          {/* HUD readout row — coordinate readouts moved into the
              constellation itself (multiple, tied to real point positions,
              placed clear of this text column) rather than one static value here. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              color: colors.textDim,
              fontFamily: FONT.mono,
              fontSize: FONT.size.caption,
              letterSpacing: LETTER_SPACING.wide,
              marginBottom: SPACE[6],
            }}
          >
            <span>SYS.01 - INTRODUCTION</span>
            <span style={{ width: 1, height: 10, background: colors.border }} />
            <LiveLatency />
            <span style={{ width: 1, height: 10, background: colors.border }} />
            <span>STRATIS : ONLINE</span>
          </div>

          <h1
            style={{
              color: colors.text,
              fontSize: 'clamp(34px, 5.2vw, 56px)',
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -1,
              margin: '0 0 20px',
            }}
          >
            {['The', 'meeting', 'ran', 'by', 'you,'].map((w, i) => (
              <span key={i} style={wordRevealStyle(i, reducedMotion)}>
                {w}{i < 4 ? ' ' : ''}
              </span>
            ))}
            <br />
            {['written', 'for'].map((w, i) => (
              <span key={i} style={{ ...wordRevealStyle(i + 5, reducedMotion), color: colors.textDim }}>
                {w}{' '}
              </span>
            ))}
            <span
              style={{
                ...wordRevealStyle(7, reducedMotion),
                color: colors.accent,
                animation: reducedMotion
                  ? wordRevealStyle(7, reducedMotion).animation
                  : `${wordRevealStyle(7, reducedMotion).animation}, itselfPulse 4s ease-in-out 2.4s infinite`,
              }}
            >
              you.
            </span>
          </h1>

          <p
            style={{
              color: colors.textMuted,
              fontSize: 'clamp(15px, 1.8vw, 18px)',
              lineHeight: 1.7,
              margin: '0 0 34px',
              maxWidth: 560,
            }}
          >
            Just like every other meeting, except no one leaves on a misunderstanding ever again.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-start' }}>
            <div data-magnet style={{ display: 'inline-block' }}>
              <Button variant="primary" size="md" style={{ padding: '11px 26px', fontSize: FONT.size.body, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide }} onClick={() => onNavigate('register')}>
                Get started →
              </Button>
            </div>
            <div data-magnet style={{ display: 'inline-block' }}>
              <Button variant="ghost" size="md" style={{ padding: '11px 26px', fontSize: FONT.size.body, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide }} onClick={() => onNavigate('login')}>
                Sign in
              </Button>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div
          className={pastHero ? undefined : "scroll-cue"}
          style={{
            position: 'fixed',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            color: colors.textMuted,
            fontSize: FONT.size.caption,
            letterSpacing: LETTER_SPACING.wide,
            opacity: pastHero ? 0 : 1,
            pointerEvents: pastHero ? 'none' : 'auto',
            transition: 'opacity 0.3s ease',
          }}
        >
          See it live
          <ChevronDown size={18} strokeWidth={2} />
        </div>
      </section>

      {/* ── MARQUEE (overlaps the hero's bottom edge) ───────────────────────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 4,
          marginTop: -28,
          overflow: 'hidden',
          borderTop: `1px solid ${colors.border}`,
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
          padding: '14px 0',
        }}
      >
        <div className="landing-marquee-track">
          {[0, 1, 2].map((dup) => (
            <div key={dup} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {MARQUEE_ITEMS.map((phrase, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 24,
                    color: colors.textMuted,
                    fontSize: FONT.size.subheading,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    padding: '0 24px',
                  }}
                >
                  {phrase}
                  <span style={{ color: colors.accent }} aria-hidden="true">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── DEMO (peeks ~10% above the fold, full on scroll) ───────────────── */}
      <section
        id="live-demo"
        style={{
          position: 'relative',
          zIndex: 3,
          padding: '90px 24px 110px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <MeetingDemo
          colors={colors}
          shadow={shadow}
          linesVisible={linesVisible}
          card0Visible={card0Visible}
          card1Visible={card1Visible}
          card0Answered={card0Answered}
        />
        <p style={{ color: colors.textMuted, fontSize: FONT.size.body, marginTop: SPACE[6], textAlign: 'center', maxWidth: 520, lineHeight: 1.6 }}>
          As the conversation unfolds, Stratis surfaces the question nobody thought to
          ask — privately, to the facilitator — and marks it answered when the room
          gets there.
        </p>
      </section>

      {/* ── HOW STRATIS WORKS ────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: '40px 32px 110px', maxWidth: 1040, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 40 }}>
          <h2 style={{ color: colors.text, fontSize: FONT.size.title, fontWeight: 700, margin: 0 }}>
            How Stratis works
          </h2>
          <span style={{ color: colors.textDim, fontFamily: FONT.mono, fontSize: FONT.size.caption, letterSpacing: LETTER_SPACING.wide }}>
            01 — 03
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {HOW_IT_WORKS.map((col, i) => (
            <div
              key={col.n}
              style={{
                padding: '0 28px',
                borderRight: i < HOW_IT_WORKS.length - 1 ? `1px solid ${colors.border}` : 'none',
              }}
            >
              <div style={{ color: colors.accent, fontFamily: FONT.mono, fontSize: FONT.size.body, fontWeight: 700, marginBottom: SPACE[3] }}>
                {col.n}
              </div>
              <div style={{ color: colors.text, fontSize: FONT.size.subheading, fontWeight: 700, marginBottom: SPACE[2] }}>
                {col.title}
              </div>
              <p style={{ color: colors.textMuted, fontSize: FONT.size.body, lineHeight: 1.6, margin: 0 }}>
                {col.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER CTA ───────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: '70px 32px',
          textAlign: 'center',
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <h2 style={{ color: colors.text, fontSize: FONT.size.heading, fontWeight: 700, margin: '0 0 22px' }}>
          Ready to see it in your next meeting?
        </h2>
        <div data-magnet style={{ display: 'inline-block' }}>
          <Button variant="primary" size="md" style={{ padding: '11px 26px', fontSize: FONT.size.body }} onClick={() => onNavigate('register')}>
            Get started
          </Button>
        </div>
      </section>
    </div>
  )
}

function navLinkStyle(colors: Colors) {
  return {
    background: 'transparent',
    border: 'none',
    padding: 0,
    font: 'inherit',
    color: colors.textMuted,
    fontSize: FONT.size.body,
    cursor: 'pointer',
  } as const
}

// ── The framed live-meeting mock ─────────────────────────────────────────────

function MeetingDemo({
  colors, shadow, linesVisible, card0Visible, card1Visible, card0Answered,
}: {
  colors: Colors
  shadow: Shadow
  linesVisible: number
  card0Visible: boolean
  card1Visible: boolean
  card0Answered: boolean
}) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 760,
        background: colors.surface,
        border: `1px solid ${colors.borderLight}`,
        borderRadius: 14,
        boxShadow: shadow.hero,
        overflow: 'hidden',
      }}
    >
      {/* title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 16px',
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surfaceMuted,
        }}
      >
        <span aria-hidden="true" style={{ display: 'inline-flex', gap: 8 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: colors.red }} />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: colors.accent }} />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: colors.green }} />
        </span>
        <span style={{ marginLeft: 2, color: colors.textMuted, fontSize: FONT.size.label, fontWeight: 500 }}>
          Stratis — Live meeting
        </span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, color: colors.red, fontSize: FONT.size.caption, fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: colors.red }} />
          REC
        </span>
      </div>

      {/* body: transcript + floating suggestion stack */}
      <div style={{ position: 'relative', height: 320, padding: 20 }}>
        <div style={{ color: colors.textMuted, fontSize: FONT.size.caption, fontWeight: 600, letterSpacing: LETTER_SPACING.label, marginBottom: SPACE[4] }}>
          TRANSCRIPT
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {TRANSCRIPT.map((line, i) => {
            const shown = i < linesVisible
            return (
              <div
                key={i}
                style={{
                  opacity: shown ? 1 : 0,
                  transform: shown ? 'translateY(0)' : 'translateY(8px)',
                  transition: 'opacity 0.45s ease, transform 0.45s ease',
                  maxWidth: 440,
                }}
              >
                <div style={{ color: line.color, fontSize: FONT.size.label, fontWeight: 600, marginBottom: 3 }}>
                  {line.who}
                </div>
                <div style={{ color: colors.textMuted, fontSize: FONT.size.body, lineHeight: 1.55 }}>
                  {line.text}
                </div>
              </div>
            )
          })}
        </div>

        {/* floating facilitator-only suggestion stack (bottom-right) */}
        <div
          style={{
            position: 'absolute',
            right: 18,
            bottom: 18,
            width: 244,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {card1Visible && <DemoCard colors={colors} shadow={shadow} card={CARDS[1]} answered={false} />}
          {card0Visible && <DemoCard colors={colors} shadow={shadow} card={CARDS[0]} answered={card0Answered} />}
        </div>
      </div>
    </div>
  )
}

function DemoCard({
  colors, shadow, card, answered,
}: {
  colors: Colors
  shadow: Shadow
  card: { tag: string; colorKey: 'accent' | 'teal'; q: string; r: string }
  answered: boolean
}) {
  const tagColor = colors[card.colorKey]
  return (
    <div
      style={{
        background: colors.surfaceElevated,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        padding: '10px 12px',
        boxShadow: shadow.float,
        animation: 'cardIn 0.32s ease',
        opacity: answered ? 0.7 : 1,
        transition: 'opacity 0.4s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: SPACE[1.5] }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: tagColor }} />
        <span style={{ color: tagColor, fontSize: FONT.size.micro, fontWeight: 700, letterSpacing: LETTER_SPACING.wide }}>
          {card.tag}
        </span>
      </div>

      <div style={{ position: 'relative', display: 'inline-block' }}>
        <span style={{ color: answered ? colors.textMuted : colors.text, fontSize: FONT.size.body, fontWeight: 600, lineHeight: 1.4 }}>
          {card.q}
        </span>
        {/* animated strike line — transform, not width, to avoid layout thrash */}
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            width: '100%',
            height: 1,
            background: colors.textMuted,
            transform: `scaleX(${answered ? 1 : 0})`,
            transformOrigin: 'left',
            transition: 'transform 0.4s ease',
          }}
        />
      </div>

      {!answered && (
        <div style={{ color: colors.textMuted, fontSize: FONT.size.label, lineHeight: 1.4, marginTop: 4 }}>
          {card.r}
        </div>
      )}
    </div>
  )
}
