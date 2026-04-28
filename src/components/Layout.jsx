import { useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'

const COACH_COLOR = '#22C5D5'

// ─── Toast banner ─────────────────────────────────────────────────────────────
function MessageToasts() {
  const { toasts, dismissToast } = useNotifications()
  const navigate = useNavigate()

  if (!toasts.length) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2" style={{ maxWidth: 320 }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => { navigate(`/messages/${toast.senderId}`); dismissToast(toast.id) }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer shadow-2xl transition-all hover:scale-[1.02]"
          style={{ background: 'var(--surface)', border: `1px solid ${COACH_COLOR}55`, boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${COACH_COLOR}22` }}
        >
          {/* Sender avatar */}
          {toast.senderPhoto
            ? <img src={toast.senderPhoto} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
            : <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                style={{ background: 'var(--red)' }}>
                {toast.senderName?.[0]?.toUpperCase()}
              </div>
          }
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: COACH_COLOR }} />
              <p className="text-xs font-bold text-white truncate">{toast.senderName}</p>
            </div>
            <p className="text-xs truncate" style={{ color: 'var(--text3)' }}>{toast.content}</p>
          </div>
          {/* Dismiss */}
          <button
            onClick={e => { e.stopPropagation(); dismissToast(toast.id) }}
            className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 text-xs"
            style={{ background: 'var(--surface2)', color: 'var(--text3)' }}
          >✕</button>
        </div>
      ))}
    </div>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function Layout({ children }) {
  const { coach, signOut } = useAuth()
  const { unread, clearUnread } = useNotifications()
  const navigate = useNavigate()
  const location = useLocation()

  // Clear unread when visiting the messages section
  useEffect(() => {
    if (location.pathname.startsWith('/messages')) clearUnread()
  }, [location.pathname])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Toast notifications */}
      <MessageToasts />

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
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive ? 'text-white' : 'hover:bg-white/5'}`
            }
            style={({ isActive }) => isActive ? { background: 'var(--red)', color: '#fff' } : { color: 'var(--text2)' }}
          >
            <span>👥</span>
            Athlètes
          </NavLink>

          {/* Messages with unread badge */}
          <NavLink
            to="/messages"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive ? 'text-white' : 'hover:bg-white/5'}`
            }
            style={({ isActive }) => isActive ? { background: 'var(--red)', color: '#fff' } : { color: 'var(--text2)' }}
          >
            <span>💬</span>
            <span className="flex-1">Messages</span>
            {unread > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                style={{ background: COACH_COLOR }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </NavLink>
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
