import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/', label: 'Athlètes', icon: '👥', end: true },
  { to: '/messages', label: 'Messages', icon: '💬' },
]

export default function Layout({ children }) {
  const { coach, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        {/* Logo */}
        <div className="px-5 py-6 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--red)' }}>
              <span className="text-white font-bold text-sm">G</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">GEMS</p>
              <p className="text-[10px]" style={{ color: 'var(--text3)' }}>Coach Portal</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'hover:bg-white/5'
                }`
              }
              style={({ isActive }) => isActive ? { background: 'var(--red)', color: '#fff' } : { color: 'var(--text2)' }}
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Coach profile */}
        <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-semibold text-white truncate">{coach?.full_name || 'Coach'}</p>
          <p className="text-xs truncate mb-3" style={{ color: 'var(--text3)' }}>{coach?.email}</p>
          <button
            onClick={handleSignOut}
            className="text-xs font-medium px-3 py-1.5 rounded-lg w-full text-left transition-colors hover:bg-white/5"
            style={{ color: 'var(--text3)' }}
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
