import { Link } from 'react-router-dom'

export default function Navbar({ user, onLogout }) {
  console.log('Navbar rendering with user:', user)
  
  return (
    <nav style={styles.nav}>
      <div style={styles.container}>
        <h1 style={styles.brand}>Indicadores Claves Estaca Maroñas</h1>
        
        <div style={styles.menu}>
          <Link to="/" style={styles.link}>Dashboard</Link>
          <Link to="/upload" style={styles.link}>Cargar PDFs</Link>
          <Link to="/conversos" style={styles.link}>Cargar Listas</Link>
          
          <div style={styles.user}>
            <span style={styles.userName}>{user?.name || user?.email}</span>
            <button onClick={onLogout} style={styles.logoutBtn}>
              Salir
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
    alignItems: 'center'
  },
  brand: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold'
  },
  menu: {
    display: 'flex',
    alignItems: 'center',
    gap: '25px'
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
