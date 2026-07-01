import { useState } from 'react'
import { COLORS, FONT } from '../constants'
import { Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'

interface Props {
  onNavigate: (page: 'landing' | 'login' | 'app') => void
}

import { API_BASE } from '../lib/api'

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
  if (!/[0-9]/.test(password)) return 'Password must include at least one number'

  return null
}

export default function Register({ onNavigate }: Props) {
  const { login } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (loading) return

    const validationError = validateRegister(name, email, password)

    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: 'facilitator',
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Signup failed')
        return
      }

      if (!data.data?.token || !data.data?.user) {
        setError('Signup response was missing user session data')
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
          Create account
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
              <label htmlFor="register-name" className="sr-only">Full name</label>
              <input
                id="register-name"
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (error) setError(null)
                }}
                autoComplete="name"
                disabled={loading}
                style={inputStyle()}
              />
            </div>

            <div>
              <label htmlFor="register-email" className="sr-only">Email</label>
              <input
                id="register-email"
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
              <label htmlFor="register-password" className="sr-only">Password</label>
              <input
                id="register-password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError(null)
                }}
                autoComplete="new-password"
                disabled={loading}
                aria-describedby="register-password-hint"
                style={inputStyle()}
              />
            </div>

            <div
              id="register-password-hint"
              style={{
                color: COLORS.textMuted,
                fontSize: FONT.size.caption,
                lineHeight: 1.5,
                marginTop: -4,
              }}
            >
              Password must be at least 8 characters and include one letter and one number.
            </div>
          </div>

          <Button type="submit" variant="primary" fullWidth disabled={loading} style={{ fontSize: FONT.size.body, padding: '10px' }}>
            {loading ? 'Creating account...' : 'Create account'}
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
          Already have an account?{' '}
          <button
            type="button"
            style={linkStyle}
            onClick={() => !loading && onNavigate('login')}
            disabled={loading}
          >
            Sign in
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