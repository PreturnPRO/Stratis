import React, { useState, type CSSProperties } from 'react'
import { COLORS, FONT, LETTER_SPACING, RADIUS } from '../constants'
import { Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../lib/api'

interface Props {
  onNavigate: (page: 'landing' | 'login' | 'app') => void
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateRegister(name: string, email: string, password: string): string | null {
  const cleanName = name.trim()
  const cleanEmail = email.trim()

  if (!cleanName) return 'Full name is required'
  if (cleanName.length < 2) return 'Full name must be at least 2 characters'

  if (!cleanEmail) return 'Email is required'
  if (!isValidEmail(cleanEmail)) return 'Enter a valid email address'

  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Za-z]/.test(password)) return 'Password must include at least one letter'
  if (!/[1-9]/.test(password)) return 'Password must include at least one number'

  return null
}

export default function Register({ onNavigate }: Props) {
  const { login } = useAuth()
  const [name, setName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    const validationError = validateRegister(name, email, password)
    if (validationError) {
      setError(validationError)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          orgName: orgName.trim() || `${name.trim()}'s Team`,
          role: 'facilitator', // Standard default role for platform onboarding
        }),
      })

      const payload = await response.json()

      if (!response.ok || !payload.ok) {
        setError(payload.error || 'Registration failed')
        return
      }

      // Success commits session tokens and loads active dashboard workspace
      login(payload.data.token, payload.data.user)
      onNavigate('app')
    } catch (err) {
      console.error('[auth:signup] error:', err)
      setError('Could not connect to the registration server')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit =
    name.trim() &&
    email.trim() &&
    password &&
    !loading

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={wordmarkStyle}>STRATIS</div>
        <div style={subtitleStyle}>Initialize Master Organizational Tenant</div>

        {error && <div style={errorStyle}>{error}</div>}

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={fieldStyle}>
            <label htmlFor="fullName" style={labelStyle}>
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Arthur Pendragon"
              disabled={loading}
              style={inputStyle()}
              required
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="orgName" style={labelStyle}>
              Organization Name
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Excalibur Corp"
              disabled={loading}
              style={inputStyle()}
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="email" style={labelStyle}>
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="arthur@excalibur.com"
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
              placeholder="Min. 8 chars, 1 letter, 1 number"
              disabled={loading}
              style={inputStyle()}
              required
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="confirmPassword" style={labelStyle}>
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? 'Initializing...' : 'Deploy Workspace'}
          </Button>
        </form>

        <div style={switchFooterStyle}>
          <span style={{ color: COLORS.textMuted }}>Already registered? </span>
          <button
            type="button"
            onClick={() => onNavigate('login')}
            disabled={loading}
            style={linkStyle}
          >
            Access accounts
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
  gap: 6,
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