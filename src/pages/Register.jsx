import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { finalizeCoachSignup } from '../lib/coachSignup'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const navigate = useNavigate()
  const { confirmSignupOtp } = useAuth()
  const [form, setForm] = useState({ email: '', password: '', name: '', code: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)

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

    // 2. Créer le compte auth — le code est stocké dans les métadonnées pour
    // être consommé plus tard si la confirmation par email est requise
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name, role: 'coach', coach_code: form.code.trim().toUpperCase() } }
    })
    if (authErr) { setError(authErr.message); setLoading(false); return }

    const userId = authData.user?.id
    if (!userId) { setError('Erreur lors de la création du compte.'); setLoading(false); return }

    if (!authData.session) {
      // Confirmation par email requise : pas de session active, on ne peut
      // pas encore écrire le profil (RLS). Finalisé automatiquement à la
      // première connexion réussie (voir AuthContext.fetchCoach/signIn).
      setLoading(false)
      setConfirmSent(true)
      return
    }

    // Confirmation email désactivée → session déjà active, on finalise tout de suite
    await finalizeCoachSignup(userId)
    navigate('/')
  }

  async function handleVerifyOtp(e) {
    e.preventDefault()
    setOtpLoading(true)
    setOtpError('')
    const { error } = await confirmSignupOtp(form.email, otp)
    setOtpLoading(false)
    if (error) setOtpError('Code incorrect ou expiré.')
    else navigate('/')
  }

  if (confirmSent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-white mb-1 text-center">Confirme ton email</h1>
          <p className="text-sm mb-8 text-center" style={{ color: 'var(--text3)' }}>
            Entre le code à 6 chiffres reçu par email à <span style={{ color: 'var(--cyan)' }}>{form.email}</span> (vérifie aussi les spams).
          </p>
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none text-center tracking-[0.3em]"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
              placeholder="000000"
            />
            {otpError && <p className="text-sm" style={{ color: '#f87171' }}>{otpError}</p>}
            <button
              type="submit"
              disabled={otpLoading}
              className="w-full py-3 rounded-xl font-semibold text-white mt-2"
              style={{ background: 'var(--red)', opacity: otpLoading ? 0.6 : 1 }}
            >
              {otpLoading ? 'Vérification...' : 'Confirmer'}
            </button>
          </form>
        </div>
      </div>
    )
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
