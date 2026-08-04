import React, { useEffect, useState, type CSSProperties } from 'react'
import { FONT, LETTER_SPACING, RADIUS, SPACE } from '../constants'
import { Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import AmbientBackground from '../components/AmbientBackground'
import { Zap } from 'lucide-react'

type Colors = ReturnType<typeof useTheme>['colors']
type Shadow = ReturnType<typeof useTheme>['shadow']

interface Props {
  onNavigate: (page: 'landing' | 'register' | 'app') => void
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateLogin(email: string, password: string): string | null {
  const cleanEmail = email.trim()
  if (!cleanEmail) return 'Email is required'
  if (!isValidEmail(cleanEmail)) return 'Enter a valid email address'
  if (!password) return 'Password is required'
  return null
}

export default function Login({ onNavigate }: Props) {
  const { login } = useAuth()
  const { theme, colors, shadow } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Which sign-in methods this deployment has. Asked rather than assumed: a
  // Google button that 503s because the server has no OAuth credentials is
  // worse than no button.
  const [providers, setProviders] = useState<{ google: boolean } | null>(null)

  useEffect(() => {
    void fetch(`${API_BASE}/api/auth/providers`)
      .then((res) => res.json())
      .then((body) => setProviders(body?.data ?? null))
      .catch(() => setProviders(null))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    const validationError = validateLogin(email, password)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      const payload = await response.json()

      if (!response.ok || !payload.ok) {
        setError(payload.error || 'Invalid credentials or login failed')
        return
      }

      login(payload.data.token, payload.data.user)
      onNavigate('app')
    } catch (err) {
      console.error('[auth:login] error:', err)
      setError('Could not connect to the authentication server')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = email.trim() && password && !loading

  return (
    <div style={containerStyle(colors)}>
      <AmbientBackground theme={theme} />
      <div style={cardStyle(colors, shadow)}>
        <div style={wordmarkStyle(colors)}>
          <Zap size={14} strokeWidth={2} />
          STRATIS
        </div>
        <div style={headingStyle(colors)}>Sign in to Stratis</div>
        <div style={subtitleStyle(colors)}>Access the Control Room</div>

        {error && <div style={errorStyle(colors)}>{error}</div>}

        {providers?.google && (
          <>
            <Button
              type="button"
              fullWidth
              onClick={() => {
                window.location.href = `${API_BASE}/api/auth/google`
              }}
              style={{ marginBottom: 16 }}
            >
              Continue with Google
            </Button>
            <div style={dividerStyle(colors)}>
              <span style={{ background: colors.surfaceElevated, padding: '0 10px' }}>or</span>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={fieldStyle}>
            <label htmlFor="email" style={labelStyle(colors)}>
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@organization.com"
              disabled={loading}
              style={inputStyle(colors)}
              required
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="password" style={labelStyle(colors)}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              style={inputStyle(colors)}
              required
            />
          </div>

          <Button
            variant="primary"
            type="submit"
            disabled={!canSubmit}
            fullWidth
            style={{ marginTop: 12 }}
          >
            {loading ? 'Accessing...' : 'Enter Control Room'}
          </Button>
        </form>

        <div style={switchFooterStyle}>
          <span style={{ color: colors.textMuted }}>Don't have an account? </span>
          <button
            type="button"
            onClick={() => onNavigate('register')}
            disabled={loading}
            style={linkStyle(colors)}
          >
            Create one
          </button>
        </div>
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
  marginBottom: 24,
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

const dividerStyle = (colors: Colors): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.textDim,
  fontSize: FONT.size.caption,
  marginBottom: 16,
  borderTop: `1px solid ${colors.border}`,
  lineHeight: 0,
})

const formStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: SPACE[1.5],
}

const labelStyle = (colors: Colors): CSSProperties => ({
  color: colors.textMuted,
  fontSize: FONT.size.label,
  fontWeight: FONT.weight.medium,
  letterSpacing: LETTER_SPACING.wide,
})

const inputStyle = (colors: Colors): CSSProperties => ({
  background: colors.bg,
  border: `1px solid ${colors.border}`,
  borderRadius: RADIUS.sm,
  padding: '10px 12px',
  fontSize: FONT.size.body,
  color: colors.text,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
})

const switchFooterStyle: CSSProperties = {
  marginTop: 24,
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
