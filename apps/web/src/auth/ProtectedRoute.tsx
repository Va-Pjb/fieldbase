import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'

/**
 * Gate for authenticated areas. While the initial session check is in flight we
 * render nothing decision-making; once resolved, unauthenticated users are
 * redirected to /login (remembering where they were headed).
 */
export default function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>Loading…</div>
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
