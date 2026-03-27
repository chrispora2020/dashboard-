import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function Navbar({ user, onLogout, canManageLists }) {
  const userLabel = user?.name || user?.email || 'Usuario local'
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900)
  const [menuOpen, setMenuOpen] = useState(false)

  const headerByPath = {
    '/': 'Indicadores Estaca Maroñas',
    '/conversos': 'Cargar listas',
    '/mensajes-estaca': 'Editar plan',
    '/plan-discursos': 'Plan de discursos',
    '/upload': 'Cargar listas',
    '/dashboard-api': 'Dashboard API'
  }

  const pageTitle = headerByPath[location.pathname] || 'Indicadores Estaca Maroñas'

  useEffect(() => {
    function onResize() {
      const mobile = window.innerWidth <= 900
      setIsMobile(mobile)
      if (!mobile) {
        setMenuOpen(false)
      }
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (isMobile) {
      setMenuOpen(false)
    }
  }, [location.pathname, isMobile])

  return (
    <nav style={styles.nav}>
      <div style={styles.container}>
        <h1 style={styles.brand}>{pageTitle}</h1>

        {isMobile ? (
          <button
            type="button"
            style={styles.menuToggle}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Abrir menú"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        ) : null}

        <div
          style={{
            ...styles.menu,
            ...(isMobile ? styles.menuMobile : {}),
            ...(isMobile && menuOpen ? styles.menuMobileOpen : {})
          }}
        >
          <Link to="/" style={styles.link}>Dashboard</Link>
          {canManageLists ? (
            <Link to="/conversos" style={styles.link}>Cargar Listas</Link>
          ) : null}
          <Link to="/plan-discursos" style={styles.link}>Plan de discursos</Link>
          {canManageLists ? (
            <Link to="/mensajes-estaca" style={styles.link}>Editar plan</Link>
          ) : null}

          <div style={{ ...styles.user, ...(isMobile ? styles.userMobile : {}) }}>
            <span style={styles.userName}>{userLabel}</span>
            <button onClick={onLogout} style={styles.logoutBtn}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    background: 'linear-gradient(135deg, #00587c 0%, #0b7ea8 100%)',
    color: 'white',
    padding: '15px 0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    position: 'relative'
  },
  brand: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold',
    lineHeight: 1.2
  },
  menuToggle: {
    background: 'rgba(255,255,255,0.18)',
    border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '22px',
    padding: '2px 10px',
    cursor: 'pointer'
  },
  menu: {
    display: 'flex',
    alignItems: 'center',
    gap: '25px'
  },
  menuMobile: {
    position: 'absolute',
    top: '56px',
    right: '20px',
    left: '20px',
    display: 'none',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '10px',
    background: 'rgba(30, 41, 59, 0.95)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '12px',
    padding: '12px',
    zIndex: 10,
    backdropFilter: 'blur(4px)'
  },
  menuMobileOpen: {
    display: 'flex'
  },
  link: {
    color: 'white',
    textDecoration: 'none',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'opacity 0.3s'
  },
  user: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    marginLeft: '20px',
    paddingLeft: '20px',
    borderLeft: '1px solid rgba(255,255,255,0.3)'
  },
  userMobile: {
    marginLeft: 0,
    paddingLeft: 0,
    borderLeft: 'none',
    borderTop: '1px solid rgba(255,255,255,0.2)',
    paddingTop: '10px',
    justifyContent: 'space-between'
  },
  userName: {
    fontSize: '14px',
    opacity: 0.9
  },
  logoutBtn: {
    padding: '6px 15px',
    background: 'rgba(255,255,255,0.2)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  }
}
