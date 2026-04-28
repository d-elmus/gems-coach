import { useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'

const COACH_COLOR = '#22C5D5'

// ─── Toast banner ─────────────────────────────────────────────────────────────
function MessageToasts() {
  const { toasts, dismissToast } = useNotifications()
  const navigate = useNavigate()

  return (
    <div className="fixed top-4 right-4 flex flex-col gap-2 pointer-events-none" style={{ zIndex: 99999, maxWidth: 340 }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => { navigate(`/messages/${toast.senderId}`); dismissToast(toast.id) }}
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer pointer-events-auto"
          style={{
            background: 'var(--surface)',
            border: `1px solid ${COACH_COLOR}66`,
            boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px ${COACH_COLOR}22`,
            animation: 'slideInRight 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          {/* Sender avatar */}
          <div className="relative flex-shrink-0">
            {toast.senderPhoto
              ? <img src={toast.senderPhoto} alt="" className="w-10 h-10 rounded-full object-cover" />
              : <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                  style={{ background: 'var(--red)' }}>
                  {toast.senderName?.[0]?.toUpperCase()}
                </div>
            }
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
              style={{ background: COACH_COLOR, borderColor: 'var(--surface)' }}>
              <span style={{ fontSize: 7, color: '#fff', lineHeight: 1 }}>💬</span>
            </div>
          </div>
          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white mb-0.5">{toast.senderName}</p>
            <p className="text-xs leading-snug" style={{ color: 'var(--text3)' }}>{toast.content}</p>
          </div>
          {/* Dismiss */}
          <button
            onClick={e => { e.stopPropagation(); dismissToast(toast.id) }}
            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs hover:opacity-70"
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
