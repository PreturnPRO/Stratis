import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Zap, ChevronDown, Sun, Moon, Languages } from 'lucide-react'
import { FONT, LETTER_SPACING, RADIUS, SPACE } from '../tokens/colors'
import { Button } from '../components/ui'
import { useTheme } from '../hooks/useTheme'
import { useLang, OTHER_LANG_LABEL } from '../hooks/useLang'
import AmbientBackground from '../components/AmbientBackground'

type Colors = ReturnType<typeof useTheme>['colors']
type Shadow = ReturnType<typeof useTheme>['shadow']

interface Props {
  onNavigate: (page: 'login' | 'register') => void
}

const TRANSCRIPT = [
  { who: 'Sarah K.', color: '#e0533f', text: 'We missed Q2 by 12% — root cause looks like enterprise pricing.' },
  { who: 'Mike R.', color: '#2ab0d4', text: 'Agreed, but the sales cycle lengthened too.' },
  { who: 'Alex T.', color: '#1fae8a', text: '8 of 12 churned customers cited pricing. That’s signal.' },
]

const CARDS: { tag: string; colorKey: 'accent' | 'teal'; q: string; r: string }[] = [
  { tag: 'QUESTION', colorKey: 'accent', q: 'Who owns the pricing decision before next meeting?', r: 'Discussed, but no owner was named.' },
  { tag: 'ASSUMPTION', colorKey: 'teal', q: 'Has anyone validated SMB accepts metered billing?', r: 'A core assumption no one has tested.' },
]

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

const TEAM: {
  name: string
  role: string
  email: string
  tel: string
  photo: string
  photoZoom: number
  photoPos: string
  /** LINE QR, served from public/. Omitted until that person sends theirs. */
  lineQr?: string
  /** Per-person QR size: the source images carry different quiet-zone margins,
      so a single number renders the codes at visibly different scales. */
  lineQrSize?: number
}[] = [
  { name: 'Naphat Nirunsitirut', role: 'Interface Designer', email: 'KaifyProduction@gmail.com', tel: '+66 98 101 3409', photo: 'https://i.ibb.co/9mvscLW2/image-1.jpg', photoZoom: 1.5, photoPos: '32.5% 25%' , lineQr: '/line-naphat.jpg' },
  { name: 'Thananarin Saisornthananant', role: 'Software Architect', email: 's.thananarin@gmail.com', tel: '+66 64 478 8545', photo: 'https://i.ibb.co/279tD5s4/FB-IMG-1783759688169.jpg', photoZoom: 1.5, photoPos: '55% 45%' , lineQr: '/line-thananarin.jpg' , lineQrSize: 78 },
  { name: 'Phuwich Khamteja', role: 'Project Lead', email: 'subphuwich@gmail.com', tel: '+66 62 875 6868', photo: 'https://i.ibb.co/DP8FSnzS/fqs-2569-01-14-144852-111.jpg', photoZoom: 2, photoPos: '75% 45%' , lineQr: '/line-phuwich.jpg' , lineQrSize: 78 },
]

const STEP_COUNT = 8
const STEP_MS = 1700
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

function wordRevealStyle(index: number, reducedMotion: boolean): CSSProperties {
  return {
    display: 'inline-block',
    animation: reducedMotion ? undefined : `wordReveal 0.6s ease ${index * 0.08}s both`,
  }
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function Landing({ onNavigate }: Props) {
  const { theme, toggleTheme, colors, shadow } = useTheme()
  const { lang, toggleLang } = useLang()
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
    let rafId = 0
    let nx = 0
    let ny = 0
    const apply = () => {
      rafId = 0
      heroTextRef.current?.style.setProperty('transform', `translate(${nx * 1.4}px, ${ny * 1}px)`)
    }
    const onMove = (e: MouseEvent) => {
      nx = (e.clientX / window.innerWidth - 0.5) * 2
      ny = (e.clientY / window.innerHeight - 0.5) * 2
      if (!rafId) rafId = requestAnimationFrame(apply)
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (rafId) cancelAnimationFrame(rafId)
    }
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
          <button
            onClick={toggleLang}
            aria-label="Switch language"
            title="Switch language"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              height: 30,
              padding: '0 6px',
              borderRadius: RADIUS.sm,
              background: 'transparent',
              border: 'none',
              color: colors.textMuted,
              fontSize: FONT.size.label,
              fontWeight: FONT.weight.bold,
              cursor: 'pointer',
            }}
          >
            <Languages size={15} strokeWidth={2} />
            {OTHER_LANG_LABEL[lang]}
          </button>
          <div style={{ display: 'inline-block' }}>
            <Button variant="primary" size="sm" onClick={() => onNavigate('register')}>
              Get started
            </Button>
          </div>
        </div>
      </nav>

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
            marginTop: '-6vh',
            transition: 'transform 0.6s ease-out',
          }}
        >
          <div aria-hidden style={{ position: 'absolute', left: '50%', top: -40, bottom: -40, width: 1, background: colors.border }} />
          <div aria-hidden style={{ position: 'absolute', left: '100%', top: -40, bottom: -40, width: 1, background: colors.border }} />

          <div
            style={{
              color: colors.textDim,
              fontFamily: FONT.mono,
              fontSize: FONT.size.caption,
              letterSpacing: LETTER_SPACING.wide,
              marginBottom: SPACE[6],
            }}
          >
            THAI + ENGLISH
          </div>

          <h1
            // Stays English in both languages, and it is split into per-word
            // spans for the reveal animation, so the translator must skip it.
            data-no-translate
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
            <div style={{ display: 'inline-block' }}>
              <Button variant="primary" size="md" style={{ padding: '11px 26px', fontSize: FONT.size.body, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide }} onClick={() => onNavigate('register')}>
                Get started →
              </Button>
            </div>
            <div style={{ display: 'inline-block' }}>
              <Button variant="ghost" size="md" style={{ padding: '11px 26px', fontSize: FONT.size.body, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide }} onClick={() => onNavigate('login')}>
                Sign in
              </Button>
            </div>
          </div>
        </div>

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
            <div
              key={dup}
              aria-hidden={dup > 0 ? true : undefined}
              style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
            >
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

      <section id="how-it-works" style={{ padding: '40px 32px 110px', maxWidth: 1040, margin: '0 auto' }}>
        <h2 style={{ color: colors.text, fontSize: FONT.size.title, fontWeight: 700, margin: '0 0 40px' }}>
          How Stratis works
        </h2>

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
        <div style={{ display: 'inline-block' }}>
          <Button variant="primary" size="md" style={{ padding: '11px 26px', fontSize: FONT.size.body }} onClick={() => onNavigate('register')}>
            Get started
          </Button>
        </div>
      </section>

      <section
        id="about"
        style={{
          padding: '80px 32px 96px',
          maxWidth: 1040,
          margin: '0 auto',
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <h2
          style={{
            textAlign: 'center',
            color: colors.textDim,
            fontSize: FONT.size.label,
            fontWeight: FONT.weight.medium,
            letterSpacing: LETTER_SPACING.eyebrow,
            textTransform: 'uppercase',
            margin: '0 0 40px',
          }}
        >
          About us
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 36,
          }}
        >
          {TEAM.map((person) => (
            <TeamCard key={person.email} colors={colors} shadow={shadow} person={person} />
          ))}
        </div>
      </section>
    </div>
  )
}

function TeamCard({
  colors, shadow, person,
}: {
  colors: Colors
  shadow: Shadow
  person: (typeof TEAM)[number]
}) {
  return (
    <div>
      <div
        role="img"
        aria-label={person.name}
        style={{
          width: '100%',
          height: 300,
          borderRadius: 18,
          marginBottom: 22,
          border: `1px solid ${colors.border}`,
          background: colors.border,
          backgroundImage: `url('${person.photo}')`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${person.photoZoom * 100}%`,
          backgroundPosition: person.photoPos,
        }}
      />

      <div
        style={{
          // minHeight, not height: the QR sits beside the contact lines and is
          // taller than they are, so the card has to be free to grow.
          minHeight: 200,
          borderRadius: 14,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          boxShadow: shadow.shadCard,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: colors.accent }}>
          <Zap size={18} strokeWidth={2} />
          <span style={{ color: colors.text, fontSize: FONT.size.label, fontWeight: FONT.weight.bold, letterSpacing: 2.6 }}>
            STRATIS
          </span>
        </div>

        <div>
          <div style={{ width: 32, height: 2, background: colors.accent, borderRadius: 1, margin: '14px 0' }} />
          <div style={{ color: colors.text, fontSize: FONT.size.subheading, fontWeight: FONT.weight.bold, letterSpacing: -0.3 }}>
            {person.name}
          </div>
          <div style={{ color: colors.textMuted, fontSize: FONT.size.label, marginTop: 3 }}>
            {person.role}
          </div>
        </div>

        {/* minHeight keeps every card the same height even though the QR sizes
            differ per person, so the row of cards stays bottom-aligned. */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 14, minHeight: 72 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0, color: colors.textMuted, fontSize: FONT.size.caption }}>
            <a href={`mailto:${person.email}`} style={contactLinkStyle}>
              {person.email}
            </a>
            <a href={`tel:${person.tel.replace(/[^+\d]/g, '')}`} style={contactLinkStyle}>
              {person.tel}
            </a>
          </div>

          {person.lineQr && (
            <img
              src={person.lineQr}
              alt={`LINE QR code for ${person.name}`}
              width={person.lineQrSize ?? 68}
              height={person.lineQrSize ?? 68}
              style={{
                flexShrink: 0,
                width: person.lineQrSize ?? 68,
                height: person.lineQrSize ?? 68,
                borderRadius: 8,
                // The QR art is black on white, so it carries its own white
                // plate to stay scannable on the dark theme.
                background: '#fff',
                padding: 4,
                objectFit: 'contain',
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

const contactLinkStyle = { color: 'inherit', textDecoration: 'none' } as const

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
