import { NavLink, Outlet } from 'react-router-dom'
import {
  Import,
  KanbanSquare,
  LayoutDashboard,
  Megaphone,
  Settings as SettingsIcon,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'

const NAV: { to: string; label: string; icon: LucideIcon; end: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/contacts', label: 'Contacts', icon: Users, end: false },
  { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare, end: false },
  { to: '/automations', label: 'Automations', icon: Workflow, end: false },
  { to: '/communication', label: 'Communication', icon: Megaphone, end: false },
  { to: '/migration', label: 'Migration', icon: Import, end: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
]

const linkBase =
  'flex items-center gap-3 whitespace-nowrap border-l-[3px] px-4 py-2.5 font-body text-small transition-colors'
const linkActive = 'border-signal bg-ink-soft text-paper'
const linkIdle = 'border-transparent text-slate hover:bg-ink-soft/60 hover:text-paper'

export default function AppShell() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-paper md:flex">
      <aside className="flex flex-col bg-ink text-paper md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="h-4 w-4 rounded-sm bg-signal" aria-hidden />
          <span className="font-display text-heading tracking-tight text-paper">FieldBase</span>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:gap-0.5 md:overflow-visible md:px-0 md:pb-0">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}
            >
              <Icon size={17} strokeWidth={2} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto hidden border-t border-ink-soft/60 px-5 py-4 md:block">
          <p className="truncate font-mono text-[0.7rem] text-slate" title={user?.email ?? ''}>
            {user?.email}
          </p>
          <button
            onClick={() => void signOut()}
            className="mt-2 font-body text-small text-signal hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
