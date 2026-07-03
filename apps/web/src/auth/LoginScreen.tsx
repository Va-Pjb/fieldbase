import { useState, type CSSProperties, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'

type Mode = 'signin' | 'signup'

export default function LoginScreen() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: { pathname?: string } } }
  const redirectTo = location.state?.from?.pathname ?? '/'

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) setMessage(error)
        else navigate(redirectTo, { replace: true })
      } else {
        const { error, needsConfirmation } = await signUp(email, password)
        if (error) setMessage(error)
        else if (needsConfirmation)
          setMessage('Account created — check your email to confirm, then sign in.')
        else navigate(redirectTo, { replace: true })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'system-ui, sans-serif',
        background: '#f7f7f8',
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: 340,
          background: '#fff',
          border: '1px solid #e5e5e5',
          borderRadius: 12,
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>FieldBase</h1>
        <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
          {mode === 'signin' ? 'Sign in to your workspace.' : 'Create your workspace.'}
        </p>

        <label style={{ fontSize: '0.85rem', color: '#333' }}>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={inputStyle}
          />
        </label>

        <label style={{ fontSize: '0.85rem', color: '#333' }}>
          Password
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            style={inputStyle}
          />
        </label>

        <button type="submit" disabled={busy} style={buttonStyle}>
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>

        {message && (
          <p style={{ margin: 0, color: '#b00020', fontSize: '0.85rem' }}>{message}</p>
        )}

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
            setMessage(null)
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#555',
            cursor: 'pointer',
            fontSize: '0.85rem',
            textAlign: 'left',
            padding: 0,
          }}
        >
          {mode === 'signin'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </button>
      </form>
    </main>
  )
}

const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '0.5rem 0.6rem',
  border: '1px solid #ccc',
  borderRadius: 8,
  fontSize: '0.95rem',
  boxSizing: 'border-box',
}

const buttonStyle: CSSProperties = {
  marginTop: 4,
  padding: '0.55rem',
  border: 'none',
  borderRadius: 8,
  background: '#111',
  color: '#fff',
  fontSize: '0.95rem',
  cursor: 'pointer',
}
