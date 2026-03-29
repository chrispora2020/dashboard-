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
    '/asignaciones/sumo-consejo': 'Asignación Sumo Consejo',
    '/asignaciones/comites': 'Asignación de Comités',
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
        { to: '/mensajes/ver', label: 'Ver plan de mensajes' },
        ...(canManageLists ? [{ to: '/mensajes/editar', label: 'Editar plan de mensajes' }] : [])
      ]
    },
    {
      id: 'asignaciones',
      title: 'Asignaciones',
      links: [
        { to: '/asignaciones/sumo-consejo', label: 'Asignación Sumo Consejo' },
        { to: '/asignaciones/comites', label: 'Asignación Comités' },
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
    <header style={styles.wrapper}>
      <div style={styles.brandBar}>
        <div style={styles.containerFluid}>
          <div style={styles.brandWrap}>
            <img
              alt="La Iglesia de Jesucristo de los Santos de los Últimos Días"
              src="https://www.churchofjesuschrist.org/imgs/c730fd12d24c640f7649912008ddf828afd93403/full/60%2C/0/default.png"
              style={styles.logoImage}
            />
            <span style={styles.brandTitle}>{pageTitle}</span>
          </div>

          <div style={styles.userSectionTop}>
            <span style={styles.userName}>{userLabel}</span>
            <button onClick={onLogout} style={styles.logoutBtn}>Salir</button>
          </div>
        </div>
      </div>

      <nav style={styles.menuBar}>
        <div style={styles.containerFluid}>
          <Link to="/" style={styles.homeLink} aria-label="Inicio">⌂</Link>

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
          </div>
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
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
  },
  brandBar: {
    background: '#ececec',
    borderBottom: '1px solid #d4d4d4'
  },
  menuBar: {
    background: '#ffffff',
    borderBottom: '1px solid #d1d1d1'
  },
  containerFluid: {
    width: '100%',
    boxSizing: 'border-box',
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '0 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: '56px'
  },
  brandWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
    flexGrow: 1
  },
  logoImage: {
    width: '24px',
    height: '36px',
    objectFit: 'contain',
    objectPosition: 'center',
    display: 'block',
    background: '#4f246a'
  },
  brandTitle: {
    fontSize: '1.05rem',
    color: '#1f2937',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  userSectionTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  userName: {
    color: '#334155',
    fontSize: '0.86rem'
  },
  logoutBtn: {
    border: '1px solid #c8c8c8',
    background: '#fff',
    color: '#111827',
    borderRadius: '6px',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: '0.85rem'
  },
  homeLink: {
    textDecoration: 'none',
    color: '#111827',
    fontSize: '1.4rem',
    lineHeight: 1,
    marginRight: '6px'
  },
  toggler: {
    marginLeft: 'auto',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#fff',
    color: '#111827',
    width: '38px',
    height: '38px',
    padding: 0,
    fontSize: '22px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  togglerDesktop: {
    display: 'none'
  },
  collapse: {
    display: 'none',
    alignItems: 'center',
    width: '100%'
  },
  collapseOpen: {
    display: 'flex'
  },
  collapseMobile: {
    width: '100%',
    marginTop: '8px'
  },
  navbarNav: {
    listStyle: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    margin: 0,
    padding: 0,
    width: '100%'
  },
  navbarNavMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '6px'
  },
  navItem: {
    position: 'relative'
  },
  navLink: {
    textDecoration: 'none',
    color: '#111827',
    fontSize: '1.05rem',
    padding: '12px 16px',
    borderRadius: '4px',
    display: 'inline-block'
  },
  navLinkMobile: {
    display: 'block',
    width: '100%'
  },
  navLinkActive: {
    background: '#f1f5f9'
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
    color: '#111827',
    padding: '12px 16px',
    borderRadius: '4px',
    fontSize: '1.05rem',
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
    marginTop: '2px',
    listStyle: 'none',
    padding: '6px',
    minWidth: '230px',
    background: '#fff',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.1)',
    zIndex: 30
  },
  dropdownMenuMobile: {
    position: 'static',
    boxShadow: 'none',
    marginTop: 0,
    paddingLeft: '8px',
    border: 'none'
  },
  dropdownItem: {
    textDecoration: 'none',
    color: '#111827',
    padding: '8px 10px',
    borderRadius: '4px',
    display: 'block'
  },
  dropdownItemActive: {
    background: '#f1f5f9'
  }
}
