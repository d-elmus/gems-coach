// Étapes d'une séance : { type, label, duration (min), zone, instructions }.

export function defaultBlocks(zone = 'Z2') {
  return [
    { type: 'warmup', label: 'Échauffement', duration: 15, zone: 'Z1' },
    { type: 'work', label: '', duration: '', zone },
    { type: 'cooldown', label: 'Retour au calme', duration: 10, zone: 'Z1' },
  ]
}

// Nettoie avant enregistrement (étapes vides retirées, nombres parsés).
export function cleanBlocks(blocks) {
  return blocks
    .filter(b => b.label?.trim() || b.duration || b.instructions?.trim())
    .map(b => ({
      type: b.type || 'work',
      label: b.label?.trim() || undefined,
      instructions: b.instructions?.trim() || undefined,
      zone: b.zone || undefined,
      duration: parseInt(b.duration) || undefined,
    }))
}
