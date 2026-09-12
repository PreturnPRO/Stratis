import { useState, type CSSProperties } from 'react'
import { Zap } from 'lucide-react'
import type { DesktopCodeResponse } from '@shared/types'
import { FONT, LETTER_SPACING, RADIUS } from '../constants'
import { Button } from '../components/ui'
import AmbientBackground from '../components/AmbientBackground'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../hooks/useLang'
import { useTheme } from '../hooks/useTheme'
import { apiFetch } from '../lib/http'
import { desktopCallbackUrl, type DesktopRequest } from '../lib/desktopHandoff'

type Colors = ReturnType<typeof useTheme>['colors']
type Shadow = ReturnType<typeof useTheme>['shadow']

interface Props {
  request: DesktopRequest
  /** Signs this browser out so another account can sign in; the request is kept for after. */
  onUseAnotherAccount: () => void
}

/**
 * The website half of Stratis Desktop sign-in (desktop spec §6, steps 3-4).
 *
 * Nothing reaches the app until the person clicks Continue. Any program on the
 * computer can open this page, so the account it names is what they approve.
 */
export default function DesktopSignIn({ request, onUseAnotherAccount }: Props) {
  const { user } = useAuth()
  const { lang } = useLang()
  const { theme, colors, shadow } = useTheme()
  const [step, setStep] = useState<'ready' | 'sending' | 'sent'>('ready')
  const [error, setError] = useState<string | null>(null)

  const handleContinue = async () => {
    if (step !== 'ready') return
    setStep('sending')
    setError(null)
    try {
      const { code } = await apiFetch<DesktopCodeResponse>('/api/auth/desktop/code', {
        method: 'POST',
        body: { challenge: request.challenge },
      })
      setStep('sent')
      window.location.href = desktopCallbackUrl(request, code, lang)
    } catch (err) {
      setStep('ready')
      // apiFetch already turns an unreachable server into a sentence a person can act on.
      setError(
        err instanceof Error
          ? err.message
          : 'Could not reach Stratis. Check your connection and try again.',
      )
    }
  }

  return (
    <div style={containerStyle(colors)}>
      <AmbientBackground theme={theme} />
      <div style={cardStyle(colors, shadow)}>
        <div style={wordmarkStyle(colors)}>
          <Zap size={14} strokeWidth={2} />
          STRATIS
        </div>
        {step === 'sent' ? (
          <>
            <h1 style={{ ...headingStyle(colors), margin: 0 }}>You're signed in to Stratis Desktop</h1>
            <div style={subtitleStyle(colors)}>You can close this tab and go back to the app.</div>
          </>
        ) : (
          <>
            <h1 style={{ ...headingStyle(colors), margin: 0 }}>Open Stratis Desktop?</h1>
            <div style={subtitleStyle(colors)}>Stratis Desktop will be signed in as</div>
            <div style={accountStyle(colors)}>
              <div style={{ fontWeight: FONT.weight.semibold }}>{user?.name}</div>
              <div style={{ color: colors.textMuted }}>{user?.email}</div>
            </div>
            {error && <div style={errorStyle(colors)}>{error}</div>}
            <Button
              variant="primary"
              fullWidth
              disabled={step === 'sending'}
              onClick={() => void handleContinue()}
            >
              {step === 'sending' ? 'Opening Stratis Desktop…' : 'Continue'}
            </Button>
            <div style={footerStyle}>
              <button
                type="button"
                onClick={onUseAnotherAccount}
                disabled={step === 'sending'}
                style={linkStyle(colors)}
              >
                Use another account
              </button>
            </div>
            <div style={noteStyle(colors)}>
              Only continue if you just asked to sign in from Stratis Desktop on this computer.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const containerStyle = (colors: Colors): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  background: colors.bg,
  position: 'relative',
})

const cardStyle = (colors: Colors, shadow: Shadow): CSSProperties => ({
  background: colors.surfaceElevated,
  border: `1px solid ${colors.border}`,
  borderRadius: 14,
  boxShadow: shadow.shadModal,
  padding: '40px 36px',
  width: 380,
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
})

const wordmarkStyle = (colors: Colors): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  fontSize: FONT.size.caption,
  color: colors.accent,
  letterSpacing: LETTER_SPACING.eyebrow,
  fontWeight: FONT.weight.bold,
  marginBottom: 4,
})

const headingStyle = (colors: Colors): CSSProperties => ({
  fontSize: FONT.size.title,
  color: colors.text,
  fontWeight: FONT.weight.semibold,
  marginBottom: 4,
})

const subtitleStyle = (colors: Colors): CSSProperties => ({
  fontSize: FONT.size.body,
  color: colors.textMuted,
  marginTop: 8,
  marginBottom: 12,
})

const accountStyle = (colors: Colors): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  border: `1px solid ${colors.border}`,
  borderRadius: RADIUS.sm,
  padding: '12px 14px',
  marginBottom: 20,
  fontSize: FONT.size.body,
  color: colors.text,
})

const errorStyle = (colors: Colors): CSSProperties => ({
  background: colors.redBg,
  border: `1px solid ${colors.red}`,
  color: colors.red,
  borderRadius: RADIUS.sm,
  padding: '10px 12px',
  fontSize: FONT.size.label,
  marginBottom: 16,
  lineHeight: 1.4,
})

const footerStyle: CSSProperties = {
  marginTop: 16,
  textAlign: 'center',
  fontSize: FONT.size.label,
}

const linkStyle = (colors: Colors): CSSProperties => ({
  background: 'transparent',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: colors.accent,
  cursor: 'pointer',
  textDecoration: 'underline',
})

const noteStyle = (colors: Colors): CSSProperties => ({
  marginTop: 20,
  fontSize: FONT.size.caption,
  color: colors.textDim,
  lineHeight: 1.5,
  textAlign: 'center',
})
