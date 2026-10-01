import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { ClubProvider, useClub } from './context/ClubContext'
import Layout from './components/Layout'
import { Spinner, Page, SetupNotice } from './components/ui'
import Login from './pages/Login'
import Register from './pages/Register'
import { MessagesList, Conversation } from './pages/Messages'
import CoachDashboard from './pages/coach/CoachDashboard'
import Athletes from './pages/coach/Athletes'
import AthleteDetail from './pages/coach/AthleteDetail'
import PlanBuilder from './pages/coach/PlanBuilder'
import Agenda from './pages/coach/Agenda'
import Plans from './pages/coach/Plans'
import Settings from './pages/coach/Settings'
import ClubDashboard from './pages/club/ClubDashboard'
import Members from './pages/club/Members'
import Coaches from './pages/club/Coaches'
import Planning from './pages/club/Planning'
import Subscription from './pages/club/Subscription'
import ClubSettings from './pages/club/ClubSettings'
import CreateClub from './pages/club/CreateClub'
import Workouts from './pages/Workouts'
import Announcements from './pages/Announcements'
import './index.css'

function PrivateRoute({ children }) {
  const { coach, loading } = useAuth()
  const club = useClub()
  if (loading || (coach && club.loading)) return <div className="h-screen flex items-center justify-center"><Spinner /></div>
  if (!coach) return <Navigate to="/login" replace />
  if (coach.role !== 'coach' && coach.role !== 'admin') return (
    <div className="h-screen flex items-center justify-center text-center px-6">
      <div>
        <p className="font-extrabold text-lg mb-1">Accès non autorisé</p>
        <p className="text-sm muted">Ce portail est réservé aux coachs et aux clubs GEMS.</p>
      </div>
    </div>
  )
  return <Layout>{children}</Layout>
}

// Pages de l'espace club : réservées aux admins d'un club.
function ClubRoute({ children, needsAdmin = true }) {
  const { club, isAdmin, setupNeeded } = useClub()
  if (setupNeeded) return <Page><SetupNotice /></Page>
  if (!club) return <Navigate to="/club/new" replace />
  if (needsAdmin && !isAdmin) return <Navigate to="/" replace />
  return children
}

// Accueil : tableau de bord club pour un admin en espace club, sinon tableau de bord coach.
function Home() {
  const { space, isAdmin, club } = useClub()
  if (club && isAdmin && space === 'club') return <Navigate to="/club" replace />
  return <CoachDashboard />
}

const P = el => <PrivateRoute>{el}</PrivateRoute>

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ClubProvider>
          <NotificationsProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Espace coach */}
              <Route path="/" element={P(<Home />)} />
              <Route path="/athletes" element={P(<Athletes />)} />
              <Route path="/athletes/:id" element={P(<AthleteDetail />)} />
              <Route path="/athletes/:id/builder" element={P(<PlanBuilder />)} />
              <Route path="/agenda" element={P(<ClubRoute needsAdmin={false}><Agenda /></ClubRoute>)} />
              <Route path="/workouts" element={P(<ClubRoute needsAdmin={false}><Workouts space="coach" /></ClubRoute>)} />
              <Route path="/announcements" element={P(<ClubRoute needsAdmin={false}><Announcements space="coach" /></ClubRoute>)} />
              <Route path="/plans" element={P(<Plans />)} />
              <Route path="/messages" element={P(<MessagesList />)} />
              <Route path="/messages/:id" element={P(<Conversation />)} />
              <Route path="/settings" element={P(<Settings />)} />

              {/* Espace club */}
              <Route path="/club" element={P(<ClubRoute><ClubDashboard /></ClubRoute>)} />
              <Route path="/club/members" element={P(<ClubRoute><Members /></ClubRoute>)} />
              <Route path="/club/coaches" element={P(<ClubRoute><Coaches /></ClubRoute>)} />
              <Route path="/club/planning" element={P(<ClubRoute><Planning /></ClubRoute>)} />
              <Route path="/club/workouts" element={P(<ClubRoute><Workouts space="club" /></ClubRoute>)} />
              <Route path="/club/announcements" element={P(<ClubRoute><Announcements space="club" /></ClubRoute>)} />
              <Route path="/club/subscription" element={P(<ClubRoute><Subscription /></ClubRoute>)} />
              <Route path="/club/settings" element={P(<ClubRoute><ClubSettings /></ClubRoute>)} />
              <Route path="/club/new" element={P(<CreateClub />)} />

              {/* Anciennes URLs */}
              <Route path="/profile" element={<Navigate to="/settings" replace />} />
              <Route path="/athletes/:id/plan" element={<Navigate to=".." relative="path" replace />} />
              <Route path="/athletes/:id/plans" element={<Navigate to=".." relative="path" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </NotificationsProvider>
        </ClubProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
