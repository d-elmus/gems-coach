import { addDays, sameDay, fmtTime } from '../lib/clubData'
import { sportColor } from './ui'

const HOUR_PX = 52
const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// Place les séances qui se chevauchent côte à côte dans une même journée.
function layoutDay(events) {
  const sorted = [...events].sort((a, b) => a.start - b.start)
  const cols = []
  const placed = sorted.map(e => {
    let c = cols.findIndex(end => end <= e.start)
    if (c === -1) { c = cols.length; cols.push(e.end) } else cols[c] = e.end
    return { e, c }
  })
  return placed.map(p => ({ ...p, n: cols.length }))
}

// Semaine type agenda (maquette « Planning du club » / « Mon agenda »).
export default function WeekCalendar({ weekStart, sessions, onSelect, onCreate, showCoach = false }) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Plage horaire : 7h–21h par défaut, élargie si des séances en sortent.
  let minH = 7, maxH = 21
  for (const s of sessions) {
    minH = Math.min(minH, s.start.getHours())
    maxH = Math.max(maxH, Math.ceil(s.end.getHours() + s.end.getMinutes() / 60))
  }
  const hours = Array.from({ length: maxH - minH }, (_, i) => minH + i)

  return (
    <div className="card overflow-hidden">
      <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
        <div />
        {days.map((d, i) => {
          const isToday = sameDay(d, today)
          return (
            <div key={i} className="px-3 py-3 flex items-baseline gap-2" style={{ borderLeft: '1px solid var(--border)' }}>
              <span className="text-[13px] font-semibold" style={{ color: isToday ? 'var(--red)' : 'var(--text3)' }}>{DAY_NAMES[i]}</span>
              <span className="text-lg font-extrabold" style={{ color: isToday ? 'var(--red)' : 'var(--text1)' }}>{d.getDate()}</span>
            </div>
          )
        })}
      </div>

      <div className="grid relative" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        {/* Heures */}
        <div>
          {hours.map(h => (
            <div key={h} className="text-[11px] font-semibold muted text-right pr-2" style={{ height: HOUR_PX, transform: 'translateY(-7px)' }}>
              {h > minH ? `${h}h` : ''}
            </div>
          ))}
        </div>

        {days.map((d, di) => {
          const isToday = sameDay(d, today)
          const dayEvents = layoutDay(sessions.filter(s => sameDay(s.start, d)))
          return (
            <div key={di} className="relative" style={{ borderLeft: '1px solid var(--border)', background: isToday ? 'rgba(158,27,43,0.035)' : undefined }}>
              {hours.map(h => (
                <div key={h}
                  onClick={() => onCreate?.(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h))}
                  className={onCreate ? 'cursor-pointer hover:bg-[rgba(158,27,43,0.05)]' : ''}
                  style={{ height: HOUR_PX, borderTop: h > minH ? '1px solid var(--border)' : 'none' }} />
              ))}

              {dayEvents.map(({ e, c, n }) => {
                const top = (e.start.getHours() + e.start.getMinutes() / 60 - minH) * HOUR_PX
                const realH = ((e.end - e.start) / 3600000) * HOUR_PX
                const tiny = realH < 44 // créneau court (1:1 de 30 min) : une seule ligne
                const height = tiny ? Math.max(22, realH - 3) : realH - 4
                const color = sportColor(e.kind === 'one_on_one' ? 'coaching' : e.sport)
                const isFree = e.kind === 'one_on_one' && e.booked.length === 0
                const oneBooked = e.kind === 'one_on_one' && !isFree
                const compact = height < 70
                const name = e.kind === 'one_on_one' ? (e.booked[0]?.profile?.full_name || 'Libre') : e.title
                return (
                  <button key={e.id} onClick={ev => { ev.stopPropagation(); onSelect?.(e) }}
                    title={`${fmtTime(e.start)} · ${name}`}
                    className={`absolute text-left rounded-xl overflow-hidden transition-shadow hover:shadow-lg ${tiny ? 'px-2 py-0 flex items-center' : 'px-2.5 py-1.5'}`}
                    style={{
                      top: top + 1, height,
                      left: `calc(${(c / n) * 100}% + 4px)`, width: `calc(${100 / n}% - 8px)`,
                      background: oneBooked ? 'var(--surface3)' : e.full ? 'var(--red)' : isFree ? 'var(--red-soft)' : 'var(--surface)',
                      color: e.full && !oneBooked ? '#fff' : 'var(--text1)',
                      border: isFree ? '1.5px dashed var(--red)' : '1px solid var(--border)',
                      borderLeft: `4px solid ${e.full && !oneBooked ? '#fff' : color}`,
                      boxShadow: 'var(--shadow)',
                    }}>
                    {tiny ? (
                      <p className="text-[11px] leading-none truncate"><span className="opacity-75">{fmtTime(e.start)}</span> <b>{name}</b></p>
                    ) : (
                      <>
                        <p className="text-[11px] font-semibold opacity-80 leading-tight">{fmtTime(e.start)}</p>
                        <p className={`text-[12px] font-extrabold leading-tight ${compact ? 'truncate' : 'line-clamp-2'}`}>{name}</p>
                        {!compact && showCoach && e.coach && (
                          <p className="text-[11px] opacity-70 truncate">{e.coach.full_name}</p>
                        )}
                        {!compact && (
                          <span className="inline-block mt-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md"
                            style={{
                              background: e.full ? 'rgba(255,255,255,0.2)' : isFree ? 'transparent' : 'var(--good-soft)',
                              color: e.full ? '#fff' : isFree ? 'var(--red)' : 'var(--good)',
                            }}>
                            {e.kind === 'one_on_one'
                              ? (isFree ? 'Libre' : 'Réservé')
                              : e.full ? `Complet · ${e.booked.length}/${e.capacity}`
                                : e.capacity ? `${e.booked.length}/${e.capacity} places` : `${e.booked.length} inscrits`}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function CalendarLegend() {
  const items = [['swim', 'Natation'], ['bike', 'Vélo'], ['run', 'Course'], ['brick', 'Enchaîné'], ['strength', 'Renfo'], ['coaching', 'Coaching 1:1']]
  return (
    <div className="flex items-center gap-5 flex-wrap mt-4 text-[12px] font-semibold ink2">
      {items.map(([k, l]) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: sportColor(k) }} /> {l}
        </span>
      ))}
      <span className="flex-1" />
      <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} /> Places libres</span>
      <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded" style={{ background: 'var(--red)' }} /> Complet</span>
      <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded" style={{ background: 'var(--red-soft)', border: '1.5px dashed var(--red)' }} /> 1:1 libre</span>
    </div>
  )
}
