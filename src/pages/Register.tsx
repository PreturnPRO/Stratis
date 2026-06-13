import { useState, type CSSProperties } from 'react'
import { COLORS } from '../constants'
import { btnAccent } from '../components/ui'
import { useAuth } from '../context/AuthContext'

interface Props {
  onNavigate: (page: 'landing' | 'login' | 'app') => void
}

interface RegisterErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
  form?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateRegister(
  name: string,
  email: string,
  password: string,
  confirmPassword: string,
): RegisterErrors {
  const errors: RegisterErrors = {}
  const cleanName = name.trim()
  const cleanEmail = email.trim()

  if (!cleanName) {
    errors.name = 'Full name is required'
  } else if (cleanName.length < 2) {
    errors.name = 'Name must be at least 2 characters'
  } else if (cleanName.length > 80) {
    errors.name = 'Name must be 80 characters or fewer'
  }

  if (!cleanEmail) {
    errors.email = 'Email is required'
  } else if (!EMAIL_RE.test(cleanEmail)) {
    errors.email = 'Enter a valid email address'
  }

  if (!password) {
    errors.password = 'Password is required'
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.password = 'Password must include at least one letter and one number'
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirm your password'
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match'
  }

  return errors
}

export default function Register({ onNavigate }: Props) {
  const { login } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<RegisterErrors>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const nextErrors = validateRegister(name, email, password, confirmPassword)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)

    try {
      const res = await fetch('http://localhost:3001/api/auth/signup', {
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

      if (!data.ok) {
        setErrors({ form: data.error ?? 'Signup failed' })
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

  const canSubmit =
    name.trim() &&
    email.trim() &&
    password &&
    confirmPassword &&
    !loading

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
          Create account
        </h2>

        {errors.form && (
          <div style={errorBoxStyle}>
            {errors.form}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          <div>
            <input
              type="text"
              placeholder="Full name"
              value={name}
              autoComplete="name"
              onChange={(e) => {
                setName(e.target.value)
                setErrors((prev) => ({ ...prev, name: undefined, form: undefined }))
              }}
              style={inputStyle(!!errors.name)}
            />
            {errors.name && <FieldError message={errors.name} />}
          </div>

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
              autoComplete="new-password"
              onChange={(e) => {
                setPassword(e.target.value)
                setErrors((prev) => ({ ...prev, password: undefined, form: undefined }))
              }}
              style={inputStyle(!!errors.password)}
            />
            {errors.password && <FieldError message={errors.password} />}
          </div>

          <div>
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              autoComplete="new-password"
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setErrors((prev) => ({ ...prev, confirmPassword: undefined, form: undefined }))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSubmit()
              }}
              style={inputStyle(!!errors.confirmPassword)}
            />
            {errors.confirmPassword && <FieldError message={errors.confirmPassword} />}
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
          {loading ? 'Creating account...' : 'Create account'}
        </button>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: COLORS.textMuted }}>
          Already have an account?{' '}
          <span style={{ color: COLORS.accent, cursor: 'pointer' }} onClick={() => onNavigate('login')}>
            Sign in
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