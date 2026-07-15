import { useEffect, useState } from 'react'
import { Zap, ChevronDown } from 'lucide-react'
import { COLORS, FONT, LETTER_SPACING, SHADOW, SPACE } from '../tokens/colors'
import { Button } from '../components/ui'

interface Props {
  onNavigate: (page: 'login' | 'register') => void
}

// ── Demo content (a scripted "live meeting") ─────────────────────────────────
const TRANSCRIPT = [
  { who: 'Sarah K.', color: '#e0533f', text: 'We missed Q2 by 12% — root cause looks like enterprise pricing.' },
  { who: 'Mike R.', color: '#2ab0d4', text: 'Agreed, but the sales cycle lengthened too.' },
  { who: 'Alex T.', color: '#1fae8a', text: '8 of 12 churned customers cited pricing. That’s signal.' },
]

const CARDS = [
  { tag: 'QUESTION', color: COLORS.accent, q: 'Who owns the pricing decision before next meeting?', r: 'Discussed, but no owner was named.' },
  { tag: 'ASSUMPTION', color: COLORS.teal, q: 'Has anyone validated SMB accepts metered billing?', r: 'A core assumption no one has tested.' },
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

export default function Landing({ onNavigate }: Props) {
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

  return (
    <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', background: COLORS.bg }}>
      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section
        className="landing-hero"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
      >
        <div className="landing-grid" />
        <div className="landing-glow" />
        <div className="landing-fade" />

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            textAlign: 'center',
            maxWidth: 720,
            padding: '0 32px',
            marginTop: '-6vh', // sit slightly high so the demo can peek at the bottom
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              color: COLORS.accent,
              fontSize: FONT.size.label,
              letterSpacing: 2.5,
              fontWeight: 600,
              marginBottom: SPACE[6],
            }}
          >
            <Zap size={15} strokeWidth={2.2} />
            STRATIS
          </div>

          <h1
            style={{
              color: COLORS.textPrimary,
              fontSize: 'clamp(34px, 5.2vw, 56px)',
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -1,
              margin: '0 0 20px',
            }}
          >
            The AI co-facilitator for teams that{' '}
            <span style={{ color: COLORS.accent }}>build things that matter</span>
          </h1>

          <p
            style={{
              color: COLORS.textMuted,
              fontSize: 'clamp(15px, 1.8vw, 18px)',
              lineHeight: 1.7,
              margin: '0 auto 34px',
              maxWidth: 560,
            }}
          >
            Stratis listens to your meeting and builds the reasoning record your team
            never has time to write.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Button variant="primary" size="md" style={{ padding: '11px 26px', fontSize: FONT.size.body }} onClick={() => onNavigate('register')}>
              Get started
            </Button>
            <Button variant="ghost" size="md" style={{ padding: '11px 26px', fontSize: FONT.size.body }} onClick={() => onNavigate('login')}>
              Sign in
            </Button>
          </div>
        </div>

        {/* Scroll cue */}
        <div
          className="scroll-cue"
          style={{
            position: 'absolute',
            bottom: '15vh',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            color: COLORS.textMuted,
            fontSize: FONT.size.caption,
            letterSpacing: LETTER_SPACING.wide,
          }}
        >
          See it live
          <ChevronDown size={18} strokeWidth={2} />
        </div>
      </section>

      {/* ── DEMO (peeks ~10% above the fold, full on scroll) ───────────────── */}
      <section
        style={{
          position: 'relative',
          zIndex: 3,
          marginTop: '-120px',
          padding: '0 24px 110px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <MeetingDemo
          linesVisible={linesVisible}
          card0Visible={card0Visible}
          card1Visible={card1Visible}
          card0Answered={card0Answered}
        />
        <p style={{ color: COLORS.textMuted, fontSize: FONT.size.body, marginTop: SPACE[6], textAlign: 'center', maxWidth: 520, lineHeight: 1.6 }}>
          As the conversation unfolds, Stratis surfaces the question nobody thought to
          ask — privately, to the facilitator — and marks it answered when the room
          gets there.
        </p>
      </section>
    </div>
  )
}

// ── The framed live-meeting mock ─────────────────────────────────────────────

function MeetingDemo({
  linesVisible, card0Visible, card1Visible, card0Answered,
}: {
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
        background: COLORS.surface,
        border: `1px solid ${COLORS.borderLight}`,
        borderRadius: 14,
        boxShadow: SHADOW.hero,
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
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.surfaceMuted,
        }}
      >
        <span aria-hidden="true" style={{ display: 'inline-flex', gap: 8 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: COLORS.red }} />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: COLORS.accent }} />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: COLORS.green }} />
        </span>
        <span style={{ marginLeft: 2, color: COLORS.textMuted, fontSize: FONT.size.label, fontWeight: 500 }}>
          Stratis — Live meeting
        </span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, color: COLORS.red, fontSize: FONT.size.caption, fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: COLORS.red }} />
          REC
        </span>
      </div>

      {/* body: transcript + floating suggestion stack */}
      <div style={{ position: 'relative', height: 320, padding: 20 }}>
        <div style={{ color: COLORS.textMuted, fontSize: FONT.size.caption, fontWeight: 600, letterSpacing: LETTER_SPACING.label, marginBottom: SPACE[4] }}>
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
                <div style={{ color: COLORS.textMuted, fontSize: FONT.size.body, lineHeight: 1.55 }}>
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
          {card1Visible && <DemoCard card={CARDS[1]} answered={false} />}
          {card0Visible && <DemoCard card={CARDS[0]} answered={card0Answered} />}
        </div>
      </div>
    </div>
  )
}

function DemoCard({
  card, answered,
}: {
  card: { tag: string; color: string; q: string; r: string }
  answered: boolean
}) {
  return (
    <div
      style={{
        background: COLORS.surfaceElevated,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: '10px 12px',
        boxShadow: SHADOW.float,
        animation: 'cardIn 0.32s ease',
        opacity: answered ? 0.7 : 1,
        transition: 'opacity 0.4s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: SPACE[1.5] }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: card.color }} />
        <span style={{ color: card.color, fontSize: FONT.size.micro, fontWeight: 700, letterSpacing: LETTER_SPACING.wide }}>
          {card.tag}
        </span>
      </div>

      <div style={{ position: 'relative', display: 'inline-block' }}>
        <span style={{ color: answered ? COLORS.textMuted : COLORS.textPrimary, fontSize: FONT.size.body, fontWeight: 600, lineHeight: 1.4 }}>
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
            background: COLORS.textMuted,
            transform: `scaleX(${answered ? 1 : 0})`,
            transformOrigin: 'left',
            transition: 'transform 0.4s ease',
          }}
        />
      </div>

      {!answered && (
        <div style={{ color: COLORS.textMuted, fontSize: FONT.size.label, lineHeight: 1.4, marginTop: 4 }}>
          {card.r}
        </div>
      )}
    </div>
  )
}