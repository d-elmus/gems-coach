import { useCallback, useEffect, useState } from 'react'

// Chargement asynchrone d'une page : { data, error, loading, reload }.
// `fn` doit lever une erreur en cas d'échec (voir must() dans clubData).
// Les données précédentes restent affichées pendant un rechargement (pas de clignotement).
export function useLoader(fn, deps) {
  const [tick, setTick] = useState(0)
  const [state, setState] = useState({ data: null, error: null, done: false })

  useEffect(() => {
    let alive = true
    Promise.resolve().then(fn).then(
      data => { if (alive) setState({ data, error: null, done: true }) },
      error => { if (alive) setState(s => ({ data: s.data, error, done: true })) },
    )
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick(t => t + 1), [])
  return { data: state.data, error: state.error, loading: !state.done, reload }
}
