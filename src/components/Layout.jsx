import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import { useClub } from '../context/ClubContext'
import { Icon, Avatar, Mascot, Meter } from './ui'

const CLUB_NAV = [
  { to: '/club', label: 'Tableau de bord', icon: 'grid', end: true },
  { to: '/club/members', label: 'Membres', icon: 'users', badge: 'requests' },
  { to: '/club/coaches', label: 'Coachs', icon: 'whistle' },
  { to: '/club/planning', label: 'Planning', icon: 'calendar' },
  { to: '/club/workouts', label: 'Séances à faire', icon: 'clipboard' },
  { to: '/club/announcements', label: 'Annonces', icon: 'megaphone' },
  { to: '/club/subscription', label: 'Abonnement', icon: 'card' },
  { to: '/club/settings', label: 'Réglages', icon: 'settings' },
]
const COACH_NAV = [
  { to: '/', label: 'Tableau de bord', icon: 'grid', end: true },
  { to: '/athletes', label: 'Mes athlètes', icon: 'users' },
  { to: '/agenda', label: 'Mon agenda', icon: 'calendar', needsClub: true },
  { to: '/workouts', label: 'Séances à faire', icon: 'clipboard', needsClub: true },
  { to: '/plans', label: 'Plans', icon: 'list' },
  { to: '/announcements', label: 'Annonces', icon: 'megaphone', needsClub: true },
  { to: '/messages', label: 'Messages', icon: 'message', badge: 'unread' },
  { to: '/settings', label: 'Réglages', icon: 'settings' },
]

// ─── Toasts messages ──────────────────────────────────────────────────────────
function MessageToasts() {
  const { toasts, dismissToast } = useNotifications()
  const navigate = useNavigate()
  return (
    <div className="fixed top-5 right-5 flex flex-col gap-2 pointer-events-none" style={{ zIndex: 99999, maxWidth: 340 }}>
      {toasts.map(t => (
        <div key={t.id}
          onClick={() => { navigate(`/messages/${t.senderId}`); dismissToast(t.id) }}
          className="card flex items-center gap-3 px-4 py-3 cursor-pointer pointer-events-auto"
          style={{ boxShadow: 'var(--shadow-lg)', animation: 'slideInRight 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <Avatar name={t.senderName} url={t.senderPhoto} id={t.senderId} size={38} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-extrabold">{t.senderName}</p>
            <p className="text-xs muted truncate">{t.content}</p>
          </div>
          <button onClick={e => { e.stopPropagation(); dismissToast(t.id) }} className="muted hover:opacity-70" aria-label="Fermer">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Carte club (haut de sidebar) : bascule espace club / espace coach ────────
function ClubCard() {
  const { club, isAdmin, space, setSpace, memberCount, setupNeeded } = useClub()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  if (!club) {
    return (
      <button onClick={() => navigate('/club/new')}
        className="w-full text-left rounded-2xl p-3 flex items-center gap-3 transition-colors hover:bg-white/15"
        style={{ background: 'rgba(255,255,255,0.1)', border: '1px dashed rgba(255,255,255,0.35)' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
          <Icon name="plus" size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-extrabold">Créer mon club</p>
          <p className="text-[11px] opacity-70">{setupNeeded ? 'Espace club à activer' : 'Planning, membres, réservations'}</p>
        </div>
      </button>
    )
  }

  const sub = space === 'club' ? `Espace club · ${memberCount} adhérent${memberCount > 1 ? 's' : ''}` : 'Espace coach'
  return (
    <div ref={ref} className="relative">
      <button onClick={() => isAdmin && setOpen(o => !o)}
        className="w-full text-left rounded-2xl p-3 flex items-center gap-3 transition-colors"
        style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', cursor: isAdmin ? 'pointer' : 'default' }}>
        {club.logo_url
          ? <img src={club.logo_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          : <Mascot size={40} />}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold truncate">{club.name}</p>
          <p className="text-[11px] opacity-75 truncate">{sub}</p>
        </div>
        {isAdmin && <Icon name="swap" size={15} className="opacity-70" />}
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl p-1.5 z-20"
          style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-lg)', color: 'var(--text1)' }}>
          {[
            { id: 'club', label: 'Espace club', sub: 'Membres, coachs, planning, annonces', icon: 'shield', home: '/club' },
            { id: 'coach', label: 'Espace coach', sub: 'Mes athlètes, séances, plans', icon: 'whistle', home: '/' },
          ].map(o => (
            <button key={o.id} onClick={() => { setSpace(o.id); setOpen(false); navigate(o.home) }}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-[var(--surface2)]">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: space === o.id ? 'var(--red)' : 'var(--surface3)', color: space === o.id ? '#fff' : 'var(--text2)' }}>
                <Icon name={o.icon} size={15} />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-bold">{o.label}</p>
                <p className="text-[11px] muted">{o.sub}</p>
              </div>
              {space === o.id && <Icon name="check" size={15} style={{ color: 'var(--red)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PlanCard() {
  const { club, memberCount } = useClub()
  if (!club) return null
  return (
    <NavLink to="/club/subscription" className="block rounded-2xl p-4"
      style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p className="text-[10px] font-extrabold tracking-[0.14em] opacity-70">FORMULE</p>
      <p className="display text-[17px] mt-1 mb-3">GEMS Club Pro</p>
      <Meter value={memberCount} max={club.seats} tone="light" height={5} />
      <p className="text-[11px] opacity-75 mt-2">{memberCount} / {club.seats} licences</p>
    </NavLink>
  )
}

// ─── En-tête de page : titre + utilitaires (recherche, notifs, profil) ────────
export function Header({ eyebrow, title, children, search = true }) {
  const { coach, signOut } = useAuth()
  const { unread } = useNotifications()
  const { space, isAdmin } = useClub()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [menu, setMenu] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setMenu(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function submitSearch(e) {
    e.preventDefault()
    const target = space === 'club' ? '/club/members' : '/athletes'
    navigate(`${target}?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <div className="flex items-end justify-between gap-6 flex-wrap mb-7">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {children}
        {search && (
          <form onSubmit={submitSearch} className="relative hidden xl:block">
            <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 muted" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…"
              className="input" style={{ width: 220, paddingLeft: 38, borderRadius: 999 }} />
          </form>
        )}
        <button onClick={() => navigate('/messages')} className="btn btn-ghost btn-icon relative" aria-label="Messages">
          <Icon name="bell" size={17} />
          {unread > 0 && <span className="absolute top-2 right-2.5 w-2.5 h-2.5 rounded-full" style={{ background: 'var(--red)', boxShadow: '0 0 0 2px var(--surface)' }} />}
        </button>
        <div ref={ref} className="relative">
          <button onClick={() => setMenu(m => !m)} className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full hover:bg-[var(--surface)]">
            <Avatar name={coach?.full_name} url={coach?.photo_url} id={coach?.id} size={38} />
            <div className="text-left hidden lg:block">
              <p className="text-[13px] font-extrabold leading-tight">{coach?.full_name || 'Coach'}</p>
              <p className="text-[11px] muted">{space === 'club' && isAdmin ? 'Admin' : 'Coach'}</p>
            </div>
          </button>
          {menu && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl p-1.5 z-30" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-lg)' }}>
              <button onClick={() => { setMenu(false); navigate('/settings') }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold hover:bg-[var(--surface2)]">
                <Icon name="settings" size={15} /> Mon profil coach
              </button>
              <button onClick={async () => { await signOut(); navigate('/login') }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold hover:bg-[var(--surface2)]" style={{ color: 'var(--bad)' }}>
                <Icon name="logout" size={15} /> Se déconnecter
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function Layout({ children }) {
  const { unread, clearUnread } = useNotifications()
  const { space, club, isAdmin, setSpace, roleRequests } = useClub()
  const location = useLocation()

  useEffect(() => {
    if (location.pathname.startsWith('/messages')) clearUnread()
  }, [location.pathname])

  // Lien direct vers une page /club/… : on affiche la navigation de l'espace club.
  // Inversement, une page propre à l'espace coach affiche la navigation coach.
  const onClubPage = /^\/club(\/|$)/.test(location.pathname) && location.pathname !== '/club/new'
  const onCoachPage = /^\/(agenda|workouts|announcements|plans|athletes)\/?$/.test(location.pathname)
  useEffect(() => {
    if (!isAdmin) return
    if (onClubPage && space !== 'club') setSpace('club')
    else if (onCoachPage && space !== 'coach') setSpace('coach')
  }, [onClubPage, onCoachPage, isAdmin, space, setSpace])

  const nav = (space === 'club' ? CLUB_NAV : COACH_NAV).filter(n => !n.needsClub || club)

  return (
    <div className="h-screen flex overflow-hidden">
      <MessageToasts />

      <aside className="sidebar-bg w-[256px] flex-shrink-0 flex flex-col text-white px-4 py-6 gap-6 overflow-y-auto">
        <div className="px-3">
          <p className="display text-[26px] leading-none">GEMS</p>
          <p className="text-[9px] font-extrabold tracking-[0.3em] opacity-80 mt-1">TRIATHLON TEAM</p>
        </div>

        <ClubCard />

        <nav className="flex flex-col gap-1">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 h-11 rounded-xl text-[14px] font-semibold transition-colors ${isActive ? '' : 'hover:bg-white/10'}`}
              style={({ isActive }) => isActive
                ? { background: 'var(--bg)', color: 'var(--red-dark)' }
                : { color: 'rgba(255,255,255,0.88)' }}>
              <Icon name={n.icon} size={18} />
              <span className="flex-1">{n.label}</span>
              {(() => {
                const n2 = n.badge === 'unread' ? unread : n.badge === 'requests' ? roleRequests : 0
                return n2 > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-extrabold flex items-center justify-center"
                    style={{ background: '#fff', color: 'var(--red)' }} title={n.badge === 'requests' ? 'Demandes de rôle à valider' : 'Messages non lus'}>
                    {n2 > 99 ? '99+' : n2}
                  </span>
                )
              })()}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto">
          <PlanCard />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
        {children}
      </main>
    </div>
  )
}
