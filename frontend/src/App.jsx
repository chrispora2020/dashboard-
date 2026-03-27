import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import ApiDashboard from './components/ApiDashboard'
import Dashboard from './components/Dashboard'
import ImportacionConversos from './components/ImportacionConversos'
import Login from './components/Login'
import Navbar from './components/Navbar'
import CouncilAssignments from './components/CouncilAssignments'
import StakeMessagesPlan from './components/StakeMessagesPlan'
import SpeakersPlanView from './components/SpeakersPlanView'
import Upload from './components/Upload'

const LOCAL_USER_KEY = 'user'
const SESSION_ROLE_KEY = 'dashboard_role'
const SESSION_NAME_KEY = 'dashboard_role_name'
const ROLE_CONSEJO = 'consejo'
const ROLE_PRESIDENCIA = 'presidencia'
const ALLOWED_ROLES = [ROLE_CONSEJO, ROLE_PRESIDENCIA]

function resolveStoredUser() {
  const storedRole = localStorage.getItem(SESSION_ROLE_KEY)
  const storedName = localStorage.getItem(SESSION_NAME_KEY)
  const storedUser = localStorage.getItem(LOCAL_USER_KEY)

  if (!storedRole || !ALLOWED_ROLES.includes(storedRole)) {
    return null
  }

  try {
    const parsedUser = JSON.parse(storedUser)

    if (parsedUser?.name || parsedUser?.email || parsedUser?.role) {
      return {
        ...parsedUser,
        role: storedRole,
        name: storedName || parsedUser?.name || (storedRole === ROLE_PRESIDENCIA ? 'Presidencia' : 'Consejo')
      }
    }
  } catch (error) {
    console.error('No fue posible leer el usuario guardado, se reiniciará la sesión.', error)
  }

  return {
    role: storedRole,
    name: storedName || (storedRole === ROLE_PRESIDENCIA ? 'Presidencia' : 'Consejo'),
    email: `${storedRole}@dashboard.local`
  }
}

export default function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    setUser(resolveStoredUser())
  }, [])

  function handleLogin(loggedUser) {
    const role = loggedUser?.role

    if (!ALLOWED_ROLES.includes(role)) {
      return
    }

    const normalizedUser = {
      ...loggedUser,
      role,
      name: loggedUser?.name || (role === ROLE_PRESIDENCIA ? 'Presidencia' : 'Consejo'),
      email: loggedUser?.email || `${role}@dashboard.local`
    }

    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(normalizedUser))
    localStorage.setItem(SESSION_ROLE_KEY, role)
    localStorage.setItem(SESSION_NAME_KEY, normalizedUser.name)
    setUser(normalizedUser)
  }

  function handleLogout() {
    localStorage.removeItem(LOCAL_USER_KEY)
    localStorage.removeItem(SESSION_ROLE_KEY)
    localStorage.removeItem(SESSION_NAME_KEY)
    setUser(null)
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  const canManageLists = user.role === ROLE_PRESIDENCIA

  return (
    <HashRouter>
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <Navbar
          user={user}
          onLogout={handleLogout}
          canManageLists={canManageLists}
          isPresidencia={canManageLists}
        />

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/upload"
            element={canManageLists ? <Upload /> : <Navigate to="/" replace />}
          />
          <Route
            path="/conversos"
            element={canManageLists ? <ImportacionConversos /> : <Navigate to="/" replace />}
          />
          <Route
            path="/dashboard-api"
            element={canManageLists ? <ApiDashboard /> : <Navigate to="/" replace />}
          />
          <Route
            path="/mensajes-estaca"
            element={<Navigate to="/mensajes/ver" replace />}
          />
          <Route
            path="/mensajes/ver"
            element={<StakeMessagesPlan canEdit={false} />}
          />
          <Route
            path="/mensajes/editar"
            element={canManageLists ? <StakeMessagesPlan canEdit /> : <Navigate to="/mensajes/ver" replace />}
          />
          <Route
            path="/sumo-consejo"
            element={<CouncilAssignments canEdit={canManageLists} />}
          />
          <Route
            path="/asignaciones/ver"
            element={<CouncilAssignments canEdit={false} />}
          />
          <Route
            path="/asignaciones/editar"
            element={canManageLists ? <CouncilAssignments canEdit /> : <Navigate to="/asignaciones/ver" replace />}
          />
          <Route path="/plan-discursos" element={<SpeakersPlanView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </HashRouter>
  )
}
