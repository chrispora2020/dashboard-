import { useState } from 'react'

export default function Login({ onLogin }) {
  const [role, setRole] = useState('consejo')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const credentialsByRole = {
    consejo: {
      password: import.meta.env.VITE_ROLE_PASSWORD_CONSEJO || 'consejo2026',
      name: 'Consejo',
      email: 'consejo@dashboard.local'
    },
    presidencia: {
      password: import.meta.env.VITE_ROLE_PASSWORD_PRESIDENCIA || 'Presidencia2026Maroñas#',
      name: 'Presidencia',
      email: 'presidencia@dashboard.local'
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const roleConfig = credentialsByRole[role]

    if (!roleConfig) {
      setError('Rol no válido.')
      return
    }

    if (password.trim() !== roleConfig.password) {
      setError('Contraseña incorrecta para el rol seleccionado.')
      return
    }

    onLogin({
      role,
      name: roleConfig.name,
      email: roleConfig.email
    })
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Iniciar sesión</h2>
        <p style={styles.subtitle}>Seleccione rol y contraseña</p>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Rol
            <select value={role} onChange={(event) => setRole(event.target.value)} style={styles.input}>
              <option value="consejo">Consejo</option>
              <option value="presidencia">Presidencia</option>
            </select>
          </label>
          
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
          />
          
          {error && <div style={styles.error}>{error}</div>}
          
          <button type="submit" style={styles.button}>
            Ingresar
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #00587c 0%, #0b7ea8 100%)',
    fontFamily: 'Arial, sans-serif'
  },
  card: {
    background: 'white',
    padding: '40px',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    width: '100%',
    maxWidth: '400px'
  },
  title: {
    marginTop: 0,
    marginBottom: '6px',
    textAlign: 'center',
    color: '#333'
  },
  subtitle: {
    textAlign: 'center',
    color: '#4b5563',
    marginTop: 0,
    marginBottom: '22px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    color: '#374151',
    fontSize: '14px'
  },
  input: {
    padding: '12px 15px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border 0.3s'
  },
  button: {
    padding: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'white',
    background: 'linear-gradient(135deg, #00587c 0%, #0b7ea8 100%)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginTop: '10px'
  },
  error: {
    padding: '10px',
    background: '#fee',
    color: '#c33',
    borderRadius: '6px',
    fontSize: '14px'
  }
}
