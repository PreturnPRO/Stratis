import { useState } from 'react'
import { COLORS, FONT } from '../constants'
import { Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'

interface Props {
  onNavigate: (page: 'landing' | 'register' | 'app') => void
}

import { API_BASE } from '../lib/api'

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

  const handleSubmit = async () => {
    if (loading) return

    const validationError = validateLogin(email, password)

    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Invalid email or password')
        return
      }

      if (!data.data?.token || !data.data?.user) {
        setError('Login response was missing user session data')
        return
      }

      login(data.data.token, data.data.user)
      onNavigate('app')
    } catch {
      setError('Could not reach server')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = email.trim() && password && !loading

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: COLORS.bg,
      }}
    >
      <div
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: '40px 36px',
          width: 360,
        }}
      >
        <div
          style={{
            fontSize: FONT.size.caption,
            color: COLORS.accent,
            letterSpacing: 2,
            marginBottom: 24,
          }}
        >
          STRATIS
        </div>

        <h1
          style={{
            color: COLORS.text,
            fontSize: FONT.size.heading,
            fontWeight: 600,
            margin: '0 0 28px',
          }}
        >
          Sign in
        </h1>

        {error && (
          <div
            role="alert"
            style={{
              background: COLORS.redBg,
              border: `1px solid ${COLORS.red}`,
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: FONT.size.body,
              color: COLORS.red,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              marginBottom: 24,
            }}
          >
            <div>
              <label htmlFor="login-email" className="sr-only">Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError(null)
                }}
                autoComplete="email"
                disabled={loading}
                style={inputStyle()}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="sr-only">Password</label>
              <input
                id="login-password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError(null)
                }}
                autoComplete="current-password"
                disabled={loading}
                style={inputStyle()}
              />
            </div>
          </div>

          <Button type="submit" variant="primary" fullWidth disabled={!canSubmit} style={{ fontSize: FONT.size.body, padding: '10px' }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div
          style={{
            marginTop: 20,
            textAlign: 'center',
            fontSize: FONT.size.body,
            color: COLORS.textMuted,
          }}
        >
          No account?{' '}
          <button
            type="button"
            style={linkStyle}
            onClick={() => !loading && onNavigate('register')}
            disabled={loading}
          >
            Register
          </button>
        </div>

        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <button
            type="button"
            style={{ ...linkStyle, fontSize: FONT.size.label, color: COLORS.textMuted }}
            onClick={() => !loading && onNavigate('landing')}
            disabled={loading}
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle = (): React.CSSProperties => ({
  background: COLORS.bg,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  padding: '10px 12px',
  fontSize: FONT.size.body,
  color: COLORS.text,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
})

const linkStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: COLORS.accent,
  cursor: 'pointer',
}