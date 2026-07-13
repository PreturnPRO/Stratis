import React, { useState, type CSSProperties } from 'react'
import { COLORS, FONT, LETTER_SPACING, RADIUS, SPACE } from '../constants'
import { Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../lib/api'

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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

      // Commit to central AuthContext and navigate to App
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
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={wordmarkStyle}>STRATIS</div>
        <div style={subtitleStyle}>Access the Control Room</div>

        {error && <div style={errorStyle}>{error}</div>}

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={fieldStyle}>
            <label htmlFor="email" style={labelStyle}>
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@organization.com"
              disabled={loading}
              style={inputStyle()}
              required
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="password" style={labelStyle}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              style={inputStyle()}
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
          <span style={{ color: COLORS.textMuted }}>Don't have an account? </span>
          <button
            type="button"
            onClick={() => onNavigate('register')}
            disabled={loading}
            style={linkStyle}
          >
            Create one
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Style Blocks ────────────────────────────────────────────────────────────

const containerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  background: COLORS.bg,
}

const cardStyle: CSSProperties = {
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.lg,
  padding: '40px 36px',
  width: 360,
  display: 'flex',
  flexDirection: 'column',
}

const wordmarkStyle: CSSProperties = {
  fontSize: FONT.size.caption,
  color: COLORS.accent,
  letterSpacing: LETTER_SPACING.eyebrow,
  fontWeight: FONT.weight.bold,
  marginBottom: 4,
}

const subtitleStyle: CSSProperties = {
  fontSize: FONT.size.body,
  color: COLORS.textMuted,
  marginBottom: 24,
}

const errorStyle: CSSProperties = {
  background: COLORS.redBg,
  border: `1px solid ${COLORS.red}`,
  color: COLORS.red,
  borderRadius: RADIUS.sm,
  padding: '10px 12px',
  fontSize: FONT.size.label,
  marginBottom: 16,
  lineHeight: 1.4,
}

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

const labelStyle: CSSProperties = {
  color: COLORS.textMuted,
  fontSize: FONT.size.label,
  fontWeight: FONT.weight.medium,
  letterSpacing: LETTER_SPACING.wide,
}

const inputStyle = (): CSSProperties => ({
  background: COLORS.bg,
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.sm,
  padding: '10px 12px',
  fontSize: FONT.size.body,
  color: COLORS.text,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
})

const switchFooterStyle: CSSProperties = {
  marginTop: 24,
  textAlign: 'center',
  fontSize: FONT.size.label,
}

const linkStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: COLORS.accent,
  cursor: 'pointer',
  textDecoration: 'underline',
}