import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

const TOP_MENU_ITEMS = [
  { id: 'miembros', label: 'Miembros' },
  { id: 'llamamientos', label: 'Llamamientos' },
  { id: 'confidencial', label: 'Confidencial' },
  { id: 'ministering', label: 'Ministración y bienestar' },
  { id: 'finanzas', label: 'Finanzas' },
  { id: 'misionero', label: 'Misionero' },
  { id: 'templo', label: 'Templo' },
  { id: 'informes', label: 'Informes' },
  { id: 'ayuda', label: 'Ayuda' }
]

const DASHBOARD_LINKS = [
  { to: '/', label: 'Página de inicio de LCR' },
  { to: '/plan-discursos', label: 'Plan de discursos' },
  { to: '/mensajes/ver', label: 'Plan de mensajes' },
  { to: '/asignaciones/ver', label: 'Asignaciones' }
]

export default function Navbar({ user, onLogout, canManageLists, isPresidencia }) {
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 991)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileDashboardOpen, setMobileDashboardOpen] = useState(false)

  useEffect(() => {
    function onResize() {
      const mobile = window.innerWidth <= 991
      setIsMobile(mobile)
      if (!mobile) {
        setMobileOpen(false)
      }
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setMobileDashboardOpen(false)
  }, [location.pathname])

  const userLabel = user?.name || user?.email || 'Usuario local'

  return (
    <header style={styles.wrapper}>
      <div style={styles.brandBar}>
        <div style={styles.brandInner}>
          <div style={styles.brandLeft}>
            <a href="https://www.churchofjesuschrist.org?lang=spa" style={styles.logoAnchor}>
              <img
                src="https://www.churchofjesuschrist.org/imgs/c730fd12d24c640f7649912008ddf828afd93403/full/60%2C/0/default.png"
                alt="La Iglesia de Jesucristo de los Santos de los Últimos Días"
                style={styles.logoImage}
              />
            </a>
            <div style={styles.purpleRay} />
            <span style={styles.brandTitle}>Fuentes de recursos para líderes y secretarios</span>
          </div>

          <div style={styles.userPanel}>
            <span style={styles.userName}>{userLabel}</span>
            <button onClick={onLogout} style={styles.logoutBtn}>Salir</button>
          </div>
        </div>
      </div>

      <nav style={styles.menuBar}>
        <div style={styles.menuInner}>
          <Link to="/" style={styles.homeIcon} title="Inicio" aria-label="Inicio">⌂</Link>

          {isMobile ? (
            <>
              <button style={styles.hamburgerBtn} onClick={() => setMobileOpen((prev) => !prev)}>
                ☰ Menú
              </button>
              {mobileOpen ? (
                <ul style={styles.mobileMenuList}>
                  <li>
                    <button
                      style={styles.mobileMainItem}
                      onClick={() => setMobileDashboardOpen((prev) => !prev)}
                    >
                      Dashboard ▾
                    </button>
                    {mobileDashboardOpen ? (
                      <ul style={styles.mobileSubMenu}>
                        {DASHBOARD_LINKS.map((item) => (
                          <li key={item.to}>
                            <Link to={item.to} style={styles.mobileLink}>{item.label}</Link>
                          </li>
                        ))}
                        {canManageLists ? (
                          <>
                            <li><Link to="/conversos" style={styles.mobileLink}>Cargar lista indicadores</Link></li>
                            <li><Link to="/mensajes/editar" style={styles.mobileLink}>Editar plan de mensajes</Link></li>
                          </>
                        ) : null}
                        {isPresidencia ? (
                          <li><Link to="/asignaciones/editar" style={styles.mobileLink}>Editar asignaciones</Link></li>
                        ) : null}
                      </ul>
                    ) : null}
                  </li>
                  {TOP_MENU_ITEMS.map((item) => (
                    <li key={item.id} style={styles.mobileMainItem}>{item.label}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <ul style={styles.desktopMenuList}>
              {TOP_MENU_ITEMS.map((item) => (
                <li key={item.id}>
                  <button style={styles.desktopMenuItem}>{item.label} ▾</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </nav>
    </header>
  )
}

const styles = {
  wrapper: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    boxShadow: '0 2px 7px rgba(0, 0, 0, 0.08)'
  },
  brandBar: {
    background: '#ececec',
    borderBottom: '1px solid #d2d2d2'
  },
  brandInner: {
    maxWidth: '1280px',
    margin: '0 auto',
    height: '56px',
    padding: '0 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px'
  },
  brandLeft: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  logoAnchor: {
    display: 'flex',
    alignItems: 'center'
  },
  logoImage: {
    width: '24px',
    height: '36px',
    objectFit: 'cover',
    background: '#4f246a'
  },
  purpleRay: {
    width: '30px',
    height: '44px',
    background: 'linear-gradient(120deg, rgba(85,43,111,.35) 0%, rgba(85,43,111,.1) 75%, transparent 100%)'
  },
  brandTitle: {
    fontSize: '1.8rem',
    lineHeight: 1.2,
    color: '#28323b',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  userPanel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  userName: {
    color: '#334155',
    fontSize: '0.88rem'
  },
  logoutBtn: {
    border: '1px solid #c9c9c9',
    background: '#ffffff',
    color: '#1f2937',
    borderRadius: '6px',
    padding: '6px 10px',
    cursor: 'pointer'
  },
  menuBar: {
    background: '#ffffff',
    borderBottom: '1px solid #cfcfcf'
  },
  menuInner: {
    maxWidth: '1280px',
    margin: '0 auto',
    minHeight: '56px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 8px'
  },
  homeIcon: {
    color: '#111827',
    textDecoration: 'none',
    fontSize: '28px',
    width: '28px',
    display: 'inline-flex',
    justifyContent: 'center'
  },
  desktopMenuList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    overflowX: 'auto'
  },
  desktopMenuItem: {
    border: 'none',
    background: 'transparent',
    color: '#111827',
    fontSize: '16px',
    padding: '11px 14px',
    whiteSpace: 'nowrap',
    cursor: 'pointer'
  },
  hamburgerBtn: {
    border: '1px solid #d1d5db',
    background: '#fff',
    padding: '8px 10px',
    borderRadius: '6px',
    color: '#111827'
  },
  mobileMenuList: {
    listStyle: 'none',
    margin: '8px 0',
    padding: '8px',
    width: '100%',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    background: '#fff'
  },
  mobileMainItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    padding: '9px 8px',
    color: '#111827'
  },
  mobileSubMenu: {
    listStyle: 'none',
    margin: 0,
    padding: '0 0 0 12px'
  },
  mobileLink: {
    display: 'block',
    padding: '8px 8px',
    textDecoration: 'none',
    color: '#0f172a'
  }
}
