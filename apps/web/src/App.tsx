import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import ProtectedRoute from './auth/ProtectedRoute'
import LoginScreen from './auth/LoginScreen'

/**
 * Temporary protected landing page. The full app shell (sidebar + module
 * routes) replaces this as the protected-route element in Phase 0, Task 5.
 */
function ProtectedHome() {
  const { user, signOut } = useAuth()
  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 640,
        margin: '0 auto',
        padding: '3rem 1.5rem',
        lineHeight: 1.5,
      }}
    >
      <h1 style={{ margin: 0 }}>FieldBase</h1>
      <p>
        Signed in as <strong>{user?.email}</strong>.
      </p>
      <p style={{ color: '#555' }}>
        Protected area placeholder — the app shell and module routes arrive in Task 5.
      </p>
      <button
        onClick={() => void signOut()}
        style={{
          padding: '0.5rem 0.9rem',
          border: '1px solid #ccc',
          borderRadius: 8,
          background: '#fff',
          cursor: 'pointer',
        }}
      >
        Sign out
      </button>
    </main>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<ProtectedHome />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
