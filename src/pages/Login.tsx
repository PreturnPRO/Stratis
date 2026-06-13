import { useState } from 'react'
import { COLORS } from '../constants'
import { btnAccent } from '../components/ui'
import { useAuth } from '../context/AuthContext'

interface Props {
  onNavigate: (page: 'landing' | 'register' | 'app') => void
}

export default function Login({ onNavigate }: Props) {
  const { login } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!data.ok) { setError(data.error ?? 'Login failed'); return }
      login(data.data.token, data.data.user)
      onNavigate('app')
    } catch {
      setError('Could not reach server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: COLORS.bg,
    }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 12, padding: '40px 36px', width: 360,
      }}>
        <div style={{ fontSize: 11, color: COLORS.accent, letterSpacing: 2, marginBottom: 24 }}>STRATIS</div>
        <h2 style={{ color: COLORS.text, fontSize: 20, fontWeight: 500, margin: '0 0 28px' }}>Sign in</h2>

        {error && (
          <div style={{ background: COLORS.redBg, border: `1px solid ${COLORS.red}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: COLORS.red, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle()}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={inputStyle()}
          />
        </div>

        <button
          style={{ ...btnAccent(), width: '100%', justifyContent: 'center', fontSize: 14, padding: '10px', opacity: loading ? 0.6 : 1 }}
          onClick={handleSubmit}
          disabled={loading}
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

const inputStyle = (): React.CSSProperties => ({
  background: COLORS.bg, border: `1px solid ${COLORS.border}`,
  borderRadius: 6, padding: '10px 12px', fontSize: 14,
  color: COLORS.text, outline: 'none', width: '100%', boxSizing: 'border-box',
})