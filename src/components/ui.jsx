import { useEffect } from 'react'
import { SPORT_META } from '../lib/planHelpers'

// ─── Icônes (trait 2px, style « lucide ») ─────────────────────────────────────
const PATHS = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  whistle: 'M11 11a5 5 0 1 0 10 0 5 5 0 0 0-10 0zM11 11H4a2 2 0 0 1-2-2V7h9M16 11h.01M7 7V4',
  calendar: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 2v4M8 2v4M3 10h18',
  list: 'M4 6h16M4 12h10M4 18h13',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41',
  card: 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20M6 15h4',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  plus: 'M12 5v14M5 12h14',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  down: 'M6 9l6 6 6-6',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  arrow: 'M5 12h14M13 5l7 7-7 7',
  run: 'M13 4a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0M7 21l3-6 3 2v5M5 12l3-3 4 1 2 3 3 1M10 15l-1-4',
  bike: 'M5.5 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM18.5 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 17.5V14l-3-3 4-3 2 3h2',
  swim: 'M2 12c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0M2 17c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0M2 7c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  dumbbell: 'M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  more: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  pin: 'M12 22s-8-6-8-12a8 8 0 0 1 16 0c0 6-8 12-8 12zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  swap: 'M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  sparkle: 'M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z',
  trend: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h2l6 4V6l-6 4H4a1 1 0 0 0-1 1zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12',
  clipboard: 'M9 3h6v3H9zM9 4.5H6a2 2 0 0 0-2 2V20a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6.5a2 2 0 0 0-2-2h-3M9 14l2 2 4-4',
  pinned: 'M9 4h6M10 4v6l-3 4h10l-3-4V4M12 14v7',
  filter: 'M3 5h18M6 12h12M10 19h4',
}

export function Icon({ name, size = 18, stroke = 2, className = '', style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      <path d={PATHS[name] || PATHS.more} />
    </svg>
  )
}

const SPORT_ICON = { run: 'run', bike: 'bike', swim: 'swim', brick: 'zap', strength: 'dumbbell', coaching: 'whistle' }
export function sportColor(sport) {
  if (sport === 'coaching') return '#9E1B2B'
  return SPORT_META[sport]?.color || '#9A8B72'
}
export function sportLabel(sport) {
  if (sport === 'coaching') return 'Coaching 1:1'
  return SPORT_META[sport]?.label || 'Séance'
}

// Pastille carrée teintée avec l'icône du sport (comme les maquettes).
export function SportBadge({ sport, size = 40 }) {
  const c = sportColor(sport)
  return (
    <div className="flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, borderRadius: size * 0.3, background: c + '18', color: c }}>
      <Icon name={SPORT_ICON[sport] || 'run'} size={size * 0.48} />
    </div>
  )
}

// ─── Avatars ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#B0576F', '#4F6FA6', '#B8893A', '#4E7F5A', '#7E5AA6', '#3E8C8C', '#9E1B2B', '#5A6472']
export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
function hashColor(key = '') {
  let h = 0
  for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
export function Avatar({ name, url, size = 36, ring = false, id }) {
  const style = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    boxShadow: ring ? '0 0 0 2px var(--surface)' : undefined,
  }
  if (url) return <img src={url} alt="" style={{ ...style, objectFit: 'cover' }} />
  return (
    <div style={{ ...style, background: hashColor(id || name), fontSize: size * 0.36 }}
      className="flex items-center justify-center font-extrabold text-white">
      {initials(name)}
    </div>
  )
}
export function AvatarStack({ people = [], max = 3, size = 28, total }) {
  const shown = people.slice(0, max)
  const rest = (total ?? people.length) - shown.length
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <div key={p.id || i} style={{ marginLeft: i ? -size * 0.3 : 0 }}>
          <Avatar name={p.full_name} url={p.photo_url} id={p.id} size={size} ring />
        </div>
      ))}
      {rest > 0 && (
        <div className="flex items-center justify-center font-extrabold text-white"
          style={{ marginLeft: -size * 0.3, width: size, height: size, borderRadius: '50%', background: '#1A1410', fontSize: size * 0.34, boxShadow: '0 0 0 2px var(--surface)' }}>
          +{rest}
        </div>
      )}
    </div>
  )
}

export function Mascot({ size = 44 }) {
  return <img src="/mascot.png" alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
}

// ─── Mise en page ────────────────────────────────────────────────────────────
export function Spinner({ full = false }) {
  const s = <div className="w-7 h-7 rounded-full border-[3px] animate-spin" style={{ borderColor: 'var(--red-soft)', borderTopColor: 'var(--red)' }} />
  return full ? <div className="flex items-center justify-center h-[60vh]">{s}</div> : s
}

export function PageHeader({ eyebrow, title, children }) {
  return (
    <div className="flex items-end justify-between gap-6 flex-wrap mb-7">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
      </div>
      {children && <div className="flex items-center gap-3 flex-wrap">{children}</div>}
    </div>
  )
}

export function Page({ children, wide = false }) {
  return <div className={`px-8 py-8 ${wide ? '' : 'max-w-[1320px]'} fade-up`}>{children}</div>
}

export function StatCard({ label, value, sub, icon, subTone }) {
  return (
    <div className="card p-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold ink2">{label}</p>
        {icon && (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
            <Icon name={icon} size={17} />
          </div>
        )}
      </div>
      <p className="text-[38px] leading-none font-extrabold tracking-tight">{value}</p>
      {sub && <p className="text-[13px] font-medium" style={{ color: subTone === 'good' ? 'var(--good)' : subTone === 'warn' ? 'var(--warn)' : 'var(--text3)' }}>{sub}</p>}
    </div>
  )
}

export function Empty({ icon = 'sparkle', title, text, children }) {
  return (
    <div className="card p-12 flex flex-col items-center text-center gap-3">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
        <Icon name={icon} size={26} />
      </div>
      <p className="text-lg font-extrabold">{title}</p>
      {text && <p className="text-sm muted max-w-md">{text}</p>}
      {children && <div className="mt-2 flex gap-3 flex-wrap justify-center">{children}</div>}
    </div>
  )
}

export function Modal({ title, eyebrow, onClose, children, footer, width = 560 }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(26,20,16,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}>
      <div className="w-full flex flex-col fade-up" onClick={e => e.stopPropagation()}
        style={{ maxWidth: width, maxHeight: '92vh', background: 'var(--bg)', borderRadius: 24, boxShadow: 'var(--shadow-lg)' }}>
        <div className="flex items-start justify-between gap-4 px-7 pt-6 pb-4">
          <div>
            {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
            <h3 className="text-xl font-extrabold">{title}</h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" style={{ width: 36, height: 36 }} aria-label="Fermer">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="px-7 pb-6 overflow-y-auto flex flex-col gap-5">{children}</div>
        {footer && <div className="px-7 py-4 flex items-center justify-end gap-3" style={{ borderTop: '1px solid var(--border)' }}>{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }) {
  return (
    <div className="min-w-0">
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <p className="text-xs muted mt-1.5">{hint}</p>}
    </div>
  )
}

// Barre de remplissage (places, licences…)
export function Meter({ value, max, tone = 'red', height = 6 }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0
  const color = tone === 'good' ? 'var(--good)' : tone === 'light' ? '#F6D5D8' : 'var(--red)'
  return (
    <div style={{ height, borderRadius: 99, background: tone === 'light' ? 'rgba(255,255,255,0.18)' : 'var(--surface3)' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: color, transition: 'width .3s' }} />
    </div>
  )
}

// Erreur de chargement : message lisible + « Réessayer ».
export function ErrorNotice({ error, onRetry, compact = false }) {
  const msg = typeof error === 'string' ? error : error?.message || 'Erreur inconnue'
  const missing = /does not exist|could not find the (table|function)|42P01|PGRST20[25]/i.test(`${error?.code || ''} ${msg}`)
  const text = missing
    ? "Une table manque dans Supabase : exécute la dernière version de db/clubs.sql (section V2), puis recharge."
    : `Le chargement a échoué : ${msg}`
  if (compact) {
    return (
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3 text-[13px]" style={{ background: 'var(--bad-soft)', color: 'var(--bad)' }}>
        <span className="flex-1">{text}</span>
        {onRetry && <button className="font-bold underline" onClick={onRetry}>Réessayer</button>}
      </div>
    )
  }
  return (
    <Empty icon="x" title="Impossible d'afficher cette page" text={text}>
      {onRetry && <button className="btn btn-ghost" onClick={onRetry}>Réessayer</button>}
    </Empty>
  )
}

// Liste déroulante « pilule » pour les filtres (membres, planning, séances…).
export function FilterSelect({ label, value, onChange, options, width }) {
  return (
    <select className="input" style={{ width: width || 'auto', minWidth: 130, borderRadius: 999, fontWeight: 600, color: value ? 'var(--red)' : undefined }}
      value={value} onChange={e => onChange(e.target.value)} aria-label={label}>
      <option value="">{label}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

export function SetupNotice() {
  return (
    <Empty icon="settings" title="Espace club pas encore activé"
      text="Les tables du club n'existent pas encore dans Supabase. Exécute db/clubs.sql dans Supabase → SQL Editor, puis recharge la page." />
  )
}
