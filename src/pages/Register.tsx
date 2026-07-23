import React, { useState, type CSSProperties } from 'react'
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
  const { theme, colors, shadow } = useTheme()
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
    confirmPassword &&
    !validateRegister(name, email, password) &&
    password === confirmPassword &&
    !loading

  return (
    <div style={containerStyle(colors)}>
      <AmbientBackground theme={theme} />
      <div style={cardStyle(colors, shadow)}>
        <div style={wordmarkStyle(colors)}>
          <Zap size={14} strokeWidth={2} />
          STRATIS
        </div>
        <div style={headingStyle(colors)}>Create your account</div>
        <div style={subtitleStyle(colors)}>Initialize Master Organizational Tenant</div>

        {error && <div style={errorStyle(colors)}>{error}</div>}

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={fieldStyle}>
            <label htmlFor="fullName" style={labelStyle(colors)}>
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Arthur Pendragon"
              disabled={loading}
              style={inputStyle(colors)}
              required
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="orgName" style={labelStyle(colors)}>
              Organization Name
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Excalibur Corp"
              disabled={loading}
              style={inputStyle(colors)}
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="email" style={labelStyle(colors)}>
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="arthur@excalibur.com"
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
              placeholder="Min. 8 chars, 1 letter, 1 number"
              disabled={loading}
              style={inputStyle(colors)}
              required
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="confirmPassword" style={labelStyle(colors)}>
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? 'Initializing...' : 'Deploy Workspace'}
          </Button>
        </form>

        <div style={switchFooterStyle}>
          <span style={{ color: colors.textMuted }}>Already registered? </span>
          <button
            type="button"
            onClick={() => onNavigate('login')}
            disabled={loading}
            style={linkStyle(colors)}
          >
            Access accounts
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Style Blocks ────────────────────────────────────────────────────────────

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