import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
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
    if (error) { setError('Email ou mot de passe incorrect'); setLoading(false) }
    else navigate('/')
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

        <h1 className="text-2xl font-bold text-white mb-1">Connexion</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text3)' }}>Accès réservé aux coachs GEMS</p>

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
      </div>
    </div>
  )
}
