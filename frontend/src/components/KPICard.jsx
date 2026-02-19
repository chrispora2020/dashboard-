export default function KPICard({ title, meta, actual, potencial, comentario, unit = '', color = '#667eea', onDetalleClick }) {
  // Bautismos (acumulativo): % = actual / meta,  big number = actual
  // Recomendación / Ordenados: % = real / potencial,  big number = percentage
  const esBautismos = potencial != null && potencial === actual
  const denominator = (!esBautismos && potencial != null && potencial > 0) ? potencial : meta
  const percentage = denominator > 0 ? Math.round((actual / denominator) * 100) : 0
  const status = percentage >= 90 ? 'green' : percentage >= 70 ? 'orange' : 'red'

  const statusColors = {
    green: '#10b981',
    orange: '#f59e0b',
    red: '#ef4444'
  }

  return (
    <div style={{ ...styles.card, borderTop: `4px solid ${color}` }}>
      <h3 style={styles.title}>{title}</h3>
      <div style={styles.values}>
        {esBautismos ? (
          /* Bautismos: mostrar conteo real como número principal */
          <>
            <div style={styles.actual}>
              <span style={styles.number}>{actual}</span>
            </div>
            <div style={styles.meta}>Meta: {meta}</div>
          </>
        ) : (
          /* Recomendación / Ordenados: mostrar porcentaje como número principal */
          <>
            <div style={styles.actual}>
              <span style={styles.number}>{percentage}</span>
              <span style={styles.unit}>%</span>
            </div>
            <div style={styles.meta}>Meta: {meta}%</div>
            <div style={styles.potencial}>
              Real: <strong style={{color: statusColors[status]}}>{actual}</strong>
              <span style={{margin:'0 6px',color:'#999'}}>/</span>
              Potencial: <strong style={{color:'#2563eb'}}>{potencial ?? '-'}</strong>
            </div>
          </>
        )}
      </div>
      <div style={styles.progressContainer}>
        <div
          style={{
            ...styles.progressBar,
            width: `${Math.min(percentage, 100)}%`,
            background: statusColors[status]
          }}
        />
      </div>
      <div style={styles.footer}>
        <span style={{ ...styles.badge, background: statusColors[status] }}>
          {esBautismos ? `${percentage}% vs Meta` : `${percentage}%`}
        </span>
        <span style={styles.status}>
          {status === 'green' ? '✓ En Meta' : status === 'orange' ? '⚠ Alerta' : '✗ Bajo'}
        </span>
        {onDetalleClick && (
          <button onClick={onDetalleClick} style={{marginLeft:12,fontSize:12,padding:'2px 8px',borderRadius:6,border:'1px solid #ddd',background:'#f3f4f6',cursor:'pointer'}}>Ver detalle</button>
        )}
      </div>
      {comentario && comentario.length > 0 && (
        <div style={styles.comentario}>
          <span style={{ color: '#b91c1c', fontWeight: 500 }}>⚠ {comentario}</span>
        </div>
      )}
    </div>
  )
}

const styles = {
  card: {
    background: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  title: {
    margin: '0 0 15px 0',
    fontSize: '16px',
    color: '#666',
    fontWeight: '500'
  },
  values: {
    marginBottom: '15px'
  },
  actual: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '5px',
    marginBottom: '8px'
  },
  number: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#333'
  },
  unit: {
    fontSize: '14px',
    color: '#999'
  },
  meta: {
    fontSize: '14px',
    color: '#666'
  },
  potencial: {
    fontSize: '14px',
    color: '#0e7490',
    marginTop: '2px',
    marginBottom: '2px'
  },
  comentario: {
    fontSize: '13px',
    marginTop: '10px',
    color: '#b91c1c',
    background: '#fef2f2',
    borderRadius: '6px',
    padding: '6px 10px',
    fontWeight: 500
  },
  progressContainer: {
    height: '8px',
    background: '#f0f0f0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '12px'
  },
  progressBar: {
    height: '100%',
    transition: 'width 0.3s ease'
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  badge: {
    padding: '4px 10px',
    borderRadius: '12px',
    color: 'white',
    fontSize: '13px',
    fontWeight: 'bold'
  },
  status: {
    fontSize: '13px',
    color: '#666',
    fontWeight: '500'
  }
}
