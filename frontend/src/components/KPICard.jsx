import KPIProgress from './KPIProgress'
import { formatKpi, getKpiMetrics } from '../utils/kpiMetrics'
import './detalle.css'
export default function KPICard({ title, meta, actual = 0, potencial, comentario, unit = '', onDetalleClick, breakdown = [] }) {
  const metric = getKpiMetrics({ actual, potencial, meta, unit })
  return (
    <article className="kpi-card">
      <div className="kpi-card__top"><span className="kpi-card__eyebrow">{metric.porcentual ? 'Cobertura' : 'Resultado'}</span><span className={`kpi-status kpi-status--${metric.estado}`}><i />{metric.estado === 'success' ? 'Meta alcanzada' : metric.estado === 'progress' ? 'En progreso' : 'Por avanzar'}</span></div>
      {title && <h3>{title}</h3>}
      <div className="kpi-card__number">{formatKpi(metric.valor)}<span>{metric.porcentual ? '%' : ''}</span></div>
      <KPIProgress actual={actual} potencial={potencial} meta={meta} unit={unit} compact />
      {breakdown.length > 0 && <div className="kpi-breakdown">{breakdown.map(item => (
        <div key={item.key || item.label}><span>{item.label}</span><strong>{formatKpi(item.potential > 0 ? item.actual / item.potential * 100 : 0)}%</strong><small>{item.actual} / {item.potential}</small></div>
      ))}</div>}
      {comentario && <p className="kpi-card__note">{comentario}</p>}
      {onDetalleClick && <button type="button" onClick={onDetalleClick} className="kpi-detail-button" aria-haspopup="dialog" aria-label={title ? `Ver detalle de ${title}` : 'Ver detalle'}>
        <span>Ver detalle</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>
      </button>}
    </article>
  )
}
