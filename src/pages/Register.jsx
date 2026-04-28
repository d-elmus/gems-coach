import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', name: '', code: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 1. Vérifier le code coach
    const { data: codeRow, error: codeErr } = await supabase
      .from('coach_codes')
      .select('id, used_by')
      .eq('code', form.code.trim().toUpperCase())
      .single()

    if (codeErr || !codeRow) {
      setError('Code invalide. Contacte GEMS pour obtenir ton code.')
      setLoading(false)
      return
    }
    if (codeRow.used_by) {
      setError('Ce code a déjà été utilisé.')
      setLoading(false)
      return
    }

    // 2. Créer le compte auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name, role: 'coach' } }
    })
    if (authErr) { setError(authErr.message); setLoading(false); return }

    const userId = authData.user?.id
    if (!userId) { setError('Erreur lors de la création du compte.'); setLoading(false); return }

    // 3. Se connecter pour avoir une session active
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (signInErr) { setError(signInErr.message); setLoading(false); return }

    // 4. Maintenant on a une session → mettre à jour le profil avec rôle coach
    await supabase.from('profiles').upsert({
      id: userId,
      full_name: form.name,
      email: form.email,
      role: 'coach',
      gender: null,
    })

    // 5. Marquer le code comme utilisé
    await supabase.from('coach_codes').update({ used_by: userId, used_at: new Date().toISOString() }).eq('id', codeRow.id)

    navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--red)' }}>
            <span className="text-white font-bold text-lg">G</span>
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">GEMS</p>
            <p className="text-xs" style={{ color: 'var(--text3)' }}>Coach Portal</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">Créer un compte coach</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text3)' }}>Tu as besoin d'un code d'invitation</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {[
            { key: 'name', label: 'Nom complet', type: 'text', placeholder: 'Jean Dupont' },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'coach@example.com' },
            { key: 'password', label: 'Mot de passe', type: 'password', placeholder: '••••••••' },
            { key: 'code', label: 'Code invitation', type: 'text', placeholder: 'GEMS-COACH-XXXXX' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text3)' }}>{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={set(key)}
                required
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                placeholder={placeholder}
              />
            </div>
          ))}

          {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white mt-2"
            style={{ background: 'var(--red)', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--text3)' }}>
          Déjà un compte ?{' '}
          <Link to="/login" className="font-semibold" style={{ color: 'var(--cyan)' }}>Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
