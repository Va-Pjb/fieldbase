import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import ProtectedRoute from './auth/ProtectedRoute'
import AppShell from './components/AppShell'
import LoginScreen from './auth/LoginScreen'
import DesignTokens from './routes/DesignTokens'
import Dashboard from './routes/Dashboard'
import Contacts from './routes/Contacts'
import ContactForm from './routes/ContactForm'
import Pipeline from './routes/Pipeline'
import Automations from './routes/Automations'
import Migration from './routes/Migration'
import Settings from './routes/Settings'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/design-tokens" element={<DesignTokens />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="contacts" element={<Contacts />} />
              <Route path="contacts/new" element={<ContactForm />} />
              <Route path="contacts/:id/edit" element={<ContactForm />} />
              <Route path="pipeline" element={<Pipeline />} />
              <Route path="automations" element={<Automations />} />
              <Route path="migration" element={<Migration />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
