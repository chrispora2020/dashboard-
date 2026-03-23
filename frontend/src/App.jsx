import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ApiDashboard from './components/ApiDashboard'
import Dashboard from './components/Dashboard'
import ImportacionConversos from './components/ImportacionConversos'
import Navbar from './components/Navbar'
import StakeMessagesPlan from './components/StakeMessagesPlan'
import Upload from './components/Upload'

const LOCAL_USER_KEY = 'user'
const DEFAULT_LOCAL_USER = {
  id: 'local-user',
  email: 'local@dashboard',
  name: 'Usuario local'
}
const LISTAS_ACCESS_KEY = 'listas_access_granted'
const LISTAS_ACCESS_CODE = import.meta.env.VITE_LISTAS_ACCESS_CODE || 'maranas-2026'

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
  const [listasAccessGranted, setListasAccessGranted] = useState(false)

  useEffect(() => {
    setUser(resolveStoredUser())
    setListasAccessGranted(localStorage.getItem(LISTAS_ACCESS_KEY) === 'true')
  }, [])

  function handleResetSession() {
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(DEFAULT_LOCAL_USER))
    localStorage.removeItem(LISTAS_ACCESS_KEY)
    setUser(DEFAULT_LOCAL_USER)
    setListasAccessGranted(false)
  }

  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <Navbar
          user={user}
          onLogout={handleResetSession}
          listasAccessGranted={listasAccessGranted}
        />

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route
            path="/conversos"
            element={listasAccessGranted ? <ImportacionConversos /> : <Navigate to="/acceso-listas" replace />}
          />
          <Route
            path="/acceso-listas"
            element={listasAccessGranted ? <Navigate to="/conversos" replace /> : (
              <AccesoListas
                onUnlock={() => {
                  localStorage.setItem(LISTAS_ACCESS_KEY, 'true')
                  setListasAccessGranted(true)
                }}
              />
            )}
          />
          <Route path="/dashboard-api" element={<ApiDashboard />} />
          <Route path="/mensajes-estaca" element={<StakeMessagesPlan />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

function AccesoListas({ onUnlock }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()

    if (code.trim() !== LISTAS_ACCESS_CODE) {
      setError('Código inválido. Solicita el código de acceso al administrador.')
      return
    }

    setError('')
    onUnlock()
  }

  return (
    <div style={accessStyles.container}>
      <form style={accessStyles.card} onSubmit={handleSubmit}>
        <h2 style={accessStyles.title}>Acceso restringido: Cargar Listas</h2>
        <p style={accessStyles.text}>
          Esta sección no se habilita solamente con la URL directa. Ingresa el código privado para continuar.
        </p>

        <input
          type="password"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          style={accessStyles.input}
          placeholder="Código de acceso"
          autoComplete="off"
        />

        {error && <div style={accessStyles.error}>{error}</div>}

        <button type="submit" style={accessStyles.button}>
          Desbloquear acceso
        </button>
      </form>
    </div>
  )
}

const accessStyles = {
  container: {
    padding: '40px 20px',
    display: 'flex',
    justifyContent: 'center'
  },
  card: {
    width: '100%',
    maxWidth: '520px',
    background: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.08)'
  },
  title: {
    marginTop: 0,
    marginBottom: '8px',
    color: '#1f2937'
  },
  text: {
    marginTop: 0,
    marginBottom: '18px',
    color: '#4b5563'
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '10px 12px',
    marginBottom: '12px'
  },
  error: {
    background: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#991b1b',
    borderRadius: '8px',
    padding: '10px 12px',
    marginBottom: '12px'
  },
  button: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 14px',
    cursor: 'pointer',
    fontWeight: 'bold'
  }
}
