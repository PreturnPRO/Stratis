import { useState, type CSSProperties } from 'react'
import { COLORS } from '../constants'
import { btnAccent } from '../components/ui'
import { useAuth } from '../context/AuthContext'

interface Props {
  onNavigate: (page: 'landing' | 'register' | 'app') => void
}

interface LoginErrors {
  email?: string
  password?: string
  form?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateLogin(email: string, password: string): LoginErrors {
  const errors: LoginErrors = {}
  const cleanEmail = email.trim()

  if (!cleanEmail) {
    errors.email = 'Email is required'
  } else if (!EMAIL_RE.test(cleanEmail)) {
    errors.email = 'Enter a valid email address'
  }

  if (!password) {
    errors.password = 'Password is required'
  }

  return errors
}

export default function Login({ onNavigate }: Props) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginErrors>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const nextErrors = validateLogin(email, password)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)

    try {
      const res = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      })

      const data = await res.json()

      if (!data.ok) {
        setErrors({ form: data.error ?? 'Login failed' })
        return
      }

      login(data.data.token, data.data.user)
      onNavigate('app')
    } catch {
      setErrors({ form: 'Could not reach server' })
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
        <div style={{ fontSize: 11, color: COLORS.accent, letterSpacing: 2, marginBottom: 24 }}>
          STRATIS
        </div>

        <h2 style={{ color: COLORS.text, fontSize: 20, fontWeight: 500, margin: '0 0 28px' }}>
          Sign in
        </h2>

        {errors.form && (
          <div style={errorBoxStyle}>
            {errors.form}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              autoComplete="email"
              onChange={(e) => {
                setEmail(e.target.value)
                setErrors((prev) => ({ ...prev, email: undefined, form: undefined }))
              }}
              style={inputStyle(!!errors.email)}
            />
            {errors.email && <FieldError message={errors.email} />}
          </div>

          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => {
                setPassword(e.target.value)
                setErrors((prev) => ({ ...prev, password: undefined, form: undefined }))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSubmit()
              }}
              style={inputStyle(!!errors.password)}
            />
            {errors.password && <FieldError message={errors.password} />}
          </div>
        </div>

        <button
          style={{
            ...btnAccent(),
            width: '100%',
            justifyContent: 'center',
            fontSize: 14,
            padding: '10px',
            opacity: canSubmit ? 1 : 0.6,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: COLORS.textMuted }}>
          No account?{' '}
          <span style={{ color: COLORS.accent, cursor: 'pointer' }} onClick={() => onNavigate('register')}>
            Register
          </span>
        </div>

        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: COLORS.textDim, cursor: 'pointer' }} onClick={() => onNavigate('landing')}>
            ← Back
          </span>
        </div>
      </div>
    </div>
  )
}

function FieldError({ message }: { message: string }) {
  return (
    <div style={{ color: COLORS.red, fontSize: 12, marginTop: 6 }}>
      {message}
    </div>
  )
}

const errorBoxStyle: CSSProperties = {
  background: COLORS.redBg,
  border: `1px solid ${COLORS.red}`,
  borderRadius: 6,
  padding: '8px 12px',
  fontSize: 13,
  color: COLORS.red,
  marginBottom: 16,
}

const inputStyle = (hasError = false): CSSProperties => ({
  background: COLORS.bg,
  border: `1px solid ${hasError ? COLORS.red : COLORS.border}`,
  borderRadius: 6,
  padding: '10px 12px',
  fontSize: 14,
  color: COLORS.text,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
})