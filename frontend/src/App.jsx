import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ApiDashboard from './components/ApiDashboard'
import Dashboard from './components/Dashboard'
import ImportacionConversos from './components/ImportacionConversos'
import Navbar from './components/Navbar'
import Upload from './components/Upload'

const LOCAL_USER_KEY = 'user'
const DEFAULT_LOCAL_USER = {
  id: 'local-user',
  email: 'local@dashboard',
  name: 'Usuario local'
}

function resolveStoredUser() {
  const storedUser = localStorage.getItem(LOCAL_USER_KEY)

  if (!storedUser) {
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(DEFAULT_LOCAL_USER))
    return DEFAULT_LOCAL_USER
  }

  try {
    const parsedUser = JSON.parse(storedUser)

    if (parsedUser?.name || parsedUser?.email) {
      return parsedUser
    }
  } catch (error) {
    console.error('No fue posible leer el usuario guardado, se restaurará uno local.', error)
  }

  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(DEFAULT_LOCAL_USER))
  return DEFAULT_LOCAL_USER
}

export default function App() {
  const [user, setUser] = useState(DEFAULT_LOCAL_USER)

  useEffect(() => {
    setUser(resolveStoredUser())
  }, [])

  function handleResetSession() {
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(DEFAULT_LOCAL_USER))
    setUser(DEFAULT_LOCAL_USER)
  }

  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <Navbar user={user} onLogout={handleResetSession} />

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/conversos" element={<ImportacionConversos />} />
          <Route path="/dashboard-api" element={<ApiDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
