import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT = 640

export default function Login({ onLogin }) {
  const [role, setRole] = useState('consejo')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_BREAKPOINT)

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

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
    <div style={{ ...styles.container, ...(isMobile ? styles.containerMobile : null) }}>
      <div style={{ ...styles.card, ...(isMobile ? styles.cardMobile : null) }}>
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

          <div style={styles.passwordField}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ ...styles.input, ...styles.passwordInput }}
            />
            <button
              type="button"
              onMouseDown={() => setShowPassword(true)}
              onMouseUp={() => setShowPassword(false)}
              onMouseLeave={() => setShowPassword(false)}
              onTouchStart={() => setShowPassword(true)}
              onTouchEnd={() => setShowPassword(false)}
              style={styles.eyeButton}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              👁️
            </button>
          </div>

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
  containerMobile: {
    alignItems: 'stretch'
  },
  card: {
    background: 'white',
    padding: '40px',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    width: '100%',
    maxWidth: '400px'
  },
  cardMobile: {
    minHeight: '100vh',
    maxWidth: 'none',
    borderRadius: 0,
    boxShadow: 'none',
    padding: '28px 22px',
    boxSizing: 'border-box'
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

  passwordField: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  passwordInput: {
    width: '100%',
    paddingRight: '44px'
  },
  eyeButton: {
    position: 'absolute',
    right: '10px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: 1,
    padding: '4px'
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
