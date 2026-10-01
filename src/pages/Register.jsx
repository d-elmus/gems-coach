import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { finalizeCoachSignup } from '../lib/coachSignup'
import { useAuth } from '../context/AuthContext'
import Shell from '../components/AuthShell'

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

    // 1. Vérifier le code coach (facultatif : un coach invité par son club n'en a pas,
    // son invitation est rattachée à son email à la première connexion).
    const code = form.code.trim().toUpperCase()
    if (code) {
      const { data: codeRow, error: codeErr } = await supabase
        .from('coach_codes')
        .select('id, used_by')
        .eq('code', code)
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
    }

    // 2. Créer le compte auth — le code est stocké dans les métadonnées pour
    // être consommé plus tard si la confirmation par email est requise
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name, ...(code ? { coach_code: code } : {}) } }
    })
    if (authErr) { setError(authErr.message); setLoading(false); return }

    // Supabase répond sans erreur (anti-enumeration) même si l'email existe
    // déjà — identities vide = compte déjà existant, aucun email ne part.
    if (authData.user?.identities?.length === 0) {
      setError('Un compte existe déjà avec cet email. Va sur la page de connexion (et utilise "Mot de passe oublié ?" si besoin).')
      setLoading(false)
      return
    }

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
      <Shell title="Confirme ton email" subtitle={<>Entre le code à 6 chiffres reçu par email à <span style={{ color: 'var(--red)' }}>{form.email}</span> (vérifie aussi les spams).</>}>
        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              required
              className="input text-center tracking-[0.3em]"
              placeholder="000000"
            />
            {otpError && <p className="text-sm" style={{ color: 'var(--bad)' }}>{otpError}</p>}
            <button
              type="submit"
              disabled={otpLoading}
              className="btn btn-primary w-full mt-2"
            >
              {otpLoading ? 'Vérification...' : 'Confirmer'}
            </button>
          </form>
      </Shell>
    )
  }

  return (
    <Shell title="Créer un compte coach" subtitle="Tu as besoin d'un code d'invitation GEMS (ou d'une invitation de ton club).">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {[
            { key: 'name', label: 'Nom complet', type: 'text', placeholder: 'Jean Dupont' },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'coach@example.com' },
            { key: 'password', label: 'Mot de passe', type: 'password', placeholder: '••••••••' },
            { key: 'code', label: 'Code invitation (facultatif si ton club t\'a invité)', type: 'text', placeholder: 'GEMS-COACH-XXXXX', optional: true },
          ].map(({ key, label, type, placeholder, optional }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={set(key)}
                required={!optional}
                className="input"
                placeholder={placeholder}
              />
            </div>
          ))}

          {error && <p className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full mt-2"
          >
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>

      <p className="text-center text-sm mt-6" style={{ color: 'var(--text3)' }}>
          Déjà un compte ?{' '}
          <Link to="/login" className="font-semibold" style={{ color: 'var(--red)' }}>Se connecter</Link>
        </p>
    </Shell>
  )
}
