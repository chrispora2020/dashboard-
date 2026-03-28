import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function Navbar({ user, onLogout, canManageLists, isPresidencia }) {
  const userLabel = user?.name || user?.email || 'Usuario local'
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 991)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState('')

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

  const menuGroups = [
    {
      id: 'indicadores',
      title: 'Indicadores',
      links: [
        { to: '/', label: 'Ver indicadores' },
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
    function onResize() {
      const mobile = window.innerWidth <= 991
      setIsMobile(mobile)
      if (!mobile) {
        setMenuOpen(false)
      }
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setOpenDropdown('')
  }, [location.pathname])

  function isRouteActive(group) {
    return group.links.some((link) => link.to === location.pathname)
  }

  return (
    <nav style={styles.navbar}>
      <div style={styles.containerFluid}>
        <Link to="/" style={styles.brand}>
          {pageTitle}
        </Link>

        <button
          type="button"
          style={{ ...styles.toggler, ...(!isMobile ? styles.togglerDesktop : {}) }}
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-controls="navbarSupportedContent"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
        >
          ☰
        </button>

        <div
          id="navbarSupportedContent"
          style={{
            ...styles.collapse,
            ...(menuOpen || !isMobile ? styles.collapseOpen : {}),
            ...(isMobile ? styles.collapseMobile : {})
          }}
        >
          <ul style={{ ...styles.navbarNav, ...(isMobile ? styles.navbarNavMobile : {}) }}>
            {menuGroups.map((group) => {
              const groupActive = isRouteActive(group)
              if (group.links.length === 1) {
                const onlyLink = group.links[0]
                return (
                <li key={group.id} style={styles.navItem}>
                  <Link
                    to={onlyLink.to}
                    style={{
                      ...styles.navLink,
                      ...(isMobile ? styles.navLinkMobile : {}),
                      ...(onlyLink.to === location.pathname ? styles.navLinkActive : {})
                    }}
                  >
                      {onlyLink.label}
                    </Link>
                  </li>
                )
              }

              const isOpen = openDropdown === group.id
              return (
                <li
                  key={group.id}
                  style={{ ...styles.dropdownWrapper, ...(isMobile ? styles.dropdownWrapperMobile : {}) }}
                >
                  <button
                    type="button"
                    style={{
                      ...styles.dropdownToggle,
                      ...(isMobile ? styles.dropdownToggleMobile : {}),
                      ...(groupActive ? styles.navLinkActive : {})
                    }}
                    onClick={() => setOpenDropdown((prev) => (prev === group.id ? '' : group.id))}
                    aria-expanded={isOpen}
                  >
                    {group.title} ▾
                  </button>

                  {isOpen ? (
                    <ul style={{ ...styles.dropdownMenu, ...(isMobile ? styles.dropdownMenuMobile : {}) }}>
                      {group.links.map((link) => (
                        <li key={link.to}>
                          <Link
                            to={link.to}
                            style={{
                              ...styles.dropdownItem,
                              ...(link.to === location.pathname ? styles.dropdownItemActive : {})
                            }}
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>

          <div style={{ ...styles.userSection, ...(isMobile ? styles.userSectionMobile : {}) }}>
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
  navbar: {
    background: 'linear-gradient(135deg, #00587c 0%, #0b7ea8 100%)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.25)',
    padding: '10px 0',
    position: 'sticky',
    top: 0,
    zIndex: 20,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  containerFluid: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 18px',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px'
  },
  brand: {
    fontSize: '1.05rem',
    color: '#ffffff',
    textDecoration: 'none',
    fontWeight: 700,
    marginRight: '8px'
  },
  toggler: {
    marginLeft: 'auto',
    border: '1px solid rgba(255, 255, 255, 0.35)',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.18)',
    color: '#ffffff',
    padding: '4px 10px',
    fontSize: '20px',
    lineHeight: 1,
    cursor: 'pointer'
  },
  togglerDesktop: {
    display: 'none'
  },
  collapse: {
    width: '100%',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    position: 'relative'
  },
  collapseOpen: {
    display: 'flex'
  },
  collapseMobile: {
    flexDirection: 'column',
    alignItems: 'stretch'
  },
  navbarNav: {
    listStyle: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: 0,
    padding: 0,
    flexWrap: 'wrap'
  },
  navbarNavMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    width: '100%'
  },
  navItem: {
    position: 'relative'
  },
  navLink: {
    textDecoration: 'none',
    color: '#ffffff',
    padding: '8px 12px',
    borderRadius: '6px',
    display: 'inline-block',
    fontWeight: 500
  },
  navLinkMobile: {
    display: 'block',
    width: '100%'
  },
  navLinkActive: {
    color: '#e8f6ff',
    background: 'rgba(255,255,255,0.18)'
  },
  dropdownWrapper: {
    position: 'relative'
  },
  dropdownWrapperMobile: {
    width: '100%'
  },
  dropdownToggle: {
    border: 'none',
    background: 'transparent',
    color: '#ffffff',
    padding: '8px 12px',
    borderRadius: '6px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  dropdownToggleMobile: {
    width: '100%',
    textAlign: 'left',
    display: 'flex',
    justifyContent: 'space-between'
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '4px',
    listStyle: 'none',
    padding: '8px',
    minWidth: '230px',
    background: 'rgba(8, 56, 79, 0.95)',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    zIndex: 30
  },
  dropdownMenuMobile: {
    position: 'static',
    width: '100%',
    marginTop: 0,
    boxShadow: 'none',
    paddingLeft: '6px'
  },
  dropdownItem: {
    textDecoration: 'none',
    color: '#ffffff',
    padding: '8px 10px',
    borderRadius: '6px',
    display: 'block'
  },
  dropdownItemActive: {
    color: '#e8f6ff',
    background: 'rgba(255,255,255,0.18)'
  },
  userSection: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  userSectionMobile: {
    marginLeft: 0,
    width: '100%',
    justifyContent: 'space-between',
    borderTop: '1px solid rgba(255, 255, 255, 0.3)',
    paddingTop: '10px'
  },
  userName: {
    color: '#e8f6ff',
    fontSize: '0.9rem'
  },
  logoutBtn: {
    border: '1px solid rgba(255,255,255,0.3)',
    background: 'rgba(255,255,255,0.2)',
    color: '#ffffff',
    borderRadius: '6px',
    padding: '7px 11px',
    cursor: 'pointer',
    fontWeight: 600
  }
}
