import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import AthleteDetail from './pages/AthleteDetail'
import AthletePlan from './pages/AthletePlan'
import { MessagesList, Conversation } from './pages/Messages'
import './index.css'

function PrivateRoute({ children }) {
  const { coach, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(147,22,33,0.2)', borderTopColor: '#931621' }} />
    </div>
  )
  if (!coach) return <Navigate to="/login" replace />
  if (coach.role !== 'coach' && coach.role !== 'admin') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-center px-6">
        <p className="text-white font-semibold mb-2">Accès non autorisé</p>
        <p className="text-sm" style={{ color: 'var(--text3)' }}>Ce portail est réservé aux coachs GEMS.</p>
      </div>
    </div>
  )
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/athletes/:id" element={<PrivateRoute><AthleteDetail /></PrivateRoute>} />
          <Route path="/athletes/:id/plan" element={<PrivateRoute><AthletePlan /></PrivateRoute>} />
          <Route path="/messages" element={<PrivateRoute><MessagesList /></PrivateRoute>} />
          <Route path="/messages/:id" element={<PrivateRoute><Conversation /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
