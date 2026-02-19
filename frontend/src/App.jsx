import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import ImportacionConversos from './components/ImportacionConversos'
import Login from './components/Login'
import Navbar from './components/Navbar'
import Upload from './components/Upload'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (e) {
        console.error('Error parsing stored user', e)
      }
    }
    
    setLoading(false)
  }, [])

  function handleLogin(userData) {
    console.log('Login successful, user data:', userData)
    setUser(userData)
  }

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'Arial, sans-serif'
      }}>
        Cargando...
      </div>
    )
  }
  console.log('App render - user:', user, 'loading:', loading)
  return (
    <BrowserRouter>
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
          <Navbar user={user} onLogout={handleLogout} />
          
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/conversos" element={<ImportacionConversos />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      )}
    </BrowserRouter>
  )
}
