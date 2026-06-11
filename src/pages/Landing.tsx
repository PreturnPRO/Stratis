import { COLORS } from '../constants'
import { btnAccent, btnGhost } from '../components/ui'

interface Props {
  onNavigate: (page: 'login' | 'register') => void
}

export default function Landing({ onNavigate }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 48, padding: '0 40px',
      background: COLORS.bg,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 560 }}>
        <div style={{ fontSize: 11, color: COLORS.accent, letterSpacing: 2, marginBottom: 16 }}>
          STRATIS
        </div>
        <h1 style={{ color: COLORS.text, fontSize: 36, fontWeight: 500, margin: '0 0 16px', lineHeight: 1.2 }}>
          The AI co-facilitator for teams that build things that matter
        </h1>
        <p style={{ color: COLORS.textMuted, fontSize: 16, lineHeight: 1.7, margin: 0 }}>
          Stratis listens to your meeting and builds the reasoning record your team never has time to write.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button style={{ ...btnAccent(), fontSize: 14, padding: '10px 28px' }} onClick={() => onNavigate('register')}>
          Get started
        </button>
        <button style={{ ...btnGhost(), fontSize: 14, padding: '10px 28px' }} onClick={() => onNavigate('login')}>
          Sign in
        </button>
      </div>

      <div style={{ display: 'flex', gap: 48, marginTop: 8 }}>
        {[
          ['Alive inside the meeting', 'Surfaces the question nobody thought to ask'],
          ['Zero manual docs', 'Summary delivered within 5 minutes of session end'],
          ['Reasoning survives', 'Every decision and assumption preserved indefinitely'],
        ].map(([title, desc]) => (
          <div key={title} style={{ textAlign: 'center', maxWidth: 180 }}>
            <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{title}</div>
            <div style={{ color: COLORS.textMuted, fontSize: 12, lineHeight: 1.6 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}