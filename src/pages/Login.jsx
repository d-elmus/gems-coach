import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Shell({ title, subtitle, children }) {
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
        <h1 className="text-2xl font-bold text-white mb-1">{title}</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text3)' }}>{subtitle}</p>
        {children}
      </div>
    </div>
  )
}

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
          className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
          placeholder="GEMS-COACH-XXXXX"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-semibold text-white mt-2 transition-opacity"
          style={{ background: 'var(--red)', opacity: loading ? 0.6 : 1 }}
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

export default function Login() {
  const { signIn, hasSession, coach, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message === 'needs_code'
        ? "Connexion réussie, mais ce compte n'est pas encore activé comme coach."
        : 'Email ou mot de passe incorrect')
      setLoading(false)
    }
    else navigate('/')
  }

  if (!authLoading && hasSession && !coach) return <ClaimCodeForm />

  return (
    <Shell title="Connexion" subtitle="Accès réservé aux coachs GEMS">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text3)' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
            placeholder="coach@example.com"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text3)' }}>Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-semibold text-white mt-2 transition-opacity"
          style={{ background: 'var(--red)', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: 'var(--text3)' }}>
        Pas encore de compte ?{' '}
        <Link to="/register" className="font-semibold" style={{ color: 'var(--cyan)' }}>
          S'inscrire
        </Link>
      </p>
    </Shell>
  )
}
