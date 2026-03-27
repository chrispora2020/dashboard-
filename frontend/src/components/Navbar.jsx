import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function Navbar({ user, onLogout, canManageLists, isPresidencia }) {
  const userLabel = user?.name || user?.email || 'Usuario local'
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState('indicadores')
  const [hoveredGroup, setHoveredGroup] = useState('')
  const [hoveredLink, setHoveredLink] = useState('')

  const headerByPath = {
    '/': 'Indicadores Estaca Maroñas',
    '/mensajes/ver': 'Plan de mensajes',
    '/mensajes/editar': 'Editar plan de mensajes',
    '/conversos': 'Cargar listas',
    '/mensajes-estaca': 'Plan de mensajes',
    '/sumo-consejo': 'Asignaciones',
    '/asignaciones/ver': 'Asignaciones',
    '/asignaciones/editar': 'Editar asignaciones',
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

  const groups = [
    {
      id: 'indicadores',
      title: 'Indicadores',
      links: [
        { to: '/', label: 'Dashboard' },
        ...(canManageLists ? [{ to: '/conversos', label: 'Cargar lista indicadores' }] : [])
      ]
    },
    {
      id: 'mensajes',
      title: 'Mensajes',
      links: [
        { to: '/plan-discursos', label: 'Ver plan de discursos' },
        ...(canManageLists ? [{ to: '/mensajes/editar', label: 'Editar plan de mensajes' }] : [])
      ]
    },
    {
      id: 'asignaciones',
      title: 'Asignaciones',
      links: [
        { to: '/asignaciones/ver', label: 'Ver asignaciones' },
        ...(isPresidencia ? [{ to: '/asignaciones/editar', label: 'Editar asignaciones' }] : [])
      ]
    }
  ]

  useEffect(() => {
    const activeGroup = groups.find((group) => group.links.some((link) => link.to === location.pathname))
    if (activeGroup) {
      setOpenGroup(activeGroup.id)
    }
  }, [location.pathname, canManageLists, isPresidencia])

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
          {groups.map((group) => {
            const isOpen = openGroup === group.id
            const hasSingleLink = group.links.length === 1
            const singleLink = hasSingleLink ? group.links[0] : null
            const isGroupHovered = hoveredGroup === group.id
            const isSingleLinkActive = singleLink?.to === location.pathname
            return (
              <div
                key={group.id}
                style={{
                  ...styles.group,
                  ...(!isMobile && (isOpen || isGroupHovered) ? styles.groupActiveDesktop : {})
                }}
                onMouseEnter={() => !isMobile && setHoveredGroup(group.id)}
                onMouseLeave={() => !isMobile && setHoveredGroup('')}
              >
                {hasSingleLink && singleLink ? (
                  <Link
                    to={singleLink.to}
                    style={{
                      ...styles.groupSingleLink,
                      ...(!isMobile && isGroupHovered ? styles.groupSingleLinkHoverDesktop : {}),
                      ...(isSingleLinkActive ? styles.groupSingleLinkActive : {})
                    }}
                  >
                    {singleLink.label}
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      style={{
                        ...styles.groupTitleButton,
                        ...(!isMobile && (isOpen || isGroupHovered) ? styles.groupTitleButtonDesktopActive : {})
                      }}
                      onClick={() => setOpenGroup((prev) => (prev === group.id ? '' : group.id))}
                    >
                      <span>{group.title}</span>
                      <span style={{ ...styles.chevron, ...(isOpen ? styles.chevronOpen : {}) }}>▾</span>
                    </button>
                    {isOpen ? (
                      <div style={styles.submenu}>
                        {group.links.map((link) => (
                          <Link
                            key={link.to}
                            to={link.to}
                            style={{
                              ...styles.link,
                              ...(link.to === location.pathname ? styles.linkActive : {}),
                              ...(!isMobile && hoveredLink === link.to ? styles.linkHoverDesktop : {})
                            }}
                            onMouseEnter={() => !isMobile && setHoveredLink(link.to)}
                            onMouseLeave={() => !isMobile && setHoveredLink('')}
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )
          })}


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
    gap: '14px'
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
    fontSize: '15px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    padding: '4px 8px',
    borderRadius: '6px'
  },
  linkActive: {
    background: 'rgba(255,255,255,0.18)',
    fontWeight: 700
  },
  linkHoverDesktop: {
    transform: 'translateX(2px)',
    background: 'rgba(255,255,255,0.12)'
  },
  group: {
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '10px',
    padding: '6px 10px',
    minWidth: '190px',
    background: 'rgba(255,255,255,0.05)',
    transition: 'all 0.22s ease'
  },
  groupActiveDesktop: {
    background: 'rgba(255,255,255,0.12)',
    boxShadow: '0 10px 22px rgba(2, 34, 49, 0.28)',
    border: '1px solid rgba(255,255,255,0.38)',
    transform: 'translateY(-1px)'
  },
  groupTitleButton: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
    padding: 0,
    transition: 'color 0.2s ease'
  },
  groupTitleButtonDesktopActive: {
    color: '#e8f6ff'
  },
  groupSingleLink: {
    color: 'white',
    textDecoration: 'none',
    display: 'block',
    fontWeight: 700,
    fontSize: '14px',
    borderRadius: '6px',
    padding: '2px 4px',
    transition: 'all 0.2s ease'
  },
  groupSingleLinkHoverDesktop: {
    background: 'rgba(255,255,255,0.14)'
  },
  groupSingleLinkActive: {
    color: '#e8f6ff'
  },
  chevron: {
    display: 'inline-block',
    transition: 'transform 0.2s ease'
  },
  chevronOpen: {
    transform: 'rotate(180deg)'
  },
  submenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginTop: '8px'
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
