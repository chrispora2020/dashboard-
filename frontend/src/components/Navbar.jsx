import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function Navbar({ user, onLogout, canManageLists, isPresidencia }) {
  const userLabel = user?.name || user?.email || 'Usuario local'
  const location = useLocation()
  const navRef = useRef(null)
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
    '/upload': 'Cargar listas',
    '/dashboard-api': 'Dashboard API',
    '/actas/presidencia': 'Actas Presidencia',
    '/actas/consejo': 'Actas Consejo / Comité',
    '/actas/ver': 'Actas de reuniones',
    '/actas/editar': 'Registrar acta de reunión'
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
        { to: '/mensajes/ver', label: 'Ver plan de mensajes' },
        ...(canManageLists ? [{ to: '/mensajes/editar', label: 'Editar plan de mensajes' }] : [])
      ]
    },
    {
      id: 'actas',
      title: 'Actas',
      links: [
        ...(isPresidencia ? [{ to: '/actas/presidencia', label: '📋 Actas Presidencia' }] : []),
        { to: '/actas/consejo', label: '📋 Actas Consejo / Comité' },
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
    setMenuOpen(false)
    setOpenDropdown('')
  }, [location.pathname])
  useEffect(() => {
    const dismiss = event => { if (!navRef.current?.contains(event.target)) setOpenDropdown('') }
    const escape = event => { if (event.key === 'Escape') { setOpenDropdown(''); setMenuOpen(false) } }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape) }
  }, [])
  return (
    <header className="app-nav" ref={navRef}>
      <div className="app-nav__main">
        <Link to="/" className="app-brand" aria-label="Estaca Maroñas, inicio">
          <span className="app-brand__icon"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 19V9l8-5 8 5v10M8 19v-5h8v5M12 4V1M2 21h20" /></svg></span>
          <span><strong>Estaca Maroñas</strong><small>Seguimiento y organización</small></span>
        </Link>
        <div className="app-nav__account"><span className="app-avatar" aria-hidden="true">{userLabel.slice(0, 1)}</span><span className="app-nav__user">{userLabel}<small>{isPresidencia ? 'Presidencia' : 'Consejo'}</small></span><button type="button" className="app-logout" onClick={onLogout}>Salir</button></div>
        <button type="button" className="app-menu-toggle" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="app-navigation" onClick={() => setMenuOpen(v => !v)}>{menuOpen ? '✕' : '☰'}</button>
      </div>
      <nav id="app-navigation" className={`app-nav__links ${menuOpen ? 'is-open' : ''}`} aria-label="Navegación principal">
        <div className="app-nav__groups">
          {menuGroups.map((group, index) => {
            const active = group.links.some(link => link.to === location.pathname)
            const expanded = openDropdown === group.id
            return <div className="app-nav__group" key={group.id}>
              {group.links.length === 1 ? <Link to={group.links[0].to} className={`app-nav__item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}><span className="app-nav__number">0{index + 1}</span>{group.title}</Link> : <>
                <button type="button" className={`app-nav__item ${active ? 'is-active' : ''}`} aria-expanded={expanded} aria-controls={`nav-${group.id}`} onClick={() => setOpenDropdown(expanded ? '' : group.id)}><span className="app-nav__number">0{index + 1}</span>{group.title}<span aria-hidden="true">⌄</span></button>
                {expanded && <div id={`nav-${group.id}`} className="app-nav__dropdown">{group.links.map(link => <Link key={link.to} to={link.to} aria-current={location.pathname === link.to ? 'page' : undefined}>{link.label.replace('📋 ', '')}</Link>)}</div>}
              </>}
            </div>
          })}
        </div>
        <span className="app-nav__current">{pageTitle}</span>
      </nav>
    </header>
  )
}
