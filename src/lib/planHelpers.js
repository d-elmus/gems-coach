// ─── Phase auto-assignment ────────────────────────────────────────────────────
export function autoAssignPhases(totalWeeks, recoveryFreq = 4) {
  const phases = []
  if (totalWeeks <= 4) {
    return Array.from({ length: totalWeeks }, (_, i) => ({
      phase: i >= totalWeeks - 1 ? 'TAPER' : 'BASE',
      isRecovery: false,
    }))
  }
  const taperWeeks  = totalWeeks >= 12 ? 2 : 1
  const peakWeeks   = totalWeeks >= 16 ? 2 : 0
  const prepWeeks   = totalWeeks >= 10 ? 2 : 1
  const buildWeeks  = Math.max(2, Math.floor((totalWeeks - taperWeeks - peakWeeks - prepWeeks) * 0.4))
  const baseWeeks   = totalWeeks - taperWeeks - peakWeeks - prepWeeks - buildWeeks

  const sequence = [
    ...Array(prepWeeks).fill('PREP'),
    ...Array(Math.max(0, baseWeeks)).fill('BASE'),
    ...Array(buildWeeks).fill('BUILD'),
    ...Array(peakWeeks).fill('PEAK'),
    ...Array(taperWeeks).fill('TAPER'),
  ]

  return sequence.slice(0, totalWeeks).map((phase, i) => ({
    phase,
    isRecovery: phase !== 'TAPER' && phase !== 'PEAK' && (i + 1) % recoveryFreq === 0,
  }))
}

// ─── TSS target by phase ──────────────────────────────────────────────────────
const TSS_PEAK = { beginner: 280, intermediate: 420, advanced: 560, expert: 700 }
const TSS_FACTOR = { PREP: 0.60, BASE: 0.75, BUILD: 0.88, RACE_SPEC: 0.92, PEAK: 0.95, TAPER: 0.50 }

export function weekTSSTarget(phase, isRecovery, level = 'intermediate') {
  const peak = TSS_PEAK[level] ?? 420
  const factor = TSS_FACTOR[phase] ?? 0.75
  return Math.round(peak * factor * (isRecovery ? 0.65 : 1))
}

// ─── Zone targets from athlete data ──────────────────────────────────────────
export function getZoneTargets(athletePlan, sport, zone) {
  if (!zone || !athletePlan) return null
  const zNum = parseInt(zone.replace('Z', ''))

  if (sport === 'run' && athletePlan.zones?.run) {
    const runZones = athletePlan.zones.run.zones
    const hrZones  = athletePlan.zones.run.hrZones
    const z = runZones?.find(z => z.z === zone)
    const hr = hrZones?.[`z${zNum}`]
    if (z || hr) return {
      pace:  z?.range  || null,
      hr:    hr ? `${hr.min}–${hr.max === 999 ? '∞' : hr.max} bpm` : null,
      label: z?.name   || null,
    }
  }

  if (sport === 'bike' && athletePlan.zones?.bike) {
    const ftp    = athletePlan.zones.bike.ftp || athletePlan.pbs?.ftp
    const hrZones = athletePlan.zones.bike.hrZones
    const hr = hrZones?.[`z${zNum}`]
    const ftpRanges = { Z1:'< 55%', Z2:'56–75%', Z3:'76–90%', Z4:'91–105%', Z5:'106–120%' }
    return {
      power: ftp ? `${Math.round(ftp * (zNum === 1 ? 0.55 : zNum === 2 ? 0.65 : zNum === 3 ? 0.83 : zNum === 4 ? 0.98 : 1.13))}W (${ftpRanges[zone] || ''} FTP)` : (ftpRanges[zone] || null),
      hr: hr ? `${hr.min}–${hr.max === 999 ? '∞' : hr.max} bpm` : null,
    }
  }

  if (sport === 'swim' && athletePlan.zones?.swim) {
    const css = athletePlan.pbs?.css
    const cssRanges = { Z1:'+20s', Z2:'+10s', Z3:'+5s', Z4:'CSS', Z5:'-5s' }
    return { pace: css ? `${cssRanges[zone] || ''} /100m (CSS: ${css})` : null }
  }

  return null
}

// ─── Session presets ──────────────────────────────────────────────────────────
export const SESSION_PRESETS = {
  run: [
    { label: 'Récupération active',   zone: 'Z1', duration: 30, distance: 5,   tssBase: 28 },
    { label: 'Endurance fondamentale', zone: 'Z2', duration: 50, distance: 8,   tssBase: 45 },
    { label: 'Tempo / Seuil',         zone: 'Z3', duration: 45, distance: 9,   tssBase: 62 },
    { label: 'Seuil lactique',        zone: 'Z4', duration: 50, distance: 10,  tssBase: 72 },
    { label: 'Intervalles VO2max',    zone: 'Z5', duration: 55, distance: 10,  tssBase: 80 },
    { label: 'Sortie longue',         zone: 'Z2', duration: 90, distance: 18,  tssBase: 90 },
    { label: 'Fartlek',               zone: 'Z3', duration: 50, distance: 10,  tssBase: 60 },
    { label: 'Allure course',         zone: 'Z4', duration: 60, distance: 12,  tssBase: 75 },
  ],
  bike: [
    { label: 'Récupération vélo',     zone: 'Z1', duration: 45, distance: 15,  tssBase: 30 },
    { label: 'Endurance Z2',          zone: 'Z2', duration: 90, distance: 40,  tssBase: 65 },
    { label: 'Sweet Spot',            zone: 'Z3', duration: 75, distance: 35,  tssBase: 78 },
    { label: 'FTP / Seuil',          zone: 'Z4', duration: 70, distance: 35,  tssBase: 88 },
    { label: 'Intervalles VO2max',    zone: 'Z5', duration: 60, distance: 28,  tssBase: 95 },
    { label: 'Sortie longue',         zone: 'Z2', duration: 180,distance: 80,  tssBase: 120 },
    { label: 'Over-Under',            zone: 'Z4', duration: 75, distance: 38,  tssBase: 82 },
  ],
  swim: [
    { label: 'Natation facile',       zone: 'Z1', duration: 40, distance: 1500, tssBase: 30 },
    { label: 'Endurance natation',    zone: 'Z2', duration: 50, distance: 2000, tssBase: 40 },
    { label: 'CSS / Seuil',          zone: 'Z3', duration: 55, distance: 2500, tssBase: 55 },
    { label: 'Intervalles courts',    zone: 'Z5', duration: 50, distance: 2000, tssBase: 65 },
    { label: 'Technique / Drills',    zone: 'Z1', duration: 45, distance: 1800, tssBase: 35 },
  ],
  brick: [
    { label: 'Brick court',           zone: 'Z3', duration: 75,  distance: null, tssBase: 90 },
    { label: 'Brick longue distance', zone: 'Z3', duration: 150, distance: null, tssBase: 130 },
    { label: 'Simulation course',     zone: 'Z4', duration: 180, distance: null, tssBase: 160 },
  ],
  strength: [
    { label: 'Renforcement général',  zone: null, duration: 45, distance: null, tssBase: 40 },
    { label: 'Gainage / Core',        zone: null, duration: 30, distance: null, tssBase: 25 },
    { label: 'Plyométrie',            zone: null, duration: 40, distance: null, tssBase: 35 },
  ],
}

export const SPORT_META = {
  swim:     { label: 'Natation',  emoji: '🏊', color: '#0BBCD4', distUnit: 'm'  },
  bike:     { label: 'Vélo',     emoji: '🚴', color: '#F59E0B', distUnit: 'km' },
  run:      { label: 'Course',   emoji: '🏃', color: '#EF4444', distUnit: 'km' },
  brick:    { label: 'Brick',    emoji: '🔗', color: '#8B5CF6', distUnit: 'km' },
  strength: { label: 'Renfo',    emoji: '💪', color: '#10B981', distUnit: null },
}

export const ZONE_COLORS = {
  Z1: '#7DF9FF', Z2: '#00FA9A', Z3: '#FF7F50', Z4: '#FF1493', Z5: '#9D00FF',
}

export const DISCIPLINES = [
  'sprint','olympique','halfIronman','ironman','triathlon',
  'run5k','run10k','semi','marathon','bike','swim',
]

export const PHASES = ['PREP','BASE','BUILD','RACE_SPEC','PEAK','TAPER']
export const PHASE_COLORS = {
  PREP:'#B52E38', BASE:'#0A9DAB', BUILD:'#D9541A',
  RACE_SPEC:'#8B1A1A', PEAK:'#C0392B', TAPER:'#1E8449',
}
export const LEVELS = ['beginner','intermediate','advanced','expert']
export const DAYS_SHORT = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

export const COACH_COLOR = '#22C5D5'
