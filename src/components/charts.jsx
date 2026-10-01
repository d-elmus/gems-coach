import { useState } from 'react'

// Courbe unique + aire (charge hebdo). Survol : repère vertical + infobulle.
export function AreaChart({ points, labels, height = 150, format = v => v }) {
  const [hover, setHover] = useState(null)
  const W = 320, H = height, PAD_X = 10, PAD_T = 14, PAD_B = 4
  const max = Math.max(1, ...points) * 1.15
  const x = i => PAD_X + (points.length > 1 ? (i / (points.length - 1)) * (W - PAD_X * 2) : (W - PAD_X * 2) / 2)
  const y = v => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B)
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')
  const area = `${line} L${x(points.length - 1)},${H} L${x(0)},${H} Z`
  const last = points.length - 1

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height, overflow: 'visible' }} preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#9E1B2B" stopOpacity="0.28" />
            <stop offset="1" stopColor="#9E1B2B" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(f => <line key={f} x1={0} x2={W} y1={PAD_T + f * (H - PAD_T - PAD_B)} y2={PAD_T + f * (H - PAD_T - PAD_B)} stroke="var(--border)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />)}
        <path d={area} fill="url(#areaFill)" />
        <path d={line} fill="none" stroke="#9E1B2B" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="var(--border-strong)" vectorEffect="non-scaling-stroke" />}
        {/* Zones de survol, plus larges que les points */}
        {points.map((_, i) => (
          <rect key={i} x={x(i) - (W / points.length) / 2} y={0} width={W / points.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {/* Points en HTML pour rester ronds malgré preserveAspectRatio="none" */}
      {points.map((v, i) => (i === last || i === hover) && (
        <div key={i} className="absolute rounded-full pointer-events-none"
          style={{ left: `${(x(i) / W) * 100}%`, top: y(v), width: i === last ? 12 : 9, height: i === last ? 12 : 9, transform: 'translate(-50%,-50%)', background: '#9E1B2B', boxShadow: '0 0 0 2.5px var(--surface)' }} />
      ))}
      {hover != null && (
        <div className="absolute px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-white pointer-events-none whitespace-nowrap"
          style={{ left: `${(x(hover) / W) * 100}%`, top: Math.max(0, y(points[hover]) - 40), transform: 'translateX(-50%)', background: 'var(--text1)' }}>
          {labels[hover]} · {format(points[hover])}
        </div>
      )}
      <div className="flex justify-between mt-3">
        {labels.map((l, i) => <span key={i} className="text-[11px] font-semibold" style={{ color: i === last ? 'var(--text1)' : 'var(--text3)' }}>{l}</span>)}
      </div>
    </div>
  )
}

// Anneau de progression (une seule valeur, pas un camembert).
export function Ring({ pct, size = 130, stroke = 12, label }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--red)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`} style={{ transition: 'stroke-dasharray .4s' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] font-extrabold leading-none">{pct}%</span>
        {label && <span className="text-[11px] muted mt-1">{label}</span>}
      </div>
    </div>
  )
}
