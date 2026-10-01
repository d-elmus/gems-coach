import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Shell from '../components/AuthShell'

// Compte authentifié mais pas encore promu coach (email confirmé après une
// inscription interrompue, code jamais saisi, etc.) : on lui laisse une
// chance de rentrer son code plutôt que de le renvoyer se réinscrire.
function ClaimCodeForm() {
  const { claimCoachCode, signOut } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await claimCoachCode(code)
    if (error) {
      setError(error.message === 'invalid_code'
        ? 'Code invalide ou déjà utilisé.'
        : 'Erreur, réessaie.')
      setLoading(false)
    } else navigate('/')
  }

  return (
    <Shell title="Finalise ton compte coach" subtitle="Ton compte est confirmé mais pas encore activé. Entre ton code d'invitation coach.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value)}
          required
          className="input"
          placeholder="GEMS-COACH-XXXXX"
        />
        {error && <p className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full mt-2"
        >
          {loading ? 'Activation...' : 'Activer mon compte coach'}
        </button>
      </form>
      <button onClick={signOut} className="text-center text-sm mt-6 w-full" style={{ color: 'var(--text3)' }}>
        Se déconnecter
      </button>
    </Shell>
  )
}

// Compte pas encore confirmé : ce projet envoie un code à 6 chiffres par
// email pour confirmer un signup (pas un lien cliquable).
function ConfirmEmailForm({ email }) {
  const { confirmSignupOtp } = useAuth()
  const navigate = useNavigate()
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await confirmSignupOtp(email, otp)
    if (error) {
      setError('Code incorrect ou expiré.')
      setLoading(false)
    } else navigate('/')
  }

  return (
    <Shell title="Confirme ton email" subtitle={`Entre le code à 6 chiffres reçu par email à ${email}.`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          inputMode="numeric"
          value={otp}
          onChange={e => setOtp(e.target.value)}
          required
          className="input text-center tracking-[0.3em]"
          placeholder="000000"
        />
        {error && <p className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full mt-2"
        >
          {loading ? 'Vérification...' : 'Confirmer'}
        </button>
      </form>
    </Shell>
  )
}

// Mot de passe oublié : demande un OTP par email, le vérifie, puis fixe un
// nouveau mot de passe. Utile pour un compte athlète existant dont le
// propriétaire ne se souvient plus du mot de passe.
function ForgotPasswordForm({ onDone }) {
  const { sendPasswordResetOtp, resetPasswordWithOtp } = useAuth()
  const [step, setStep] = useState('email') // 'email' | 'otp' | 'password'
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSendOtp(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await sendPasswordResetOtp(email)
    setLoading(false)
    if (error) setError("Email introuvable ou erreur. Vérifie l'adresse.")
    else setStep('otp')
  }

  async function handleVerifyOtp(e) {
    e.preventDefault()
    if (otp.length < 6) { setError('Entre le code à 6 chiffres reçu par email.'); return }
    setLoading(true); setError('')
    const { error } = await resetPasswordWithOtp(email, otp, pw)
    setLoading(false)
    if (error) setError('Code incorrect/expiré, ou mot de passe trop court (6 caractères min).')
    else onDone()
  }

  if (step === 'email') {
    return (
      <Shell title="Mot de passe oublié" subtitle="Entre ton email, on t'envoie un code à 6 chiffres.">
        <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="input"
            placeholder="coach@example.com"
          />
          {error && <p className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}
          <button type="submit" disabled={loading}
            className="btn btn-primary w-full mt-2">
            {loading ? 'Envoi...' : 'Envoyer le code'}
          </button>
        </form>
      </Shell>
    )
  }

  return (
    <Shell title="Nouveau mot de passe" subtitle={`Code envoyé à ${email}. Entre-le avec ton nouveau mot de passe.`}>
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
        <input
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          required
          className="input"
          placeholder="Nouveau mot de passe"
        />
        {error && <p className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}
        <button type="submit" disabled={loading}
          className="btn btn-primary w-full mt-2">
          {loading ? 'Validation...' : 'Valider'}
        </button>
      </form>
    </Shell>
  )
}

export default function Login() {
  const { signIn, hasSession, coach, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const [forgotPw, setForgotPw] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) {
      if (error.message === 'email_not_confirmed') {
        setNeedsConfirm(true)
      } else {
        setError(error.message === 'needs_code'
          ? "Connexion réussie, mais ce compte n'est pas encore activé comme coach."
          : 'Email ou mot de passe incorrect')
      }
      setLoading(false)
    }
    else navigate('/')
  }

  if (forgotPw) return <ForgotPasswordForm onDone={() => navigate('/')} />
  if (needsConfirm) return <ConfirmEmailForm email={email} />
  if (!authLoading && hasSession && !coach) return <ClaimCodeForm />

  return (
    <Shell title="Connexion" subtitle="Espace coachs et clubs GEMS">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="input"
            placeholder="coach@example.com"
          />
        </div>
        <div>
          <label className="label">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="input"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full mt-2"
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>

      <button onClick={() => setForgotPw(true)} className="text-center text-sm mt-4 w-full" style={{ color: 'var(--text3)' }}>
        Mot de passe oublié ?
      </button>

      <p className="text-center text-sm mt-6" style={{ color: 'var(--text3)' }}>
        Pas encore de compte ?{' '}
        <Link to="/register" className="font-semibold" style={{ color: 'var(--red)' }}>
          S'inscrire
        </Link>
      </p>
    </Shell>
  )
}
