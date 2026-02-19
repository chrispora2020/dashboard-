export default function KPICard({ title, meta, actual, potencial, comentario, unit = '', color = '#667eea', onDetalleClick }) {
  const esBautismos = potencial != null && potencial === actual;
  const denominator = (!esBautismos && potencial != null && potencial > 0) ? potencial : meta;
  const percentage = denominator > 0 ? Math.round((actual / denominator) * 100) : 0;
  const status = percentage >= 90 ? 'green' : percentage >= 70 ? 'orange' : 'red';
  const falta = Math.max(0, meta - actual);

  const statusColors = {
    green: '#10b981',
    orange: '#f59e0b',
    red: '#ef4444'
  };
  const statusBg = {
    green: '#f0fdf4',
    orange: '#fffbeb',
    red: '#fef2f2'
  };

  return (
    <div style={{ ...styles.card, borderTop: `4px solid ${color}`, borderLeft: `1px solid ${statusColors[status]}22` }}>
      {/* Título (solo cuando se pasa) */}
      {title && (
        <div style={styles.titleRow}>
          <span style={{ ...styles.titleText, borderLeft: `3px solid ${color}` }}>{title}</span>
        </div>
      )}

      {/* Meta con ícono de objetivo */}
      <div style={styles.metaRow}>
        <span style={styles.metaIcon}>🎯</span>
        <span style={styles.metaLabel}>Meta</span>
        <span style={{ ...styles.metaValue, color }}>{meta}</span>
        {!esBautismos && falta > 0 && (
          <span style={styles.faltaChip}>faltan {falta}</span>
        )}
      </div>

      <div style={styles.values}>
        {esBautismos ? (
          <div style={styles.actual}>
            <span style={{ ...styles.number, color: statusColors[status] }}>{actual}</span>
            <span style={styles.unit}>/{meta}</span>
          </div>
        ) : (
          <>
            <div style={styles.actual}>
              <span style={{ ...styles.number, color: statusColors[status] }}>{percentage}</span>
              <span style={styles.unit}>%</span>
            </div>
            <div style={styles.potencial}>
              <span style={styles.potencialItem}>
                <span style={styles.potencialLabel}>Real</span>
                <strong style={{ color: statusColors[status] }}>{actual}</strong>
              </span>
              <span style={{ color: '#d1d5db' }}>│</span>
              <span style={styles.potencialItem}>
                <span style={styles.potencialLabel}>Potencial</span>
                <strong style={{ color: '#2563eb' }}>{potencial ?? '-'}</strong>
              </span>
            </div>
          </>
        )}
      </div>

      {/* Barra de progreso mejorada */}
      <div style={styles.progressContainer}>
        <div style={{ ...styles.progressBar, width: `${Math.min(percentage, 100)}%`, background: statusColors[status] }} />
      </div>
      <div style={styles.progressLabels}>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>0</span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>{Math.round(meta / 2)}</span>
        <span style={{ fontSize: 10, color: color, fontWeight: 600 }}>{meta}</span>
      </div>

      <div style={{ ...styles.footer, background: statusBg[status], borderRadius: 6, padding: '6px 10px', marginTop: 8 }}>
        <span style={{ ...styles.badge, background: statusColors[status] }}>
          {esBautismos ? `${percentage}% vs Meta` : `${percentage}%`}
        </span>
        <span style={{ ...styles.status, color: statusColors[status], fontWeight: 600 }}>
          {status === 'green' ? '✓ En Meta' : status === 'orange' ? '⚠ Alerta' : '✗ Bajo'}
        </span>
        {onDetalleClick && (
          <button onClick={onDetalleClick} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: `1px solid ${color}44`, background: '#fff', cursor: 'pointer', color }}>Ver detalle</button>
        )}
      </div>

      {comentario && comentario.length > 0 && (
        <div style={styles.comentario}>
          <span style={{ color: '#b45309', fontWeight: 500 }}>ℹ {comentario}</span>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: 'white',
    borderRadius: '10px',
    padding: '18px 20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  titleRow: {
    marginBottom: 12
  },
  titleText: {
    fontSize: 14,
    fontWeight: 700,
    color: '#1e293b',
    paddingLeft: 8,
    letterSpacing: '0.01em'
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    background: '#f8faff',
    borderRadius: 6,
    padding: '5px 10px'
  },
  metaIcon: {
    fontSize: 14
  },
  metaLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 500
  },
  metaValue: {
    fontSize: 15,
    fontWeight: 700,
    marginLeft: 2
  },
  faltaChip: {
    marginLeft: 'auto',
    fontSize: 11,
    background: '#fee2e2',
    color: '#b91c1c',
    borderRadius: 10,
    padding: '1px 7px',
    fontWeight: 600
  },
  values: {
    marginBottom: 12
  },
  actual: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '5px',
    marginBottom: '6px'
  },
  number: {
    fontSize: '34px',
    fontWeight: 'bold'
  },
  unit: {
    fontSize: '16px',
    color: '#9ca3af'
  },
  potencial: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    color: '#64748b'
  },
  potencialItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1
  },
  potencialLabel: {
    fontSize: 10,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  progressContainer: {
    height: '10px',
    background: '#e5e7eb',
    borderRadius: '6px',
    overflow: 'hidden',
    marginBottom: '4px'
  },
  progressBar: {
    height: '100%',
    transition: 'width 0.4s ease',
    borderRadius: '6px'
  },
  progressLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  badge: {
    padding: '3px 8px',
    borderRadius: '4px',
    color: 'white',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  status: {
    fontSize: '12px'
  },
  comentario: {
    marginTop: '10px',
    fontSize: '13px',
    background: '#fffbeb',
    borderRadius: 6,
    padding: '5px 8px'
  }
};
